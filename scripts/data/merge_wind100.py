#!/usr/bin/env python3
"""
Merge wind100 data into per-cyclone Parquet files.

Overview
--------
This script integrates the 100 m wind statistics (wind100) dataset with the
main cyclone track + LEC energetics data, producing one Parquet file per
cyclone track.

Pipeline steps
--------------
  1. Load the consolidated main CSV
     (data/processed/tracks_south_atlantic_consolidated.csv).
     If it is absent, attempt to generate it by running preprocess_data.py
     against data/raw/tracks_SAt_source.csv.

  2. Index all wind100 CSV files under data/raw/wind100/, building a lookup
     from track_id → {max: Path, p99: Path}.

  3. For each track_id in the main dataset:
       a. Slice the main data rows for that track.
       b. Load wind100_max file if available; standardise column names.
       c. Load wind100_p99 file if available; standardise column names.
       d. LEFT-merge wind100 onto main data by timestamp (date ↔ timestamp).
          Every main-data timestep is preserved; wind100 columns are NaN where
          no matching wind100 record exists.
       e. Drop the duplicate 'timestamp' column introduced by the merge.

  4. Write each merged track to:
         data/processed/tracks_by_id/{YYYY}/{MM:02d}/{track_id}.parquet
     where YYYY and MM come from the track's FIRST timestep.

  5. Print and save a validation/coverage report to:
         data/processed/tracks_by_id/merge_report.txt

Output format: Parquet (pyarrow)
---------------------------------
Parquet is chosen over CSV because:
  - ~5-10× smaller on disk for float-heavy columnar data (tested: ~15 KB vs
    ~120 KB per typical track at 100 timesteps × 66 columns).
  - Preserves dtypes natively (datetime, float32/64, nullable int, string);
    no re-parsing required.
  - Columnar layout: reading a single variable across many files is fast
    without loading the full row set.
  - pyarrow (available in the 'data' conda environment) reads/writes it
    without configuration.

Merge strategy
--------------
- Join key: track_id (context) + date/timestamp (explicit).
- Join type: LEFT join from main data. No main-data rows are dropped.
- Timezone: both datasets are UTC-naive (no tz attached). No conversion is
  applied. If future ingestion adds tz-awareness, both sides must be aligned
  before merging.
- Wind100 timestamps that have no corresponding main-data row are silently
  discarded (expected: wind100 may cover slightly different intervals).
- When wind100 data are absent for a track, the wind100 columns are filled
  with NaN (pd.NA for object, np.nan for float).

Column schema (74 columns per output file)
------------------------------------------
  From main data (40):
    track_id, date, lon, lat, vor42, lec_original, region, period,
    cps_original, cps_class, cps_B, cps_VTL, cps_VTU, cps_size_km,
    cps_dir, cps_over_ocean,
    Az, Ae, Kz, Ke, Cz, Ca, Ck, Ce,
    BAz, BAe, BKz, BKe, BΦZ, BΦE, Gz, Ge,
    dAzdt, dAedt, dKzdt, dKedt, RGz, RGe, RKz, RKe

  The cps_* block is present only when data/raw/cps_parameters_SAt.csv was
  available at preprocessing time; without it the file has 66 columns.

  From wind100_max (17):
    w100max_{QD}_lon, w100max_{QD}_lat, w100max_{QD}_val, w100max_{QD}_dist
    (for QD in NW, NE, SW, SE) + w100max_global_quad

  From wind100_p99 (17):
    w100p99_{QD}_lon, w100p99_{QD}_lat, w100p99_{QD}_val, w100p99_{QD}_dist
    (for QD in NW, NE, SW, SE) + w100p99_global_quad

Run from project root
---------------------
    conda run -n data python scripts/data/merge_wind100.py

Options
-------
    --dry-run     Index files and report coverage without writing any output.
    --year YYYY   Process only tracks whose first timestep falls in year YYYY.
    --limit N     Process at most N tracks (useful for testing).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# ─── Path setup ───────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DATA = PROJECT_ROOT / "scripts" / "data"

MAIN_CSV = PROJECT_ROOT / "data" / "processed" / "tracks_south_atlantic_consolidated.csv"
SOURCE_CSV = PROJECT_ROOT / "data" / "raw" / "tracks_SAt_source.csv"
WIND100_DIR = PROJECT_ROOT / "data" / "raw" / "wind100"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed" / "tracks_by_id"
REPORT_FILE = OUTPUT_DIR / "merge_report.txt"

# ─── Import wind100 loader ────────────────────────────────────────────────────

sys.path.insert(0, str(PROJECT_ROOT))
from scripts.data.load_wind100 import (
    WIND100_MAX_COLS,
    WIND100_P99_COLS,
    index_wind100_files,
    load_wind100_file,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _add_nan_wind100_cols(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Add wind100 columns filled with NaN when no file is available."""
    for col in cols:
        if col not in df.columns:
            if col.endswith("_quad"):
                df[col] = pd.NA
            else:
                df[col] = np.nan
    return df


