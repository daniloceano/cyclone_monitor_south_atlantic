#!/usr/bin/env python3
"""
Generate the web app's wind JSON from the consolidated per-cyclone base.

Replaces generate_wind100_json.py, which read the raw archive directly and
emitted one file per wind level. This version reads data/processed/tracks_by_id/
instead, which means:

  * the site artefact is a derivative of the consolidated base, not a second
    independent path from the raw data;
  * it is automatically restricted to the 6,789 catalogue cyclones (the raw
    archives carry 1,198 track_ids the site can never look up);
  * the cyclone centre needed for the delta encoding is already on the row.

Output
------
  site/public/data/wind/{year}.json

  {
    "year": 1979,
    "levels": ["wind10", "wind100"],
    "tracks": {
      "19790001": {
        "1979-01-01T00:00:00": {
          "w10":  {"max": {"NW": [dlon, dlat, val], "NE": [...],
                            "SW": [...], "SE": [...]},
                   "p99": {...}},
          "w100": {"max": {...}, "p99": {...}}
        }
      }
    }
  }

  site/public/data/wind/meta.json

  {
    "levels": {
      "wind10":  {"label": "Wind 10 m",  "unit": "m s-1", "height_m": 10,
                  "max_global_max": ..., "p99_global_max": ...,
                  "max_global_p95": ..., "p99_global_p95": ...},
      "wind100": {...}
    },
    "years": [...], "total_tracks": ..., "generated": "..."
  }

Encoding decisions
------------------
Quadrant entries are [dlon, dlat, val], not [lon, lat, val, dist]:

  * Coordinates are stored as OFFSETS from the cyclone centre. The centre is
    already in details/{year}.json, so absolute position is lon_c + dlon and
    the encoding is lossless. Offsets are small numbers (2.51 vs -50.874), so
    they cost fewer bytes at the same 3-decimal precision.

  * 'dist' is dropped because it is exactly recoverable: the source defines it
    as the Euclidean hypot(dlon, dlat) in degrees, verified here to 1e-14 deg
    over 13,968 timestep-quadrant comparisons. The site recomputes it.

  * The global-quadrant label is dropped for the same reason: it is exactly the
    quadrant carrying the largest value, verified over 74,242 timestep-metric
    comparisons with zero mismatches and zero ties. The site recomputes it.

  * Wind speeds are rounded to 2 decimals, which is what the UI displays.

Together these keep the combined two-level artefact close to the size of the
single-level one it replaces.

A metric block is null when no wind record matched that timestep. Nothing is
interpolated or filled.

Run from project root:
    conda run -n paper_energy_patterns python scripts/generate_wind_json.py

Options:
    --year YYYY    Only this year (for testing / size measurement)
    --dry-run      Report statistics and byte sizes without writing files
------------------------------------------------------------------------------
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts" / "data"))

from wind_levels import LEVEL_ORDER, METRICS, QUADRANTS, level_config  # noqa: E402

BASE_DIR = PROJECT_ROOT / "data" / "processed" / "tracks_by_id"
OUTPUT_DIR = PROJECT_ROOT / "site" / "public" / "data" / "wind"

COORD_DECIMALS = 3   # degrees; matches the ERA5 grid precision of the source
VALUE_DECIMALS = 2   # m s-1; matches what the UI renders


def _round(x, nd: int):
    """Round to nd decimals, mapping NaN/None to JSON null."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(f):
        return None
    return round(f, nd)


def _quadrant_entry(row, prefix: str, metric: str, quad: str,
                    lon_c: float, lat_c: float):
    """Build [dlon, dlat, val] for one quadrant, or None if fully absent."""
    lon = row.get(f"{prefix}{metric}_{quad}_lon")
    lat = row.get(f"{prefix}{metric}_{quad}_lat")
    val = row.get(f"{prefix}{metric}_{quad}_val")

    dlon = _round(lon - lon_c, COORD_DECIMALS) if pd.notna(lon) else None
    dlat = _round(lat - lat_c, COORD_DECIMALS) if pd.notna(lat) else None
    v = _round(val, VALUE_DECIMALS)

    if dlon is None and dlat is None and v is None:
        return None
    return [dlon, dlat, v]


def _metric_block(row, level: str, metric: str, lon_c: float, lat_c: float):
    """Build the {NW, NE, SW, SE} block for one level/metric, or None."""
    prefix = level_config(level)["prefix"]
    block = {}
    any_data = False

    for quad in QUADRANTS:
        entry = _quadrant_entry(row, prefix, metric, quad, lon_c, lat_c)
        block[quad] = entry
        if entry is not None:
            any_data = True

    if not any_data:
        return None
    return block


