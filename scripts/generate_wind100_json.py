#!/usr/bin/env python3
"""
Generate wind100 JSON files for the South Atlantic Cyclone Monitor web site.

Reads per-cyclone wind100 CSV files from data/raw/wind100/ and produces:
  - site/public/data/wind100/{year}.json   — per-year data, keyed by track_id
                                             and ISO timestamp
  - site/public/data/wind100/meta.json     — global statistics for color
                                             normalization on the site

Output JSON structure
---------------------

  {year}.json:
  {
    "year": 1979,
    "tracks": {
      "19790001": {
        "1979-01-01T00:00:00": {
          "max": {"NW":[lon,lat,val,dist], "NE":[...], "SW":[...], "SE":[...], "gq":"NE"},
          "p99": {"NW":[...], ...,                                               "gq":"SE"}
        },
        "1979-01-01T01:00:00": { ... }
      }
    }
  }

  Each quadrant array is [lon, lat, val, dist] (all float, rounded to 3 dp).
  "gq" = global_quad (the quadrant with the timestep-maximum).
  A metric block is null if the corresponding CSV file was absent.

  meta.json:
  {
    "max_global_max": 52.34,
    "p99_global_max": 48.71,
    "max_global_p95": 38.10,
    "p99_global_p95": 35.22,
    "years": [1979, ..., 2021],
    "total_tracks": 7987,
    "generated": "2026-04-01T12:00:00"
  }

Notes
-----
- Timestamps are converted from "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS"
  (T-separator, no timezone) to match the 'date' field in details/{year}.json.
- NaN values in CSV cells are propagated as null in JSON.
- Tracks present in wind100 but absent from the main LEC dataset are included;
  the site will just never look them up.
- Year 2021 is present locally despite the Zenodo record stating 1979–2020.
  It is included as received (see data/README.md §wind100 notes).

Run from project root:
  conda run -n data python scripts/generate_wind100_json.py

Options:
  --year YYYY    Process only this year (for testing)
  --dry-run      Report statistics without writing any files

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# ─── Paths ────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WIND100_DIR  = PROJECT_ROOT / "data" / "raw" / "wind100"
OUTPUT_DIR   = PROJECT_ROOT / "site" / "public" / "data" / "wind100"

# ─── Column mappings ──────────────────────────────────────────────────────────

QUADRANTS = ["NW", "NE", "SW", "SE"]

# For _max files: source column name for [lon, lat, val, dist] per quadrant
MAX_COLS = {
    qd: [f"{qd}_lo_max_wind100", f"{qd}_la_max_wind100",
          f"{qd}_mx_max_wind100", f"{qd}_dis_max_wind100"]
    for qd in QUADRANTS
}
MAX_GQ_COL = "mx_mx_max"

# For _p99 files: source column name for [lon, lat, val, dist] per quadrant
P99_COLS = {
    qd: [f"{qd}_lo_p99_wind100", f"{qd}_la_p99_wind100",
          f"{qd}_mx_p99_wind100", f"{qd}_dis_p99_wind100"]
    for qd in QUADRANTS
}
P99_GQ_COL = "mx_mx_p99"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ts_to_iso(ts_str: str) -> str:
    """Convert "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"."""
    return ts_str.replace(" ", "T")


def _safe(v) -> float | None:
    """Return None if v is NaN, else round to 3 decimal places."""
    if v is None:
        return None
    try:
        f = float(v)
        if np.isnan(f):
            return None
        return round(f, 3)
    except (TypeError, ValueError):
        return None


def _read_wind100_file(path: Path, col_map: dict, gq_col: str) -> dict | None:
    """
    Read one wind100 CSV and return a dict keyed by ISO timestamp.

    Returns None if the file cannot be read.

    Dict structure:
        {
            "YYYY-MM-DDTHH:MM:SS": {
                "NW": [lon, lat, val, dist] or null,
                "NE": [...],
                "SW": [...],
                "SE": [...],
                "gq": "NE"
            }
        }
    """
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        print(f"  ✗ Cannot read {path.name}: {exc}")
        return None

    result: dict = {}

    for _, row in df.iterrows():
        raw_ts = str(row.get("timestamp", ""))
        if not raw_ts or raw_ts == "nan":
            continue
        iso_ts = _ts_to_iso(raw_ts)

        entry: dict = {}
        for qd, cols in col_map.items():
            lo, la, mx, dis = [_safe(row.get(c)) for c in cols]
            if lo is None and la is None and mx is None and dis is None:
                entry[qd] = None
            else:
                entry[qd] = [lo, la, mx, dis]

        # global_quad
        gq_raw = row.get(gq_col, "")
        entry["gq"] = str(gq_raw).strip() if gq_raw == gq_raw else None

        result[iso_ts] = entry

    return result if result else None


def process_year(year: int, year_dir: Path) -> tuple[dict, dict]:
    """
    Process all wind100 CSV files for one year.

    Returns:
        year_json  — dict ready to be serialised as {year}.json
        year_stats — {"max_vals": [...], "p99_vals": [...], "n_tracks": int, "n_files": int}
    """
    year_json: dict = {"year": year, "tracks": {}}
    all_max_vals: list[float] = []
    all_p99_vals: list[float] = []
    n_files = 0
    seen_tracks: set[int] = set()

    # Collect max/p99 file pairs
    max_files: dict[int, Path] = {}
    p99_files: dict[int, Path] = {}

    for csv_file in sorted(year_dir.iterdir()):
        if not csv_file.is_file() or csv_file.suffix != ".csv":
            continue
        name = csv_file.stem
        if name.endswith("_wind100_max"):
            tid = int(name.replace("_wind100_max", ""))
            max_files[tid] = csv_file
            n_files += 1
        elif name.endswith("_wind100_p99"):
            tid = int(name.replace("_wind100_p99", ""))
            p99_files[tid] = csv_file
            n_files += 1

    # Merge per track
    all_track_ids = sorted(set(max_files) | set(p99_files))
    for tid in all_track_ids:
        seen_tracks.add(tid)
        tid_str = str(tid)

        # Read max
        max_data: dict | None = None
        if tid in max_files:
            max_data = _read_wind100_file(max_files[tid], MAX_COLS, MAX_GQ_COL)
            if max_data:
                for entry in max_data.values():
                    for qd in QUADRANTS:
                        q = entry.get(qd)
                        if q and q[2] is not None:
                            all_max_vals.append(q[2])

        # Read p99
        p99_data: dict | None = None
        if tid in p99_files:
            p99_data = _read_wind100_file(p99_files[tid], P99_COLS, P99_GQ_COL)
            if p99_data:
                for entry in p99_data.values():
                    for qd in QUADRANTS:
                        q = entry.get(qd)
                        if q and q[2] is not None:
                            all_p99_vals.append(q[2])

        # Merge by timestamp
        all_timestamps = sorted(
            set(max_data.keys() if max_data else []) |
            set(p99_data.keys() if p99_data else [])
        )

        track_dict: dict = {}
        for ts in all_timestamps:
            track_dict[ts] = {
                "max": max_data.get(ts) if max_data else None,
                "p99": p99_data.get(ts) if p99_data else None,
            }

        year_json["tracks"][tid_str] = track_dict

    year_stats = {
        "max_vals": all_max_vals,
        "p99_vals": all_p99_vals,
        "n_tracks": len(seen_tracks),
        "n_files": n_files,
    }

    return year_json, year_stats


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate wind100 JSON files for the Cyclone Monitor site"
    )
    parser.add_argument("--year", type=int, default=None, metavar="YYYY",
                        help="Process only this year (for testing)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report statistics without writing any files")
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("Wind100 → JSON Generation")
    print("=" * 70)
    print(f"Started  : {datetime.now():%Y-%m-%d %H:%M:%S}")
    if args.dry_run:
        print("Mode     : DRY RUN (no files written)")
    if args.year:
        print(f"Filter   : year = {args.year}")
    print()

    t_start = datetime.now()

    # Discover year directories
    if not WIND100_DIR.is_dir():
        print(f"✗ wind100 directory not found: {WIND100_DIR}")
        return 1

    year_dirs: list[tuple[int, Path]] = []
    for d in sorted(WIND100_DIR.iterdir()):
        if d.is_dir() and d.name.endswith("_wind100"):
            try:
                yr = int(d.name.replace("_wind100", ""))
            except ValueError:
                continue
            if args.year and yr != args.year:
                continue
            year_dirs.append((yr, d))

    if not year_dirs:
        print("✗ No wind100 year directories found.")
        return 1

    print(f"Processing {len(year_dirs)} year(s): {[yr for yr, _ in year_dirs]}")
    print()

    if not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Accumulate global stats
    global_max_vals: list[float] = []
    global_p99_vals: list[float] = []
    total_tracks = 0
    total_files = 0
    years_processed: list[int] = []

    for yr, year_dir in year_dirs:
        print(f"  [{yr}] processing ...", end=" ", flush=True)
        year_json, stats = process_year(yr, year_dir)

        global_max_vals.extend(stats["max_vals"])
        global_p99_vals.extend(stats["p99_vals"])
        total_tracks += stats["n_tracks"]
        total_files += stats["n_files"]
        years_processed.append(yr)

        if not args.dry_run:
            out_path = OUTPUT_DIR / f"{yr}.json"
            with open(out_path, "w") as f:
                json.dump(year_json, f, separators=(",", ":"))
            size_kb = out_path.stat().st_size / 1024
            print(f"✓  {stats['n_tracks']} tracks, {stats['n_files']} files → {size_kb:.0f} KB")
        else:
            print(f"(dry)  {stats['n_tracks']} tracks, {stats['n_files']} files")

    # Global statistics
    max_global_max = float(np.max(global_max_vals)) if global_max_vals else 0.0
    p99_global_max = float(np.max(global_p99_vals)) if global_p99_vals else 0.0
    max_global_p95 = float(np.percentile(global_max_vals, 95)) if global_max_vals else 0.0
    p99_global_p95 = float(np.percentile(global_p99_vals, 95)) if global_p99_vals else 0.0

    meta = {
        "max_global_max": round(max_global_max, 3),
        "p99_global_max": round(p99_global_max, 3),
        "max_global_p95": round(max_global_p95, 3),
        "p99_global_p95": round(p99_global_p95, 3),
        "years": years_processed,
        "total_tracks": total_tracks,
        "generated": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }

    if not args.dry_run:
        meta_path = OUTPUT_DIR / "meta.json"
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
        print(f"\n  meta.json written: {meta_path}")

    elapsed = (datetime.now() - t_start).total_seconds()

    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    print(f"  Years processed      : {len(years_processed)} ({years_processed[0]}–{years_processed[-1]})")
    print(f"  Unique track IDs     : {total_tracks:,}")
    print(f"  CSV files read       : {total_files:,}")
    print(f"  wind100_max global max: {max_global_max:.2f} m s⁻¹")
    print(f"  wind100_max p95      : {max_global_p95:.2f} m s⁻¹")
    print(f"  wind100_p99 global max: {p99_global_max:.2f} m s⁻¹")
    print(f"  wind100_p99 p95      : {p99_global_p95:.2f} m s⁻¹")
    if "2021" in [str(y) for y in years_processed]:
        n2021 = next((len(d["tracks"]) for y, d in [(yr, process_year(yr, yd)[0]) for yr, yd in year_dirs if yr == 2021]), 0) if args.dry_run else sum(1 for f in (WIND100_DIR / "2021_wind100").iterdir() if f.suffix == ".csv") // 2
        print(f"  Note: 2021 data present ({n2021} track(s)); Zenodo record states 1979–2020.")
    print(f"  Elapsed              : {elapsed:.1f} s")
    if args.dry_run:
        print("\n  (dry run — no files written)")
    else:
        print(f"\n  Output directory: {OUTPUT_DIR}")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
