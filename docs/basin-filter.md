# Basin Filter Integration

This document describes the spatial filtering feature that allows users to filter cyclones by their intersection with Brazilian sedimentary basins.

## Overview

The basin filter enables users to:
1. **View basin boundaries** on the map
2. **Select basins** via the filter panel or by clicking on the map
3. **Filter cyclones** that pass through selected basins, with options for:
   - Cyclone center passes through basin
   - Maximum wind position passes through basin
   - Either condition (default)

## Data Pipeline

### Source Data

Basin boundaries are sourced from ESRI Shapefiles stored in `data/sedimentary_basins/`. Each basin has its own folder containing:
- `bacias_gishub_db.shp` — Geometry
- `bacias_gishub_db.shx` — Index
- `bacias_gishub_db.dbf` — Attributes
- `bacias_gishub_db.prj` — CRS definition (EPSG:4326)

### Processing Scripts

#### 1. `scripts/process_sedimentary_basins.py`

Reads all shapefiles and produces a combined GeoJSON for the web application.

**Input**: `data/sedimentary_basins/{basin}/bacias_gishub_db.shp`

**Output**: `site/public/data/basins.geojson`

**Processing**:
- Validates all geometries (fixes invalid ones)
- Verifies CRS is WGS84 (EPSG:4326)
- Normalizes basin IDs (lowercase, accents removed, underscores to hyphens)
- Creates display names (e.g., "Bacia de Santos", "Bacia do Ceará")
- Computes bounding boxes for efficient spatial queries

**Running**:
```bash
python3 scripts/process_sedimentary_basins.py
```

#### 2. `scripts/compute_basin_intersections.py`

Pre-computes which basins each cyclone track intersects, enabling instant filtering in the frontend.

**Input**:
- `site/public/data/basins.geojson` — Basin polygons
- `site/public/data/summary.json` — Track center coordinates
- `site/public/data/wind100/{year}.json` — Maximum wind positions

**Output**: `site/public/data/basin_intersections.json`

**Processing**:
- For each track, tests point-in-polygon for all center positions
- For each track, tests point-in-polygon for all maximum wind positions
- Uses bounding box filtering for efficiency
- Computes per-basin statistics

**Running**:
```bash
python3 scripts/compute_basin_intersections.py
```

### Generated Data Files

| File | Size | Description |
|------|------|-------------|
| `basins.geojson` | ~614 KB | GeoJSON FeatureCollection with all 16 basins |
| `basin_intersections.json` | ~172 KB | Pre-computed track-basin intersections |

