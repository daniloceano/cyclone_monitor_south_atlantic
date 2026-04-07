# Scripts Directory

Data processing and transformation scripts for the South Atlantic Cyclone Monitor.

## 📁 Structure

```
scripts/
├── data/                       ← Data pipeline (download, preprocess, merge)
│   ├── run_pipeline.py         ← Main orchestrator (start here)
│   ├── download_source_data.py ← Download from Zenodo
│   ├── preprocess_data.py      ← Standardise and validate CSV → consolidated CSV
│   ├── load_wind100.py         ← Wind100 loader module (imported by merge)
│   ├── merge_wind100.py        ← Merge wind100 + main data → per-track Parquet
│   └── __init__.py
├── preprocess_data.py          ← CSV → JSON for web app
└── README.md
```

## 🚀 Quick Start

### 1. Run the Main Data Pipeline

```bash
# Full pipeline: download + preprocess
python3 scripts/data/run_pipeline.py

# Skip download (use existing source file)
python3 scripts/data/run_pipeline.py --skip-download
```

**Output**: `data/processed/tracks_south_atlantic_consolidated.csv` (~143 MB)

### 2. Merge Wind100 Data (per-cyclone Parquet files)

Requires the consolidated CSV from Step 1.

```bash
# Merge wind100 into per-track Parquet (requires conda 'data' environment)
conda run -n data python scripts/data/merge_wind100.py

# Or via the orchestrator
conda run -n data python scripts/data/run_pipeline.py --skip-download --wind100

# Dry run (check coverage without writing files)
conda run -n data python scripts/data/merge_wind100.py --dry-run

# Process a single year (for testing)
conda run -n data python scripts/data/merge_wind100.py --year 1979
```

**Output**: `data/processed/tracks_by_id/{YYYY}/{MM:02d}/{track_id}.parquet`

### 3. Generate Web App JSON

```bash
python3 scripts/preprocess_data.py
```

**Output**:
- `site/public/data/summary.json` (~10 MB)
- `site/public/data/details/{year}.json` (43 files, ~2 MB each)

---

## 📋 Script Details

### `scripts/data/run_pipeline.py`

**Purpose**: Orchestrate the complete data pipeline

**Options**:
- `--force` — Force re-download even if source file exists
- `--skip-download` — Skip download step (use existing source file)
- `--wind100` — Also run Step 3 (wind100 merge into per-track Parquet)

**Steps**:
1. Download source data from Zenodo
2. Preprocess and validate → consolidated CSV
3. (optional) Merge wind100 → per-cyclone Parquet files

---

### `scripts/data/download_source_data.py`

**Purpose**: Download cyclone track data from Zenodo

**Source**: DOI [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)

**Output**: `data/raw/tracks_SAt_source.csv` (~180 MB)

**Requirements**: `curl` or `wget` (or Python `requests`/`tqdm`)

---

### `scripts/data/preprocess_data.py`

**Purpose**: Standardise and validate source CSV

**Processing**:
- Rename columns (e.g., `lon vor` → `lon`, `∂Az/∂t` → `dAzdt`)
- Drop geometry column
- Parse dates
- Validate track_id integrity
- Interpolate LEC energetics from 3-hourly to 1-hourly (linear, within each track)
- Mark interpolated vs original values with `lec_original` flag

**Output**:
- `data/processed/tracks_south_atlantic_consolidated.csv` (~143 MB)
- `data/processed/tracks_south_atlantic_consolidated.txt` (validation report)

---

### `scripts/data/load_wind100.py`

**Purpose**: Module providing helpers for reading wind100 CSV files

**Provides**:
- `COLUMN_RENAME_MAX` / `COLUMN_RENAME_P99` — dicts mapping original → standardised column names
- `WIND100_MAX_COLS` / `WIND100_P99_COLS` — ordered lists of standardised column names
- `index_wind100_files(wind100_dir)` — scan directory, return `{track_id: {max: Path, p99: Path}}`
- `load_wind100_file(path, metric)` — read one CSV, apply renaming, return DataFrame
- `describe_rename_map()` — print full original→standardised name table

**Column renaming** (max files):

| Original | Standardised |
|----------|-------------|
| `{QD}_lo_max_wind100` | `w100max_{QD}_lon` |
| `{QD}_la_max_wind100` | `w100max_{QD}_lat` |
| `{QD}_mx_max_wind100` | `w100max_{QD}_val` |
| `{QD}_dis_max_wind100` | `w100max_{QD}_dist` |
| `mx_mx_max` | `w100max_global_quad` |

Same pattern for p99 files (`w100p99_` prefix, `_p99_` in source names).

---

### `scripts/process_sedimentary_basins.py`

**Purpose**: Process Brazilian sedimentary basin shapefiles into web-ready GeoJSON

**Input**: `data/sedimentary_basins/{basin_folder}/bacias_gishub_db.shp` (16 basins)

**Processing**:
- Reads all shapefiles from `data/sedimentary_basins/`
- Validates geometries (fixes invalid ones using `shapely.validation.make_valid`)
- Verifies CRS is EPSG:4326 (WGS84); reprojects if needed
- Normalizes basin IDs (e.g., "Santos" → "santos", "Espírito Santo" → "espirito-santo")
- Creates user-friendly display names (e.g., "Bacia de Santos", "Bacia do Ceará")
- Computes bounding boxes for each basin

