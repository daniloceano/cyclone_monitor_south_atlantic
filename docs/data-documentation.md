# Data Documentation

## Source Data

### Primary Source: Zenodo Archive

**DOI**: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)

The canonical data source is the Zenodo archive containing complete cyclone tracks with energetics for the South Atlantic (1979–2020).

**Downloaded to**: `data/raw/tracks_SAt_source.csv`

### Processed Output

**File**: `data/processed/tracks_south_atlantic_consolidated.csv`

| Property | Value |
|----------|-------|
| Rows | 631,009 (individual track timesteps) |
| Unique tracks | 6,789 |
| Period | 1979-01-01 to 2021-01-07 |
| Geographic coverage | South Atlantic (lat −74.9° to −16.0°, lon −84.3° to +179.9°) |
| File size | ~311 MB |

### Temporal Resolution

| Data Type | Resolution | Coverage | Notes |
|-----------|------------|----------|-------|
| Track positions (lon, lat) | 1-hourly | 100% | Native resolution |
| Vorticity (vor42) | 1-hourly | 100% | Native resolution |
| LEC energetics | 1-hourly | ~98% | Interpolated from 3-hourly |

**Interpolation**: LEC diagnostics are originally computed at 3-hourly intervals. Since these are smooth time series representing gradually evolving energy budgets, they are **linearly interpolated** to 1-hourly resolution. Only track boundaries (first/last hours) have ~2% NaN where interpolation cannot fill gaps. See De Souza et al. (2025) Climate Dynamics for methodology.

## Data Sources

