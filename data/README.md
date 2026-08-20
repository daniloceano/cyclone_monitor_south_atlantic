# Data Directory

This directory contains all datasets used by the South Atlantic Cyclone Monitor.

## 📋 Directory Structure

```
data/
├── raw/                                        ← Source data (gitignored)
│   ├── tracks_SAt_source.csv                   ← Full LEC dataset from Zenodo (~180 MB)
│   ├── tracks_SAt_filtered_with_energetics.csv ← Symlink to above (legacy name)
│   ├── cps_parameters_SAt.csv                  ← Cyclone Phase Space, per timestep (25 MB)
│   ├── cps_classification_SAt.csv              ← CPS class per cyclone (1.2 MB)
│   ├── cps_consolidation_report.txt            ← Validation report for the two above
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
│   ├── tracks_south_atlantic_consolidated.csv  ← Flat CSV: tracks + LEC + CPS (372 MB)
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
│ data/processed/tracks_south_atlantic_consolidated.csv (372 MB)     │
│ • All columns standardised (renamed, geometry dropped)              │
│ • LEC energetics interpolated from 3-hourly to 1-hourly            │
│ • CPS merged and interpolated 3-h → 1-h  (Dataset 5, optional)     │
│   40 columns: 32 base + cps_original, cps_class, cps_B, cps_VTL,   │
│   cps_VTU, cps_size_km, cps_dir, cps_over_ocean                    │
└─────────────────────────────────────────────────────────────────────┘
             │                              │
             ↓  scripts/preprocess_data.py  ↓  scripts/data/merge_wind.py
             │                              │
┌────────────────────────┐    ┌─────────────────────────────────────────┐
│ site/public/data/      │    │ data/processed/tracks_by_id/            │
│ ├── summary.json       │    │ └── {YYYY}/{MM:02d}/{track_id}.parquet  │
│ └── details/{year}.json│    │ • Main + CPS + wind100_max + wind100_p99 │
│ (Web application)      │    │ • 74 columns per file                   │
└────────────────────────┘    └─────────────────────────────────────────┘
```

### Running the Pipeline

```bash
# Full pipeline: download → preprocess → generate consolidated CSV
python3 scripts/data/run_pipeline.py

# Skip download (use existing source file)
python3 scripts/data/run_pipeline.py --skip-download

# Also download AND merge every wind level into the per-cyclone Parquet base
python3 scripts/data/run_pipeline.py --skip-download --wind100

# wind acquisition on its own (idempotent: verifies MD5, skips if present)
python3 scripts/data/download_wind.py

# Run the merge only (requires the consolidated CSV to exist)
python3 scripts/data/merge_wind.py

# Dry run: check coverage without writing output
python3 scripts/data/merge_wind.py --dry-run

# Process a single year (for testing)
python3 scripts/data/merge_wind.py --year 1979 --limit 10
```

### ⚠️ Environment requirement

**pandas must be `>= 2.0, < 3`.** Under pandas 3.x the grouping column is no
longer passed into `DataFrameGroupBy.apply`, which used to break
`preprocess_data.py` with `KeyError: 'track_id'`. The interpolation code has
since been rewritten to use `groupby().transform()` and is version-agnostic, but
`environment.yml` pins the upper bound as a guard. Create the env with:

```bash
conda env create -f environment.yml && conda activate cyclone_monitor
```

Note that `conda run` does **not** forward stdin, so scripts piped via heredoc
exit silently — always pass a file path.

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

## 🌬️ Dataset 2: Cyclone-relative wind (10 m and 100 m)

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

### Acquisition

```bash
python3 scripts/data/download_wind.py
```

The Zenodo record holds a **single** file, `wind100.tar.gz`, which is a
**tarball of tarballs** — this is not stated anywhere in the record itself:

```
wind100.tar.gz                        (182.3 MB, md5 4eaef49b4c53b5ef81cece06680fca31)
  └── {YYYY}_wind100.tar.gz           (43 archives, 1979–2021)
        └── {YYYY}_wind100/
              ├── {track_id}_wind100_max.csv
              └── {track_id}_wind100_p99.csv
```

Two extraction passes are needed. The download script does both, verifies the
published MD5, validates the resulting tree (43 year directories, 15,974 CSVs)
and is idempotent — re-running it re-validates rather than re-downloading.

### File Organisation

```
data/raw/wind100/
  {YYYY}_wind100/
    {track_id}_wind100_max.csv   ← absolute maximum per quadrant
    {track_id}_wind100_p99.csv   ← 99th percentile per quadrant
```

