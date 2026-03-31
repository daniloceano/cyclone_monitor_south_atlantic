# South Atlantic Cyclone Monitor

Interactive web-based monitor for extratropical cyclone tracks in the Southwestern Atlantic Ocean (1979–2020).

## Overview

This tool visualises 6,789 cyclone tracks on a dynamic Leaflet map, allowing researchers to filter systems by year, month, and genesis region; inspect individual lifecycles; and explore per-timestep diagnostics including Lorenz Energy Cycle (LEC) parameters.

The site includes an **About** page (`/about`) with detailed documentation of data sources, preprocessing methods, scientific methodology, and complete references.

Built as a private scientific demonstration for the IAG-USP / Petrobras–CENPES cooperation.

---

## Quick Start

```bash
# 1. Clone and enter the repository
cd cyclone_monitor_south_atlantic

# 2. Run the data pipeline (downloads ~180 MB, takes ~2 min)
python3 scripts/data/run_pipeline.py

# 3. Generate web app JSON artefacts
python3 scripts/preprocess_data.py

# 4. Install web dependencies and run locally
cd site
npm install
npm run dev
# Open http://localhost:3000
```

---

## Data Pipeline

The data pipeline downloads and processes cyclone track data with full energetics:

```
scripts/data/
├── run_pipeline.py         ← Orchestrator (run this)
├── download_source_data.py ← Download from Zenodo
└── preprocess_data.py      ← Standardize columns, validate

data/
├── raw/
│   └── tracks_SAt_source.csv           ← Downloaded (~180 MB, gitignored)
└── processed/
    └── tracks_south_atlantic_consolidated.csv  ← Final product (~143 MB)
```

### Running the Pipeline

```bash
# Full pipeline (download + preprocess)
python3 scripts/data/run_pipeline.py

# Or individual steps:
python3 scripts/data/download_source_data.py   # Download from Zenodo
python3 scripts/data/preprocess_data.py        # Process and validate
```

### Pipeline Output

The consolidated CSV contains **631,009 timesteps** across **6,789 cyclones** with:

| Column | Description | Temporal Resolution |
|--------|-------------|---------------------|
| `track_id` | Cyclone identifier (YYYYNNNN) | — |
| `date` | UTC timestamp | 1-hourly |
| `lon`, `lat` | Position (degrees) | 1-hourly |
| `vor42` | Filtered/normalized relative vorticity (×10⁻⁵ s⁻¹) | 1-hourly |
| `region` | Genesis region (ARG, LA-PLATA, SE-BR) | — |
| `period` | Lifecycle phase (incipient, intensification, mature, decay) | 1-hourly |
| `Az`, `Ae`, `Kz`, `Ke` | LEC energy reservoirs (J m⁻²) | 1-hourly (interpolated) |
| `Ca`, `Ck`, `Ce`, `Cz` | LEC conversion terms (W m⁻²) | 1-hourly (interpolated) |
| `BAz`, `BAe`, `BKz`, `BKe` | LEC boundary terms (W m⁻²) | 1-hourly (interpolated) |
| `Gz`, `Ge` | LEC generation terms (W m⁻²) | 1-hourly (interpolated) |

**Note:** LEC energetics are originally at 3-hourly resolution, linearly interpolated to 1-hourly (~98% coverage). The energetics are smooth time series where interpolation is scientifically appropriate. Only track boundaries (first/last hours) may have NaN values where interpolation cannot fill gaps.

---

## Data Sources

