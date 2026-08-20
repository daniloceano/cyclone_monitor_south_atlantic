#!/usr/bin/env python3
"""
Data Pipeline Orchestrator for South Atlantic Cyclone Monitor.

Builds the consolidated per-cyclone base, in order:

    1. Download tracks + LEC energetics from Zenodo
    2. Preprocess and validate  -> consolidated CSV (+ CPS merge)
    3. Download every wind level from Zenodo          [optional]
    4. Merge all wind levels    -> per-cyclone Parquet + cyclones.parquet
    5. Build the per-cyclone taxonomy index

Steps 3-5 are optional because the wind archives are ~360 MB and the base is
usable without them; pass --wind to run them.

The products
------------
    data/processed/tracks_south_atlantic_consolidated.csv
        Flat, one row per timestep. Feeds scripts/preprocess_data.py.

    data/processed/tracks_by_id/{Y}/{M}/{id}.parquet
        THE consolidated analysis product: one file per cyclone, one row per
        timestep, carrying track + LEC + CPS + every wind level.

    data/processed/cyclones.parquet
        One row per cyclone. Attributes that do not vary through the life cycle
        live here instead of being repeated across every timestep.

    data/processed/cyclone_categories.json
        Per-cyclone taxonomies (currently CPS): category -> track_ids.

The site's own artefacts are generated separately, from these:
    python scripts/preprocess_data.py
    python scripts/generate_wind_json.py
    python scripts/compute_basin_intersections.py

Run from project root:
    python scripts/data/run_pipeline.py --wind

Options:
    --force            Force re-download even if the source file exists
    --skip-download    Skip the download step (use the existing source file)
    --wind             Also run steps 3-5 (wind download, merge, taxonomy index)
    --skip-wind        Explicitly skip them (default behaviour)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
import subprocess
import argparse
from pathlib import Path
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = PROJECT_ROOT / "scripts" / "data"

PIPELINE_STEPS = [
    {
        "name": "Download source data",
        "script": "download_source_data.py",
        "description": "Download tracks + energetics from Zenodo",
        "skip_flag": "skip_download",
    },
    {
        "name": "Preprocess data",
        "script": "preprocess_data.py",
        "description": "Standardize columns, validate, generate consolidated CSV",
        "skip_flag": None,
    },
    {
        "name": "Download wind data",
        "script": "download_wind.py",
        "description": "Download and unpack every configured wind level from Zenodo",
        "skip_flag": "skip_wind",
    },
    {
        "name": "Merge wind data",
        "script": "merge_wind.py",
        "description": "Build the per-cyclone Parquet base and cyclones.parquet",
        "skip_flag": "skip_wind",
    },
    {
        "name": "Build cyclone taxonomy index",
        "script": "build_cyclone_categories.py",
        "description": "Per-cyclone categories (CPS) -> track_ids",
        "skip_flag": "skip_wind",
    },
]


def run_step(step: dict, skip: bool = False) -> bool:
    """
    Run a pipeline step.
    
    Returns True on success, False on failure.
    """
    script_path = SCRIPTS_DIR / step["script"]
    
    if skip:
        print(f"  ⏭ Skipped (--{step['skip_flag']})")
        return True
    
    if not script_path.exists():
        print(f"  ✗ Script not found: {script_path}")
        return False
    
    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=PROJECT_ROOT,
    )
    
    if result.returncode != 0:
        print(f"  ✗ Failed with exit code {result.returncode}")
        return False
    
    return True


def main() -> int:
    """Run the complete data pipeline."""
    parser = argparse.ArgumentParser(
        description="Run the data pipeline for South Atlantic Cyclone Monitor"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download even if source file exists",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        dest="skip_download",
        help="Skip download step (use existing source file)",
    )
    parser.add_argument(
        "--wind",
        action="store_true",
        help="Also run the wind download, the merge and the taxonomy index",
    )
    args = parser.parse_args()

    # The wind steps are skipped unless --wind is given
    args.skip_wind = not args.wind
    
    print("\n" + "=" * 70)
    print("South Atlantic Cyclone Monitor — Data Pipeline")
    print("=" * 70)
    print(f"\nStarted: {datetime.now():%Y-%m-%d %H:%M:%S}")
    print(f"Project root: {PROJECT_ROOT}")
    print()
    
    # Handle --force flag
    if args.force:
        source_file = PROJECT_ROOT / "data" / "raw" / "tracks_SAt_source.csv"
        if source_file.exists():
            print(f"  --force: Removing existing source file")
            source_file.unlink()
    
    # Run pipeline steps
    results = []
    
    for i, step in enumerate(PIPELINE_STEPS, 1):
        print(f"\n{'─' * 70}")
        print(f"Step {i}/{len(PIPELINE_STEPS)}: {step['name']}")
        print(f"{'─' * 70}")
        print(f"  {step['description']}")
        print()
        
        # Check if step should be skipped
        skip = False
        if step["skip_flag"] and getattr(args, step["skip_flag"], False):
            skip = True
        
        success = run_step(step, skip=skip)
        results.append((step["name"], success))
        
        if not success:
            break
    
    # Summary
    print("\n" + "=" * 70)
    print("Pipeline Summary")
    print("=" * 70)
    
    all_success = True
    for name, success in results:
        status = "✓" if success else "✗"
        print(f"  {status} {name}")
        if not success:
            all_success = False
    
    print()
    print(f"Finished: {datetime.now():%Y-%m-%d %H:%M:%S}")
    
    if all_success:
        print("\n✓ Pipeline completed successfully")
        print()
        print("Output files:")
        consolidated = PROJECT_ROOT / "data" / "processed" / "tracks_south_atlantic_consolidated.csv"
        if consolidated.exists():
            size_mb = consolidated.stat().st_size / (1024 * 1024)
            print(f"  {consolidated}")
            print(f"  Size: {size_mb:.1f} MB")
        tracks_dir = PROJECT_ROOT / "data" / "processed" / "tracks_by_id"
        if tracks_dir.exists():
            n_parquet = len(list(tracks_dir.rglob("*.parquet")))
            if n_parquet > 0:
                print(f"  {tracks_dir}")
                print(f"  Per-track Parquet files: {n_parquet:,}")
        print()
        print("Next steps:")
        print("  1. Generate web app JSON:")
        print("     python scripts/preprocess_data.py")
        print()
        print("  2. Merge the wind levels (if not already done):")
        print("     python scripts/data/run_pipeline.py --skip-download --wind")
        print()
        print("  3. Run web app locally:")
        print("     cd site && npm install && npm run dev")
        return 0
    else:
        print("\n✗ Pipeline failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