> **Correction to the column description below:** `{QD}_dis_*` is a plain
> **Euclidean distance in degrees** (`hypot(Δlon, Δlat)`), *not* a great-circle
> distance. Verified against 761 timesteps of known track positions: the error
> against the Euclidean definition is 0.0000°, against great-circle 0.63°
> (median). A practical consequence: because the metric is planar and all four
> quadrants are always populated, the cyclone centre is recoverable **exactly**
> from the quadrant geometry by least-squares trilateration — relevant for the
> 1,198 tracks that exist only in this dataset and carry no centre position.

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
**Generated by**: `scripts/data/merge_wind.py`

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

### Column Schema (109 columns: 41 catalogue + 34 wind10 + 34 wind100)

Each Parquet file contains all timesteps for one cyclone with:

| Block | Columns | Count |
|-------|---------|-------|
| Main data | track_id, date, lon, lat, vor42, lec_original, region, period, cps_original, cps_class, cps_B, cps_VTL, cps_VTU, cps_size_km, cps_dir, cps_over_ocean, Az, Ae, Kz, Ke, Cz, Ca, Ck, Ce, BAz, BAe, BKz, BKe, BΦZ, BΦE, Gz, Ge, dAzdt, dAedt, dKzdt, dKedt, RGz, RGe, RKz, RKe | 40 |
| wind100_max | w100max_{NW,NE,SW,SE}_{lon,lat,val,dist} + w100max_global_quad | 17 |
| wind100_p99 | w100p99_{NW,NE,SW,SE}_{lon,lat,val,dist} + w100p99_global_quad | 17 |
| **Total** | | **74** |

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

**Provenance lives in one place: [`data/metadata/sources.json`](metadata/sources.json).**

That registry is the single source of truth for every dataset name, author, DOI,
licence, coverage, the monitor variables it supplies and the transformations
applied locally. The pipeline reads it, emits `site/public/data/sources.json` for
the About page, and generates [`data/SOURCES.md`](SOURCES.md) — the readable
version — from the same object.

Do not restate a DOI here or in any other README. Edit the registry; everything
downstream follows. Regenerate with:

```bash
python scripts/preprocess_data.py
```

---

## 🚫 Version Control Guidelines

| Path | Status | Reason |
|------|--------|--------|
| `data/raw/*.csv` | **Gitignored** | Large source files (up to 180 MB) |
| `data/raw/cps_*` | **Gitignored** | Covered by the blanket `data/raw/` rule — including the `.txt` report, so this README is the only versioned documentation of Dataset 5 |
| `data/raw/wind10/`, `data/raw/wind100/` | **Gitignored** | ~480 MB of CSV files each |
| `data/interim/` | **Gitignored** | Regeneratable intermediate products |
| `data/processed/*.csv` | **Gitignored** | Large generated files |
| `data/processed/tracks_by_id/` | **Gitignored** | 6,789 Parquet files (603 MB) |
| `data/processed/cyclones.parquet` | **Gitignored** | Covered by the blanket `*.parquet` rule |
| `data/processed/cyclone_categories.json` | **Versioned** | ~150 KB; the taxonomy index a reader needs without the binaries |
| `data/metadata/sources.json` | **Versioned** | The provenance registry |
| `data/SOURCES.md` | **Versioned** | Generated from the registry |
| `data/processed/*.txt` | **Versioned** | Small validation/coverage reports |
| `data/interim/README.md` | **Versioned** | Documentation |
| `data/README.md` | **Versioned** | This file |
| `data/sedimentary_basins/` | **Versioned** | Brazilian offshore sedimentary basin shapefiles |

---

## 🌀 Dataset 5: Cyclone Phase Space (CPS) Classification

**Source**: `paper_energy_patterns` project (`scripts/cps_analysis/`), exported by
`scripts/cps_analysis/export_cps_for_monitor.py`
**CPS computation**: Andres Rodriguez (IAG-USP)
**Local files**: `data/raw/cps_parameters_SAt.csv`, `data/raw/cps_classification_SAt.csv` (gitignored)

Thermal-structure classification of every cyclone in Dataset 1, using the Hart (2003)
Cyclone Phase Space. Answers, per cyclone and per timestep, whether the system is
extratropical, subtropical or tropical in structure.

### File 1 — `cps_parameters_SAt.csv` (per timestep)

