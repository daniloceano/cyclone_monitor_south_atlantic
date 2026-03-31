#!/usr/bin/env python3
"""
Preprocess source data to create consolidated cyclone dataset.

This script reads the raw Zenodo CSV and produces a clean, standardized CSV
with all track data, lifecycle phases, genesis regions, and LEC energetics.

Input:
    data/raw/tracks_SAt_source.csv

Output:
    data/processed/tracks_south_atlantic_consolidated.csv

Key processing steps:
    1. Parse and validate dates
    2. Standardize column names (remove special characters)
    3. Drop geometry column (redundant with lon/lat)
    4. Validate track_id integrity
    5. Interpolate 3-hourly LEC energetics to 1-hourly (per track)
    6. Sort by track_id and date
    7. Generate validation report

Energetics interpolation:
    The LEC terms (Az, Ae, Kz, Ke, Ca, Ce, Ck, Cz, etc.) are originally computed
    at 3-hourly intervals. Since these are smooth time series representing
    integrated atmospheric energy quantities, linear interpolation provides a
    physically reasonable estimate of intermediate values.
    
    Reference for LEC methodology:
    De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R. (2025).
    Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones.
    Climate Dynamics, 63(11), 1-26. https://doi.org/10.1007/s00382-024-07555-z

Run from project root:
    python scripts/data/preprocess_data.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_FILE = PROJECT_ROOT / "data" / "raw" / "tracks_SAt_source.csv"
OUTPUT_FILE = PROJECT_ROOT / "data" / "processed" / "tracks_south_atlantic_consolidated.csv"

# Column renaming map
COLUMN_RENAMES = {
    "lon vor": "lon",
    "lat vor": "lat",
    "∂Az/∂t (finite diff.)": "dAzdt",
    "∂Ae/∂t (finite diff.)": "dAedt",
    "∂Kz/∂t (finite diff.)": "dKzdt",
    "∂Ke/∂t (finite diff.)": "dKedt",
}

# Columns to drop
COLUMNS_TO_DROP = ["geometry"]

# LEC columns to interpolate (3-hourly → 1-hourly)
LEC_COLUMNS = [
    # Energy reservoirs
    "Az", "Ae", "Kz", "Ke",
    # Conversion terms
    "Cz", "Ca", "Ck", "Ce",
    # Boundary terms
    "BAz", "BAe", "BKz", "BKe", "BΦZ", "BΦE",
    # Generation terms
    "Gz", "Ge",
    # Tendencies
    "dAzdt", "dAedt", "dKzdt", "dKedt",
    # Residuals
    "RGz", "RGe", "RKz", "RKe",
]

# Final column order (for readability)
COLUMN_ORDER = [
    # Identification
    "track_id", "date",
    # Position
    "lon", "lat", "vor42",
    # Classification
    "region", "period",
    # Energy reservoirs
    "Az", "Ae", "Kz", "Ke",
    # Conversion terms
    "Cz", "Ca", "Ck", "Ce",
    # Boundary terms
    "BAz", "BAe", "BKz", "BKe", "BΦZ", "BΦE",
    # Generation terms
    "Gz", "Ge",
    # Tendencies
    "dAzdt", "dAedt", "dKzdt", "dKedt",
    # Residuals
    "RGz", "RGe", "RKz", "RKe",
]


def load_source_data(file_path: Path) -> pd.DataFrame:
    """Load source CSV and parse dates."""
    print(f"\n  Loading {file_path.name}...")
    
    df = pd.read_csv(file_path, parse_dates=["date"])
    
    print(f"  Loaded {len(df):,} rows, {df['track_id'].nunique():,} unique tracks")
    print(f"  Columns: {len(df.columns)}")
    
    return df


def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns and drop unnecessary ones."""
    print("\n  Standardizing columns...")
    
    # Rename columns
    df = df.rename(columns=COLUMN_RENAMES)
    renamed = [f"'{old}' → '{new}'" for old, new in COLUMN_RENAMES.items() if old in df.columns or old in COLUMN_RENAMES]
    if renamed:
        print(f"  Renamed: {', '.join(renamed)}")
    
    # Drop geometry column if present
    for col in COLUMNS_TO_DROP:
        if col in df.columns:
            df = df.drop(columns=[col])
            print(f"  Dropped: '{col}'")
    
    return df


