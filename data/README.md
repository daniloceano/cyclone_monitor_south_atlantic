# Data Directory

This directory contains all datasets used by the South Atlantic Cyclone Monitor.

## 📋 Directory Structure

```
data/
├── raw/                                        ← Source data (gitignored)
│   ├── tracks_SAt_source.csv                   ← Full LEC dataset from Zenodo (~180 MB)
│   ├── tracks_SAt_filtered_with_energetics.csv ← Symlink to above (legacy name)
│   └── wind100/                                ← 100 m wind statistics (482 MB, local)
│       ├── 1979_wind100/
│       │   ├── 19790001_wind100_max.csv
│       │   ├── 19790001_wind100_p99.csv
│       │   └── ...
│       ├── 1980_wind100/
│       │   └── ...
│       └── ... (up to 2021_wind100/)
├── interim/                                    ← Intermediate products (gitignored)
│   └── README.md
├── processed/                                  ← Final data products
│   ├── tracks_south_atlantic_consolidated.csv  ← Flat CSV: all tracks + LEC (~143 MB)
│   ├── tracks_south_atlantic_consolidated.txt  ← Validation report for above
│   └── tracks_by_id/                           ← Per-cyclone enriched Parquet files
│       ├── merge_report.txt                    ← Wind100 merge coverage report
│       ├── 1979/
│       │   ├── 01/
│       │   │   ├── 19790001.parquet
│       │   │   └── ...
│       │   └── ... (one subdirectory per month)
│       ├── 1980/
│       └── ... (up to 2021/)
└── README.md
```

---

## 🔄 Data Pipeline

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Zenodo (DOI: 10.5281/zenodo.18133432)                               │
│ • 6,789 cyclone tracks, 631,009 timesteps                           │
│ • LEC diagnostics + lifecycle phases + genesis regions              │
└─────────────────────────────────────────────────────────────────────┘
             │
             ↓  scripts/data/download_source_data.py
             │
┌─────────────────────────────────────────────────────────────────────┐
│ data/raw/tracks_SAt_source.csv (~180 MB)                            │
│ • 1-hourly positions; 3-hourly LEC energetics (NaN at interim hours)│
└─────────────────────────────────────────────────────────────────────┘
             │
             ↓  scripts/data/preprocess_data.py
             │
┌─────────────────────────────────────────────────────────────────────┐
│ data/processed/tracks_south_atlantic_consolidated.csv (~143 MB)     │
│ • All columns standardised (renamed, geometry dropped)              │
│ • LEC energetics interpolated from 3-hourly to 1-hourly            │
└─────────────────────────────────────────────────────────────────────┘
             │                              │
             ↓  scripts/preprocess_data.py  ↓  scripts/data/merge_wind100.py
             │                              │
┌────────────────────────┐    ┌─────────────────────────────────────────┐
│ site/public/data/      │    │ data/processed/tracks_by_id/            │
│ ├── summary.json       │    │ └── {YYYY}/{MM:02d}/{track_id}.parquet  │
│ └── details/{year}.json│    │ • Main data + wind100_max + wind100_p99 │
│ (Web application)      │    │ • 66 columns per file                   │
└────────────────────────┘    └─────────────────────────────────────────┘
```

### Running the Pipeline

```bash
# Full pipeline: download → preprocess → generate consolidated CSV
python3 scripts/data/run_pipeline.py

# Skip download (use existing source file)
python3 scripts/data/run_pipeline.py --skip-download

# Also merge wind100 data into per-track Parquet files
python3 scripts/data/run_pipeline.py --skip-download --wind100

# Run wind100 merge only (requires consolidated CSV to exist)
conda run -n data python scripts/data/merge_wind100.py

# Dry run: check coverage without writing output
conda run -n data python scripts/data/merge_wind100.py --dry-run