- 212,996 rows · 6,776 cyclones · **3-hourly**
- Joins onto Dataset 1 on (`track_id`, `date`); 100% of its keys are present there

| Column | Type | Description |
|--------|------|-------------|
| `track_id` | int64 | Cyclone identifier (YYYYNNNN) |
| `date` | datetime | UTC timestamp, 3-hourly |
| `B` | float64 | Storm-motion-relative 900–600 hPa thickness asymmetry (m). Large positive = frontal |
| `VTL` | float64 | Lower thermal wind, 900–600 hPa. **Positive = warm core** |
| `VTU` | float64 | Upper thermal wind, 600–300 hPa. **Positive = warm core** |
| `SIZE` | float64 | Diagnosed system radius (km) |
| `dir` | float64 | Storm motion direction (°) |
| `lat`, `lon` | float64 | Position at that timestep (°) |
| `over_ocean` | bool | Centre over ocean |
| `cps_class` | string | **Raw** per-timestep threshold label: `extratropical`, `subtropical`, `tropical`, `unclassified`. No persistence, no guards |
| `cps_state` | string | **Guarded** view: the accepted persistent state covering that timestep (`EC`, `SC`, `TC`), empty when none |

> **`cps_class` and `cps_state` are not interchangeable.** `cps_class` is the label of a
> single timestep against the thresholds — the right thing to colour a phase diagram by, and
> the wrong thing to count cyclone types with. `cps_state` is what survived the 36 h
> persistence gate *and* the identification guards. In this dataset the raw label marks
> 128,399 timesteps "subtropical" at a median latitude of 49.7°S; the guarded state marks
> 16,210 at 32.9°S. The difference is warm-seclusion contamination.

> **Native step is 3-hourly.** The exported file is left at 3-hourly on purpose: the CPS
> series feed a threshold classification, so interpolated points would be labelled from
> values nobody computed.
>
> **The monitor now interpolates them anyway, deliberately and reversibly.**
> `scripts/data/preprocess_data.py` merges this file and interpolates to 1-hourly so the
> phase-space panel is continuous alongside the energetics, under these rules:
>
> | Column | Treatment |
> |---|---|
> | `cps_B`, `cps_VTL`, `cps_VTU`, `cps_size_km` | linear, within track, `limit_area="inside"` |
> | `cps_dir` | **circular** (unit-vector) interpolation — a linear mean of 350° and 10° would give 180° |
> | `cps_over_ocean` | forward/backward fill within the track |
> | `cps_class` | **not interpolated.** Original labels pass through verbatim; interpolated rows are labelled by re-applying the published thresholds to the interpolated parameters |
>
> `cps_original` marks which rows carry computed values (`True`) — the exact mirror of
> `lec_original`. Re-deriving labels at original timesteps reproduces the upstream
> classifier for **100 % of 188,573 rows**, which is the guard that keeps the two
> consistent; the check runs on every pipeline execution and warns below 99 %.
>
> **Anything persistence-based — including the ≥ 36 h gate behind `phase_class` — must be
> computed on `cps_original == True` rows only.** Interpolated points inflate run lengths.

### File 2 — `cps_classification_SAt.csv` (per cyclone)

One row for **all 6,789 cyclones**, including the 13 without CPS series (`has_cps = False`),
so a join on `track_id` never silently drops them.

| Column | Description |
|--------|-------------|
| `track_id`, `year`, `region`, `genesis_lat`, `genesis_lon`, `ep` | Identity; `ep` is the Energy Pattern where one exists |
| `has_cps` | False for the 13 cyclones with no CPS series (one 2002, twelve 2009) |
| `class_kind` | `identified` · `characteristic` · `undetermined` · `no_data` — **read this before grouping** |
| `is_identified` | True only for EC, SC, TC, ST, SD, TT, ET |
| `phase_class` | **The classification.** See the table below |
| `phase_class_label` | Human-readable expansion of `phase_class` |
| `genesis_state`, `genesis_onset_h`, `pure_genesis` | First persistent state and how long after genesis it began |
| `state_sequence`, `transitions`, `n_persistent_states` | e.g. `EC->SC`, `ST` |
| `dominant_class`, `dominance`, `frac_EC`/`frac_SC`/`frac_TC` | Share of the cyclone's own timesteps per structure |
| `hours_EC`/`hours_SC`/`hours_TC` | Hours held in each persistent state |
| `n_warm_seclusions`, `n_out_of_band`, `n_indeterminate_warm` | Runs rejected by the identification guards |
| `antecedent_characteristics`, `antecedent_hours` | Structure shown before the first persistent state |