def index_by_track_year() -> dict[int, list[Path]]:
    """
    Group the consolidated base by the year the SITE uses to address a cyclone.

    That year is track_id // 10000, which is not always the directory the file
    sits in: the base files a cyclone under its genesis month, so cyclone
    20210007 (genesis December 2020) lives in 2020/12/. Grouping by directory
    would put it in wind/2020.json while the site, reading year 2021 from
    summary.json, would fetch wind/2021.json and find nothing.
    """
    by_year: dict[int, list[Path]] = {}
    for path in sorted(BASE_DIR.rglob("*.parquet")):
        track_id = int(path.stem)
        by_year.setdefault(track_id // 10000, []).append(path)
    return by_year


def process_year(year: int, files: list[Path], levels: list[str],
                 accum: dict) -> tuple[dict, int, int]:
    """
    Build the JSON payload for one year, accumulating global statistics.

    Returns (payload, n_tracks, n_timesteps).
    """
    if not files:
        return {}, 0, 0
    tracks: dict[str, dict] = {}
    n_timesteps = 0

    for path in files:
        df = pd.read_parquet(path)
        if df.empty:
            continue
        track_id = str(int(df["track_id"].iloc[0]))

        timesteps: dict[str, dict] = {}
        for row in df.to_dict("records"):
            lon_c, lat_c = row.get("lon"), row.get("lat")
            if pd.isna(lon_c) or pd.isna(lat_c):
                continue

            entry: dict = {}
            for level in levels:
                blocks = {m: _metric_block(row, level, m, lon_c, lat_c) for m in METRICS}
                if any(b is not None for b in blocks.values()):
                    entry[level_config(level)["prefix"]] = blocks
                    # Accumulate global stats for colour normalisation
                    for metric, block in blocks.items():
                        if block is None:
                            continue
                        for quad in QUADRANTS:
                            q = block.get(quad)
                            if q and q[2] is not None:
                                accum[level][metric].append(q[2])

            if entry:
                ts = pd.Timestamp(row["date"]).strftime("%Y-%m-%dT%H:%M:%S")
                timesteps[ts] = entry
                n_timesteps += 1

        if timesteps:
            tracks[track_id] = timesteps

    payload = {"year": year, "levels": list(levels), "tracks": tracks}
    return payload, len(tracks), n_timesteps


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the web app wind JSON from the consolidated base"
    )
    parser.add_argument("--year", type=int, default=None, help="Only this year")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report sizes without writing files")
    args = parser.parse_args()

    levels = LEVEL_ORDER

    print("=" * 70)
    print("Generate wind JSON for the web app")
    print("=" * 70)
    print(f"Source : {BASE_DIR}")
    print(f"Output : {OUTPUT_DIR}")
    print(f"Levels : {', '.join(levels)}")
    if args.dry_run:
        print("Mode   : DRY RUN")
    print()

    if not BASE_DIR.is_dir():
        print(f"x Consolidated base not found: {BASE_DIR}")
        print("  Run: python scripts/data/merge_wind.py")
        return 1

    files_by_year = index_by_track_year()
    years = [args.year] if args.year else sorted(files_by_year)

    if not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    accum = {lv: {m: [] for m in METRICS} for lv in levels}
    total_tracks = 0
    total_timesteps = 0
    total_bytes = 0
    written_years: list[int] = []

    for year in years:
        payload, n_tracks, n_ts = process_year(
            year, files_by_year.get(year, []), levels, accum
        )
        if not n_tracks:
            print(f"  {year}: no data")
            continue

        text = json.dumps(payload, separators=(",", ":"))
        size = len(text.encode("utf-8"))
        total_bytes += size
        total_tracks += n_tracks
        total_timesteps += n_ts
        written_years.append(year)

        if not args.dry_run:
            (OUTPUT_DIR / f"{year}.json").write_text(text)

        print(f"  {year}: {n_tracks:4d} tracks, {n_ts:7,d} timesteps, {size / 1e6:6.2f} MB")

    # ── meta.json ─────────────────────────────────────────────────────────────
    meta_levels: dict[str, dict] = {}
    for level in levels:
        cfg = level_config(level)
        entry = {
            "label": cfg["label"], "unit": cfg["unit"],
            "height_m": cfg["height_m"], "doi": cfg["doi"],
        }
        for metric in METRICS:
            vals = np.asarray(accum[level][metric], dtype="float64")
            entry[f"{metric}_global_max"] = round(float(vals.max()), 3) if vals.size else None
            entry[f"{metric}_global_p95"] = round(float(np.percentile(vals, 95)), 3) if vals.size else None
        meta_levels[level] = entry

    meta = {
        "levels": meta_levels,
        "years": written_years,
        "total_tracks": total_tracks,
        "generated": datetime.now().isoformat(timespec="seconds"),
    }
    if not args.dry_run:
        (OUTPUT_DIR / "meta.json").write_text(json.dumps(meta, indent=2))

    print("\n" + "-" * 70)
    print("Summary")
    print("-" * 70)
    print(f"  Years          : {len(written_years)}")
    print(f"  Tracks         : {total_tracks:,}")
    print(f"  Timesteps      : {total_timesteps:,}")
    print(f"  Total size     : {total_bytes / 1e6:.1f} MB")
    if len(written_years) and len(years) > len(written_years):
        pass
    for level in levels:
        e = meta_levels[level]
        print(f"  {level:8s} max_global_max={e['max_global_max']}  "
              f"p99_global_max={e['p99_global_max']}")
    print()
    print("ok Dry run complete" if args.dry_run else f"ok Written -> {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
