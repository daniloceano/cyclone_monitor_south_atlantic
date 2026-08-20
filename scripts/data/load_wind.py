#!/usr/bin/env python3
"""
Loader for the cyclone-relative wind datasets (any level in the registry).

Replaces the wind100-only load_wind100.py. Every function takes a `level`
argument ("wind10", "wind100", ...) and reads the layout, column names and
conventions from scripts/data/wind_levels.py, which is the single place a new
level gets defined. See that module for provenance, the archive layout, the
column reference, and the two conventions that are easy to get wrong
(mx_mx_* is a quadrant LABEL, and 'dis' is Euclidean degrees).

Column standardisation
----------------------
    {QD}_lo_{metric}_{level}   ->  {prefix}{metric}_{QD}_lon    [deg]
    {QD}_la_{metric}_{level}   ->  {prefix}{metric}_{QD}_lat    [deg]
    {QD}_mx_{metric}_{level}   ->  {prefix}{metric}_{QD}_val    [m s-1]
    {QD}_dis_{metric}_{level}  ->  {prefix}{metric}_{QD}_dist   [deg]
    mx_mx_{metric}             ->  {prefix}{metric}_global_quad [label]
    timestamp                  ->  kept as the merge key

with prefix 'w10' / 'w100' and QD in (NW, NE, SW, SE).

Usage
-----
    from scripts.data.load_wind import index_wind_files, load_wind_file

    index = index_wind_files(Path("data/raw/wind100"), "wind100")
    # index[19790001] == {'max': Path(...), 'p99': Path(...)}

    df = load_wind_file(index[19790001]["max"], "wind100", "max")

------------------------------------------------------------------------------
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from wind_levels import (  # noqa: F401  (re-exported for convenience)
    EXPECTED_COLS_PER_FILE,
    METRICS,
    QUADRANTS,
    all_std_columns,
    file_pattern,
    global_quad_column,
    level_config,
    rename_map,
    std_columns,
    track_intensity_columns,
    year_dir_pattern,
)


def wind_dir(raw_dir: Path, level: str) -> Path:
    """Directory holding the extracted tree for `level`, e.g. data/raw/wind100."""
    return raw_dir / level


def index_wind_files(level_dir: Path, level: str) -> dict[int, dict[str, Path]]:
    """
    Scan `level_dir` and index every per-cyclone file for `level`.

    Parameters
    ----------
    level_dir : Path
        Root of the extracted tree, e.g. data/raw/wind100/. Expected to hold
        subdirectories named {YYYY}_{level}/.
    level : str
        Registry key, e.g. "wind100".

    Returns
    -------
    dict[int, dict[str, Path]]
        track_id -> {'max': Path, 'p99': Path}. A track may carry only one of
        the two if the other file is absent.

    Notes
    -----
    Track IDs are read from the filename (YYYYNNNN); they are not a column in
    the source files. Unrecognised directories and files are counted and
    reported rather than silently ignored.
    """
    if not level_dir.is_dir():
        raise FileNotFoundError(f"{level} directory not found: {level_dir}")

    year_re = re.compile(year_dir_pattern(level))
    file_re = re.compile(file_pattern(level))

    index: dict[int, dict[str, Path]] = {}
    skipped_dirs: list[str] = []
    skipped_files: list[str] = []

    for year_dir in sorted(level_dir.iterdir()):
        if not year_dir.is_dir():
            continue
        if not year_re.match(year_dir.name):
            skipped_dirs.append(year_dir.name)
            continue

        for csv_file in sorted(year_dir.iterdir()):
            if not csv_file.is_file() or csv_file.suffix != ".csv":
                continue
            m = file_re.match(csv_file.name)
            if not m:
                skipped_files.append(str(csv_file))
                continue
            index.setdefault(int(m.group(1)), {})[m.group(2)] = csv_file

    if skipped_dirs:
        print(f"  ! skipped {len(skipped_dirs)} unrecognised subdirectories in {level}/")
    if skipped_files:
        print(f"  ! skipped {len(skipped_files)} unrecognised files in {level}/")

    return index


def load_wind_file(path: Path, level: str, metric: str) -> pd.DataFrame:
    """
    Read one per-cyclone file and standardise its column names.

    Returns a DataFrame with a UTC-naive 'timestamp' column (the merge key) plus
    the 17 standardised columns for this level/metric. No track_id column: the
    caller supplies that context from the filename.

    Duplicate timestamps are reported and kept, never silently dropped, so the
    caller decides. Unexpected columns are preserved with a warning.
    """
    if metric not in METRICS:
        raise ValueError(f"metric must be one of {METRICS}, got: {metric!r}")
    if not path.exists():
        raise FileNotFoundError(f"{level} file not found: {path}")

    mapping = rename_map(level, metric)
    df = pd.read_csv(path, parse_dates=["timestamp"])

    if len(df.columns) != EXPECTED_COLS_PER_FILE:
        print(
            f"  ! {path.name}: expected {EXPECTED_COLS_PER_FILE} columns, "
            f"found {len(df.columns)}"
        )

    df = df.rename(columns=mapping)

    known = set(mapping.values()) | {"timestamp"}
    extra = [c for c in df.columns if c not in known]
    if extra:
        print(f"  ! {path.name}: unexpected extra columns: {extra}")

    if df["timestamp"].duplicated().any():
        n_dup = int(df["timestamp"].duplicated().sum())
        print(f"  ! {path.name}: {n_dup} duplicate timestamp(s) - kept as-is")

    return df


def timestep_max(df: pd.DataFrame, level: str) -> pd.Series:
    """
    Per-timestep wind maximum: the largest of the four quadrant 'max' values.

    This is the quantity the global-quadrant label points at, and the one whose
    track-wide maximum defines wind intensity. Uses the 'max' metric only.
    """
    cols = [c for c in track_intensity_columns(level) if c in df.columns]
    if not cols:
        return pd.Series(index=df.index, dtype="float64")
    return df[cols].max(axis=1, skipna=True)


def describe_rename_map(level: str) -> str:
    """Human-readable table of original -> standardised renames, for provenance."""
    lines = [f"Column rename map ({level})", "-" * 60]
    for metric in METRICS:
        lines.append(f"  {'Original (' + metric + ' file)':<35} -> Standardised")
        lines.append("  " + "-" * 56)
        for orig, std in rename_map(level, metric).items():
            lines.append(f"  {orig:<35}    {std}")
        lines.append("")
    return "\n".join(lines)