def interpolate_energetics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Interpolate LEC energetics from 3-hourly to 1-hourly resolution.
    
    The LEC terms are originally computed at 3-hourly intervals. Since these
    are smooth time series representing integrated atmospheric energy quantities,
    linear interpolation provides a physically reasonable estimate of intermediate
    values. This is performed per track to ensure no interpolation across track
    boundaries.
    
    Reference:
    De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R. (2025).
    Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones.
    Climate Dynamics, 63(11), 1-26.
    """
    print("\n  Interpolating LEC energetics (3h → 1h)...")
    
    # Find which LEC columns are present
    lec_cols_present = [col for col in LEC_COLUMNS if col in df.columns]
    
    if not lec_cols_present:
        print("  No LEC columns found, skipping interpolation")
        return df
    
    print(f"  Interpolating {len(lec_cols_present)} columns: {', '.join(lec_cols_present[:5])}...")
    
    # Track original coverage
    orig_coverage = df[lec_cols_present[0]].notna().sum() / len(df) * 100
    
    # Sort by track_id and date first
    df = df.sort_values(["track_id", "date"]).reset_index(drop=True)
    
    # Group by track and interpolate within each track
    def interpolate_track(group):
        """Interpolate LEC columns within a single track."""
        # Set date as index for interpolation
        group = group.set_index("date")
        
        # Linear interpolation for each LEC column
        for col in lec_cols_present:
            if col in group.columns:
                # Only interpolate if there are at least 2 non-null values
                if group[col].notna().sum() >= 2:
                    group[col] = group[col].interpolate(method="linear", limit_area="inside")
        
        return group.reset_index()
    
    # Apply interpolation to each track
    n_tracks = df["track_id"].nunique()
    print(f"  Processing {n_tracks:,} tracks...")
    
    # Use groupby + apply for interpolation
    df = df.groupby("track_id", group_keys=False).apply(interpolate_track)
    
    # Track new coverage
    new_coverage = df[lec_cols_present[0]].notna().sum() / len(df) * 100
    
    print(f"  ✓ Coverage increased: {orig_coverage:.1f}% → {new_coverage:.1f}%")
    
    return df


def validate_data(df: pd.DataFrame, after_interpolation: bool = False) -> dict:
    """Validate data and return statistics."""
    label = "after interpolation" if after_interpolation else "before interpolation"
    print(f"\n  Validating data ({label})...")
    
    stats = {}
    
    # Basic counts
    stats["total_rows"] = len(df)
    stats["unique_tracks"] = df["track_id"].nunique()
    
    # Date range
    stats["date_min"] = df["date"].min()
    stats["date_max"] = df["date"].max()
    
    # Check for duplicate (track_id, date) combinations
    duplicates = df.duplicated(subset=["track_id", "date"], keep=False)
    stats["duplicate_rows"] = duplicates.sum()
    
    if stats["duplicate_rows"] > 0:
        print(f"  ⚠ Warning: {stats['duplicate_rows']} duplicate (track_id, date) rows found")
    
    # Check track_id format (should be YYYYNNNN)
    invalid_ids = df[~df["track_id"].astype(str).str.match(r"^\d{8}$")]["track_id"].unique()
    stats["invalid_track_ids"] = len(invalid_ids)
    
    if stats["invalid_track_ids"] > 0:
        print(f"  ⚠ Warning: {stats['invalid_track_ids']} track_ids with unexpected format")
    
    # Region distribution
    stats["regions"] = df["region"].value_counts().to_dict()
    
    # Period (phase) distribution
    stats["periods"] = df["period"].value_counts().to_dict()
    
    # Energetics coverage (key columns)
    lec_cols = ["Az", "Ae", "Kz", "Ke", "Ca", "Ck", "Ce", "Cz"]
    lec_coverage = {}
    for col in lec_cols:
        if col in df.columns:
            non_null = df[col].notna().sum()
            pct = 100 * non_null / len(df)
            lec_coverage[col] = round(pct, 1)
    stats["lec_coverage_pct"] = lec_coverage
    stats["interpolated"] = after_interpolation
    
    # Check for missing required columns
    required = ["track_id", "date", "lon", "lat", "vor42", "region", "period"]
    missing = [col for col in required if col not in df.columns]
    stats["missing_required_columns"] = missing
    
    if missing:
        print(f"  ✗ Error: Missing required columns: {missing}")
    
    print(f"  ✓ Validated {stats['total_rows']:,} rows")
    
    return stats


def sort_and_order_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Sort data and order columns."""
    print("\n  Sorting and ordering...")
    
    # Sort by track_id and date
    df = df.sort_values(["track_id", "date"]).reset_index(drop=True)
    
    # Reorder columns (keep any extras at the end)
    cols_present = [c for c in COLUMN_ORDER if c in df.columns]
    cols_extra = [c for c in df.columns if c not in COLUMN_ORDER]
    
    df = df[cols_present + cols_extra]
    
    if cols_extra:
        print(f"  Extra columns (preserved): {cols_extra}")
    
    return df


