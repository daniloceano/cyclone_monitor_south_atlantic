# South Atlantic Cyclone Monitor

Interactive web monitor for extratropical cyclones in the Southwestern Atlantic: tracks,
Lorenz Energy Cycle diagnostics, Cyclone Phase Space classification, and cyclone-relative
wind extrema at 10 m and 100 m.

Built as a private scientific demonstration for the IAG-USP / Petrobras–CENPES cooperation.

---

## Overview

**6,789 cyclones · 631,009 hourly timesteps · 1979-01-01 to 2021-01-07.**

The catalogue is defined by the energetics: the LEC computation *is* the filter that
produced it. Every other diagnostic is joined onto that set.

The map colours tracks by a **display variable**, chosen in the header. The colour scale,
the intensity filter, the wind markers and the sidebar diagnostics all follow from that
one choice, so no two parts of the interface can ever describe different quantities:

| Display variable | Track intensity is… | Marker |
|---|---|---|
| Central relative vorticity | peak vorticity along the track (×10⁻⁵ s⁻¹) | — |
| Wind 10 m | largest quadrant maximum over the track (m s⁻¹) | circle |
| Wind 100 m | largest quadrant maximum over the track (m s⁻¹) | square |

Wind intensity uses the **maximum** statistic only. The 99th percentile remains available
per quadrant in the track panel, where it is the better description of a wind field, but it
never classifies a whole cyclone.

---

## Data sources

Provenance lives in **one** place: [`data/metadata/sources.json`](data/metadata/sources.json).
The pipeline reads it, emits `site/public/data/sources.json`, and the About page renders
from that — so a DOI corrected in the registry reaches the site without editing a component.
See [data/SOURCES.md](data/SOURCES.md) for the human-readable version.