| `phase_class` | n | % | Meaning |
|---|---|---|---|
| `EC` | 2,926 | 43.10% | extratropical throughout |
| `SC` | 182 | 2.68% | subtropical throughout |
| `TC` | 2 | 0.03% | tropical throughout — **unverified candidates, do not report as identified** |
| `TT` / `ET` | 0 | 0.00% | tropical / extratropical transition — empty by construction |
| `ST` | 60 | 0.88% | subtropical transition (EC → SC) |
| `SD` | 22 | 0.32% | subtropical decay (SC → EC) |
| `EC_like` | 2,398 | 35.32% | extratropical characteristics, never sustained 36 h |
| `SC_like` | 548 | 8.07% | hybrid characteristics, never sustained 36 h |
| `TC_like` | 2 | 0.03% | warm-core characteristics, never sustained 36 h |
| `undetermined` | 636 | 9.37% | no structure held long enough, none dominant |
| `no_cps_data` | 13 | 0.19% | no CPS series computed |

> **Never group a `*_like` class with the class it resembles.** They are *characteristics*,
> not identifications: the structure was shown but never sustained for 36 h, and none of the
> identification guards was applied to it. 68% of `SC_like` cyclones have genesis outside
> 20–40°S and both `TC_like` cyclones formed at 44°S and 52°S. Folding them in is what
> briefly made the site report 730 "Subtropical" and 4 "Tropical" cyclones instead of 182
> and 2. Use `is_identified` / `class_kind`; the site's `CPS_CLASS_GROUPS` now keeps them in
> a separate `Not sustained (<36 h)` group.

### Classification protocol

Thresholds after de Souza et al. (2026), taking extratropical/tropical from Wood et al.
(2023) and subtropical from Gozzo et al. (2014):

| Class | `B` [m] | `VTL` | `VTU` |
|---|---|---|---|
| extratropical | > 10 | < 0 | < 0 |
| subtropical | −25 to 25 | > −50 | < −10 |
| tropical | < 10 | > 0 | > 0 |

A timestep satisfying more than one specification is resolved by precedence
tropical > subtropical > extratropical. A class becomes a *state* of the cyclone only when
held for **≥ 36 consecutive hours** (Guishard et al. 2009; Gozzo et al. 2014).

Persistent runs are then guarded, because the phase space alone cannot separate a genuine
warm core from a Shapiro–Keyser **warm seclusion**:

- **subtropical runs** — genesis between 20°S and 40°S (Gozzo criterion 1), ≥ 50% of the
  run over ocean, and the run beginning no more than 12 h after the cyclone's own intensity
  peak. A diabatically built warm core re-energises the system, so the peak follows the
  structure; a secluded warm core is the terminal stage and the peak has already passed.
- **tropical runs** — equatorward of 40°S and over ocean.

Of 804 persistent hybrid runs, 271 were accepted, 395 rejected as `genesis_out_of_band` and
138 as `warm_seclusion`. The guarded rate is 6.3 subtropical cyclones per year against
Gozzo et al.'s 7.2; without the guards it is 18.0.

### Caveats

- The two `TC` cyclones are **candidates, not identifications** — shallow warm cores, not
  yet inspected case by case.
- `TT` and `ET` are empty because this catalogue's genesis boxes exclude every documented
  South Atlantic tropical system (Catarina, Anita, Arani, Deni, Guará, Iba), and the named
  recent cases (Raoni, Yakecan, Akará, Biguá) postdate the record.
- The subtropical count is threshold-sensitive by a factor of 6–8 across the threshold sets
  tested; quote any subtropical number with its threshold set attached.
- The 500 km CPS radius may not represent small, shallow SE-BR systems well.
- Gozzo's genesis-band criterion is on **cyclogenesis**, so an identified `SC` may travel
  poleward of 40°S during its hybrid run — guarded `SC` timesteps reach 71°S. The guard on
  the *run* itself applies to the tropical class only (equatorward of 40°S), which is why
  guarded `TC` timesteps span just 27.7–31.8°S.

Full method, statistics and caveats: `scripts/cps_analysis/SCIENTIFIC_NOTES.md` in the
`paper_energy_patterns` project. Regenerate these files with
`python scripts/cps_analysis/export_cps_for_monitor.py` from that project.

---

## 🗺️ Dataset 4: Brazilian Sedimentary Basins