def generate_report(df: pd.DataFrame, stats: dict, output_file: Path) -> str:
    """Generate validation report as string."""
    report = []
    report.append("=" * 70)
    report.append("Validation Report")
    report.append("=" * 70)
    report.append("")
    report.append(f"Output file: {output_file}")
    report.append(f"Generated: {datetime.now():%Y-%m-%d %H:%M:%S}")
    report.append("")
    report.append("─" * 70)
    report.append("Dataset Summary")
    report.append("─" * 70)
    report.append(f"  Total rows:      {stats['total_rows']:,}")
    report.append(f"  Unique tracks:   {stats['unique_tracks']:,}")
    report.append(f"  Date range:      {stats['date_min']:%Y-%m-%d} to {stats['date_max']:%Y-%m-%d}")
    report.append(f"  Duplicate rows:  {stats['duplicate_rows']}")
    report.append("")
    report.append("─" * 70)
    report.append("Genesis Region Distribution")
    report.append("─" * 70)
    for region, count in sorted(stats["regions"].items(), key=lambda x: -x[1]):
        pct = 100 * count / stats["total_rows"]
        report.append(f"  {region:15s}: {count:8,} rows ({pct:5.1f}%)")
    report.append("")
    report.append("─" * 70)
    report.append("Lifecycle Phase Distribution")
    report.append("─" * 70)
    for period, count in sorted(stats["periods"].items(), key=lambda x: -x[1]):
        pct = 100 * count / stats["total_rows"]
        report.append(f"  {period:20s}: {count:8,} rows ({pct:5.1f}%)")
    report.append("")
    report.append("─" * 70)
    report.append("LEC Energetics Coverage (after interpolation)")
    report.append("─" * 70)
    if stats.get("interpolated"):
        report.append("  LEC terms interpolated from 3-hourly to 1-hourly resolution.")
        report.append("  Linear interpolation applied within each track (no extrapolation).")
        report.append("  Reference: De Souza et al. (2025), Climate Dynamics.")
    else:
        report.append("  (Raw coverage — before interpolation)")
    report.append("")
    for col, pct in stats.get("lec_coverage_pct", {}).items():
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        report.append(f"  {col:6s}: {bar} {pct:5.1f}%")
    report.append("")
    report.append("─" * 70)
    report.append("Column List")
    report.append("─" * 70)
    for i, col in enumerate(df.columns, 1):
        dtype = str(df[col].dtype)
        null_pct = 100 * df[col].isna().sum() / len(df)
        report.append(f"  {i:2d}. {col:30s} {dtype:15s} ({null_pct:5.1f}% null)")
    report.append("")
    report.append("=" * 70)
    
    return "\n".join(report)


def main() -> int:
    """Main preprocessing function."""
    print("=" * 70)
    print("Preprocess Source Data")
    print("=" * 70)
    print(f"\nInput:  {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")
    
    # Check input exists
    if not INPUT_FILE.exists():
        print(f"\n✗ Input file not found: {INPUT_FILE}")
        print("\nRun download script first:")
        print("  python scripts/data/download_source_data.py")
        return 1
    
    # Load data
    df = load_source_data(INPUT_FILE)
    
    # Process
    df = standardize_columns(df)
    
    # Validate before interpolation
    stats_before = validate_data(df, after_interpolation=False)
    
    # Check for critical errors
    if stats_before.get("missing_required_columns"):
        print(f"\n✗ Critical: Missing required columns")
        return 1
    
    # Interpolate LEC energetics (3h → 1h)
    df = interpolate_energetics(df)
    
    # Validate after interpolation
    stats = validate_data(df, after_interpolation=True)
    
    df = sort_and_order_columns(df)
    
    # Save
    print(f"\n  Saving to {OUTPUT_FILE.name}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)
    
    size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"  ✓ Saved ({size_mb:.1f} MB)")
    
    # Generate and print report
    report = generate_report(df, stats, OUTPUT_FILE)
    print("\n")
    print(report)
    
    # Save report
    report_file = OUTPUT_FILE.with_suffix(".txt")
    with open(report_file, "w") as f:
        f.write(report)
    print(f"\nReport saved to: {report_file}")
    
    print("\n" + "=" * 70)
    print("✓ Preprocessing complete")
    print("=" * 70)
    print(f"\nConsolidated CSV ready: {OUTPUT_FILE}")
    print(f"Contains {stats['unique_tracks']:,} cyclones, {stats['total_rows']:,} timesteps")
    print("LEC energetics interpolated from 3-hourly to 1-hourly resolution")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
