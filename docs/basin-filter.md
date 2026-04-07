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

## Spatial Filter Modes

### 1. Cyclone Center Inside Basin

A track satisfies this condition if its center coordinates pass through the basin at **any timestep** during the cyclone's lifecycle.

**Use case**: Finding cyclones that physically tracked through a basin.

### 2. Maximum Wind Inside Basin

A track satisfies this condition if the position of maximum 100m wind (from wind100_max) falls inside the basin at **any timestep**.

**Use case**: Finding cyclones whose strongest winds affected a basin, even if the cyclone center was elsewhere.

**Technical note**: The wind100 data contains absolute coordinates `[lon, lat, wind_speed, distance]` for each quadrant. The filter uses the position from the quadrant with the global maximum (indicated by the `gq` field).

### 3. Center OR Maximum Wind (Default)

A track satisfies this condition if **either** the center or maximum wind position passes through the basin.

**Use case**: Comprehensive filtering to find all cyclones that could have impacted a basin.

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

## Available Basins

| ID | Display Name | Tracks (Any) |
|----|--------------|--------------|
| `pelotas` | Bacia de Pelotas | 1,847 |
| `santos` | Bacia de Santos | 792 |
| `campos` | Bacia de Campos | 462 |
| `espirito-santo` | Bacia do Espírito Santo | 89 |
| `mucuri` | Bacia de Mucuri | 25 |
| `cumuruxatiba` | Bacia de Cumuruxatiba | 16 |
| `jequitinhonha` | Bacia de Jequitinhonha | 5 |
| `camamu-almada` | Bacia de Camamu-Almada | 2 |
| `jacuipe` | Bacia de Jacuípe | 1 |
| `seal` | Bacia de Sergipe-Alagoas (SEAL) | 1 |
| Others | Northern basins | 0 |

> **Note**: Southern basins dominate because they lie in the main extratropical cyclone track region. Northern basins (Ceará, Barreirinhas, Pará-Maranhão, Foz do Amazonas) have zero intersections with the extratropical cyclone dataset.

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

2. **Wind100 data availability**: Maximum wind filter only works for tracks with wind100 data. Tracks without wind100 data will not match "wind_max" or "any" filter modes based on wind position.

3. **Point-in-polygon precision**: The filter tests individual points (cyclone center, wind max position) against basin polygons. It does not consider track segments or buffer zones.

4. **Northern basins**: Due to the nature of extratropical cyclones in the South Atlantic, basins north of ~15°S have essentially no cyclone intersections in this dataset.

## CRS and Projections

- **Source shapefiles**: All use EPSG:4326 (WGS84)
- **Web application**: Uses EPSG:4326 for Leaflet
- **No reprojection needed**: All data remains in WGS84 throughout the pipeline

The processing script validates CRS for each shapefile and will reproject if necessary, but in practice all current basins are already in WGS84.
