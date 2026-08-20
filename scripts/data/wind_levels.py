#!/usr/bin/env python3
"""
Registry of the cyclone-relative wind diagnostics ingested by the monitor.

Every wind level the pipeline knows about is described here, once. Adding a new
level (say 50 m, or a precipitation analogue built the same way) means adding one
entry to WIND_LEVELS — no new download script, no new loader, no new merger.

Provenance
----------
Both datasets are by the same author and were built with the same method, so
they share a layout and a set of conventions:

    Paredes Quispe, Jonathan Aaron (Universidade de Sao Paulo,
    ORCID 0000-0001-8660-745X), CC-BY-4.0.

For each cyclone a 20 deg x 20 deg Lagrangian domain is centred on the core
(tracked by relative vorticity at 850 hPa). Fields are extracted at every
timestep of the life cycle, then the absolute maximum and the 99th percentile
are taken inside a circular mask of 9.5 deg radius after Gaussian smoothing
(sigma = 0.25). Statistics are reported separately for the four quadrants.

Archive layout (identical for every level, verified against both records)
------------------------------------------------------------------------
    wind{L}.tar.gz                              <- the single Zenodo file
      +-- {YYYY}_wind{L}.tar.gz                 (43 of them, 1979-2021)
            +-- {YYYY}_wind{L}/
                  +-- {track_id}_wind{L}_max.csv
                  +-- {track_id}_wind{L}_p99.csv

The nesting is not described in either Zenodo record; it is why
scripts/data/download_wind.py exists.

Per-file columns (18, same order for every level)
-------------------------------------------------
    {QD}_lo_{metric}_wind{L}    longitude of the extremum        [deg]
    {QD}_la_{metric}_wind{L}    latitude of the extremum         [deg]
    {QD}_mx_{metric}_wind{L}    wind speed                       [m s-1]
    {QD}_dis_{metric}_wind{L}   distance to the cyclone centre   [deg]
    timestamp                   UTC-naive, 1-hourly
    mx_mx_{metric}              see the warning below

for QD in (NW, NE, SW, SE) and metric in (max, p99).

WARNING - mx_mx_{metric} is a LABEL, not a value
------------------------------------------------
The Zenodo description for the 10 m record states that "the columns mx_mx_max
and mx_mx_p99 contain the maximum value across all quadrants". They do not.
Inspection of both datasets shows the column holds the NAME of the quadrant
that carries the extremum ("NE", "SW", ...). The numeric track-wide maximum
must therefore be taken across the four {QD}_mx_{metric}_wind{L} columns; see
track_intensity_columns() below. Do not read mx_mx_* as a number.

Distance convention
-------------------
'dis' is a plain Euclidean distance in degrees, hypot(dlon, dlat) - NOT a
great-circle distance, despite what docs/wind-integration.md once claimed.
This was verified locally to 0.0000 deg against the quadrant offsets, which is
also what makes the cyclone centre exactly recoverable from any two quadrants.

Quadrant labels
---------------
The producer's N/S labels are inverted relative to the geographic convention.
The correction lives in the presentation layer (site/src/lib/windQuadrants.ts)
and is applied identically to every level. It is deliberately NOT applied here:
the ingested columns keep the source's own names so that the stored data stay a
faithful copy of the archive.

------------------------------------------------------------------------------
"""

from __future__ import annotations

# Quadrants, in the source's own naming and order.
QUADRANTS: list[str] = ["NW", "NE", "SW", "SE"]

# The two statistics provided per quadrant per timestep.
METRICS: list[str] = ["max", "p99"]

# Fields stored per quadrant, in source column order.
FIELDS: list[str] = ["lon", "lat", "val", "dist"]

# Source field abbreviation -> standardised suffix.
_FIELD_FROM_SOURCE: dict[str, str] = {
    "lo": "lon", "la": "lat", "mx": "val", "dis": "dist",
}

# 16 quadrant columns + timestamp + the global-quadrant label.
EXPECTED_COLS_PER_FILE: int = 18