**Output**:
- `site/public/data/basins.geojson` (~614 KB) — Combined basin polygons
- `site/public/data/basins.debug.geojson` — Pretty-printed version for debugging

**Usage**:
```bash
python3 scripts/process_sedimentary_basins.py
```

---

### `scripts/compute_basin_intersections.py`

**Purpose**: Pre-compute which basins each cyclone track intersects

**Input**:
- `site/public/data/basins.geojson` — Basin polygons
- `site/public/data/summary.json` — Track coordinates
- `site/public/data/wind100/{year}.json` — Maximum wind positions

**Processing**:
- For each track, tests point-in-polygon for:
  - **Center positions**: cyclone center at each timestep
  - **Maximum wind positions**: position of global wind100_max at each timestep
- Uses bounding box pre-filtering for efficiency
- Computes per-basin statistics (count of tracks by filter mode)

**Output**: `site/public/data/basin_intersections.json` (~172 KB)

**Output Schema**:
```json
{
  "metadata": { ... },
  "basins": {
    "pelotas": { "name": "Bacia de Pelotas", "stats": { "center_count": 1188, "wind_max_count": 1552, "any_count": 1847 } },
    ...
  },
  "tracks": {
    "19790001": { "center": ["pelotas"], "wind_max": ["pelotas", "santos"], "any": ["pelotas", "santos"] },
    ...
  }
}
```

**Usage**:
```bash
python3 scripts/compute_basin_intersections.py
```

---

### `scripts/data/merge_wind100.py`

**Purpose**: Merge wind100 statistics with main cyclone data into per-track Parquet files

**Input**:
- `data/processed/tracks_south_atlantic_consolidated.csv` (or auto-generates it)
- `data/raw/wind100/` (15,974 CSV files)

**Processing**:
- LEFT-merges wind100_max and wind100_p99 onto main data by track_id + timestamp
- No main-data timestep is dropped; wind100 columns are NaN where no match exists
- Organises output by year/month of first cyclone timestep
- Validates temporal alignment and reports coverage statistics

**Output**:
- `data/processed/tracks_by_id/{YYYY}/{MM:02d}/{track_id}.parquet` (one file per cyclone)
- `data/processed/tracks_by_id/merge_report.txt` (coverage report)

**Options**:
- `--dry-run` — Scan and report without writing files
- `--year YYYY` — Process only tracks starting in YYYY
- `--limit N` — Process at most N tracks

**Dependencies**: requires `pyarrow` (`conda activate data` or `cyclone_monitor`)

---

### `scripts/preprocess_data.py`

**Purpose**: Convert consolidated CSV to web-optimised JSON

**Input**: `data/processed/tracks_south_atlantic_consolidated.csv`

**Output**:
- `site/public/data/summary.json` — Track metadata + simplified coords
- `site/public/data/details/{year}.json` — Full per-timestep data by year

**Processing**:
- Compute intensity quantiles
- Map region codes to display names
- Downsample track coordinates (max 120 points per track)
- Extract per-timestep energetics

---

## 📊 Data Flow

```
Zenodo (DOI: 10.5281/zenodo.18133432)
        │
        ↓  download_source_data.py
        │
data/raw/tracks_SAt_source.csv (180 MB)
        │
        ↓  preprocess_data.py (scripts/data/)
        │
data/processed/tracks_south_atlantic_consolidated.csv (143 MB)
        │                              │
        ↓  preprocess_data.py          ↓  merge_wind100.py
           (scripts/)                     + data/raw/wind100/ (482 MB)
        │                              │
site/public/data/             data/processed/tracks_by_id/
  summary.json                  {YYYY}/{MM:02d}/{track_id}.parquet
  details/{year}.json
  wind100/{year}.json
        │
        ↓
    Web Application


data/sedimentary_basins/      site/public/data/
  {basin}/bacias_gishub_db.*     │
        │                        │
        ↓  process_sedimentary_basins.py
        │                        │
        └──────────────────────→ basins.geojson (614 KB)
                                 │
        + summary.json           │
        + wind100/{year}.json    │
                │                │
                ↓  compute_basin_intersections.py
                │                │
                └──────────────→ basin_intersections.json (172 KB)
                                 │
                                 ↓
                             Web Application
                         (basin filtering)
```

---

## 🔧 Dependencies

**Python 3.11+** with:
- `pandas>=2.0`
- `numpy>=1.24`
- `pyarrow>=14.0` (for wind100 merge / Parquet I/O)

Recommended: use the existing `data` conda environment:
```bash
conda activate data   # pandas 2.2.2 + pyarrow 17.0.0
```

Or create the project environment:
```bash
conda env create -f environment.yml
conda activate cyclone_monitor
```

**System tools**:
- `curl` or `wget` (for download step only)

---

## 📝 Notes

- LEC energetics are 3-hourly in source; interpolated to 1-hourly in consolidated CSV
- ~67% of timesteps have NaN for LEC energetics before interpolation (expected)
- Genesis regions use pre-computed codes (ARG, LA-PLATA, SE-BR)
- Lifecycle phases are from [Cyclophaser](https://github.com/daniloceano/CycloPhaser)
- Wind100 track IDs may not fully overlap with main dataset (~7,987 vs 6,789 tracks)
- 2021 wind100 data (1 track) is present and processed despite Zenodo record stating 1979–2020

## 📧 Questions?

See main repository README or `docs/wind100-integration.md`.