| What | Source |
|---|---|
| Cyclone tracks + LEC energetics | Couto de Souza & Gramcianinov (2025), Zenodo [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432) |
| Tracking dataset & method | Gramcianinov et al. (2020), Mendeley Data [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4) |
| LEC methodology | De Souza et al. (2025), *Climate Dynamics* [10.1007/s00382-024-07555-z](https://doi.org/10.1007/s00382-024-07555-z) |
| Genesis regions | Gramcianinov et al. (2019), *Climate Dynamics* [10.1007/s00382-019-04778-7](https://doi.org/10.1007/s00382-019-04778-7) |
| Lifecycle phases | de Souza et al. (2025), *JOSS* [10.21105/joss.07363](https://doi.org/10.21105/joss.07363) |
| Cyclone Phase Space | Rodriguez & Couto de Souza (in prep.) — **DOI pending**, exported by hand from `paper_energy_patterns` |
| **Wind 10 m** | **Paredes Quispe (2026), Zenodo [10.5281/zenodo.19378255](https://doi.org/10.5281/zenodo.19378255)** |
| **Wind 100 m** | **Paredes Quispe (2026), Zenodo [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037)** |

---

## Data architecture

```
PRIMARY SOURCES (Zenodo / Mendeley / hand-export)
        │
        ▼
data/raw/                                    gitignored, stays on swell
  tracks_SAt_source.csv                      tracks + LEC, as published
  cps_parameters_SAt.csv                     CPS per timestep    (3-hourly)
  cps_classification_SAt.csv                 CPS per cyclone     (6,789 rows)
  wind10/{YYYY}_wind10/*.csv                 per-quadrant extrema (1-hourly)
  wind100/{YYYY}_wind100/*.csv               idem
        │
        ▼  scripts/data/preprocess_data.py + merge_wind.py
data/processed/                              gitignored, stays on swell
  tracks_south_atlantic_consolidated.csv     flat, 41 cols, one row per timestep
  tracks_by_id/{Y}/{M}/{id}.parquet          ◄── THE consolidated product
                                                 109 cols, one file per cyclone
  cyclones.parquet                           one row per cyclone (static attributes)
  cyclone_categories.json                    taxonomies → track_ids   (committed)
        │
        ▼  scripts/preprocess_data.py, generate_wind_json.py, compute_basin_intersections.py
site/public/data/                            committed, served by Vercel
  summary.json          11 MB   per-cyclone metadata + per-variable distributions
  details/{year}.json  279 MB   per-timestep tracks, LEC, CPS
  wind/{year}.json     291 MB   per-quadrant wind, BOTH heights in one file
  sources.json          16 KB   provenance registry
  basins.geojson, basin_intersections.json
```

**Two grains, deliberately separate.** A cyclone's *category* (`phase_class`: EC, SC, ST,
EC_like…) is a property of the whole system and lives in `cyclones.parquet` and
`cyclone_categories.json`. Its *state at a given hour* lives in the per-timestep files, in
two distinct columns: `cps_class` (raw threshold label, unguarded) and `cps_state` (the
accepted ≥36 h persistent state, or empty). Deriving the former from the latter is exactly
what the upstream persistence gate exists to prevent.

**`*_like` is not an identification.** `EC_like` / `SC_like` / `TC_like` mean the structure
was dominant but never sustained 36 h. Filter on `class_kind` / `is_identified`, never on a
string prefix — grouping `SC_like` under "Subtropical" asserts something the classification
explicitly refuses to assert.

---

## Quick start

```bash
# 1. Build the consolidated base (downloads ~540 MB; needs pandas 2.x)
python scripts/data/run_pipeline.py --wind

# 2. Generate the site artefacts
python scripts/preprocess_data.py             # summary.json, details/, sources.json
python scripts/generate_wind_json.py          # wind/{year}.json + meta.json
python scripts/compute_basin_intersections.py # basin_intersections.json

# 3. Run the site
cd site && npm install && cp .env.example .env.local && npm run dev
```

**Environment:** pandas must be `>= 2.0, < 3` — pandas 3 changed how `groupby.apply` passes
grouping columns and breaks the preprocessing. On swell, use the `paper_energy_patterns`
conda env. Node 18+ for the site.

---

## Pipeline

| Script | Reads | Writes |
|---|---|---|
| `scripts/data/download_source_data.py` | Zenodo | `data/raw/tracks_SAt_source.csv` |
| `scripts/data/preprocess_data.py` | raw tracks + CPS params | consolidated CSV |
| `scripts/data/wind_levels.py` | — | *registry: the one place a wind level is defined* |
| `scripts/data/download_wind.py` | Zenodo | `data/raw/wind{10,100}/` |
| `scripts/data/load_wind.py` | — | *loader module, parameterised by level* |
| `scripts/data/merge_wind.py` | consolidated CSV + wind + CPS class | `tracks_by_id/`, `cyclones.parquet` |
| `scripts/data/build_cyclone_categories.py` | `cyclones.parquet` | `cyclone_categories.json` |
| `scripts/preprocess_data.py` | consolidated CSV + `cyclones.parquet` | `summary.json`, `details/`, `sources.json` |
| `scripts/generate_wind_json.py` | `tracks_by_id/` | `wind/{year}.json` |
| `scripts/process_sedimentary_basins.py` | shapefiles | `basins.geojson` |
| `scripts/compute_basin_intersections.py` | basins + wind + details | `basin_intersections.json` |

**Adding a wind level** is one entry in `scripts/data/wind_levels.py`. No new download
script, loader or merger.

---

## Conventions that are easy to get wrong

- **`mx_mx_max` / `mx_mx_p99` in the wind archives hold a quadrant NAME, not a value**,
  despite what the Zenodo descriptions say. Verified as exactly the argmax of the four
  quadrant values over 74,242 comparisons.
- **Wind `dis` is Euclidean degrees**, `hypot(Δlon, Δlat)` — not great-circle. Verified to
  1e-14°. The site therefore does not store it and recomputes it.
- **Quadrant N/S labels are inverted** in the source relative to geographic convention. The
  stored data keep the original labels (a faithful copy of the archive); the correction is
  applied only where a label is shown, in `site/src/lib/windQuadrants.ts`.
- **LEC is native 3-hourly**, linearly interpolated to 1-hourly within each track;
  `lec_original` flags the computed values. Coverage after interpolation is 97.8 %.
- **CPS is native 3-hourly and is NOT interpolated for classification purposes**; the
  persistence gate, not smoothing, is the noise control.
- **Vorticity is stored as a magnitude**, so values are positive for SH cyclones. The sign
  convention is not altered anywhere.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Map | Leaflet 1.9 + React-Leaflet 4 |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 3 |
| Deployment | Vercel (root directory: `site/`) |
| Auth | httpOnly cookie + Next.js middleware (`SITE_PASSWORD`) |

---

## Version control

Large scientific products stay on swell and out of git:

| Kind | In git? |
|---|---|
| Code, docs, provenance registry | yes |
| `cyclone_categories.json` (~150 KB) | yes |
| `data/raw/**`, `data/processed/*.csv`, `**/*.parquet` | **no** — regeneratable, large |
| `site/public/data/**` (~583 MB) | yes — Vercel serves them as static assets |

---

## Documentation

| File | Contents |
|---|---|
| [data/SOURCES.md](data/SOURCES.md) | Provenance of every dataset, generated from the registry |
| [data/README.md](data/README.md) | Dataset-by-dataset detail, validation reports |
| [docs/data-documentation.md](docs/data-documentation.md) | Column reference, region and phase definitions |
| [docs/wind-integration.md](docs/wind-integration.md) | The wind pipeline in detail |
| [docs/architecture.md](docs/architecture.md) | Component tree, state, performance rationale |
| [docs/basin-filter.md](docs/basin-filter.md) | Sedimentary-basin filter |
| [docs/deployment.md](docs/deployment.md) | Vercel deploy steps |
| Site `/about` | Sources, coverage, methodology, references (after login) |

---

## Known limitations

- `summary.json` (11 MB, ~2.5 MB gzipped) is fetched on every first page visit.
- Static files under `site/public/data/` are publicly reachable by direct URL regardless of
  the password cookie — a constraint of Vercel static hosting.
- The Cyclone Phase Space dataset has no DOI yet; it is copied into `data/raw/` by hand and
  is not reproducible from a public download.
- Subtropical counts are threshold-sensitive by a factor of 6–8 across the threshold sets
  tested; the two `TC` cyclones are unverified candidates.
- The wind archives cover 7,987 track_ids, 1,198 of which are outside this catalogue and are
  not shown.
