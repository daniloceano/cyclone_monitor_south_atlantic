# South Atlantic Cyclone Monitor

Interactive web-based monitor for extratropical cyclone tracks in the Southwestern Atlantic Ocean (1979–2020).

## Overview

This tool visualises 6 789 cyclone tracks on a dynamic Leaflet map, allowing researchers to filter systems by year, month, and genesis region; inspect individual lifecycles; and explore per-timestep diagnostics including Lorenz Energy Cycle (LEC) parameters.

Built as a private scientific demonstration for the IAG-USP / Petrobras–CENPES cooperation.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Map | Leaflet 1.9 + React-Leaflet 4 |
| Styling | Tailwind CSS 3 |
| Deployment | Vercel |
| Auth | httpOnly cookie + Next.js middleware |

---

## Repository structure

```
cyclone_monitor_south_atlantic/
├── data/
│   └── raw/
│       └── tracks_SAt_filtered_with_energetics.csv   ← source data (not committed)
├── scripts/
│   └── preprocess_data.py                            ← CSV → JSON pipeline
├── public/
│   └── data/
│       ├── summary.json                              ← all track summaries + line coords
│       └── details/
│           ├── 1979.json
│           ├── 1980.json
│           └── ...                                   ← per-year full timestep data
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                                  ← main map page
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   └── api/auth/
│   │       ├── route.ts                              ← login endpoint
│   │       └── logout/route.ts
│   ├── components/
│   │   ├── CycloneMap.tsx                            ← Leaflet map (ssr:false)
│   │   ├── FilterPanel.tsx
│   │   ├── TrackDetailPanel.tsx
│   │   └── Header.tsx
│   ├── lib/
│   │   ├── dataLoader.ts
│   │   ├── filters.ts
│   │   └── utils.ts
│   └── types/
│       └── cyclone.ts
├── middleware.ts                                     ← auth guard
├── docs/
│   ├── data-documentation.md
│   ├── architecture.md
│   └── deployment.md
├── .env.example
├── package.json
└── next.config.js
```

---

## Setup

### 1. Prerequisites

- Python 3.9+ with pandas and numpy
- Node.js 18+ (or install via [nvm](https://github.com/nvm-sh/nvm))

### 2. Clone and place the data file

```bash
# Place the source CSV at:
data/raw/tracks_SAt_filtered_with_energetics.csv
```

### 3. Run the preprocessing pipeline

Converts the raw CSV into web-optimised JSON artefacts under `public/data/`:

```bash
python3 scripts/preprocess_data.py
# or via npm:
npm run preprocess
```

This generates:
- `public/data/summary.json` (~10 MB) — one entry per track with metadata and simplified line coordinates
- `public/data/details/{year}.json` (~1.8 MB each, 43 files) — full per-timestep data, loaded on demand

### 4. Install dependencies

```bash
npm install
```

### 5. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and set SITE_PASSWORD
```

The default password in `.env.example` is `tc_petrobras`.

### 6. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

You will be redirected to `/login`. Enter the password to access the map.

---

## Password protection

Authentication uses a simple httpOnly cookie checked by Next.js middleware.

| Setting | Description |
|---------|-------------|
| `SITE_PASSWORD` | The access password (required) |
| Cookie name | `cyclone-auth` |
| Cookie lifetime | 7 days |
| Logout | Button in top-right header → `/api/auth/logout` |

> **Note:** Static JSON files under `/data/` are served from Vercel's CDN and cannot be
> gated by middleware without a custom server. This is a soft barrier suitable for a
> private scientific demo. For strict access control, move data serving to API routes.

---

## Vercel deployment

See [docs/deployment.md](docs/deployment.md) for step-by-step instructions.

Quick reference:
1. Push the repository (including `public/data/`) to GitHub
2. Import the project in [vercel.com](https://vercel.com)
3. In **Project Settings → Environment Variables**, add `SITE_PASSWORD=tc_petrobras`
4. Deploy

---

## Data sources

The dataset is derived from two published resources:

1. **Zenodo** — Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian Lorenz Energy Cycle (LEC) diagnostics (1979–2020)
   DOI: [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)

2. **Mendeley Data** — Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases
   DOI: [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4)

---

## Current limitations

- The 10 MB `summary.json` is loaded on every initial page visit. Served via CDN, it compresses to ~2.5 MB over the wire — acceptable but notable on slow connections.
- Static files under `public/data/` are publicly accessible at their URLs regardless of the password cookie. This is by design for Vercel static hosting.
- Lifecycle phase (genesis/intensification/mature/decay/lysis) is derived heuristically from the vor42 time series. No explicit phase labels were present in the source data.
- Genesis region assignment uses geographic bounding boxes; some ambiguous tracks near region boundaries may be misclassified.

## Roadmap

- [ ] Add a statistics dashboard (seasonal climatology, frequency maps)
- [ ] Export selected track as GeoJSON or CSV
- [ ] Add intensity colormap to tracks (gradient from genesis to lysis)
- [ ] Multi-track comparison panel
- [ ] Move data serving to API routes for stricter access control
- [ ] Upgrade to Next.js 15+ when ready to address current security advisory
