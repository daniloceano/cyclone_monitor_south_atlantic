# South Atlantic Cyclone Monitor

Interactive web-based monitor for extratropical cyclone tracks in the Southwestern Atlantic Ocean (1979–2020).

## Overview

This tool visualises 6 789 cyclone tracks on a dynamic Leaflet map, allowing researchers to filter systems by year, month, and genesis region; inspect individual lifecycles; and explore per-timestep diagnostics including Lorenz Energy Cycle (LEC) parameters.

Built as a private scientific demonstration for the IAG-USP / Petrobras–CENPES cooperation.

---

## Data sources

| Dataset | Reference |
|---------|-----------|
| Cyclone tracks | Gramcianinov et al. **Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases**. Mendeley Data. DOI: [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4) |
| LEC diagnostics | **Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020)**. Zenodo. DOI: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432) |
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

## Repository structure

```
cyclone_monitor_south_atlantic/
├── data/
│   └── raw/
│       └── tracks_SAt_filtered_with_energetics.csv   ← source data (not committed)
├── scripts/
│   └── preprocess_data.py                            ← CSV → JSON pipeline (run from here)
├── site/                                             ← Next.js web application
│   ├── public/
│   │   └── data/
│   │       ├── summary.json                          ← all tracks + simplified coords (~10 MB)
│   │       └── details/{year}.json                   ← full timestep data, loaded on demand
│   ├── src/
│   │   ├── app/                                      ← pages, layouts, API routes
│   │   ├── components/                               ← React components
│   │   ├── lib/                                      ← data loading, filters, utils
│   │   └── types/                                    ← TypeScript types
│   ├── middleware.ts                                  ← auth guard
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

### 2. Place the source data

```bash
# The CSV must be at:
data/raw/tracks_SAt_filtered_with_energetics.csv
```

### 3. Run the preprocessing pipeline

Run from the **project root** (not from `site/`):

```bash
python3 scripts/preprocess_data.py
```

This generates:
- `site/public/data/summary.json` (~10 MB) — all track metadata and simplified line coordinates
- `site/public/data/details/{year}.json` (~1.8 MB each, 43 files) — full per-timestep data

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

## Password protection

Authentication uses a simple httpOnly cookie checked by Next.js middleware.

| Setting | Value |
|---------|-------|
| Environment variable | `SITE_PASSWORD` |
| Cookie name | `cyclone-auth` |
| Cookie lifetime | 7 days |
| Logout | Header button → `POST /api/auth/logout` |

See [docs/deployment.md](docs/deployment.md) for Vercel configuration.

---

## Vercel deployment

The Next.js app lives in `site/`. When importing the project in Vercel, set
**Root Directory** to `site`. Then add `SITE_PASSWORD` in environment variables.

Full instructions: [docs/deployment.md](docs/deployment.md)

---

## Documentation

| File | Contents |
|------|----------|
| [docs/data-documentation.md](docs/data-documentation.md) | CSV structure, derived artefacts, region and phase definitions |
| [docs/architecture.md](docs/architecture.md) | Component tree, state, performance rationale |
| [docs/deployment.md](docs/deployment.md) | Vercel deploy steps, environment variables |

---

## Current limitations

- The 10 MB `summary.json` is loaded on every initial page visit (~2.5 MB gzip over CDN).
- Static files under `site/public/data/` are publicly accessible by direct URL regardless of the password cookie — this is a known constraint of Vercel static hosting.
- Lifecycle phases (incipient/intensification/mature/decay/dissipation) are derived heuristically from the vor42 time series. For rigorous lifecycle analysis, use [Cyclophaser](https://github.com/daniloceano/CycloPhaser) directly.
- Genesis region bounding boxes are approximations of the hotspots in Gramcianinov et al. (2019).

## Roadmap

- [ ] Integrate Cyclophaser phase labels directly from pre-computed per-track phase files
- [ ] Statistics dashboard (seasonal climatology, frequency maps)
- [ ] Export selected track as GeoJSON or CSV
- [ ] Intensity colormap on tracks (gradient from incipient to dissipation)
- [ ] Upgrade to Next.js 15+ to address current security advisory
