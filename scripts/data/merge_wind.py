#!/usr/bin/env python3
"""
Build the consolidated per-cyclone base: tracks + LEC + CPS + every wind level.

Replaces the wind100-only merge_wind100.py. Levels come from
scripts/data/wind_levels.py, so adding a diagnostic means adding a registry
entry, not editing this script.

What it produces
----------------
  1. data/processed/tracks_by_id/{YYYY}/{MM}/{track_id}.parquet
         One file per cyclone, one row per timestep. This is the primary
         analysis product: everything known about a cyclone through time.

  2. data/processed/cyclones.parquet
         One row per cyclone. Attributes that do not vary through the life
         cycle live here instead of being repeated across every timestep -
         genesis/lysis, region, duration, the per-cyclone CPS classification,
         and the track intensity in each display variable.

  3. data/processed/tracks_by_id/merge_report.txt
         Coverage and validation report.

Two grains, deliberately kept apart
-----------------------------------
The split above is the whole point of the layout. A cyclone's CPS *category*
(phase_class: EC, SC, ST, EC_like, ...) is a property of the whole system and
belongs in cyclones.parquet. Its CPS *state at a given hour* is a property of
that timestep and stays in the per-timestep file, in two distinct columns:

    cps_class   raw threshold label at that timestep, unguarded. Right for
                colouring a phase diagram, WRONG for counting cyclone types.
    cps_state   the guarded view: the accepted, >=36 h persistent state
                covering that timestep, or empty. A timestep whose run was
                rejected (warm seclusion, genesis out of band) is empty here
                even when cps_class reads "subtropical".

Merge strategy
--------------
- Join key: track_id (from the filename) + timestamp, matched against 'date'.
- Join type: LEFT from the main data. No main-data row is ever dropped.
- Timezone: both sides are UTC-naive. No conversion is applied.
- Wind timestamps with no main-data counterpart are discarded (the wind
  datasets cover 1,198 track_ids that the energetics catalogue does not).
- Absent wind data become NaN, never interpolated or filled. The wind series
  are 1-hourly and need no interpolation; the LEC terms were interpolated
  upstream and carry the 'lec_original' flag.

Catalogue scope
---------------
6,789 cyclones, defined by the energetics dataset. Wind-only track_ids are
counted in the report and skipped, never merged in.

Output schema (109 columns)
---------------------------
  From the consolidated CSV (41):
    track_id, date, lon, lat, vor42, lec_original, region, period,
    cps_original, cps_class, cps_state, cps_B, cps_VTL, cps_VTU,
    cps_size_km, cps_dir, cps_over_ocean,
    Az Ae Kz Ke Cz Ca Ck Ce BAz BAe BKz BKe BPhiZ BPhiE Gz Ge
    dAzdt dAedt dKzdt dKedt RGz RGe RKz RKe

  Per wind level (34 each; prefix w10 / w100):
    {prefix}max_{QD}_{lon,lat,val,dist} + {prefix}max_global_quad
    {prefix}p99_{QD}_{lon,lat,val,dist} + {prefix}p99_global_quad

Parquet is used because it is ~5-10x smaller than CSV for float-heavy columnar
data, preserves dtypes natively, and lets a single variable be read across many
files without loading every row.

Run from project root
---------------------
    conda run -n paper_energy_patterns python scripts/data/merge_wind.py

Options
-------
    --dry-run     Index files and report coverage without writing anything.
    --year YYYY   Only tracks whose first timestep falls in year YYYY.
    --limit N     At most N tracks (for testing).
    --level NAME  Only merge this wind level (default: all).

------------------------------------------------------------------------------
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DATA = PROJECT_ROOT / "scripts" / "data"
sys.path.insert(0, str(SCRIPTS_DATA))

from load_wind import index_wind_files, load_wind_file, timestep_max  # noqa: E402
from wind_levels import LEVEL_ORDER, all_std_columns, global_quad_column, level_config  # noqa: E402

MAIN_CSV = PROJECT_ROOT / "data" / "processed" / "tracks_south_atlantic_consolidated.csv"
SOURCE_CSV = PROJECT_ROOT / "data" / "raw" / "tracks_SAt_source.csv"
CPS_CLASS_CSV = PROJECT_ROOT / "data" / "raw" / "cps_classification_SAt.csv"
RAW_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed" / "tracks_by_id"
CYCLONES_PARQUET = PROJECT_ROOT / "data" / "processed" / "cyclones.parquet"
REPORT_FILE = OUTPUT_DIR / "merge_report.txt"


def _add_nan_cols(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Add missing wind columns filled with NaN (pd.NA for the label columns)."""
    for col in cols:
        if col not in df.columns:
            df[col] = pd.NA if col.endswith("_global_quad") else np.nan
    return df


