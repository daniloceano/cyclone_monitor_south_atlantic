#!/usr/bin/env python3
"""
Wind100 data loader module.

Provides functions and constants for reading, standardizing, and indexing
per-cyclone wind100 CSV files from data/raw/wind100/.

Background
----------
The wind100 dataset (Zenodo DOI: 10.5281/zenodo.19353037) provides statistics
of 100 m wind speed associated with extratropical cyclones in the South Atlantic.
Data are derived from ERA5 reanalysis in a Lagrangian reference frame centred on
the cyclone core, tracked by relative vorticity at 850 hPa (vor42).

Two wind speed statistics are provided per cyclone per timestep:
  - wind100_max : absolute maximum 100 m wind speed within each quadrant
  - wind100_p99 : 99th percentile 100 m wind speed within each quadrant

Quadrant convention (relative to cyclone centre)
-------------------------------------------------
  NW = Northwest  |  NE = Northeast
  SW = Southwest  |  SE = Southeast

File organisation
-----------------
  data/raw/wind100/{YYYY}_wind100/{track_id}_wind100_{metric}.csv
  where:
    YYYY     = year of the cyclone
    track_id = 8-digit identifier (YYYYNNNN), same scheme as main dataset
    metric   = 'max' or 'p99'

Column name standardisation
----------------------------
Original max-file columns        → Standardised name
  {QD}_lo_max_wind100            → w100max_{QD}_lon     (longitude, °)
  {QD}_la_max_wind100            → w100max_{QD}_lat     (latitude, °)
  {QD}_mx_max_wind100            → w100max_{QD}_val     (wind speed, m s⁻¹)
  {QD}_dis_max_wind100           → w100max_{QD}_dist    (distance to centre, °)
  mx_mx_max                      → w100max_global_quad  (quadrant with max value)
  timestamp                      → (used as merge key; not retained in output)

Original p99-file columns        → Standardised name
  {QD}_lo_p99_wind100            → w100p99_{QD}_lon
  {QD}_la_p99_wind100            → w100p99_{QD}_lat
  {QD}_mx_p99_wind100            → w100p99_{QD}_val
  {QD}_dis_p99_wind100           → w100p99_{QD}_dist
  mx_mx_p99                      → w100p99_global_quad
  timestamp                      → (used as merge key; not retained in output)

where QD ∈ {NW, NE, SW, SE}

Usage
-----
  from scripts.data.load_wind100 import index_wind100_files, load_wind100_file

  index = index_wind100_files(wind100_dir)
  # index[19790001] = {'max': Path(...), 'p99': Path(...)}

  df_max = load_wind100_file(index[19790001]['max'], metric='max')
  # Returns DataFrame with standardised column names and 'timestamp' as datetime index.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import re
from pathlib import Path

import pandas as pd

# ─── Constants ────────────────────────────────────────────────────────────────

QUADRANTS = ["NW", "NE", "SW", "SE"]

# Mapping: original column name → standardised column name (wind100_max files)
COLUMN_RENAME_MAX: dict[str, str] = {}
for _qd in QUADRANTS:
    COLUMN_RENAME_MAX[f"{_qd}_lo_max_wind100"] = f"w100max_{_qd}_lon"
    COLUMN_RENAME_MAX[f"{_qd}_la_max_wind100"] = f"w100max_{_qd}_lat"
    COLUMN_RENAME_MAX[f"{_qd}_mx_max_wind100"] = f"w100max_{_qd}_val"
    COLUMN_RENAME_MAX[f"{_qd}_dis_max_wind100"] = f"w100max_{_qd}_dist"
COLUMN_RENAME_MAX["mx_mx_max"] = "w100max_global_quad"

# Mapping: original column name → standardised column name (wind100_p99 files)
COLUMN_RENAME_P99: dict[str, str] = {}
for _qd in QUADRANTS:
    COLUMN_RENAME_P99[f"{_qd}_lo_p99_wind100"] = f"w100p99_{_qd}_lon"
    COLUMN_RENAME_P99[f"{_qd}_la_p99_wind100"] = f"w100p99_{_qd}_lat"
    COLUMN_RENAME_P99[f"{_qd}_mx_p99_wind100"] = f"w100p99_{_qd}_val"
    COLUMN_RENAME_P99[f"{_qd}_dis_p99_wind100"] = f"w100p99_{_qd}_dist"
COLUMN_RENAME_P99["mx_mx_p99"] = "w100p99_global_quad"

# Expected column count per metric file (16 quadrant cols + timestamp + global_quad)
EXPECTED_COLS_PER_FILE = 18

# Regex for parsing filename: {track_id}_wind100_{metric}.csv
_FILE_PATTERN = re.compile(r"^(\d{8})_wind100_(max|p99)\.csv$")

# Standardised wind100 column lists (no timestamp, no track_id)
WIND100_MAX_COLS: list[str] = [f"w100max_{qd}_{fld}" for qd in QUADRANTS for fld in ("lon", "lat", "val", "dist")] + ["w100max_global_quad"]
WIND100_P99_COLS: list[str] = [f"w100p99_{qd}_{fld}" for qd in QUADRANTS for fld in ("lon", "lat", "val", "dist")] + ["w100p99_global_quad"]


# ─── Public functions ─────────────────────────────────────────────────────────

def index_wind100_files(wind100_dir: Path) -> dict[int, dict[str, Path]]:
    """
    Scan wind100_dir and build an index of all available wind100 files.

    Parameters
    ----------
    wind100_dir : Path
        Root directory, e.g., data/raw/wind100/. Expected to contain
        subdirectories named {YYYY}_wind100/.

    Returns
    -------
    dict[int, dict[str, Path]]
        Mapping from track_id (int) to a dict with keys 'max' and/or 'p99'
        pointing to the respective CSV file path.

        Example:
            {19790001: {'max': Path('...19790001_wind100_max.csv'),
                        'p99': Path('...19790001_wind100_p99.csv')}}

    Notes
    -----
    - Track IDs are integers (YYYYNNNN format).
    - A track may have only 'max' or only 'p99' if one file is missing.
    - Year subdirectories named anything other than {YYYY}_wind100/ are skipped
      with a warning.
    """
    if not wind100_dir.is_dir():
        raise FileNotFoundError(f"wind100 directory not found: {wind100_dir}")

    index: dict[int, dict[str, Path]] = {}
    skipped_dirs: list[str] = []
    skipped_files: list[str] = []

    for year_dir in sorted(wind100_dir.iterdir()):
        if not year_dir.is_dir():
            continue
        # Accept {YYYY}_wind100 naming
        if not re.match(r"^\d{4}_wind100$", year_dir.name):
            skipped_dirs.append(year_dir.name)
            continue

        for csv_file in sorted(year_dir.iterdir()):
            if not csv_file.is_file() or csv_file.suffix != ".csv":
                continue
            m = _FILE_PATTERN.match(csv_file.name)
            if not m:
                skipped_files.append(str(csv_file))
                continue
            track_id = int(m.group(1))
            metric = m.group(2)  # 'max' or 'p99'
            if track_id not in index:
                index[track_id] = {}
            index[track_id][metric] = csv_file

    if skipped_dirs:
        print(f"  ⚠ Skipped {len(skipped_dirs)} unrecognised subdirectories in wind100/")
    if skipped_files:
        print(f"  ⚠ Skipped {len(skipped_files)} unrecognised files in wind100/")

    return index


def load_wind100_file(path: Path, metric: str) -> pd.DataFrame:
    """
    Load a single wind100 CSV file and standardise its column names.

    Parameters
    ----------
    path : Path
        Absolute path to the CSV file.
    metric : str
        Either 'max' or 'p99'. Determines which renaming map is applied.

    Returns
    -------
    pd.DataFrame
        DataFrame with:
        - 'timestamp' column as timezone-naive UTC datetime (parsed from CSV)
        - Standardised wind100 columns (see COLUMN_RENAME_MAX / COLUMN_RENAME_P99)
        - No track_id column (caller supplies context)

    Raises
    ------
    ValueError
        If metric is not 'max' or 'p99'.
    FileNotFoundError
        If path does not exist.

    Notes
    -----
    - Timestamps are parsed without timezone (naive UTC, consistent with main
      dataset's 'date' column).
    - Duplicate timestamps within a single file are flagged as a warning and
      kept (not silently dropped) so the caller can decide how to handle them.
    - Unexpected columns (beyond the standard 18) are preserved with a warning.
    """
    if metric not in ("max", "p99"):
        raise ValueError(f"metric must be 'max' or 'p99', got: {metric!r}")
    if not path.exists():
        raise FileNotFoundError(f"Wind100 file not found: {path}")

    rename_map = COLUMN_RENAME_MAX if metric == "max" else COLUMN_RENAME_P99

    df = pd.read_csv(path, parse_dates=["timestamp"])

    # Warn about unexpected column count
    if len(df.columns) != EXPECTED_COLS_PER_FILE:
        print(
            f"  ⚠ {path.name}: expected {EXPECTED_COLS_PER_FILE} columns, "
            f"found {len(df.columns)}"
        )

    # Rename to standardised names
    df = df.rename(columns=rename_map)

    # Check for unrecognised columns (not in rename map + not 'timestamp')
    known = set(rename_map.values()) | {"timestamp"}
    extra = [c for c in df.columns if c not in known]
    if extra:
        print(f"  ⚠ {path.name}: unexpected extra columns: {extra}")

    # Warn on duplicate timestamps (should not occur in well-formed files)
    if df["timestamp"].duplicated().any():
        n_dup = df["timestamp"].duplicated().sum()
        print(f"  ⚠ {path.name}: {n_dup} duplicate timestamp(s) — kept as-is")

    return df


def describe_rename_map() -> str:
    """
    Return a human-readable table of all original→standardised column renames.

    Useful for documentation and provenance logging.
    """
    lines = ["Column rename map (wind100)", "─" * 60]
    lines.append(f"  {'Original (max file)':<35} → {'Standardised'}")
    lines.append("  " + "─" * 56)
    for orig, std in COLUMN_RENAME_MAX.items():
        lines.append(f"  {orig:<35}   {std}")
    lines.append("")
    lines.append(f"  {'Original (p99 file)':<35} → {'Standardised'}")
    lines.append("  " + "─" * 56)
    for orig, std in COLUMN_RENAME_P99.items():
        lines.append(f"  {orig:<35}   {std}")
    return "\n".join(lines)