WIND_LEVELS: dict[str, dict] = {
    "wind10": {
        "prefix": "w10",
        "height_m": 10,
        "label": "Wind 10 m",
        "unit": "m s-1",
        "source_ref": "wind10",           # key into data/metadata/sources.json
        "zenodo_record": "19378255",
        "doi": "10.5281/zenodo.19378255",
        "archive": "wind10.tar.gz",
        "md5": "753030a447d337e6375bd14463ac3a23",
        "bytes": 177_490_101,
    },
    "wind100": {
        "prefix": "w100",
        "height_m": 100,
        "label": "Wind 100 m",
        "unit": "m s-1",
        "source_ref": "wind100",
        "zenodo_record": "19353037",
        "doi": "10.5281/zenodo.19353037",
        "archive": "wind100.tar.gz",
        "md5": "4eaef49b4c53b5ef81cece06680fca31",
        "bytes": 182_331_000,
    },
}

# Deterministic order wherever levels are iterated (reports, schemas, JSON keys).
LEVEL_ORDER: list[str] = ["wind10", "wind100"]

# Post-extraction expectations, shared by every level.
EXPECTED_YEAR_DIRS: int = 43      # 1979-2021
EXPECTED_MIN_CSV: int = 15_000


def level_config(level: str) -> dict:
    """Return the registry entry for `level`, with a helpful error if unknown."""
    try:
        return WIND_LEVELS[level]
    except KeyError:
        raise ValueError(
            f"unknown wind level {level!r}; known levels: {', '.join(LEVEL_ORDER)}"
        ) from None


def source_column(level: str, metric: str, quadrant: str, field: str) -> str:
    """Original column name in the archive, e.g. 'NE_mx_max_wind100'."""
    abbrev = {v: k for k, v in _FIELD_FROM_SOURCE.items()}[field]
    return f"{quadrant}_{abbrev}_{metric}_{level}"


def std_column(level: str, metric: str, quadrant: str, field: str) -> str:
    """Standardised column name, e.g. 'w100max_NE_val'."""
    return f"{level_config(level)['prefix']}{metric}_{quadrant}_{field}"


def global_quad_column(level: str, metric: str) -> str:
    """Standardised name of the quadrant-label column, e.g. 'w100max_global_quad'."""
    return f"{level_config(level)['prefix']}{metric}_global_quad"


def rename_map(level: str, metric: str) -> dict[str, str]:
    """Original -> standardised column mapping for one level/metric file."""
    mapping = {
        source_column(level, metric, qd, fld): std_column(level, metric, qd, fld)
        for qd in QUADRANTS
        for fld in FIELDS
    }
    mapping[f"mx_mx_{metric}"] = global_quad_column(level, metric)
    return mapping


def std_columns(level: str, metric: str) -> list[str]:
    """All 17 standardised columns emitted for one level/metric."""
    return [
        std_column(level, metric, qd, fld) for qd in QUADRANTS for fld in FIELDS
    ] + [global_quad_column(level, metric)]


def all_std_columns(level: str) -> list[str]:
    """All 34 standardised columns emitted for one level (max + p99)."""
    return [c for metric in METRICS for c in std_columns(level, metric)]


def track_intensity_columns(level: str) -> list[str]:
    """
    The four columns whose row-wise maximum is the timestep wind maximum.

    Track intensity for a level is max over timesteps of max over quadrants of
    these, mirroring how max_vor42 is the max of vor42 over the track. Only the
    'max' metric is used - never p99.
    """
    return [std_column(level, "max", qd, "val") for qd in QUADRANTS]


def file_pattern(level: str) -> str:
    """Regex matching '{track_id}_wind{L}_{max|p99}.csv' for this level."""
    return rf"^(\d{{8}})_{level}_(max|p99)\.csv$"


def year_dir_pattern(level: str) -> str:
    """Regex matching the per-year subdirectory name, e.g. '1979_wind100'."""
    return rf"^\d{{4}}_{level}$"