def _merge_wind_onto_track(
    main_slice: pd.DataFrame,
    files_by_level: dict[str, dict[str, Path]],
    levels: list[str],
) -> tuple[pd.DataFrame, dict]:
    """
    Merge every configured wind level onto one track's main-data slice.

    Returns the augmented frame plus per-level merge statistics. Row count is
    asserted unchanged: this is a LEFT join and must never add or drop rows.
    """
    stats: dict = {"n_main_timesteps": len(main_slice), "levels": {}, "merge_errors": []}
    df = main_slice.copy().reset_index(drop=True)

    for level in levels:
        cfg = level_config(level)
        lstat = {
            "max_file_found": False, "p99_file_found": False,
            "max_matched": 0, "p99_matched": 0,
            "max_extra": 0, "p99_extra": 0,
            "max_duplicate_timestamps": False, "p99_duplicate_timestamps": False,
        }
        level_files = files_by_level.get(level, {})

        for metric in ("max", "p99"):
            path = level_files.get(metric)
            cols = [c for c in all_std_columns(level)
                    if c.startswith(f"{cfg['prefix']}{metric}_")]

            if path is None:
                df = _add_nan_cols(df, cols)
                continue

            lstat[f"{metric}_file_found"] = True
            try:
                w = load_wind_file(path, level, metric)

                if w["timestamp"].duplicated().any():
                    lstat[f"{metric}_duplicate_timestamps"] = True

                lstat[f"{metric}_extra"] = len(set(w["timestamp"]) - set(df["date"]))

                df = df.merge(w, left_on="date", right_on="timestamp", how="left")
                df = df.drop(columns=["timestamp"], errors="ignore")

                probe = f"{cfg['prefix']}{metric}_NW_val"
                lstat[f"{metric}_matched"] = int(df[probe].notna().sum())
            except Exception as exc:
                stats["merge_errors"].append(f"{level}/{metric}: {exc}")
                df = _add_nan_cols(df, cols)

        stats["levels"][level] = lstat

    assert len(df) == stats["n_main_timesteps"], (
        f"LEFT join changed row count: {stats['n_main_timesteps']} -> {len(df)}"
    )
    return df, stats


def _output_path(track_id: int, first_date: pd.Timestamp) -> Path:
    """
    Parquet path for one track: tracks_by_id/{YYYY}/{MM}/{track_id}.parquet.

    Year and month come from the track's FIRST timestep, so a cyclone that
    spans a month boundary is still filed under its genesis month.
    """
    return OUTPUT_DIR / f"{first_date.year}" / f"{first_date.month:02d}" / f"{track_id}.parquet"


