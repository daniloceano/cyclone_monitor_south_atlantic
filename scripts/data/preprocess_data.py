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

# Cyclone Phase Space (optional input — skipped with a warning when absent).
#
# PROVENANCE PLACEHOLDER: these files are currently produced by the sibling
# project `paper_energy_patterns` (scripts/cps_analysis/export_cps_for_monitor.py)
# and copied here by hand. A Zenodo DOI is planned but NOT yet minted, so there
# is no download script for them — unlike Datasets 1 and 2. When the record is
# published, add scripts/data/download_cps.py mirroring download_wind100.py and
# reference the DOI here.
CPS_PARAMS_FILE = PROJECT_ROOT / "data" / "raw" / "cps_parameters_SAt.csv"
CPS_DOI = None  # TODO: fill in once the CPS dataset is published on Zenodo

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

# ─── Cyclone Phase Space (CPS) ────────────────────────────────────────────────
#
# Source columns (per timestep, 3-hourly) → standardised names written here:
#     B          → cps_B           storm-motion-relative 900–600 hPa thickness
#                                  asymmetry (m); large positive = frontal
#     VTL        → cps_VTL         lower thermal wind 900–600 hPa; >0 = warm core
#     VTU        → cps_VTU         upper thermal wind 600–300 hPa; >0 = warm core
#     SIZE       → cps_size_km     diagnosed system radius (km)
#     dir        → cps_dir         storm motion direction (degrees, 0–360)
#     over_ocean → cps_over_ocean  centre over ocean (bool)
#     cps_class  → cps_class       per-timestep structural label
# The source file's own lat/lon are dropped: they duplicate the track position
# already carried by this dataset and would collide on merge.
CPS_LINEAR_COLS = ["cps_B", "cps_VTL", "cps_VTU", "cps_size_km"]
CPS_CIRCULAR_COLS = ["cps_dir"]
CPS_RENAMES = {
    "B": "cps_B",
    "VTL": "cps_VTL",
    "VTU": "cps_VTU",
    "SIZE": "cps_size_km",
    "dir": "cps_dir",
    "over_ocean": "cps_over_ocean",
    "cps_class": "cps_class",
    "cps_state": "cps_state",
}

# Classification thresholds, after de Souza et al. (2026), taking
# extratropical/tropical from Wood et al. (2023) and subtropical from
# Gozzo et al. (2014). A timestep satisfying more than one specification is
# resolved by the precedence tropical > subtropical > extratropical.
#
# These are ONLY applied to fill labels at interpolated timesteps; labels at
# original 3-hourly timesteps are always carried through untouched from the
# upstream classifier, so no upstream decision is ever overwritten here.
CPS_CLASS_RULES = [
    ("tropical",      lambda b, vtl, vtu: (b < 10) & (vtl > 0) & (vtu > 0)),
    ("subtropical",   lambda b, vtl, vtu: (b > -25) & (b < 25) & (vtl > -50) & (vtu < -10)),
    ("extratropical", lambda b, vtl, vtu: (b > 10) & (vtl < 0) & (vtu < 0)),
]
CPS_UNCLASSIFIED = "unclassified"

