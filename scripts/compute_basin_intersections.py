#!/usr/bin/env python3
"""
Compute spatial intersections between cyclone tracks and sedimentary basins.

For each track, this script determines which basins are traversed by:
1. The cyclone center (at any timestep)
2. The maximum wind position (at any timestep)

This pre-computation enables efficient spatial filtering in the web frontend
without requiring runtime geometry operations.

Input:
    site/public/data/basins.geojson          - Basin polygons
    site/public/data/summary.json            - Track summaries with coordinates
    site/public/data/wind100/{year}.json     - Wind100 max positions

Output:
    site/public/data/basin_intersections.json

Author: Cyclone Monitor Team
Date: 2026-04
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
WIND100_DIR = DATA_DIR / "wind100"
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


def load_wind100_positions(years: List[int]) -> Dict[int, List[Tuple[float, float]]]:
    """
    Load wind100 maximum positions for all tracks.
    
    For each timestep, extracts the position of the global maximum wind
    (using the 'gq' field to identify the quadrant with the maximum).
    
    Returns:
        Dict mapping track_id -> [(lon, lat), ...] of max wind positions
    """
    print("Loading wind100 data...")
    wind_positions = defaultdict(list)
    
    years_processed = 0
    tracks_with_wind = 0
    
    for year in sorted(years):
        wind_file = WIND100_DIR / f"{year}.json"
        if not wind_file.exists():
            continue
        
        with open(wind_file, 'r', encoding='utf-8') as f:
            year_data = json.load(f)
        
        for track_id_str, timesteps in year_data['tracks'].items():
            track_id = int(track_id_str)
            
            for ts_date, ts_data in timesteps.items():
                # Get the 'max' metric (absolute maximum wind)
                max_data = ts_data.get('max')
                if max_data is None:
                    continue
                
                # Get the quadrant with the global maximum
                gq = max_data.get('gq')
                if gq is None:
                    continue
                
                quad_data = max_data.get(gq)
                if quad_data is None:
                    continue
                
                # quad_data is [lon, lat, wind_speed, angular_distance]
                lon, lat = quad_data[0], quad_data[1]
                wind_positions[track_id].append((lon, lat))
        
        years_processed += 1
    
    tracks_with_wind = len(wind_positions)
    print(f"  Processed {years_processed} years, {tracks_with_wind} tracks with wind100 data")
    
    return dict(wind_positions)


def compute_intersections(
    basins: Dict[str, dict],
    track_centers: Dict[int, List[Tuple[float, float]]],
    wind_positions: Dict[int, List[Tuple[float, float]]],
) -> Dict[int, dict]:
    """
    Compute basin intersections for all tracks.
    
    For each track, determines:
    - center: basins intersected by cyclone center
    - wind_max: basins intersected by maximum wind position
    - any: union of both (center OR wind_max)
    
    Returns:
        Dict mapping track_id -> {
            'center': [basin_ids...],
            'wind_max': [basin_ids...],
            'any': [basin_ids...],
        }
    """
    print("Computing intersections...")
    
    all_track_ids = set(track_centers.keys())
    total = len(all_track_ids)
    
    intersections = {}
    tracks_with_basin = 0
    
    for i, track_id in enumerate(sorted(all_track_ids)):
        if (i + 1) % 1000 == 0:
            print(f"  Progress: {i+1}/{total} tracks")
        
        # Find basins intersected by center positions
        center_basins: Set[str] = set()
        centers = track_centers.get(track_id, [])
        for lon, lat in centers:
            for basin_id in point_in_any_basin(lon, lat, basins):
                center_basins.add(basin_id)
        
        # Find basins intersected by wind max positions
        wind_basins: Set[str] = set()
        winds = wind_positions.get(track_id, [])
        for lon, lat in winds:
            for basin_id in point_in_any_basin(lon, lat, basins):
                wind_basins.add(basin_id)
        
        # Combine
        any_basins = center_basins | wind_basins
        
        # Only store if there's at least one intersection
        if any_basins:
            intersections[track_id] = {
                'center': sorted(center_basins),
                'wind_max': sorted(wind_basins),
                'any': sorted(any_basins),
            }
            tracks_with_basin += 1
    
    print(f"  Completed: {tracks_with_basin}/{total} tracks intersect at least one basin")
    return intersections


def compute_basin_statistics(
    intersections: Dict[int, dict],
    basins: Dict[str, dict],
) -> Dict[str, dict]:
    """
    Compute per-basin statistics.
    
    Returns:
        Dict mapping basin_id -> {
            'center_count': int,
            'wind_max_count': int,
            'any_count': int,
        }
    """
    stats = {basin_id: {'center_count': 0, 'wind_max_count': 0, 'any_count': 0}
             for basin_id in basins.keys()}
    
    for track_id, data in intersections.items():
        for basin_id in data['center']:
            stats[basin_id]['center_count'] += 1
        for basin_id in data['wind_max']:
            stats[basin_id]['wind_max_count'] += 1
        for basin_id in data['any']:
            stats[basin_id]['any_count'] += 1
    
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
        wind_positions = load_wind100_positions(years)
        
        # Compute intersections
        intersections = compute_intersections(basins, track_centers, wind_positions)
        
        # Compute statistics
        basin_stats = compute_basin_statistics(intersections, basins)
        
        # Print summary
        print("\nBasin intersection statistics:")
        print("-" * 60)
        print(f"{'Basin':<30} {'Center':>8} {'Wind':>8} {'Any':>8}")
        print("-" * 60)
        for basin_id in sorted(basins.keys()):
            stats = basin_stats[basin_id]
            name = basins[basin_id]['name']
            # Truncate long names
            if len(name) > 28:
                name = name[:25] + "..."
            print(f"{name:<30} {stats['center_count']:>8} {stats['wind_max_count']:>8} {stats['any_count']:>8}")
        print("-" * 60)
        
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