def _merge_wind100_onto_track(
    main_slice: pd.DataFrame,
    wind100_files: dict[str, Path],
) -> tuple[pd.DataFrame, dict]:
    """
    Merge wind100_max and wind100_p99 onto a single-track main-data slice.

    Parameters
    ----------
    main_slice : DataFrame
        Rows from the consolidated main CSV for one track_id.
        Must have a 'date' column (datetime, UTC-naive).
    wind100_files : dict
        Dict with optional keys 'max' and/or 'p99' pointing to CSV paths.

    Returns
    -------
    merged : DataFrame
        main_slice augmented with standardised wind100 columns.
    stats : dict
        Merge statistics for reporting.
    """
    stats = {
        "n_main_timesteps": len(main_slice),
        "max_file_found": False,
        "p99_file_found": False,
        "max_matched_timesteps": 0,
        "p99_matched_timesteps": 0,
        "max_extra_timestamps": 0,  # wind100 rows with no main counterpart
        "p99_extra_timestamps": 0,
        "max_duplicate_timestamps": False,
        "p99_duplicate_timestamps": False,
        "merge_errors": [],
    }

    df = main_slice.copy().reset_index(drop=True)

    # ── wind100_max ────────────────────────────────────────────────────────────
    max_path = wind100_files.get("max")
    if max_path is not None:
        stats["max_file_found"] = True
        try:
            w_max = load_wind100_file(max_path, "max")

            # Check for duplicate timestamps in wind100 file
            if w_max["timestamp"].duplicated().any():
                stats["max_duplicate_timestamps"] = True

            # Count extra timestamps (wind100 has but main does not)
            main_dates = set(df["date"])
            wind100_dates = set(w_max["timestamp"])
            stats["max_extra_timestamps"] = len(wind100_dates - main_dates)

            # LEFT join: preserve all main rows
            df = df.merge(w_max, left_on="date", right_on="timestamp", how="left")
            df = df.drop(columns=["timestamp"], errors="ignore")

            stats["max_matched_timesteps"] = df["w100max_NW_val"].notna().sum()

        except Exception as exc:
            stats["merge_errors"].append(f"max: {exc}")
            df = _add_nan_wind100_cols(df, WIND100_MAX_COLS)
    else:
        df = _add_nan_wind100_cols(df, WIND100_MAX_COLS)

    # ── wind100_p99 ────────────────────────────────────────────────────────────
    p99_path = wind100_files.get("p99")
    if p99_path is not None:
        stats["p99_file_found"] = True
        try:
            w_p99 = load_wind100_file(p99_path, "p99")

            if w_p99["timestamp"].duplicated().any():
                stats["p99_duplicate_timestamps"] = True

            main_dates = set(df["date"])
            wind100_dates = set(w_p99["timestamp"])
            stats["p99_extra_timestamps"] = len(wind100_dates - main_dates)

            df = df.merge(w_p99, left_on="date", right_on="timestamp", how="left")
            df = df.drop(columns=["timestamp"], errors="ignore")

            stats["p99_matched_timesteps"] = df["w100p99_NW_val"].notna().sum()

        except Exception as exc:
            stats["merge_errors"].append(f"p99: {exc}")
            df = _add_nan_wind100_cols(df, WIND100_P99_COLS)
    else:
        df = _add_nan_wind100_cols(df, WIND100_P99_COLS)

    # Sanity: row count must not have changed (LEFT join)
    assert len(df) == stats["n_main_timesteps"], (
        f"LEFT join changed row count: {stats['n_main_timesteps']} → {len(df)}"
    )

    return df, stats


