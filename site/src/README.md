# Source Code Directory

This directory contains the main application source code for the South Atlantic Cyclone Monitor web application.

## Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Main map view
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   ├── login/              # Login page
│   │   └── page.tsx
│   ├── about/              # Data & Methodology page
│   │   └── page.tsx
│   └── api/
│       └── auth/           # Authentication endpoints
│           ├── route.ts
│           └── logout/
│               └── route.ts
├── components/             # React components
│   ├── CycloneMap.tsx      # Leaflet map with tracks
│   ├── FilterPanel.tsx     # Year/month/region filters
│   ├── Header.tsx          # App header with navigation
│   └── TrackDetailPanel.tsx # Selected track details
├── lib/                    # Utilities
│   ├── colors.ts           # Intensity-based color functions
│   ├── dataLoader.ts       # JSON data fetching
│   ├── filters.ts          # Filter logic
│   └── utils.ts            # Formatting helpers
└── types/
    └── cyclone.ts          # TypeScript definitions
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main map view with track visualization and filters |
| `/login` | Password authentication |
| `/about` | Data sources, methodology, and references |

## Key Components

- **CycloneMap**: Leaflet map rendering 6,789 tracks with canvas renderer for performance
- **FilterPanel**: Multi-select filters for year, month, and genesis region
- **TrackDetailPanel**: Shows track metadata, timestep list, and LEC diagnostics
- **Header**: Navigation links, track count, logout button

## Intensity-Based Track Coloring

When no cyclone is selected, track colors reflect intensity using `max_vor42` 
(maximum filtered relative vorticity, ×10⁻⁵ s⁻¹):

| Intensity | Color | Description |
|-----------|-------|-------------|
| Below p10 | Gray (#9ca3af) | Low-intensity cyclones (bottom 10%) |
| p10 → mid | Yellow → Orange | Moderate intensity |
| mid → max | Orange → Red | High intensity |

**Key details:**
- **Variable**: `max_vor42` — maximum vor42 across all timesteps of the track
- **Percentile calculation**: Track-level (one value per cyclone), not timestep-level
- **Scale**: Global across entire dataset (6,789 tracks), not dynamically recalculated for filtered subsets
- **Thresholds**: Pre-computed in `scripts/preprocess_data.py`, stored in `summary.json`

When a track is **selected**, only that track is highlighted (orange) and all others are dimmed (light blue).

## Data Flow

1. `page.tsx` loads `summary.json` on mount (10 MB, all track metadata)
2. Filter state managed in `page.tsx`, applied client-side
3. Track click triggers lazy load of `details/{year}.json` (2 MB per year)
4. Timestep details rendered from cached year data

## Authentication

- Cookie-based authentication via `middleware.ts`
- `POST /api/auth` validates password and sets `cyclone-auth` cookie
- All routes except `/login` and `/api/auth/*` require authentication

## Development

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm start        # Production server
```