> The filter modes and the wind-height dimension are documented under
> [Two independent dimensions](#two-independent-dimensions) below.

## Frontend Implementation

### Components

1. **FilterPanel.tsx** — Basin filter UI
   - Basin selector (multi-select)
   - Filter mode selector (center / wind_max / any)
   - Track counts per basin

2. **CycloneMap.tsx** — Basin layer on map
   - Basin polygons with teal styling
   - Hover effects
   - Click-to-select functionality
   - Selected basin highlighting

3. **page.tsx** — State management
   - Basin data loading
   - Filter state management
   - Integration with existing filters

### Type Definitions

```typescript
// Filter mode
type BasinFilterMode = "center" | "wind_max" | "any";

// Filter state
interface BasinFilterState {
  selectedBasins: string[];
  mode: BasinFilterMode;
}

// Basin feature from GeoJSON
interface BasinFeature {
  type: "Feature";
  id: string;
  properties: {
    id: string;
    name: string;
    display_name: string;
    bbox: [number, number, number, number];
    area_km2: number;
  };
  geometry: GeoJSON.Polygon;
}
```

### Filter Logic

The filter operates on pre-computed intersection data:

```typescript
function filterTracksByBasin(
  tracks: TrackSummary[],
  basinFilter: BasinFilterState,
  intersections: BasinIntersections | null
): TrackSummary[] {
  if (selectedBasins.length === 0) return tracks;
  
  return tracks.filter(track => {
    const trackData = intersections.tracks[track.id];
    if (!trackData) return false;
    
    // Get relevant basin list based on mode
    const relevantBasins = 
      mode === "center" ? trackData.center :
      mode === "wind_max" ? trackData.wind_max :
      trackData.any;
    
    // Check if track intersects any selected basin
    return relevantBasins.some(b => selectedBasins.includes(b));
  });
}
```

## Adding New Basins

To add a new basin:

1. Place shapefile (`.shp`, `.shx`, `.dbf`, `.prj`) in a new folder under `data/sedimentary_basins/`
2. Ensure the shapefile uses EPSG:4326 (WGS84) coordinate system
3. Run the processing scripts:
   ```bash
   python3 scripts/process_sedimentary_basins.py
   python3 scripts/compute_basin_intersections.py
   ```
4. Rebuild the web application:
   ```bash
   cd site && npm run build
   ```

## Limitations

1. **Static intersection data**: Intersections are pre-computed; runtime spatial queries are not performed. This enables fast filtering but requires re-running scripts if track data changes.

2. **Wind coverage**: every cyclone in the catalogue has wind data at both heights (6,789 / 6,789, 100 % of timesteps), so the wind modes exclude nothing on availability grounds. A track with no intersection record simply intersects no basin.

3. **Point-in-polygon precision**: The filter tests individual points (cyclone center, wind max position) against basin polygons. It does not consider track segments or buffer zones.

4. **Northern basins**: Due to the nature of extratropical cyclones in the South Atlantic, basins north of ~15°S have essentially no cyclone intersections in this dataset.

## CRS and Projections

- **Source shapefiles**: All use EPSG:4326 (WGS84)
- **Web application**: Uses EPSG:4326 for Leaflet
- **No reprojection needed**: All data remains in WGS84 throughout the pipeline

The processing script validates CRS for each shapefile and will reproject if necessary, but in practice all current basins are already in WGS84.

---

## Two independent dimensions

The filter has two orthogonal controls. Mixing them up is the easy mistake, so
they are named for what they each decide:

**Mode — WHICH positions are tested**

| Mode | Test |
|---|---|
| `center` | the cyclone centre, at any timestep |
| `wind_max` | the position of the wind maximum, at any timestep |
| `any` | centre **OR** wind maximum |

**Wind height — WHICH height supplies the wind positions**

| Height | Test |
|---|---|
| `10 m` | the 10 m wind maximum |
| `100 m` | the 100 m wind maximum |
| `Any` | the 10 m **OR** the 100 m wind maximum |

`Any` is a logical **OR**, which is why the control is not labelled "Both" —
"Both" would read as requiring the condition to hold at 10 m *and* at 100 m.

The height is irrelevant when the mode is `center`, which tests no wind position
at all; the control is disabled there.

The wind position is taken at the quadrant carrying the timestep maximum, using
the `max` statistic. `p99` is a detailed diagnostic and never drives the spatial
filter.

## Precomputed data

`scripts/compute_basin_intersections.py` stores only the three primitive sets per
track — `center`, `wind10`, `wind100`. Every union the interface needs is derived
from those in the browser, so adding a wind level means one more array per track
rather than a combinatorial explosion of precomputed unions.

```json
"19790063": {"center": [], "wind10": ["pelotas"], "wind100": ["pelotas"]}
```

Per-basin counts are precomputed for each mode × height combination, keyed as
`center`, `wind_max_10`, `wind_max_100`, `wind_max_any`, `any_10`, `any_100`,
`any_any` — the same keys `basinStatKey()` builds in `site/src/lib/filters.ts`.
These are dataset-wide counts shown beside each basin, not counts within the
currently applied filter.

## Track counts by basin

| Basin | Centre | Wind 10 m | Wind 100 m | Wind any | Any |
|---|---|---|---|---|---|
| Bacia de Pelotas | 1188 | 1667 | 1551 | 1724 | 1958 |
| Bacia de Santos | 444 | 667 | 625 | 717 | 860 |
| Bacia de Campos | 149 | 393 | 409 | 446 | 492 |
| Bacia de Espírito Santo | 13 | 84 | 83 | 94 | 100 |
| Bacia de Mucuri | 4 | 26 | 23 | 27 | 29 |
| Bacia de Cumuruxatiba | 1 | 16 | 15 | 17 | 18 |
| Bacia de Jequitinhonha | 2 | 5 | 4 | 5 | 6 |
| Bacia de Camamu-Almada | 0 | 3 | 1 | 3 | 3 |
| Bacia de Jacuípe | 0 | 2 | 2 | 2 | 2 |
| Bacia de Sergipe-Alagoas (SEAL) | 0 | 1 | 1 | 1 | 1 |

Basins north of about 15°S record no intersections: extratropical cyclones and
their wind maxima do not reach them. The 10 m and 100 m columns differ slightly
because the strongest wind sits in a marginally different place at each height.