# Final column order (for readability)
COLUMN_ORDER = [
    # Identification
    "track_id", "date",
    # Position
    "lon", "lat", "vor42",
    # LEC provenance flag (True = original 3-hourly value; False = linearly interpolated)
    "lec_original",
    # Classification
    "region", "period",
    # Cyclone Phase Space (3-hourly source, interpolated to 1-hourly)
    # cps_original mirrors lec_original: True = value computed at this timestep.
    "cps_original", "cps_class", "cps_state", "cps_B", "cps_VTL", "cps_VTU",
    "cps_size_km", "cps_dir", "cps_over_ocean",
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

    # Flag original (non-null) LEC timesteps BEFORE interpolation.
    # True  = value was computed at this timestep (original 3-hourly resolution).
    # False = value will be linearly interpolated (or no LEC data at all).
    df["lec_original"] = df[lec_cols_present[0]].notna()
    
    n_tracks = df["track_id"].nunique()
    print(f"  Processing {n_tracks:,} tracks...")

    # Interpolate within each track using groupby().transform().
    #
    # This deliberately avoids groupby().apply(): under pandas 3.0 the grouping
    # column is no longer passed into the applied function (the old
    # include_groups=True default became False), so 'track_id' vanished from the
    # result and validation downstream failed with KeyError. transform() works
    # column-wise, never touches the key column, and behaves identically on
    # pandas 2.x and 3.x.
    #
    # limit_area="inside" prevents extrapolation past the first/last computed
    # value of a track and is a no-op when a track has fewer than two valid
    # points, so the previous explicit ">= 2 non-null" guard is redundant.
    #
    # Note: method="linear" treats rows as equally spaced (it ignores the index).
    # That is correct here because rows are already sorted by date within each
    # track and the track sampling is a regular 1-hourly grid.
    df[lec_cols_present] = df.groupby("track_id", sort=False)[lec_cols_present].transform(
        lambda s: s.interpolate(method="linear", limit_area="inside")
    )
    
    # Track new coverage
    new_coverage = df[lec_cols_present[0]].notna().sum() / len(df) * 100
    
    print(f"  ✓ Coverage increased: {orig_coverage:.1f}% → {new_coverage:.1f}%")
    
    return df


def _classify_cps(b: pd.Series, vtl: pd.Series, vtu: pd.Series) -> pd.Series:
    """
    Apply the CPS threshold rules to (B, VTL, VTU), honouring precedence.

    Returns a Series of labels; rows where any of the three parameters is NaN,
    or that satisfy no rule, are labelled CPS_UNCLASSIFIED.

    Precedence is tropical > subtropical > extratropical: rules are applied in
    reverse order so that higher-precedence rules overwrite lower ones.
    """
    out = pd.Series(CPS_UNCLASSIFIED, index=b.index, dtype=object)
    valid = b.notna() & vtl.notna() & vtu.notna()
    for label, rule in reversed(CPS_CLASS_RULES):
        mask = valid & rule(b, vtl, vtu).fillna(False)
        out[mask] = label
    return out


def _interpolate_circular(s: pd.Series) -> pd.Series:
    """
    Linearly interpolate a direction in degrees through the 0/360 wrap.

    A plain linear interpolation between, say, 350° and 10° yields 180° — the
    exact opposite of the correct 0°. Interpolating the unit vector instead and
    converting back keeps the result on the circle.
    """
    rad = np.deg2rad(s.astype(float))
    x = pd.Series(np.cos(rad), index=s.index).interpolate(method="linear", limit_area="inside")
    y = pd.Series(np.sin(rad), index=s.index).interpolate(method="linear", limit_area="inside")
    out = np.rad2deg(np.arctan2(y, x)) % 360.0
    return out.where(x.notna() & y.notna())


def merge_cps(df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge the Cyclone Phase Space parameters and interpolate 3-hourly → 1-hourly.

    Mirrors the LEC treatment: continuous parameters are linearly interpolated
    within each track and a provenance flag (`cps_original`) marks which rows
    carry a value that was actually computed.

    Per-column treatment, chosen by the nature of the quantity:
      - B, VTL, VTU, SIZE : linear interpolation (smooth continuous fields)
      - dir               : circular interpolation (see _interpolate_circular)
      - over_ocean        : forward/backward fill within the track (a slowly
                            varying geographic property, not a smooth number)
      - cps_state         : the GUARDED view — the accepted persistent state
                            covering the timestep, or empty. Filled only INSIDE
                            a run (between its own 3-hourly endpoints), never
                            derived from thresholds: a state is the outcome of
                            persistence AND the identification guards, neither
                            of which can be recomputed from a single row.
      - cps_class         : NOT interpolated. Original labels are preserved
                            verbatim; interpolated rows are labelled by applying
                            the published thresholds to the interpolated
                            parameters, so every label remains consistent with
                            the values sitting beside it.

    Caveat worth carrying downstream: the upstream export deliberately left the
    CPS series at 3-hourly precisely because interpolated points get labelled
    from values nobody computed. That objection is answered here only in the
    bookkeeping sense — `cps_original` lets any consumer drop the interpolated
    rows. Persistence-based statistics (the >= 36 h gate behind `phase_class`)
    must still be computed on the ORIGINAL 3-hourly rows only.

    Returns df unchanged (with the CPS columns absent) when the source file is
    not present.
    """
    print("\n  Merging Cyclone Phase Space (CPS)...")

    if not CPS_PARAMS_FILE.exists():
        print(f"  ⚠ CPS file not found: {CPS_PARAMS_FILE.name}")
        print("    Skipping CPS merge. The consolidated CSV will have no cps_* columns.")
        print("    (See CPS_PARAMS_FILE in this script for provenance notes.)")
        return df

    cps = pd.read_csv(CPS_PARAMS_FILE, parse_dates=["date"])
    print(f"  Loaded {len(cps):,} CPS rows, {cps['track_id'].nunique():,} tracks")

    # Drop the duplicated position columns before merging
    cps = cps.drop(columns=[c for c in ("lat", "lon") if c in cps.columns])
    cps = cps.rename(columns=CPS_RENAMES)

    # Keep the original label under a private name so the merge does not
    # clobber it when we later fill interpolated rows.
    cps["_cps_class_orig"] = cps["cps_class"]
    cps = cps.drop(columns=["cps_class"])
    if "cps_state" in cps.columns:
        cps["cps_state"] = cps["cps_state"].fillna("")

    # Provenance: a row is "original" when the phase-space parameters were
    # actually computed there. 3-hourly rows whose B/VTL/VTU are NaN (the
    # upstream calculator cannot evaluate thermal wind at every step) are NOT
    # counted as original — there is no computed value to preserve.
    cps["cps_original"] = cps["cps_B"].notna()

    n_before = len(df)
    df = df.merge(cps, on=["track_id", "date"], how="left")
    assert len(df) == n_before, f"CPS merge changed row count: {n_before} → {len(df)}"

    matched = int(df["cps_original"].fillna(False).sum())
    print(f"  Matched {matched:,} timesteps with computed CPS parameters "
          f"({100 * matched / len(df):.1f}% of rows)")

    df["cps_original"] = df["cps_original"].fillna(False).astype(bool)

    # ── Interpolate within each track ─────────────────────────────────────────
    df = df.sort_values(["track_id", "date"]).reset_index(drop=True)
    grouped = df.groupby("track_id", sort=False)

    present_linear = [c for c in CPS_LINEAR_COLS if c in df.columns]
    if present_linear:
        df[present_linear] = grouped[present_linear].transform(
            lambda s: s.interpolate(method="linear", limit_area="inside")
        )

    for col in CPS_CIRCULAR_COLS:
        if col in df.columns:
            df[col] = grouped[col].transform(_interpolate_circular)

    if "cps_over_ocean" in df.columns:
        df["cps_over_ocean"] = grouped["cps_over_ocean"].transform(
            lambda s: s.ffill().bfill()
        )

    # cps_state: fill the two 1-hourly gaps INSIDE a run. A forward fill bounded
    # by a backward fill of the same width confines the fill to the span between
    # the run's own 3-hourly endpoints, so no timestep outside an accepted run
    # ever acquires a state — an unbounded ffill would extend every run to the
    # end of the track.
    if "cps_state" in df.columns:
        def _fill_state(s):
            v = s.replace("", pd.NA)
            return v.ffill(limit=2).where(v.bfill(limit=2).notna())
        df["cps_state"] = grouped["cps_state"].transform(_fill_state).fillna("")

    # ── Labels ────────────────────────────────────────────────────────────────
    derived = _classify_cps(df["cps_B"], df["cps_VTL"], df["cps_VTU"])
    orig = df["_cps_class_orig"]

    # Sanity check: re-deriving the label at ORIGINAL timesteps must reproduce
    # the upstream classifier. A mismatch means the thresholds coded here have
    # drifted from the ones used upstream, which would silently corrupt every
    # interpolated label.
    check = df["cps_original"] & orig.notna()
    if check.any():
        agree = (derived[check] == orig[check]).mean()
        print(f"  Threshold cross-check against upstream labels: {100 * agree:.2f}% agreement")
        if agree < 0.99:
            print("  ⚠ WARNING: thresholds disagree with the upstream classifier.")
            print("    Interpolated labels may be inconsistent — review CPS_CLASS_RULES.")

    # Originals verbatim; interpolated rows get the freshly derived label.
    df["cps_class"] = orig.where(df["cps_original"], derived)
    # Rows outside any CPS coverage stay explicitly unlabelled.
    df.loc[df["cps_B"].isna(), "cps_class"] = df.loc[df["cps_B"].isna(), "cps_class"].fillna(
        CPS_UNCLASSIFIED
    )
    df = df.drop(columns=["_cps_class_orig"])

    coverage = 100 * df["cps_B"].notna().mean()
    print(f"  ✓ CPS coverage after interpolation: "
          f"{100 * matched / len(df):.1f}% → {coverage:.1f}%")

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

    # CPS coverage (absent when the optional CPS source was not available)
    if "cps_class" in df.columns:
        stats["cps_present"] = True
        stats["cps_classes"] = df["cps_class"].value_counts(dropna=False).to_dict()
        stats["cps_original_pct"] = round(100 * df["cps_original"].mean(), 1)
        stats["cps_coverage_pct"] = round(100 * df["cps_B"].notna().mean(), 1)
        stats["cps_tracks"] = int(df.loc[df["cps_original"], "track_id"].nunique())
    else:
        stats["cps_present"] = False
    
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
    report.append("Cyclone Phase Space (CPS)")
    report.append("─" * 70)
    if stats.get("cps_present"):
        report.append(f"  Cyclones with computed CPS : {stats['cps_tracks']:,} "
                      f"of {stats['unique_tracks']:,}")
        report.append(f"  Timesteps computed (3-h)   : {stats['cps_original_pct']:5.1f}%")
        report.append(f"  Timesteps after interp.    : {stats['cps_coverage_pct']:5.1f}%")
        report.append("")
        report.append("  Per-timestep class distribution (after interpolation):")
        total = stats["total_rows"]
        for cls, count in sorted(stats["cps_classes"].items(), key=lambda x: -x[1]):
            pct = 100 * count / total
            report.append(f"    {str(cls):18s}: {count:8,} rows ({pct:5.1f}%)")
        report.append("")
        report.append("  Labels at original timesteps are carried through verbatim;")
        report.append("  interpolated rows are labelled by applying the published")
        report.append("  thresholds to the interpolated parameters. Use 'cps_original'")
        report.append("  to restrict to computed values — persistence-based statistics")
        report.append("  (the >= 36 h gate) MUST use original rows only.")
    else:
        report.append("  CPS source not available — no cps_* columns in this build.")
        report.append("  Expected at: data/raw/cps_parameters_SAt.csv")
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

    # Merge Cyclone Phase Space and interpolate (3h → 1h). No-op when absent.
    df = merge_cps(df)

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