def _output_path(track_id: int, first_date: pd.Timestamp) -> Path:
    """
    Build the output Parquet path for a given track.

    Directory: data/processed/tracks_by_id/{YYYY}/{MM:02d}/
    File:      {track_id}.parquet

    The year and month are derived from the track's FIRST timestep.
    Tracks that span multiple months are still filed under the month of genesis.
    """
    return OUTPUT_DIR / f"{first_date.year}" / f"{first_date.month:02d}" / f"{track_id}.parquet"


# ─── Main ─────────────────────────────────────────────────────────────────────

def load_main_data() -> pd.DataFrame:
    """
    Load consolidated main CSV.

    Falls back to running preprocess_data.py if the CSV is absent but the raw
    source file exists.
    """
    if MAIN_CSV.exists():
        print(f"  Loading {MAIN_CSV.name} ...")
        df = pd.read_csv(MAIN_CSV, parse_dates=["date"])
        print(f"  Loaded {len(df):,} rows, {df['track_id'].nunique():,} tracks")
        return df

    # Fallback: run preprocessing if raw source exists
    if SOURCE_CSV.exists() or (PROJECT_ROOT / "data" / "raw" / "tracks_SAt_filtered_with_energetics.csv").exists():
        effective_source = SOURCE_CSV if SOURCE_CSV.exists() else PROJECT_ROOT / "data" / "raw" / "tracks_SAt_filtered_with_energetics.csv"
        print(f"\n  Consolidated CSV not found. Running preprocessing from {effective_source.name} ...")
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DATA / "preprocess_data.py")],
            cwd=PROJECT_ROOT,
        )
        if result.returncode != 0:
            print("  ✗ Preprocessing failed. Cannot continue.")
            sys.exit(1)
        df = pd.read_csv(MAIN_CSV, parse_dates=["date"])
        print(f"  Loaded {len(df):,} rows, {df['track_id'].nunique():,} tracks")
        return df

    print("\n✗ Neither consolidated CSV nor raw source CSV found.")
    print("  Run: python scripts/data/run_pipeline.py --skip-download")
    print("  (or provide data/raw/tracks_SAt_source.csv)")
    sys.exit(1)