| What | Reference |
|------|-----------|
| Cyclone tracks | Gramcianinov, C. B. et al. **Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases**. Mendeley Data. DOI: [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4) |
| LEC diagnostics (data) | **Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020)**. Zenodo. DOI: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432) |
| LEC methodology | De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R. (2025). Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones. *Climate Dynamics*, 63(11), 1–26. DOI: [10.1007/s00382-024-07555-z](https://doi.org/10.1007/s00382-024-07555-z) |
| Genesis regions | Gramcianinov, C. B., Hodges, K. I., & Camargo, R. D. (2019). The properties and genesis environments of South Atlantic cyclones. *Climate Dynamics*, 53(7), 4115–4140. DOI: [10.1007/s00382-019-04778-7](https://doi.org/10.1007/s00382-019-04778-7) |
| Lifecycle phases | de Souza, D. C., da Dias, P. L. S., Gramcianinov, C. B., & de Camargo, R. (2025). Cyclophaser: A Python package for detecting extratropical cyclone life cycles. *JOSS*, 10(108), 7363. DOI: [10.21105/joss.07363](https://doi.org/10.21105/joss.07363) |
| Phase results | Couto de Souza, D. et al. (2024). New perspectives on South Atlantic storm track through an automatic method for detecting extratropical cyclones' lifecycle. *Int. J. Climatol.*, 44(10), 3568–3588. DOI: [10.1002/joc.8566](https://doi.org/10.1002/joc.8566) |

## Columns

### Identification and Position

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `track_id` | int64 | 0% | Cyclone identifier, format YYYYNNNN |
| `date` | datetime | 0% | UTC datetime of the position snapshot |
| `lon` | float64 | 0% | Longitude of the cyclone centre (degrees) |
| `lat` | float64 | 0% | Latitude of the cyclone centre (degrees) |
| `vor42` | float64 | 0% | Filtered and normalized relative vorticity at 850 hPa (×10⁻⁵ s⁻¹), absolute value used |

### Classification

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `region` | string | 0% | Genesis region code (ARG, LA-PLATA, SE-BR) |
| `period` | string | 7.9% | Lifecycle phase from Cyclophaser |

### LEC Energy Reservoirs

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `Az` | float64 | ~2% | Zonal available potential energy (J m⁻²) |
| `Ae` | float64 | ~2% | Eddy available potential energy (J m⁻²) |
| `Kz` | float64 | ~2% | Zonal kinetic energy (J m⁻²) |
| `Ke` | float64 | ~2% | Eddy kinetic energy (J m⁻²) |

### LEC Conversion Terms

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `Cz` | float64 | ~2% | Az → Kz conversion (W m⁻²) |
| `Ca` | float64 | ~2% | Az → Ae conversion (W m⁻²) |
| `Ck` | float64 | ~2% | Ke → Kz conversion (W m⁻²) |
| `Ce` | float64 | ~2% | Ae → Ke conversion (W m⁻²) |

### LEC Boundary Terms

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `BAz` | float64 | ~2% | Boundary flux of Az (W m⁻²) |
| `BAe` | float64 | ~2% | Boundary flux of Ae (W m⁻²) |
| `BKz` | float64 | ~2% | Boundary flux of Kz (W m⁻²) |
| `BKe` | float64 | ~2% | Boundary flux of Ke (W m⁻²) |
| `BΦZ` | float64 | ~2% | Boundary geopotential flux, zonal (W m⁻²) |
| `BΦE` | float64 | ~2% | Boundary geopotential flux, eddy (W m⁻²) |

### LEC Generation and Residual Terms

| Column | Type | Missing | Description |
|--------|------|---------|-------------|
| `Gz` | float64 | ~2% | Generation of zonal APE (W m⁻²) |
| `Ge` | float64 | ~2% | Generation of eddy APE (W m⁻²) |
| `dAzdt` | float64 | ~2% | Time tendency of Az (W m⁻²) |
| `dAedt` | float64 | ~2% | Time tendency of Ae (W m⁻²) |
| `dKzdt` | float64 | ~2% | Time tendency of Kz (W m⁻²) |
| `dKedt` | float64 | ~2% | Time tendency of Ke (W m⁻²) |
| `RGz` | float64 | ~2% | Residual generation, zonal (W m⁻²) |
| `RGe` | float64 | ~2% | Residual generation, eddy (W m⁻²) |
| `RKz` | float64 | ~2% | Residual kinetic, zonal (W m⁻²) |
| `RKe` | float64 | ~2% | Residual kinetic, eddy (W m⁻²) |

**Note:** All LEC columns show ~2% missing after interpolation. Original data was 3-hourly (~67% missing); linear interpolation within each track fills intermediate hours, leaving only track boundaries unfilled.

## Derived Web Artefacts

### `site/public/data/summary.json`

Generated by `scripts/preprocess_data.py`. One entry per track (6,789 entries, ~10 MB raw, ~2.5 MB gzip).

Per-track fields:

| Field | Description |
|-------|-------------|
| `id` | track_id (integer) |
| `year` | Extracted as `track_id // 10000` |
| `month` | Calendar month of genesis (1–12) |
| `start` / `end` | ISO-8601 datetime of first/last timestep |
| `duration_h` | Track duration in hours |
| `genesis_lat`, `genesis_lon` | First timestep position |
| `lysis_lat`, `lysis_lon` | Last timestep position |
| `genesis_region` | Named region (mapped from code) |
| `max_vor42` | Maximum vor42 across all track timesteps (intensity measure) |
| `quantile` | Intensity quantile label versus all 6,789 tracks |
| `coords` | Downsampled track line as `[lon, lat]` pairs (max 120 points) |

### `site/public/data/details/{year}.json`

One file per year (43 files, ~2 MB each). Loaded on demand when a track is clicked. Contains full timestep data for all tracks in that year.

## Intensity Measure: vor42

`vor42` (relative vorticity at 400 hPa, ×10⁻⁵ s⁻¹) is used as the intensity proxy because:
- It is 100% complete (no missing values)
- It is a physically meaningful intensity indicator for extratropical cyclones
- Higher values indicate more intense cyclonic circulation

The intensity of each track is characterised by its **maximum vor42** across all timesteps.

### Quantile Thresholds (current data)

| Percentile | vor42 (×10⁻⁵ s⁻¹) |
|------------|-------------------|
| 25th | 3.615 |
| 50th | 5.726 |
| 75th | 8.371 |
| 90th | 10.353 |
| 95th | 11.492 |

## Genesis Region Classification

Genesis region is determined from the first timestep position of each track. The source data uses codes that map to display names:

| Code | Display Name | Description |
|------|--------------|-------------|
| ARG | Argentina / Patagonia | Southern Argentina and Patagonian coast |
| LA-PLATA | SE South America | La Plata basin and Río de la Plata region |
| SE-BR | SE Brazil Coast | Coastal baroclinic zone off southeastern Brazil |

Reference:
> Gramcianinov, C. B., Hodges, K. I., & Camargo, R. D. (2019).
> The properties and genesis environments of South Atlantic cyclones.
> *Climate Dynamics*, 53(7), 4115–4140. https://doi.org/10.1007/s00382-019-04778-7

## Lifecycle Phase Labels

Phase labels in the consolidated CSV follow the Cyclophaser methodology:

> de Souza, D. C., da Dias, P. L. S., Gramcianinov, C. B., & de Camargo, R. (2025).
> Cyclophaser: A Python package for detecting extratropical cyclone life cycles.
> *Journal of Open Source Software*, 10(108), 7363. https://doi.org/10.21105/joss.07363

Results from applying Cyclophaser to this dataset are presented in:

> Couto de Souza, D., da Silva Dias, P. L., Gramcianinov, C. B.,
> da Silva, M. B. L., & de Camargo, R. (2024).
> New perspectives on South Atlantic storm track through an automatic method
> for detecting extratropical cyclones' lifecycle.
> *International Journal of Climatology*, 44(10), 3568–3588.
> https://doi.org/10.1002/joc.8566

| Phase | Description |
|-------|-------------|
| incipient | Initial development phase |
| intensification | Growth phase (vor42 increasing) |
| mature | Maximum intensity phase (vor42 near peak) |
| decay | Weakening phase (vor42 decreasing) |
| intensification 2 | Secondary intensification (some cyclones) |
| mature 2 | Secondary maximum (some cyclones) |
| decay 2 | Secondary decay (some cyclones) |
| residual | Post-decay remnant activity |

**Note**: The ~7.9% missing values in the `period` column occur at timesteps where the phase classification was not computed (e.g., very short tracks or edge cases).