def load_main_data() -> pd.DataFrame:
    """Load the consolidated CSV, regenerating it from the raw source if absent."""
    if MAIN_CSV.exists():
        print(f"  Loading {MAIN_CSV.name} ...")
        df = pd.read_csv(MAIN_CSV, parse_dates=["date"])
        print(f"  Loaded {len(df):,} rows, {df['track_id'].nunique():,} tracks")
        return df

    if SOURCE_CSV.exists():
        print(f"\n  Consolidated CSV not found. Running preprocessing from {SOURCE_CSV.name} ...")
        result = subprocess.run(
            [sys.executable, str(SCRIPTS_DATA / "preprocess_data.py")], cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            print("  x Preprocessing failed. Cannot continue.")
            sys.exit(1)
        df = pd.read_csv(MAIN_CSV, parse_dates=["date"])
        print(f"  Loaded {len(df):,} rows, {df['track_id'].nunique():,} tracks")
        return df

    print("\nx Neither consolidated CSV nor raw source CSV found.")
    print("  Run: python scripts/data/run_pipeline.py --skip-download")
    sys.exit(1)


def build_cyclones_table(
    per_track_rows: list[dict], levels: list[str]
) -> pd.DataFrame:
    """
    Assemble the per-cyclone table from accumulated per-track summaries and the
    CPS classification export.

    The CPS columns are copied verbatim from cps_classification_SAt.csv. In
    particular class_kind / is_identified are taken as given and never inferred:
    a '*_like' class is a description of characteristics, not an identification,
    and collapsing the two would assert something the upstream classification
    explicitly refuses to assert.
    """
    cyc = pd.DataFrame(per_track_rows)

    if not CPS_CLASS_CSV.exists():
        print(f"  ! {CPS_CLASS_CSV.name} not found - per-cyclone CPS columns omitted")
        return cyc

    cps = pd.read_csv(CPS_CLASS_CSV)
    keep = [
        "track_id", "has_cps", "phase_class", "phase_class_label",
        "class_kind", "is_identified", "genesis_state", "genesis_onset_h",
        "pure_genesis", "state_sequence", "transitions", "n_persistent_states",
        "dominant_class", "dominance", "frac_EC", "frac_SC", "frac_TC",
        "hours_EC", "hours_SC", "hours_TC",
        "n_warm_seclusions", "n_out_of_band", "n_indeterminate_warm",
        "antecedent_characteristics", "antecedent_hours",
    ]
    keep = [c for c in keep if c in cps.columns]
    cps = cps[keep].rename(columns={
        c: f"cps_{c}" for c in keep if c != "track_id"
    })

    n_before = len(cyc)
    cyc = cyc.merge(cps, on="track_id", how="left")
    assert len(cyc) == n_before, "CPS classification merge changed the row count"

    return cyc


def generate_report(
    stats_per_track: list[dict],
    indices: dict[str, dict],
    main_track_ids: set[int],
    levels: list[str],
    elapsed_seconds: float,
    n_columns: int,
) -> str:
    """Build the validation/coverage report."""
    total_main = len(main_track_ids)
    total_timesteps = sum(s["n_main_timesteps"] for s in stats_per_track)

    r: list[str] = []
    r.append("=" * 70)
    r.append("Consolidated per-cyclone base - Validation & Coverage Report")
    r.append("=" * 70)
    r.append(f"Generated : {datetime.now():%Y-%m-%d %H:%M:%S}")
    r.append(f"Elapsed   : {elapsed_seconds:.1f} s")
    r.append(f"Levels    : {', '.join(levels)}")
    r.append("")

    r.append("-" * 70)
    r.append("Catalogue")
    r.append("-" * 70)
    r.append(f"  Cyclones in the energetics catalogue : {total_main:,}")
    r.append(f"  Timesteps                            : {total_timesteps:,}")
    r.append("")

    for level in levels:
        idx = indices[level]
        wind_ids = set(idx.keys())
        only_wind = wind_ids - main_track_ids
        only_main = main_track_ids - wind_ids

        matched_max = sum(s["levels"][level]["max_matched"] for s in stats_per_track)
        matched_p99 = sum(s["levels"][level]["p99_matched"] for s in stats_per_track)
        found_max = sum(s["levels"][level]["max_file_found"] for s in stats_per_track)
        found_p99 = sum(s["levels"][level]["p99_file_found"] for s in stats_per_track)
        full_max = sum(1 for s in stats_per_track
                       if s["levels"][level]["max_matched"] == s["n_main_timesteps"])
        partial_max = sum(1 for s in stats_per_track
                          if 0 < s["levels"][level]["max_matched"] < s["n_main_timesteps"])
        extra_max = sum(s["levels"][level]["max_extra"] for s in stats_per_track)
        extra_p99 = sum(s["levels"][level]["p99_extra"] for s in stats_per_track)

        pct_max = 100 * matched_max / total_timesteps if total_timesteps else 0
        pct_p99 = 100 * matched_p99 / total_timesteps if total_timesteps else 0

        r.append("-" * 70)
        r.append(f"{level}  ({level_config(level)['doi']})")
        r.append("-" * 70)
        r.append(f"  Unique track IDs in the archive     : {len(wind_ids):,}")
        r.append(f"  Present in BOTH                     : {len(wind_ids & main_track_ids):,}")
        r.append(f"  In catalogue ONLY (no wind)         : {len(only_main):,}")
        r.append(f"  In wind ONLY (not in catalogue)     : {len(only_wind):,}  [skipped]")
        r.append(f"  Tracks with a max file              : {found_max:,}")
        r.append(f"  Tracks with a p99 file              : {found_p99:,}")
        r.append(f"  Tracks - full timestep coverage     : {full_max:,}")
        r.append(f"  Tracks - partial timestep coverage  : {partial_max:,}")
        r.append(f"  Timesteps with max data             : {matched_max:,} / {total_timesteps:,}  ({pct_max:.1f}%)")
        r.append(f"  Timesteps with p99 data             : {matched_p99:,} / {total_timesteps:,}  ({pct_p99:.1f}%)")
        if extra_max or extra_p99:
            r.append(f"  Wind timestamps with no catalogue counterpart: "
                     f"max {extra_max:,}, p99 {extra_p99:,}  [discarded]")
        r.append("")

    errors = [(s.get("track_id"), s["merge_errors"]) for s in stats_per_track if s["merge_errors"]]
    if errors:
        r.append("-" * 70)
        r.append(f"Merge Errors ({len(errors)} tracks affected)")
        r.append("-" * 70)
        for tid, errs in errors[:20]:
            r.append(f"  track {tid}: {errs}")
        if len(errors) > 20:
            r.append(f"  ... and {len(errors) - 20} more")
        r.append("")

    r.append("-" * 70)
    r.append("Conventions preserved")
    r.append("-" * 70)
    r.append("  * LEC terms are native 3-hourly, linearly interpolated to 1-hourly")
    r.append("    upstream. 'lec_original' is True on the original values.")
    r.append("  * CPS parameters are native 3-hourly. 'cps_original' marks computed")
    r.append("    values. cps_class is the raw per-timestep threshold label;")
    r.append("    cps_state is the guarded >=36 h persistent state, or empty.")
    r.append("  * Wind data are 1-hourly and are NOT interpolated. NaN is preserved")
    r.append("    wherever no wind record matches a catalogue timestep.")
    r.append("  * Wind 'dist' is Euclidean degrees, hypot(dlon, dlat) - verified to")
    r.append("    1e-14 deg against the quadrant offsets, not a great-circle distance.")
    r.append("  * The '*_global_quad' columns hold the NAME of the quadrant carrying")
    r.append("    the extremum, not its value.")
    r.append("  * All timestamps are UTC-naive on both sides. No tz conversion.")
    r.append("")

    r.append("-" * 70)
    r.append("Output")
    r.append("-" * 70)
    r.append("  Per timestep : data/processed/tracks_by_id/{YYYY}/{MM}/{track_id}.parquet")
    r.append(f"                 {n_columns} columns "
             f"(41 catalogue + {34 * len(levels)} wind)")
    r.append("  Per cyclone  : data/processed/cyclones.parquet")
    r.append("  Format       : Parquet (pyarrow)")
    r.append("")
    r.append("=" * 70)
    return "\n".join(r)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the consolidated per-cyclone base (tracks + LEC + CPS + wind)"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Index files and report coverage without writing output")
    parser.add_argument("--year", type=int, default=None, metavar="YYYY",
                        help="Only tracks whose first timestep falls in this year")
    parser.add_argument("--limit", type=int, default=None, metavar="N",
                        help="Process at most N tracks (for testing)")
    parser.add_argument("--level", choices=LEVEL_ORDER, default=None,
                        help="Only merge this wind level (default: all)")
    args = parser.parse_args()

    levels = [args.level] if args.level else LEVEL_ORDER

    print("\n" + "=" * 70)
    print("Consolidated per-cyclone base")
    print("=" * 70)
    print(f"\nStarted : {datetime.now():%Y-%m-%d %H:%M:%S}")
    print(f"Levels  : {', '.join(levels)}")
    if args.dry_run:
        print("Mode    : DRY RUN (no files will be written)")
    if args.year:
        print(f"Filter  : year = {args.year}")
    if args.limit:
        print(f"Limit   : {args.limit} tracks")
    print()

    t_start = datetime.now()

    print("-" * 70)
    print("Step 1 - Load the consolidated catalogue")
    print("-" * 70)
    main_df = load_main_data()
    main_track_ids = set(main_df["track_id"].unique())

    print("\n" + "-" * 70)
    print("Step 2 - Index the wind archives")
    print("-" * 70)
    indices: dict[str, dict] = {}
    for level in levels:
        level_dir = RAW_DIR / level
        print(f"  Scanning {level_dir} ...")
        idx = index_wind_files(level_dir, level)
        indices[level] = idx
        years = sorted({str(t)[:4] for t in idx})
        print(f"    {len(idx):,} track IDs, years {years[0]}-{years[-1]}")
        only_wind = set(idx) - main_track_ids
        if only_wind:
            print(f"    ! {len(only_wind):,} track(s) not in the catalogue - will be skipped")

    print("\n" + "-" * 70)
    print("Step 3 - Merge and write")
    print("-" * 70)

    main_df = main_df.sort_values(["track_id", "date"]).reset_index(drop=True)
    first_dates = main_df.groupby("track_id")["date"].first()
    track_list = [(int(t), first_dates[t]) for t in sorted(main_track_ids)]

    if args.year is not None:
        track_list = [(t, d) for t, d in track_list if d.year == args.year]
        print(f"  Filtered to {len(track_list)} tracks in year {args.year}")
    if args.limit is not None:
        track_list = track_list[: args.limit]
        print(f"  Limited to first {len(track_list)} tracks")

    if not args.dry_run:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_tracks = len(track_list)
    print(f"  Processing {total_tracks:,} tracks ...\n")

    stats_per_track: list[dict] = []
    cyclone_rows: list[dict] = []
    n_written = 0
    n_columns = 0

    grouped = dict(tuple(main_df.groupby("track_id", sort=False)))

    for i, (track_id, first_date) in enumerate(track_list):
        if i > 0 and i % 500 == 0:
            elapsed = (datetime.now() - t_start).total_seconds()
            rate = i / elapsed if elapsed else 0
            remaining = (total_tracks - i) / rate if rate else 0
            print(f"  [{i:5d}/{total_tracks}]  {100 * i / total_tracks:5.1f}%  "
                  f"{elapsed:.0f}s elapsed  ~{remaining:.0f}s remaining")

        main_slice = grouped.get(track_id)
        if main_slice is None or main_slice.empty:
            continue

        files_by_level = {lv: indices[lv].get(track_id, {}) for lv in levels}
        merged, tstats = _merge_wind_onto_track(main_slice, files_by_level, levels)
        tstats["track_id"] = track_id
        stats_per_track.append(tstats)
        n_columns = len(merged.columns)

        # ── Per-cyclone summary row ────────────────────────────────────────────
        last = merged.iloc[-1]
        first = merged.iloc[0]
        row: dict = {
            "track_id": track_id,
            "year": int(first_date.year),
            "month": int(first_date.month),
            "start": first["date"],
            "end": last["date"],
            "duration_h": int((last["date"] - first["date"]).total_seconds() // 3600),
            "n_timesteps": len(merged),
            "genesis_lat": float(first["lat"]), "genesis_lon": float(first["lon"]),
            "lysis_lat": float(last["lat"]), "lysis_lon": float(last["lon"]),
            "genesis_region": first["region"],
            "max_vor42": float(merged["vor42"].max()),
        }
        # Track intensity per wind level: max over timesteps of the max over
        # quadrants. Mirrors max_vor42 exactly. The 'max' metric only - p99 is a
        # diagnostic, never an intensity classifier.
        for level in levels:
            ts_max = timestep_max(merged, level)
            row[f"max_{level}"] = float(ts_max.max()) if ts_max.notna().any() else np.nan
        cyclone_rows.append(row)

        if args.dry_run:
            n_written += 1
            continue

        out_path = _output_path(track_id, first_date)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        merged.to_parquet(out_path, index=False, engine="pyarrow")
        n_written += 1

    elapsed_total = (datetime.now() - t_start).total_seconds()

    # ── Step 4: per-cyclone table ─────────────────────────────────────────────
    print("\n" + "-" * 70)
    print("Step 4 - Per-cyclone table")
    print("-" * 70)
    cyclones = build_cyclones_table(cyclone_rows, levels)
    print(f"  {len(cyclones):,} cyclones x {len(cyclones.columns)} columns")
    if not args.dry_run:
        CYCLONES_PARQUET.parent.mkdir(parents=True, exist_ok=True)
        cyclones.to_parquet(CYCLONES_PARQUET, index=False, engine="pyarrow")
        print(f"  Written -> {CYCLONES_PARQUET}")

    # ── Step 5: report ────────────────────────────────────────────────────────
    print("\n" + "-" * 70)
    print("Step 5 - Validation report")
    print("-" * 70)
    report = generate_report(
        stats_per_track, indices, main_track_ids, levels, elapsed_total, n_columns
    )
    print("\n" + report)

    if not args.dry_run:
        REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
        REPORT_FILE.write_text(report)
        print(f"\nReport saved to: {REPORT_FILE}")

    print("\n" + "=" * 70)
    if args.dry_run:
        print("ok Dry run complete - no files written")
    else:
        print(f"ok Merge complete: {n_written:,} Parquet files -> {OUTPUT_DIR}")
    print(f"  Elapsed: {elapsed_total:.1f} s")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
