# Type Definitions Directory

This directory contains shared TypeScript type definitions and interfaces used across the application.

## 🎯 Purpose

Centralized type definitions for:
- Track data structures
- API request/response schemas
- Map component props
- Filter configurations
- Shared domain models

## 📁 Structure

```
types/
├── track.ts                # Cyclone track data types
├── energetics.ts           # Energetics parameter types
├── map.ts                  # Map and GeoJSON types
├── filter.ts               # Filter state types
├── api.ts                  # API schemas
├── ui.ts                   # UI component prop types
└── README.md              # This file
```

## 🚀 Current Status

**Phase**: Not yet implemented

This directory is prepared for TypeScript type definitions when the application is developed.

## 📝 Type Definition Guidelines

### Track Data Types

Expected structure for cyclone tracks:

```typescript
// types/track.ts

/**
 * Single point along a cyclone track
 */
export interface TrackPoint {
  timestamp: string;           // ISO 8601 format
  latitude: number;            // Degrees North
  longitude: number;           // Degrees East
  pressure?: number;           // hPa (optional)
  windSpeed?: number;          // m/s (optional)
}

/**
 * Complete cyclone track
 */
export interface CycloneTrack {
  id: string;                  // Unique track identifier
  name?: string;               // Optional track name
  points: TrackPoint[];        // Array of track points
  startDate: string;           // ISO 8601
  endDate: string;             // ISO 8601
  maxIntensity?: number;       // Minimum pressure or max wind
  energetics?: EnergeticsData; // Energy cycle parameters
  metadata: TrackMetadata;
}

/**
 * Track metadata
 */
export interface TrackMetadata {
  source: string;              // Data source
  region: string;              // Geographic region
  season: string;              // Cyclone season (e.g., "2020-2021")
  classification?: string;     // Cyclone type classification
}
```

### Energetics Types

```typescript
// types/energetics.ts

/**
 * Lorenz Energy Cycle components
 */
export interface EnergeticsData {
  // Zonal energy terms
  zonalKE?: number;            // Zonal kinetic energy
  zonalAPE?: number;           // Zonal available potential energy
  
  // Eddy energy terms
  eddyKE?: number;             // Eddy kinetic energy
  eddyAPE?: number;            // Eddy available potential energy
  
  // Conversion terms
  ca?: number;                 // Conversion AZ → AE
  ce?: number;                 // Conversion AE → KE
  ck?: number;                 // Conversion KE → KZ
  
  // Generation terms
  gz?: number;                 // Generation of AZ
  ge?: number;                 // Generation of AE
  
  timestamp: string;           // When energetics were computed
}
```

### Filter Types

```typescript
// types/filter.ts

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Intensity filter
 */
export interface IntensityFilter {
  minPressure?: number;
  maxPressure?: number;
  minWindSpeed?: number;
  maxWindSpeed?: number;
}

/**
 * Geographic filter
 */
export interface GeographicFilter {
  bounds?: [number, number, number, number]; // [south, west, north, east]
  region?: string;
}

/**
 * Combined filter state
 */
export interface FilterState {
  dateRange: DateRangeFilter;
  intensity: IntensityFilter;
  geographic: GeographicFilter;
  showEnergeticsOnly: boolean;
}
```

### API Types

```typescript
// types/api.ts

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  timestamp: string;
}

/**
 * Track query parameters
 */
export interface TrackQueryParams {
  startDate?: string;
  endDate?: string;
  region?: string;
  minIntensity?: number;
  limit?: number;
  offset?: number;
}

/**
 * Track list response
 */
export interface TrackListResponse {
  tracks: CycloneTrack[];
  total: number;
  page: number;
  pageSize: number;
}
```

## 🎯 Best Practices

### Type vs Interface

- **Use `interface`** for object shapes that may be extended
- **Use `type`** for unions, intersections, or primitive aliases

```typescript
// Interface (extendable)
interface BaseTrack {
  id: string;
  points: TrackPoint[];
}

interface CycloneTrack extends BaseTrack {
  energetics?: EnergeticsData;
}

// Type (union/intersection)
type TrackStatus = 'active' | 'historical' | 'forecasted';
type TrackWithStatus = CycloneTrack & { status: TrackStatus };
```

### Strict Typing

Enable strict TypeScript options in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### Optional vs Required

Use `?` for truly optional fields:

```typescript
interface Track {
  id: string;              // Required
  name?: string;           // Optional
  points: TrackPoint[];    // Required
}
```

### Documentation

Add JSDoc comments to all exported types:

```typescript
/**
 * Represents a single cyclone track with all associated metadata.
 * 
 * @example
 * const track: CycloneTrack = {
 *   id: "track_001",
 *   points: [...],
 *   startDate: "2020-05-15T00:00:00Z",
 *   endDate: "2020-05-18T12:00:00Z",
 *   metadata: {...}
 * };
 */
export interface CycloneTrack {
  // ...
}
```

## 🔄 Type Reuse

Share types across:
- Frontend components (`src/components/`)
- API routes (`src/app/api/`)
- Utility functions (`src/lib/`)
- Scripts (if using TypeScript in `scripts/`)

Import from this central location:

```typescript
// In a component
import type { CycloneTrack, FilterState } from '@/types/track';
import type { EnergeticsData } from '@/types/energetics';
```

## 🧪 Type Testing

Consider using type-testing utilities:

```typescript
// types/__tests__/track.test.ts
import type { CycloneTrack } from '../track';

// Runtime validation (e.g., with Zod)
import { z } from 'zod';

const TrackSchema = z.object({
  id: z.string(),
  points: z.array(z.object({
    timestamp: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  })),
  // ...
});

// Use for API response validation
const validatedTrack = TrackSchema.parse(apiResponse);
```

## 📦 Integration with Data

Types should match the CSV structure:

```
CSV Column          TypeScript Type
--------------      ---------------
track_id        →   CycloneTrack.id
timestamp       →   TrackPoint.timestamp
lat             →   TrackPoint.latitude
lon             →   TrackPoint.longitude
mslp            →   TrackPoint.pressure
```

## 🔗 Related Files

- **Component props**: Also defined in `src/components/` when specific to one component
- **API schemas**: May duplicate types here for validation (e.g., with Zod)
- **Data processing**: Use these types in `scripts/` for type-safe data transformation

## 📧 Questions?

For TypeScript best practices and type design, refer to the main documentation or the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html).
