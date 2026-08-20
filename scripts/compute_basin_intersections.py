#!/usr/bin/env python3
"""
Compute spatial intersections between cyclone tracks and sedimentary basins.

For each track, this script determines which basins are traversed by:
1. The cyclone center (at any timestep)
2. The 10 m wind maximum position (at any timestep)
3. The 100 m wind maximum position (at any timestep)

Only these three primitive sets are stored. The unions the frontend filter
needs - centre OR wind, 10 m OR 100 m - are computed there from these, so
adding a wind level means one more array per track rather than a combinatorial
explosion of precomputed unions.

The wind position is taken at the quadrant carrying the timestep maximum, using
the 'max' statistic. p99 is a detailed diagnostic and never drives the spatial
filter.

This pre-computation enables efficient spatial filtering in the web frontend
without requiring runtime geometry operations.

Input:
    site/public/data/basins.geojson       - Basin polygons
    site/public/data/summary.json         - Track summaries with coordinates
    site/public/data/wind/{year}.json     - Per-quadrant wind extrema
    site/public/data/details/{year}.json  - Cyclone centres (the wind JSON
                                            stores offsets, not absolute
                                            positions, so the centre is needed
                                            to reconstruct them)

Output:
    site/public/data/basin_intersections.json
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from shapely.geometry import Point, shape
from shapely.prepared import prep

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "site" / "public" / "data"
BASINS_PATH = DATA_DIR / "basins.geojson"
SUMMARY_PATH = DATA_DIR / "summary.json"
WIND_DIR = DATA_DIR / "wind"
DETAILS_DIR = DATA_DIR / "details"

# Prefixes of the wind levels in the JSON payload, and the key each maps to in
# the output. Adding a level here is the only change needed.
WIND_LEVELS = {"w10": "wind10", "w100": "wind100"}
OUTPUT_PATH = DATA_DIR / "basin_intersections.json"


def load_basins() -> Dict[str, dict]:
    """
    Load basin polygons and create prepared geometries for efficient spatial queries.
    
    Returns:
        Dict mapping basin_id -> {
            'geometry': PreparedGeometry,
            'bbox': (minx, miny, maxx, maxy),
            'name': str
        }
    """
    print("Loading basins...")
    with open(BASINS_PATH, 'r', encoding='utf-8') as f:
        geojson = json.load(f)
    
    basins = {}
    for feature in geojson['features']:
        basin_id = feature['id']
        geometry = shape(feature['geometry'])
        prepared_geom = prep(geometry)
        bbox = tuple(feature['properties']['bbox'])
        
        basins[basin_id] = {
            'geometry': prepared_geom,
            'raw_geometry': geometry,
            'bbox': bbox,
            'name': feature['properties']['display_name'],
        }
    
    print(f"  Loaded {len(basins)} basins")
    return basins


def point_in_any_basin(
    lon: float, 
    lat: float, 
    basins: Dict[str, dict]
) -> List[str]:
    """
    Find all basins that contain the given point.
    
    Uses bounding box pre-filtering for efficiency.
    
    Returns:
        List of basin IDs that contain the point.
    """
    point = Point(lon, lat)
    containing_basins = []
    
    for basin_id, basin_data in basins.items():
        minx, miny, maxx, maxy = basin_data['bbox']
        
        # Quick bbox check first
        if not (minx <= lon <= maxx and miny <= lat <= maxy):
            continue
        
        # Precise point-in-polygon check
        if basin_data['geometry'].contains(point):
            containing_basins.append(basin_id)
    
    return containing_basins


def load_summary_tracks() -> Tuple[List[dict], Dict[int, List[Tuple[float, float]]]]:
    """
    Load track summaries and extract center coordinates.
    
    Returns:
        (tracks_list, track_centers_dict)
        track_centers_dict: track_id -> [(lon, lat), ...]
    """
    print("Loading track summaries...")
    with open(SUMMARY_PATH, 'r', encoding='utf-8') as f:
        summary = json.load(f)
    
    tracks = summary['tracks']
    track_centers = {}
    
    for track in tracks:
        track_id = track['id']
        coords = track['coords']  # List of [lon, lat]
        track_centers[track_id] = [(c[0], c[1]) for c in coords]
    
    print(f"  Loaded {len(tracks)} tracks")
    return tracks, track_centers


def load_wind_positions(years: List[int]) -> Dict[str, Dict[int, List[Tuple[float, float]]]]:
    """
    Load the wind-maximum position at every timestep, for every level.

    The wind JSON stores quadrant entries as OFFSETS from the cyclone centre,
    so the centre is read from details/{year}.json and added back. The quadrant
    carrying the timestep maximum is the argmax of the four values - the source
    stores that as a label, but it is exactly reproducible, so the JSON omits it.

    Returns:
        {level_key: {track_id: [(lon, lat), ...]}}
    """
    print("Loading wind data...")
    positions: Dict[str, Dict[int, List[Tuple[float, float]]]] = {
        key: defaultdict(list) for key in WIND_LEVELS.values()
    }

    years_processed = 0
    for year in sorted(years):
        wind_file = WIND_DIR / f"{year}.json"
        details_file = DETAILS_DIR / f"{year}.json"
        if not wind_file.exists() or not details_file.exists():
            continue

        with open(wind_file, "r", encoding="utf-8") as f:
            wind_year = json.load(f)
        with open(details_file, "r", encoding="utf-8") as f:
            details_year = json.load(f)

        # Cyclone centre per (track, timestamp)
        centres: Dict[str, Dict[str, Tuple[float, float]]] = {}
        for tid, detail in details_year.get("tracks", {}).items():
            centres[tid] = {
                ts["date"]: (ts["lon"], ts["lat"])
                for ts in detail.get("timesteps", [])
            }

        for tid, timesteps in wind_year.get("tracks", {}).items():
            track_id = int(tid)
            track_centres = centres.get(tid, {})

            for ts_date, ts_data in timesteps.items():
                centre = track_centres.get(ts_date)
                if centre is None:
                    continue
                lon_c, lat_c = centre

                for prefix, level_key in WIND_LEVELS.items():
                    level_block = ts_data.get(prefix)
                    if not level_block:
                        continue
                    entry = level_block.get("max")
                    if not entry:
                        continue

                    # Quadrant with the timestep maximum
                    best_q, best_v = None, None
                    for quad in ("NW", "NE", "SW", "SE"):
                        q = entry.get(quad)
                        if not q or q[2] is None:
                            continue
                        if best_v is None or q[2] > best_v:
                            best_q, best_v = q, q[2]
                    if best_q is None:
                        continue

                    dlon, dlat = best_q[0], best_q[1]
                    if dlon is None or dlat is None:
                        continue
                    positions[level_key][track_id].append((lon_c + dlon, lat_c + dlat))

        years_processed += 1

    for level_key, per_track in positions.items():
        print(f"  {level_key}: {len(per_track):,} tracks with wind positions")
    print(f"  Processed {years_processed} years")

    return {k: dict(v) for k, v in positions.items()}


def compute_intersections(
    basins: Dict[str, dict],
    track_centers: Dict[int, List[Tuple[float, float]]],
    wind_positions: Dict[str, Dict[int, List[Tuple[float, float]]]],
) -> Dict[int, dict]:
    """
    Compute basin intersections for all tracks.

    Stores only the primitive sets - centre, and one per wind level. The
    frontend derives every union it needs from these.

    Returns:
        {track_id: {'center': [...], 'wind10': [...], 'wind100': [...]}}
    """
    print("Computing intersections...")

    all_track_ids = set(track_centers.keys())
    total = len(all_track_ids)

    intersections = {}
    tracks_with_basin = 0

    for i, track_id in enumerate(sorted(all_track_ids)):
        if (i + 1) % 1000 == 0:
            print(f"  Progress: {i+1}/{total} tracks")

        center_basins: Set[str] = set()
        for lon, lat in track_centers.get(track_id, []):
            center_basins.update(point_in_any_basin(lon, lat, basins))

        per_level: Dict[str, Set[str]] = {}
        for level_key in WIND_LEVELS.values():
            found: Set[str] = set()
            for lon, lat in wind_positions.get(level_key, {}).get(track_id, []):
                found.update(point_in_any_basin(lon, lat, basins))
            per_level[level_key] = found

        union = center_basins.union(*per_level.values()) if per_level else center_basins

        # Only store tracks that intersect something.
        if union:
            entry = {"center": sorted(center_basins)}
            for level_key, found in per_level.items():
                entry[level_key] = sorted(found)
            intersections[track_id] = entry
            tracks_with_basin += 1

    print(f"  Completed: {tracks_with_basin}/{total} tracks intersect at least one basin")
    return intersections


def compute_basin_statistics(
    intersections: Dict[int, dict],
    basins: Dict[str, dict],
) -> Dict[str, dict]:
    """
    Per-basin track counts, one per mode + wind-height combination.

    Keys mirror basinStatKey() in site/src/lib/filters.ts:
        center, wind_max_10, wind_max_100, wind_max_any,
        any_10, any_100, any_any

    These are dataset-wide counts, shown next to each basin in the filter, not
    counts within the currently applied filter.
    """
    height_keys = {"10": "wind10", "100": "wind100"}

    stat_keys = ["center"]
    for h in ("10", "100", "any"):
        stat_keys += [f"wind_max_{h}", f"any_{h}"]

    stats = {bid: {k: 0 for k in stat_keys} for bid in basins}

    for data in intersections.values():
        center = set(data.get("center", []))
        per_h = {
            "10": set(data.get("wind10", [])),
            "100": set(data.get("wind100", [])),
        }
        per_h["any"] = per_h["10"] | per_h["100"]

        for bid in center:
            stats[bid]["center"] += 1
        for h, wind in per_h.items():
            for bid in wind:
                stats[bid][f"wind_max_{h}"] += 1
            for bid in center | wind:
                stats[bid][f"any_{h}"] += 1

    return stats


def save_output(
    intersections: Dict[int, dict],
    basin_stats: Dict[str, dict],
    basins: Dict[str, dict],
) -> None:
    """Save intersection data to JSON."""
    
    # Convert track_id keys to strings for JSON
    tracks_data = {str(k): v for k, v in intersections.items()}
    
    # Add basin metadata
    basin_meta = {}
    for basin_id, basin_data in basins.items():
        basin_meta[basin_id] = {
            'name': basin_data['name'],
            'stats': basin_stats[basin_id],
        }
    
    output = {
        'metadata': {
            'generated': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'description': 'Pre-computed spatial intersections between cyclone tracks and sedimentary basins',
            'total_tracks_with_intersections': len(intersections),
            'basins_used': len(basins),
        },
        'basins': basin_meta,
        'tracks': tracks_data,
    }
    
    # Write minified JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))
    
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nOutput written to: {OUTPUT_PATH}")
    print(f"File size: {size_kb:.1f} KB")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Computing Basin-Track Intersections")
    print("=" * 60)
    print()
    
    try:
        # Load data
        basins = load_basins()
        tracks, track_centers = load_summary_tracks()
        
        # Get list of years from tracks
        years = sorted(set(t['year'] for t in tracks))
        wind_positions = load_wind_positions(years)
        
        # Compute intersections
        intersections = compute_intersections(basins, track_centers, wind_positions)
        
        # Compute statistics
        basin_stats = compute_basin_statistics(intersections, basins)
        
        # Print summary
        print("\nBasin intersection statistics:")
        print("-" * 78)
        print(f"{'Basin':<26} {'Center':>8} {'W10':>8} {'W100':>8} "
              f"{'Wind any':>9} {'Any':>8}")
        print("-" * 78)
        for basin_id in sorted(basins.keys()):
            st = basin_stats[basin_id]
            name = basins[basin_id]['name']
            if len(name) > 24:
                name = name[:21] + "..."
            print(f"{name:<26} {st['center']:>8} {st['wind_max_10']:>8} "
                  f"{st['wind_max_100']:>8} {st['wind_max_any']:>9} {st['any_any']:>8}")
        print("-" * 78)
        
        # Save output
        save_output(intersections, basin_stats, basins)
        
        print("\n✓ Intersection computation complete!")
        return 0
        
    except Exception as e:
        import traceback
        print(f"\n✗ Error: {e}", file=sys.stderr)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
