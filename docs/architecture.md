# Architecture

## Repository layout

```
cyclone_monitor_south_atlantic/
├── data/                              # Data (raw CSV not committed)
│   └── raw/
│       └── tracks_SAt_filtered_with_energetics.csv
├── scripts/
│   └── preprocess_data.py             # CSV → JSON pipeline (run from project root)
├── site/                              # Next.js web application
│   ├── public/
│   │   └── data/                      # Pre-processed static JSON (committed)
│   │       ├── summary.json
│   │       └── details/{year}.json
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── middleware.ts
│   ├── package.json
│   └── next.config.js
├── docs/
└── README.md
```

## Design principle: no raw CSV in the browser

The source CSV is 66 MB / 631 009 rows. Loading it in the browser would cause
unacceptable initial load times and memory usage. A Python preprocessing script
converts it into two categories of static JSON artefacts served from Vercel's CDN:

```
CSV (66 MB)  →  summary.json (~10 MB)  +  details/{year}.json (~1.8 MB × 43)
```

The frontend never touches the raw CSV.

## Data flow

```
Initial page load
  → fetch /data/summary.json  (10 MB raw / ~2.5 MB gzip)
  → render all track polylines from summary.tracks[].coords
  → populate filter dropdowns from summary.years / summary.months / summary.regions

User applies filters
  → client-side array.filter() over summary.tracks[]  (no network request)

User clicks a track
  → fetch /data/details/{year}.json  (1.8 MB raw / ~500 KB gzip)
  → find track by id in yearDetails.tracks
  → render CircleMarker for each timestep
  → show TrackDetailPanel with lifecycle info

User clicks a timestep marker
  → read from already-loaded yearDetails object  (no network request)
  → show TimestepDetail with full LEC diagnostics
```

## Component tree

```
page.tsx  (state owner)
├── Header.tsx
├── aside
│   ├── FilterPanel.tsx
│   └── TrackDetailPanel.tsx  (conditional)
└── main
    └── CycloneMap.tsx  (dynamic import, ssr: false)
        ├── MapContainer (Leaflet)
        │   ├── TileLayer (CARTO dark)
        │   ├── TrackPolyline × N  (canvas renderer)
        │   ├── CircleMarker × M  (selected track timesteps only)
        │   └── MapClickHandler
        └── Tooltip (Leaflet native)
```

## State management

All state is owned by `page.tsx` and passed down as props. No Context or external
state library — the component tree is shallow enough that prop drilling is clean.

| State | Description |
|-------|-------------|
| `summaryData` | Loaded once on mount; never mutated |
| `filters` | Year/month/region selections |
| `filteredTracks` | Derived via `useMemo` from `summaryData` + `filters` |
| `selectedTrack` | The currently selected `TrackSummary` or null |
| `timesteps` | Full timestep array for selected track (loaded async) |
| `selectedTimestep` | One timestep clicked in the sidebar or on the map |

## Performance choices

| Decision | Rationale |
|----------|-----------|
| Canvas renderer for polylines | 6 789 simultaneous SVG paths causes noticeable jank; canvas handles them smoothly |
| Coordinate downsampling (max 120 pts/track) | Reduces `summary.json` by ~40% with imperceptible visual loss at map zoom levels 3–7 |
| Lazy year-file loading | The 43 year detail files (~1.8 MB each) are only fetched when a user clicks a track from that year |
| Module-level JS cache for loaded files | `Map<year, YearDetails>` in `dataLoader.ts` avoids re-fetching when navigating between tracks in the same year |

## SSR / Leaflet compatibility

Leaflet accesses `window` and `document` at import time, which crashes Next.js SSR.
The map component is imported with `dynamic(() => import('@/components/CycloneMap'), { ssr: false })`.
All Leaflet-specific code lives inside `CycloneMap.tsx` and never executes on the server.

## Authentication

```
Request to /  →  middleware.ts checks cookie "cyclone-auth"
                         │
             cookie absent ──→  redirect to /login
                         │
             cookie present ──→  pass through to page
```

- Cookie is httpOnly (not accessible to JavaScript)
- Cookie is set by `POST /api/auth` which compares against `SITE_PASSWORD` env var
- `POST /api/auth/logout` sets the cookie to empty string with `maxAge: 0`
- Static files under `/data/` bypass middleware (Vercel CDN serves them directly)

## Vercel deployment root

Because the Next.js app lives in `site/`, the **Vercel root directory** must be
set to `site/`. See [deployment.md](deployment.md) for details.