# Process a single year (for testing)
conda run -n data python scripts/data/merge_wind100.py --year 1979 --limit 10
```

---

## 🎯 Dataset 1: Cyclone Tracks + LEC Energetics

**Source**: Zenodo [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)
**Local file**: `data/raw/tracks_SAt_source.csv` (~180 MB, gitignored)

### Content
- 631,009 rows (individual track timesteps at 1-hourly resolution)
- 6,789 unique cyclones (1979–2020; a few extend to early January 2021)
- 31 columns: position, vorticity, LEC energetics, lifecycle phase, genesis region

### Column Reference

| Column | Type | Description | Resolution |
|--------|------|-------------|------------|
| `track_id` | int64 | Cyclone identifier (YYYYNNNN) | — |
| `date` | datetime | UTC timestamp | 1-hourly |
| `lon` | float64 | Longitude (°) | 1-hourly |
| `lat` | float64 | Latitude (°) | 1-hourly |
| `vor42` | float64 | Relative vorticity (×10⁻⁵ s⁻¹) | 1-hourly |
| `lec_original` | bool | True = original 3-hourly LEC value; False = interpolated | — |
| `region` | string | Genesis region code (ARG, LA-PLATA, SE-BR) | — |
| `period` | string | Lifecycle phase (from Cyclophaser) | 1-hourly |
| `Az`, `Ae` | float64 | Available potential energy (J m⁻²) | 3-h → 1-h |
| `Kz`, `Ke` | float64 | Kinetic energy (J m⁻²) | 3-h → 1-h |
| `Ca`, `Ck`, `Ce`, `Cz` | float64 | Conversion terms (W m⁻²) | 3-h → 1-h |
| `BAz`, `BAe`, `BKz`, `BKe` | float64 | Boundary flux terms (W m⁻²) | 3-h → 1-h |
| `BΦZ`, `BΦE` | float64 | Boundary geopotential terms (W m⁻²) | 3-h → 1-h |
| `Gz`, `Ge` | float64 | Generation terms (W m⁻²) | 3-h → 1-h |
| `dAzdt`, `dAedt`, `dKzdt`, `dKedt` | float64 | Tendencies via finite diff. (W m⁻²) | 3-h → 1-h |
| `RGz`, `RGe`, `RKz`, `RKe` | float64 | Residual terms (W m⁻²) | 3-h → 1-h |

### Temporal Resolution Note

- **Track positions** (lon, lat, vor42): 1-hourly
- **LEC energetics**: originally 3-hourly; linearly interpolated to 1-hourly per track
- ~67% of raw timesteps have NaN for LEC energetics (expected, not data loss)
- The `lec_original` flag distinguishes original 3-hourly values (True) from interpolated (False)

### Genesis Regions

| Code | Full Name | Description |
|------|-----------|-------------|
| ARG | Argentina / Patagonia | Southern Argentina and Patagonian coast |
| LA-PLATA | SE South America | La Plata basin and Río de la Plata region |
| SE-BR | SE Brazil Coast | Coastal baroclinic zone off southeastern Brazil |

### Lifecycle Phases (Cyclophaser)

`incipient`, `intensification`, `mature`, `decay`,
`intensification 2`, `mature 2`, `decay 2`, `residual`

---

## 🌬️ Dataset 2: Wind100 — 100 m Wind Statistics

**Source**: Zenodo [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037)
**Local path**: `data/raw/wind100/` (482 MB, ~15,974 CSV files, gitignored)

### What This Dataset Contains

Maximum and 99th-percentile statistics of 100 m wind speed associated with
extratropical cyclones in the South Atlantic. Derived from ERA5 reanalysis in a
Lagrangian (cyclone-centred) reference frame.

For each cyclone track and each timestep, values are reported separately for
four quadrants relative to the cyclone centre:

```
  NW | NE       (relative to cyclone centre)
  ───┼───
  SW | SE
```

### File Organisation

```
data/raw/wind100/
  {YYYY}_wind100/
    {track_id}_wind100_max.csv   ← absolute maximum per quadrant
    {track_id}_wind100_p99.csv   ← 99th percentile per quadrant
```

| Parameter | Value |
|-----------|-------|
| Years covered (Zenodo record) | 1979–2020 |
| Years present locally | 1979–2021 (see note below) |
| Unique track IDs | ~7,987 |
| Files total | ~15,974 CSV files |
| Temporal resolution | 1-hourly |

### Raw Column Schema

**wind100_max files** (18 columns):

| Original column | Standardised name | Description |
|----------------|-------------------|-------------|
| `NW_lo_max_wind100` | `w100max_NW_lon` | NW quadrant longitude of wind maximum (°) |
| `NW_la_max_wind100` | `w100max_NW_lat` | NW quadrant latitude of wind maximum (°) |
| `NW_mx_max_wind100` | `w100max_NW_val` | NW quadrant maximum wind speed (m s⁻¹) |
| `NW_dis_max_wind100` | `w100max_NW_dist` | NW quadrant distance to cyclone centre (°) |
| (same pattern for NE, SW, SE) | | |
| `mx_mx_max` | `w100max_global_quad` | Quadrant with the global timestep maximum (NW/NE/SW/SE) |
| `timestamp` | — | UTC timestamp (merge key, not retained in output) |

**wind100_p99 files** (18 columns, identical structure):

| Original column | Standardised name | Description |
|----------------|-------------------|-------------|
| `NW_lo_p99_wind100` | `w100p99_NW_lon` | NW quadrant longitude of p99 extremum (°) |
| `NW_la_p99_wind100` | `w100p99_NW_lat` | NW quadrant latitude of p99 extremum (°) |
| `NW_mx_p99_wind100` | `w100p99_NW_val` | NW quadrant 99th-percentile wind speed (m s⁻¹) |
| `NW_dis_p99_wind100` | `w100p99_NW_dist` | NW quadrant distance to cyclone centre (°) |
| (same pattern for NE, SW, SE) | | |
| `mx_mx_p99` | `w100p99_global_quad` | Quadrant with the global timestep p99 maximum (NW/NE/SW/SE) |
| `timestamp` | — | UTC timestamp (merge key, not retained in output) |

### Note on 2021 Data

The Zenodo record for DOI 10.5281/zenodo.19353037 describes coverage for
1979–2020. However, a `2021_wind100/` folder is present locally with 1 track
(`20210007`). This is consistent with the main dataset, which extends to
2021-01-07. The 2021 data are processed and included in the output. This
discrepancy is documented in the merge report
(`data/processed/tracks_by_id/merge_report.txt`).

---

## 📦 Dataset 3: Per-Cyclone Parquet Files (Final Product)

**Location**: `data/processed/tracks_by_id/`
**Format**: Parquet (pyarrow)
**Generated by**: `scripts/data/merge_wind100.py`

### Directory Structure

```
data/processed/tracks_by_id/
  merge_report.txt            ← Coverage statistics and discrepancy notes
  {YYYY}/
    {MM:02d}/
      {track_id}.parquet      ← One file per cyclone
