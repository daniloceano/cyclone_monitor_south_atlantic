# Data Directory

This directory contains all datasets used by the South Atlantic Cyclone Monitor.

## 📋 Directory Structure

```
data/
├── raw/                                ← Downloaded source data (gitignored)
│   └── tracks_SAt_source.csv           ← From Zenodo (~180 MB)
├── processed/                          ← Generated products
│   ├── tracks_south_atlantic_consolidated.csv  ← Main product (~143 MB)
│   └── tracks_south_atlantic_consolidated.txt  ← Validation report
└── README.md
```

## 🔄 Data Pipeline

### Running the Pipeline

```bash
# Full pipeline (recommended)
python3 scripts/data/run_pipeline.py

# Individual steps
python3 scripts/data/download_source_data.py   # Download from Zenodo
python3 scripts/data/preprocess_data.py        # Process and validate
```

### Pipeline Flow

```
Zenodo (DOI: 10.5281/zenodo.18133432)
        │
        ↓ download_source_data.py
        │
data/raw/tracks_SAt_source.csv (~180 MB)
        │
        ↓ preprocess_data.py
        │
data/processed/tracks_south_atlantic_consolidated.csv (~143 MB)
        │
        ↓ scripts/preprocess_data.py
        │
site/public/data/summary.json + details/{year}.json
        │
        ↓
    Web Application
```

## 🎯 Primary Dataset

### `tracks_south_atlantic_consolidated.csv`

The canonical data product for this project. Contains all cyclone tracks with full energetics.

**Location**: `data/processed/tracks_south_atlantic_consolidated.csv`

**Content**:
- 631,009 rows (individual track timesteps)
- 6,789 unique cyclones (1979–2020)
- 31 columns including position, energetics, lifecycle phase, and genesis region

### Column Reference

| Column | Type | Description | Resolution |
|--------|------|-------------|------------|
| `track_id` | int64 | Cyclone identifier (YYYYNNNN) | — |
| `date` | datetime | UTC timestamp | 1-hourly |
| `lon` | float64 | Longitude (degrees) | 1-hourly |
| `lat` | float64 | Latitude (degrees) | 1-hourly |
| `vor42` | float64 | Relative vorticity (×10⁻⁵ s⁻¹) | 1-hourly |
| `region` | string | Genesis region (ARG, LA-PLATA, SE-BR) | — |
| `period` | string | Lifecycle phase | 1-hourly |
| `Az`, `Ae` | float64 | Available potential energy (J m⁻²) | 3-hourly |
| `Kz`, `Ke` | float64 | Kinetic energy (J m⁻²) | 3-hourly |
| `Ca`, `Ck`, `Ce`, `Cz` | float64 | Conversion terms (W m⁻²) | 3-hourly |
| `BAz`, `BAe`, `BKz`, `BKe` | float64 | Boundary terms (W m⁻²) | 3-hourly |
| `BΦZ`, `BΦE` | float64 | Boundary geopotential (W m⁻²) | 3-hourly |
| `Gz`, `Ge` | float64 | Generation terms (W m⁻²) | 3-hourly |
| `dAzdt`, `dAedt`, `dKzdt`, `dKedt` | float64 | Tendencies (W m⁻²) | 3-hourly |
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
| `data/raw/` | **Gitignored** | Large source files (~180 MB) |
| `data/processed/*.csv` | **Gitignored** | Generated files (~143 MB) |
| `data/processed/*.txt` | **Versioned** | Validation reports (small) |
| `data/README.md` | **Versioned** | Documentation |

To regenerate data:
```bash
python3 scripts/data/run_pipeline.py
```

## 📊 Validation Report

After running the pipeline, a validation report is saved to:
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
