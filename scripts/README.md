# Scripts Directory

Data processing and transformation scripts for the South Atlantic Cyclone Monitor.

## 📁 Structure

```
scripts/
├── data/                       ← Data pipeline (download, preprocess)
│   ├── run_pipeline.py         ← Main orchestrator (start here)
│   ├── download_source_data.py ← Download from Zenodo
│   └── preprocess_data.py      ← Standardize and validate CSV
├── preprocess_data.py          ← CSV → JSON for web app
└── README.md
```

## 🚀 Quick Start

### 1. Run the Data Pipeline

```bash
# Full pipeline: download + preprocess
python3 scripts/data/run_pipeline.py

# Skip download (use existing source file)
python3 scripts/data/run_pipeline.py --skip-download
```

**Output**: `data/processed/tracks_south_atlantic_consolidated.csv` (~143 MB)

### 2. Generate Web App JSON

```bash
python3 scripts/preprocess_data.py
```

**Output**:
- `site/public/data/summary.json` (~10 MB)
- `site/public/data/details/{year}.json` (43 files, ~2 MB each)

## 📋 Script Details

### `scripts/data/run_pipeline.py`

**Purpose**: Orchestrate the complete data pipeline

**Options**:
- `--force` — Force re-download even if source file exists
- `--skip-download` — Skip download step (use existing source file)

**Steps**:
1. Download source data from Zenodo
2. Preprocess and validate
3. Generate consolidated CSV

### `scripts/data/download_source_data.py`

**Purpose**: Download cyclone track data from Zenodo

**Source**: DOI [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)

**Output**: `data/raw/tracks_SAt_source.csv` (~180 MB)

**Requirements**: `curl` or `wget` (or Python `requests`/`tqdm`)

### `scripts/data/preprocess_data.py`

**Purpose**: Standardize and validate source CSV

**Processing**:
- Rename columns (e.g., `lon vor` → `lon`)
- Drop geometry column
- Parse dates
- Validate track_id integrity
- Generate validation report

**Output**:
- `data/processed/tracks_south_atlantic_consolidated.csv`
- `data/processed/tracks_south_atlantic_consolidated.txt` (validation report)

### `scripts/preprocess_data.py`

**Purpose**: Convert consolidated CSV to web-optimized JSON

**Input**: `data/processed/tracks_south_atlantic_consolidated.csv`

**Output**:
- `site/public/data/summary.json` — Track metadata + simplified coords
- `site/public/data/details/{year}.json` — Full per-timestep data by year

**Processing**:
- Compute intensity quantiles
- Map region codes to display names
- Downsample track coordinates (max 120 points)
- Extract per-timestep energetics

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
        │
        ↓  preprocess_data.py (scripts/)
        │
site/public/data/summary.json + details/{year}.json
        │
        ↓
    Web Application
```

## 🔧 Dependencies

**Python 3.9+** with:
- `pandas`
- `numpy`

**System tools**:
- `curl` or `wget` (for download)

## 📝 Notes

- LEC energetics are 3-hourly; track positions are 1-hourly
- ~67% of timesteps have NaN for energetics (expected)
- Genesis regions use pre-computed codes (ARG, LA-PLATA, SE-BR)
- Lifecycle phases are from Cyclophaser, not heuristic computation

## 📧 Questions?

See main repository README or docs/data-documentation.md.