def generate_report(
    stats_per_track: list[dict],
    wind100_index: dict,
    main_track_ids: set[int],
    elapsed_seconds: float,
) -> str:
    """Build the full validation/coverage report string."""

    total_main = len(main_track_ids)
    total_wind100 = len(wind100_index)

    wind100_track_ids = set(wind100_index.keys())
    tracks_in_both = main_track_ids & wind100_track_ids
    tracks_only_main = main_track_ids - wind100_track_ids
    tracks_only_wind100 = wind100_track_ids - main_track_ids

    # Aggregate per-track stats
    total_timesteps = sum(s["n_main_timesteps"] for s in stats_per_track)
    total_max_matched = sum(s["max_matched_timesteps"] for s in stats_per_track)
    total_p99_matched = sum(s["p99_matched_timesteps"] for s in stats_per_track)

    tracks_full_max = sum(
        1 for s in stats_per_track
        if s["max_file_found"] and s["max_matched_timesteps"] == s["n_main_timesteps"]
    )
    tracks_partial_max = sum(
        1 for s in stats_per_track
        if s["max_file_found"] and 0 < s["max_matched_timesteps"] < s["n_main_timesteps"]
    )
    tracks_no_max = sum(1 for s in stats_per_track if not s["max_file_found"])

    tracks_full_p99 = sum(
        1 for s in stats_per_track
        if s["p99_file_found"] and s["p99_matched_timesteps"] == s["n_main_timesteps"]
    )
    tracks_partial_p99 = sum(
        1 for s in stats_per_track
        if s["p99_file_found"] and 0 < s["p99_matched_timesteps"] < s["n_main_timesteps"]
    )
    tracks_no_p99 = sum(1 for s in stats_per_track if not s["p99_file_found"])

    extra_max = sum(s["max_extra_timestamps"] for s in stats_per_track)
    extra_p99 = sum(s["p99_extra_timestamps"] for s in stats_per_track)

    errors = [(s.get("track_id"), s["merge_errors"]) for s in stats_per_track if s["merge_errors"]]

    pct_max = 100 * total_max_matched / total_timesteps if total_timesteps > 0 else 0
    pct_p99 = 100 * total_p99_matched / total_timesteps if total_timesteps > 0 else 0

    r = []
    r.append("=" * 70)
    r.append("Wind100 Merge — Validation & Coverage Report")
    r.append("=" * 70)
    r.append(f"Generated : {datetime.now():%Y-%m-%d %H:%M:%S}")
    r.append(f"Elapsed   : {elapsed_seconds:.1f} s")
    r.append("")

    r.append("─" * 70)
    r.append("Dataset Sizes")
    r.append("─" * 70)
    r.append(f"  Tracks in main dataset              : {total_main:,}")
    r.append(f"  Unique track IDs in wind100 index   : {total_wind100:,}")
    r.append(f"  Tracks present in BOTH datasets     : {len(tracks_in_both):,}")
    r.append(f"  Tracks in main ONLY (no wind100)    : {len(tracks_only_main):,}")
    r.append(f"  Tracks in wind100 ONLY (no main)    : {len(tracks_only_wind100):,}")
    if tracks_only_wind100:
        years_only_wind100 = sorted({str(tid)[:4] for tid in tracks_only_wind100})
        r.append(f"    Years affected                    : {', '.join(years_only_wind100)}")
    r.append("")

    r.append("─" * 70)
    r.append("wind100_max Coverage")
    r.append("─" * 70)
    r.append(f"  Tracks with wind100_max file        : {sum(s['max_file_found'] for s in stats_per_track):,}")
    r.append(f"  Tracks — full timestep coverage     : {tracks_full_max:,}")
    r.append(f"  Tracks — partial timestep coverage  : {tracks_partial_max:,}")
    r.append(f"  Tracks — no wind100_max file        : {tracks_no_max:,}")
    r.append(f"  Timesteps with wind100_max data     : {total_max_matched:,} / {total_timesteps:,}  ({pct_max:.1f}%)")
    if extra_max:
        r.append(f"  wind100_max timestamps with no main counterpart: {extra_max:,}  [discarded]")
    r.append("")

    r.append("─" * 70)
    r.append("wind100_p99 Coverage")
    r.append("─" * 70)
    r.append(f"  Tracks with wind100_p99 file        : {sum(s['p99_file_found'] for s in stats_per_track):,}")
    r.append(f"  Tracks — full timestep coverage     : {tracks_full_p99:,}")
    r.append(f"  Tracks — partial timestep coverage  : {tracks_partial_p99:,}")
    r.append(f"  Tracks — no wind100_p99 file        : {tracks_no_p99:,}")
    r.append(f"  Timesteps with wind100_p99 data     : {total_p99_matched:,} / {total_timesteps:,}  ({pct_p99:.1f}%)")
    if extra_p99:
        r.append(f"  wind100_p99 timestamps with no main counterpart: {extra_p99:,}  [discarded]")
    r.append("")

    r.append("─" * 70)
    r.append("Known Discrepancies and Notes")
    r.append("─" * 70)
    r.append("  • The Zenodo record for the wind100 dataset (DOI: 10.5281/zenodo.")
    r.append("    19353037) states coverage for 1979–2020. However, a local folder")
    r.append("    '2021_wind100' is present and has been processed. The 2021 data")
    r.append("    contains 1 track (20210007), which is consistent with the main")
    r.append("    dataset ending on 2021-01-07. This is treated as valid data.")
    r.append("")
    r.append("  • wind100 track IDs may not fully overlap with the main dataset.")
    r.append("    Differences arise from distinct filtering thresholds between the")
    r.append("    two datasets. See 'Tracks in wind100 ONLY' count above.")
    r.append("")
    r.append("  • LEC energetics in the main dataset are 3-hourly interpolated to")
    r.append("    1-hourly. The 'lec_original' flag (True = original 3-hourly value)")
    r.append("    is preserved in all output files.")
    r.append("")
    r.append("  • wind100 data are 1-hourly. No interpolation is applied to wind100")
    r.append("    columns. NaN is preserved where no wind100 record matches.")
    r.append("")
    r.append("  • Timezone: all timestamps are UTC-naive in both datasets. No tz")
    r.append("    conversion is applied.")
    r.append("")

    if errors:
        r.append("─" * 70)
        r.append(f"Merge Errors ({len(errors)} tracks affected)")
        r.append("─" * 70)
        for tid, errs in errors[:20]:
            r.append(f"  track {tid}: {errs}")
        if len(errors) > 20:
            r.append(f"  ... and {len(errors) - 20} more")
        r.append("")

    r.append("─" * 70)
    r.append("Output")
    r.append("─" * 70)
    r.append(f"  Directory : data/processed/tracks_by_id/")
    r.append(f"  Structure : {{YYYY}}/{{MM:02d}}/{{track_id}}.parquet")
    r.append(f"  Format    : Parquet (pyarrow)")
    r.append(f"  Columns   : 40 main (32 without CPS) + 17 wind100_max + 17 wind100_p99")
    r.append("")
    r.append("=" * 70)

    return "\n".join(r)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Merge wind100 data into per-cyclone Parquet files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Index files and report coverage without writing any output",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        metavar="YYYY",
        help="Process only tracks whose first timestep falls in this year",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Process at most N tracks (for testing)",
    )
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("Wind100 Merge Pipeline")
    print("=" * 70)
    print(f"\nStarted : {datetime.now():%Y-%m-%d %H:%M:%S}")
    if args.dry_run:
        print("Mode    : DRY RUN (no files will be written)")
    if args.year:
        print(f"Filter  : year = {args.year}")
    if args.limit:
        print(f"Limit   : {args.limit} tracks")
    print()

    t_start = datetime.now()

    # ── Step 1: Load main data ─────────────────────────────────────────────────
    print("─" * 70)
    print("Step 1 — Load main consolidated data")
    print("─" * 70)
    main_df = load_main_data()
    main_track_ids = set(main_df["track_id"].unique())

    # ── Step 2: Index wind100 files ────────────────────────────────────────────
    print("\n" + "─" * 70)
    print("Step 2 — Index wind100 files")
    print("─" * 70)
    print(f"  Scanning {WIND100_DIR} ...")
    wind100_index = index_wind100_files(WIND100_DIR)

    total_max = sum(1 for v in wind100_index.values() if "max" in v)
    total_p99 = sum(1 for v in wind100_index.values() if "p99" in v)
    years_in_wind100 = sorted({str(tid)[:4] for tid in wind100_index})

    print(f"  Found {len(wind100_index):,} unique track IDs in wind100 index")
    print(f"    wind100_max files : {total_max:,}")
    print(f"    wind100_p99 files : {total_p99:,}")
    print(f"    Years covered     : {years_in_wind100[0]}–{years_in_wind100[-1]}")

    # 2021 discrepancy note
    if "2021" in years_in_wind100:
        n_2021 = sum(1 for tid in wind100_index if str(tid).startswith("2021"))
        print(f"  ⚠ Note: wind100 data for 2021 found ({n_2021} track(s)).")
        print(f"    Zenodo record states 1979–2020 but local 2021_wind100/ folder exists.")
        print(f"    Treating 2021 data as valid (consistent with main dataset end date).")

    # Tracks in wind100 not in main
    only_wind100 = set(wind100_index.keys()) - main_track_ids
    if only_wind100:
        print(f"  ⚠ {len(only_wind100)} track(s) in wind100 not found in main dataset — will be skipped")

    # ── Step 3: Filter and sort tracks ────────────────────────────────────────
    # Build per-track index: track_id → (first_date, dataframe_slice)
    print("\n" + "─" * 70)
    print("Step 3 — Process tracks")
    print("─" * 70)

    # Sort main_df to ensure first timestep is correct
    main_df = main_df.sort_values(["track_id", "date"]).reset_index(drop=True)

    # Get first date per track (for output directory routing)
    first_dates = main_df.groupby("track_id")["date"].first()

    # Build list of (track_id, first_date) to process
    track_list = [(int(tid), first_dates[tid]) for tid in sorted(main_track_ids)]

    # Apply year filter
    if args.year is not None:
        track_list = [(tid, fd) for tid, fd in track_list if fd.year == args.year]
        print(f"  Filtered to {len(track_list)} tracks in year {args.year}")

    # Apply limit
    if args.limit is not None:
        track_list = track_list[: args.limit]
        print(f"  Limited to first {len(track_list)} tracks")

    if not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_tracks = len(track_list)
    print(f"  Processing {total_tracks:,} tracks ...\n")

    stats_per_track: list[dict] = []
    n_written = 0
    n_skipped = 0

    for i, (track_id, first_date) in enumerate(track_list):
        # Progress indicator every 500 tracks
        if i > 0 and i % 500 == 0:
            pct = 100 * i / total_tracks
            elapsed = (datetime.now() - t_start).total_seconds()
            rate = i / elapsed if elapsed > 0 else 0
            remaining = (total_tracks - i) / rate if rate > 0 else 0
            print(
                f"  [{i:5d}/{total_tracks}]  {pct:5.1f}%  "
                f"{elapsed:.0f}s elapsed  ~{remaining:.0f}s remaining"
            )

        # Slice main data for this track
        main_slice = main_df[main_df["track_id"] == track_id]
        if main_slice.empty:
            n_skipped += 1
            continue

        # Merge wind100
        wind100_files = wind100_index.get(track_id, {})
        merged, track_stats = _merge_wind100_onto_track(main_slice, wind100_files)
        track_stats["track_id"] = track_id
        stats_per_track.append(track_stats)

        if args.dry_run:
            n_written += 1
            continue

        # Write Parquet
        out_path = _output_path(track_id, first_date)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        merged.to_parquet(out_path, index=False, engine="pyarrow")
        n_written += 1

    elapsed_total = (datetime.now() - t_start).total_seconds()

    # ── Step 4: Report ─────────────────────────────────────────────────────────
    print("\n" + "─" * 70)
    print("Step 4 — Validation report")
    print("─" * 70)

    report = generate_report(
        stats_per_track,
        wind100_index,
        main_track_ids,
        elapsed_total,
    )
    print("\n")
    print(report)

    if not args.dry_run:
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(REPORT_FILE, "w") as f:
            f.write(report)
        print(f"\nReport saved to: {REPORT_FILE}")

    # ── Summary ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    if args.dry_run:
        print("✓ Dry run complete — no files written")
    else:
        print(f"✓ Wind100 merge complete")
        print(f"  {n_written:,} Parquet files written to {OUTPUT_DIR}")
        if n_skipped:
            print(f"  {n_skipped} tracks skipped (empty main-data slice)")
    print(f"  Elapsed: {elapsed_total:.1f} s")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
