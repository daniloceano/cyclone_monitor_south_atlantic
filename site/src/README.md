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
