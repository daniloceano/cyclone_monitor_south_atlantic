# Data Directory

This directory contains all datasets used by the South Atlantic Cyclone Monitor.

## 📋 Directory Structure

```
data/
├── raw/                                ← Downloaded source data (gitignored)
│   ├── tracks_SAt_source.csv           ← Full dataset from Zenodo (~180 MB)
│   └── tracks_SAt_filtered_with_energetics.csv → symlink to above
├── processed/                          ← Validation reports
│   └── tracks_south_atlantic_consolidated.txt  ← Validation report
└── README.md
```

## 🔄 Data Pipeline

### Overview

The data flows from Zenodo through preprocessing into web-optimized JSON files:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Zenodo Archive (DOI: 10.5281/zenodo.18133432)                       │
│ • Full LEC diagnostics for 6,789 cyclones (1979–2020)               │
│ • 631,009 timesteps with 31 columns                                 │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ↓ scripts/data/download_source_data.py
                         │
┌─────────────────────────────────────────────────────────────────────┐
│ data/raw/tracks_SAt_source.csv (~180 MB)                            │
│ • Raw CSV with all columns at original resolution                   │
│ • Positions: 1-hourly | Energetics: 3-hourly (NaN at interim hours) │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ↓ scripts/preprocess_data.py
                         │
┌─────────────────────────────────────────────────────────────────────┐
│ site/public/data/                                                   │
│ ├── summary.json       ← Track metadata + simplified trajectories   │
│ └── details/{year}.json ← Full timestep data per year               │
│                                                                     │
│ Terms exported: Az, Ae, Kz, Ke, Ca, Ce, Ck, Cz,                     │
│                 BAz, BAe, BKz, BKe, Gz, Ge, RGz, RGe, RKz, RKe      │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ↓
                    Web Application
```

### Running the Pipeline

```bash
# Step 1: Download source data from Zenodo
python3 scripts/data/download_source_data.py

# Step 2: Generate JSON for the website
python3 scripts/preprocess_data.py
```

Or use the combined pipeline runner:

```bash
python3 scripts/data/run_pipeline.py
```

## 🎯 Primary Dataset

### `tracks_SAt_source.csv` (from Zenodo)

The authoritative source data for this project. Contains all cyclone tracks with complete LEC energetics.

**Location**: `data/raw/tracks_SAt_source.csv` (gitignored, ~180 MB)

**Content**:
- 631,009 rows (individual track timesteps)
- 6,789 unique cyclones (1979–2020)
- 31 columns including position, energetics, lifecycle phase, and genesis region

### Column Reference

| Column | Type | Description | Resolution |
|--------|------|-------------|------------|
| `track_id` | int64 | Cyclone identifier (YYYYNNNN) | — |
| `date` | datetime | UTC timestamp | 1-hourly |
| `lon vor` | float64 | Longitude (degrees) | 1-hourly |
| `lat vor` | float64 | Latitude (degrees) | 1-hourly |
| `vor42` | float64 | Relative vorticity (×10⁻⁵ s⁻¹) | 1-hourly |
| `region` | string | Genesis region (ARG, LA-PLATA, SE-BR) | — |
| `period` | string | Lifecycle phase | 1-hourly |
| `Az`, `Ae` | float64 | Available potential energy (J m⁻²) | 3-hourly |
| `Kz`, `Ke` | float64 | Kinetic energy (J m⁻²) | 3-hourly |
| `Ca`, `Ck`, `Ce`, `Cz` | float64 | Conversion terms (W m⁻²) | 3-hourly |
| `BAz`, `BAe`, `BKz`, `BKe` | float64 | Boundary terms (W m⁻²) | 3-hourly |
| `BΦZ`, `BΦE` | float64 | Boundary geopotential (W m⁻²) | 3-hourly |
| `Gz`, `Ge` | float64 | Generation terms (W m⁻²) | 3-hourly |
| `∂Az/∂t`, `∂Ae/∂t`, `∂Kz/∂t`, `∂Ke/∂t` | float64 | Tendencies via finite diff. (W m⁻²) | 3-hourly |
| `RGz`, `RGe`, `RKz`, `RKe` | float64 | Residual terms (W m⁻²) | 3-hourly |

### Temporal Resolution Note

- **Track positions** (lon, lat, vor42): Available at **1-hourly** intervals
- **LEC energetics** (all other columns): Available at **3-hourly** intervals

This means ~67% of timesteps have NaN for energetics columns. This is **expected behaviour**, not data loss.

### Genesis Regions

| Code | Full Name | Description |
|------|-----------|-------------|
| ARG | Argentina / Patagonia | Southern Argentina and Patagonian coast |
| LA-PLATA | SE South America | La Plata basin and Río de la Plata region |
| SE-BR | SE Brazil Coast | Coastal baroclinic zone off southeastern Brazil |

### Lifecycle Phases

Phases are determined using [Cyclophaser](https://github.com/daniloceano/CycloPhaser):

| Phase | Description |
|-------|-------------|
| `incipient` | Initial development |
| `intensification` | Growth phase |
| `mature` | Maximum intensity |
| `decay` | Weakening phase |
| `intensification 2` | Secondary intensification (if present) |
| `mature 2` | Secondary maximum (if present) |
| `decay 2` | Secondary decay (if present) |
| `residual` | Post-decay remnant activity |

## 📡 Data Source

**Zenodo Archive**: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)

This archive contains:
- Complete cyclone tracks from ERA5 reanalysis (1979–2020)
- Semi-Lagrangian Lorenz Energy Cycle diagnostics
- Genesis region and lifecycle phase classifications

**Citation**:
> de Souza, D., & Gramcianinov, C. (2026). Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian Lorenz Energy Cycle (LEC) diagnostics (1979–2020) [Data set]. Zenodo. https://doi.org/10.5281/zenodo.18133432

## 🚫 Version Control Guidelines

| Path | Status | Reason |
|------|--------|--------|
| `data/raw/*.csv` | **Gitignored** | Large source files (~180 MB) |
| `data/processed/*.txt` | **Versioned** | Validation reports (small) |
| `data/README.md` | **Versioned** | Documentation |

To regenerate data:
```bash
python3 scripts/data/download_source_data.py
python3 scripts/preprocess_data.py
```

## 📊 Validation Report

After running the processing pipeline, a validation report is saved to:
```
data/processed/tracks_south_atlantic_consolidated.txt
```

This report includes:
- Total rows and unique tracks
- Date range
- Genesis region distribution
- Lifecycle phase distribution
- LEC energetics coverage percentages
- Column-by-column null percentages

## 📧 Questions?

For data-related questions, refer to the main repository documentation or contact the research team.