| Dataset | Reference |
|---------|-----------|
| Cyclone tracks | Gramcianinov et al. **Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases**. Mendeley Data. DOI: [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4) |
| LEC diagnostics (data) | **Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020)**. Zenodo. DOI: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432) |
| LEC methodology | De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R. (2025). Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones. *Climate Dynamics*, 63(11), 1–26. DOI: [10.1007/s00382-024-07555-z](https://doi.org/10.1007/s00382-024-07555-z) |
| Genesis regions | Gramcianinov, C. B., Hodges, K. I., & Camargo, R. D. (2019). The properties and genesis environments of South Atlantic cyclones. *Climate Dynamics*, 53(7), 4115–4140. DOI: [10.1007/s00382-019-04778-7](https://doi.org/10.1007/s00382-019-04778-7) |
| Lifecycle phases | de Souza, D. C. et al. (2025). Cyclophaser: A Python package for detecting extratropical cyclone life cycles. *JOSS*, 10(108), 7363. DOI: [10.21105/joss.07363](https://doi.org/10.21105/joss.07363) |
| Phase analysis | Couto de Souza, D. et al. (2024). New perspectives on South Atlantic storm track through an automatic method for detecting extratropical cyclones' lifecycle. *Int. J. Climatol.*, 44(10), 3568–3588. DOI: [10.1002/joc.8566](https://doi.org/10.1002/joc.8566) |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Map | Leaflet 1.9 + React-Leaflet 4 |
| Styling | Tailwind CSS 3 |
| Deployment | Vercel (root directory: `site/`) |
| Auth | httpOnly cookie + Next.js middleware |

---

## Repository Structure

```
cyclone_monitor_south_atlantic/
├── data/
│   ├── raw/                              ← Source data (gitignored)
│   │   └── tracks_SAt_source.csv
│   └── processed/                        ← Generated products
│       └── tracks_south_atlantic_consolidated.csv
├── scripts/
│   ├── data/                             ← Data pipeline
│   │   ├── run_pipeline.py               ← Main orchestrator
│   │   ├── download_source_data.py       ← Zenodo download
│   │   └── preprocess_data.py            ← CSV processing
│   └── preprocess_data.py                ← CSV → JSON for web app
├── site/                                 ← Next.js web application
│   ├── public/
│   │   └── data/
│   │       ├── summary.json              ← Track metadata (~10 MB)
│   │       └── details/{year}.json       ← Per-timestep data
│   ├── src/
│   │   ├── app/                          ← Pages, layouts, API routes
│   │   ├── components/                   ← React components
│   │   ├── lib/                          ← Data loading, filters, utils
│   │   └── types/                        ← TypeScript types
│   ├── middleware.ts                     ← Auth guard
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── data-documentation.md
│   ├── architecture.md
│   └── deployment.md
├── .gitignore
└── README.md
```

---

## Setup

### 1. Prerequisites

- Python 3.9+ with `pandas` and `numpy`
- Node.js 18+ (install via [nvm](https://github.com/nvm-sh/nvm) if needed)
- `curl` or `wget` for data downloads

### 2. Run the data pipeline

```bash
python3 scripts/data/run_pipeline.py
```

This downloads ~180 MB from Zenodo and generates the consolidated CSV (~143 MB).

### 3. Generate web app JSON

```bash
python3 scripts/preprocess_data.py
```

This generates:
- `site/public/data/summary.json` (~10 MB) — all track metadata and simplified line coordinates
- `site/public/data/details/{year}.json` (~2 MB each, 43 files) — full per-timestep data

### 4. Install dependencies

```bash
cd site
npm install
```

### 5. Configure environment

```bash
cd site
cp .env.example .env.local
# Edit .env.local — set SITE_PASSWORD
```

Default password in `.env.example`: `tc_petrobras`

### 6. Run locally

```bash
cd site
npm run dev
# Open http://localhost:3000 — redirects to /login
```

---

## Password Protection

Authentication uses a simple httpOnly cookie checked by Next.js middleware.

| Setting | Value |
|---------|-------|
| Environment variable | `SITE_PASSWORD` |
| Cookie name | `cyclone-auth` |
| Cookie lifetime | 7 days |
| Logout | Header button → `POST /api/auth/logout` |

See [docs/deployment.md](docs/deployment.md) for Vercel configuration.

---

## Vercel Deployment

The Next.js app lives in `site/`. When importing the project in Vercel, set **Root Directory** to `site`. Then add `SITE_PASSWORD` in environment variables.

Full instructions: [docs/deployment.md](docs/deployment.md)

---

## Documentation

| File | Contents |
|------|----------|
| [docs/data-documentation.md](docs/data-documentation.md) | CSV structure, derived artefacts, region and phase definitions |
| [docs/architecture.md](docs/architecture.md) | Component tree, state, performance rationale |
| [docs/deployment.md](docs/deployment.md) | Vercel deploy steps, environment variables |
| Site `/about` page | Data sources, methodology, references (visible after login) |

---

## Current Limitations

- The 10 MB `summary.json` is loaded on every initial page visit (~2.5 MB gzip over CDN).
- Static files under `site/public/data/` are publicly accessible by direct URL regardless of the password cookie — this is a known constraint of Vercel static hosting.
- LEC energetics are only available at 3-hourly intervals (~33% of timesteps have energetics data).
- Genesis region labels use short codes (ARG, LA-PLATA, SE-BR) that are mapped to display names in the web app.

## Roadmap

- [ ] Statistics dashboard (seasonal climatology, frequency maps)
- [ ] Export selected track as GeoJSON or CSV
- [ ] Intensity colormap on tracks (gradient from incipient to dissipation)
- [ ] Upgrade to Next.js 15+ to address current security advisory