```

The year and month directories come from the **first timestep** of each
cyclone. A cyclone that starts in January 2005 and ends in February 2005 is
filed under `2005/01/`.

### Column Schema (66 columns)

Each Parquet file contains all timesteps for one cyclone with:

| Block | Columns | Count |
|-------|---------|-------|
| Main data | track_id, date, lon, lat, vor42, lec_original, region, period, Az, Ae, Kz, Ke, Cz, Ca, Ck, Ce, BAz, BAe, BKz, BKe, BΦZ, BΦE, Gz, Ge, dAzdt, dAedt, dKzdt, dKedt, RGz, RGe, RKz, RKe | 32 |
| wind100_max | w100max_{NW,NE,SW,SE}_{lon,lat,val,dist} + w100max_global_quad | 17 |
| wind100_p99 | w100p99_{NW,NE,SW,SE}_{lon,lat,val,dist} + w100p99_global_quad | 17 |
| **Total** | | **66** |

Wind100 columns are NaN for timesteps where no wind100 record is available.

### Why Parquet?

Parquet is chosen over CSV for this product because:
- **~5-10× smaller**: float-heavy columnar data compresses efficiently
- **Type-preserving**: datetime, float, and string columns round-trip without
  parsing overhead
- **Fast columnar reads**: extracting a single variable across many files is
  fast without reading entire rows
- **Pandas/pyarrow native**: `pd.read_parquet()` requires no configuration

### Reading a Per-Track File

```python
import pandas as pd

df = pd.read_parquet("data/processed/tracks_by_id/1979/01/19790001.parquet")
print(df.columns.tolist())   # All 66 columns
print(df.shape)              # (n_timesteps, 66)

# Access wind100 max in the NE quadrant
df["w100max_NE_val"].dropna()

# Identify which quadrant had the global max wind at each timestep
df["w100max_global_quad"]
```

---

## 📡 Data Sources

| Dataset | DOI | Description |
|---------|-----|-------------|
| Cyclone tracks + LEC | [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432) | Tracks + LEC diagnostics (1979–2020) |
| Wind100 | [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037) | 100 m wind statistics per cyclone (1979–2020) |

**Citations**:
> de Souza, D., & Gramcianinov, C. (2026). Southwestern Atlantic Cyclone Tracks and
> Semi-Lagrangian Lorenz Energy Cycle (LEC) diagnostics (1979–2020) [Data set].
> Zenodo. https://doi.org/10.5281/zenodo.18133432

---

## 🚫 Version Control Guidelines

| Path | Status | Reason |
|------|--------|--------|
| `data/raw/*.csv` | **Gitignored** | Large source files (up to 180 MB) |
| `data/raw/wind100/` | **Gitignored** | 482 MB of CSV files |
| `data/interim/` | **Gitignored** | Regeneratable intermediate products |
| `data/processed/*.csv` | **Gitignored** | Large generated files |
| `data/processed/tracks_by_id/` | **Gitignored** | Thousands of Parquet files |
| `data/processed/*.txt` | **Versioned** | Small validation/coverage reports |
| `data/interim/README.md` | **Versioned** | Documentation |
| `data/README.md` | **Versioned** | This file |

---

## 📊 Validation Reports

After running the processing pipeline, two reports are saved:

| Report | Generated by | Content |
|--------|-------------|---------|
| `data/processed/tracks_south_atlantic_consolidated.txt` | `preprocess_data.py` | Row counts, region distribution, LEC coverage, column types |
| `data/processed/tracks_by_id/merge_report.txt` | `merge_wind100.py` | Wind100 coverage, track-level match statistics, discrepancies |