**Location**: `data/sedimentary_basins/`
**Format**: ESRI Shapefiles (one per basin)
**CRS**: EPSG:4326 (WGS84)

### Purpose

These shapefiles define the boundaries of Brazilian offshore sedimentary basins,
enabling spatial filtering of cyclone tracks that pass through specific basins.

### Directory Structure

```
data/sedimentary_basins/
├── Barreirinhas_Mar-zip/
│   ├── bacias_gishub_db.shp
│   ├── bacias_gishub_db.shx
│   ├── bacias_gishub_db.dbf
│   ├── bacias_gishub_db.prj
│   └── bacias_gishub_db.cst
├── Campos_Mar-zip/
│   └── ... (same structure)
├── Santos-zip/
│   └── ... (same structure)
└── ... (16 basins total)
```

### Available Basins

| Folder Name | Basin ID | Display Name |
|-------------|----------|--------------|
| Pelotas_Mar-zip | `pelotas` | Bacia de Pelotas |
| Santos-zip | `santos` | Bacia de Santos |
| Campos_Mar-zip | `campos` | Bacia de Campos |
| Espírito Santo-zip | `espirito-santo` | Bacia do Espírito Santo |
| Mucuri_Mar-zip | `mucuri` | Bacia de Mucuri |
| Cumuruxatiba_Mar-zip | `cumuruxatiba` | Bacia de Cumuruxatiba |
| Jequitinhonha_Mar-zip | `jequitinhonha` | Bacia de Jequitinhonha |
| Camamu-Almada_Mar-zip | `camamu-almada` | Bacia de Camamu-Almada |
| Jacuípe-zip | `jacuipe` | Bacia de Jacuípe |
| SEAL_Mar-zip | `seal` | Bacia de Sergipe-Alagoas (SEAL) |
| Pernambuco-Paraiba_Mar-zip | `pernambuco-paraiba` | Bacia de Pernambuco-Paraiba |
| Potiguar_Mar-zip | `potiguar` | Bacia de Potiguar |
| Ceará_Mar-zip | `ceara` | Bacia do Ceará |
| Barreirinhas_Mar-zip | `barreirinhas` | Bacia de Barreirinhas |
| Pará-Maranhão-zip | `para-maranhao` | Bacia do Pará-Maranhão |
| Foz do Amazonas_Mar-zip | `foz-do-amazonas` | Bacia de Foz do Amazonas |

### Shapefile Attribute Schema

All basin shapefiles share the same attribute schema:

| Column | Type | Description |
|--------|------|-------------|
| `feicao_id` | float | Feature ID from source database |
| `situacao` | string | Always "Marítima" (offshore) |
| `objectid` | int | Object ID |
| `name` | string | Basin name (canonical) |
| `code` | string | Always null |
| `creation_d` | datetime | Creation date |
| `modificati` | datetime | Modification date |
| `camada_id` | int | Layer ID (always 10) |
| `geometry` | Polygon | Basin boundary |

### Processing Pipeline

The shapefiles are processed into web-ready formats:

```bash
# Generate combined GeoJSON for the web app
python3 scripts/process_sedimentary_basins.py

# Compute track-basin intersections
python3 scripts/compute_basin_intersections.py
```

**Generated outputs** (in `site/public/data/`):

| File | Description | Size |
|------|-------------|------|
| `basins.geojson` | Combined basin polygons | ~614 KB |
| `basin_intersections.json` | Pre-computed track-basin intersections | ~172 KB |

### Intersection Statistics (1979–2020)

| Basin | Center | Max Wind | Any |
|-------|--------|----------|-----|
| Pelotas | 1,188 | 1,552 | 1,847 |
| Santos | 444 | 624 | 792 |
| Campos | 149 | 409 | 462 |
| Espírito Santo | 13 | 83 | 89 |
| Others | <10 each | <25 each | <30 each |

> **Note**: Southern basins (Pelotas, Santos, Campos) dominate because they lie
> in the main extratropical cyclone track region.

---

## 📊 Validation Reports

After running the processing pipeline, two reports are saved:

| Report | Generated by | Content |
|--------|-------------|---------|
| `data/processed/tracks_south_atlantic_consolidated.txt` | `preprocess_data.py` | Row counts, region distribution, LEC coverage, column types |
| `data/processed/tracks_by_id/merge_report.txt` | `merge_wind.py` | Wind100 coverage, track-level match statistics, discrepancies |
