// ─── Core data types ──────────────────────────────────────────────────────────
// These types mirror the JSON artefacts produced by scripts/preprocess_data.py.
// Any schema change there must be reflected here.

/** One entry in summary.json → tracks[]. Carries all filtering metadata and
 *  simplified line coordinates for map rendering. */
export interface TrackSummary {
  /** Track identifier (format YYYYNNNN, e.g. 20010143). */
  id: number;
  year: number;
  /** Month of cyclogenesis (1–12). */
  month: number;
  /** ISO-8601 datetime of first timestep. */
  start: string;
  /** ISO-8601 datetime of last timestep. */
  end: string;
  /** Track duration in hours. */
  duration_h: number;
  /** Latitude of genesis (first position), degrees South (negative). */
  genesis_lat: number;
  /** Longitude of genesis (first position). */
  genesis_lon: number;
  /** Latitude of lysis (last position). */
  lysis_lat: number;
  /** Longitude of lysis (last position). */
  lysis_lon: number;
  /** Named genesis region derived from genesis lat/lon. */
  genesis_region: string;
  /** Maximum vor42 (filtered and normalized relative vorticity, ×10⁻⁵ s⁻¹).
   *  Absolute value is used to keep positive values. This is the intensity
   *  measure used throughout the application. */
  max_vor42: number;
  /** Intensity quantile label relative to all tracks in the dataset. */
  quantile: "top 5%" | "top 10%" | "top 25%" | "top 50%" | "bottom 50%";
  /**
   * True when the cyclone carries the full diagnostic stack (LEC energetics +
   * lifecycle phases + genesis region). False for "raw" tracks that exist in the
   * tracking catalogue but were never processed.
   *
   * NOTE: raw-catalogue tracks are not ingested yet, so every track currently
   * reports true. The filter is in place so they light up when merged in.
   */
  processed: boolean;
  /** CPS phase_class code (EC, SC, ST, SD, EC_like, …). Absent without CPS. */
  cps_class?: string;
  /** Human-readable expansion of cps_class. */
  cps_label?: string;
  /** Coarse group used by the type filter (Extratropical, Subtropical, …). */
  cps_group?: string;
  /** Persistent-state sequence, e.g. "EC->SC". */
  cps_seq?: string;
  /**
   * True when the CPS identification guards rejected at least one persistent
   * run as a Shapiro–Keyser warm seclusion. Not a class — a property of the
   * rejected runs, surfaced because it is scientifically interesting.
   */
  warm_seclusion?: boolean;
  /** Simplified track coordinates as [lon, lat] pairs (GeoJSON convention). */
  coords: [number, number][];
}

/**
 * Distribution of track-level max_vor42 across the whole dataset.
 * Drives the intensity filter: the PDF curve, the quantile guide lines and the
 * bounds of the range slider.
 */
export interface IntensityPDF {
  /** Histogram bin edges — length is density.length + 1. */
  bin_edges: number[];
  /** Raw counts per bin. */
  counts: number[];
  /** Probability density per bin (integrates to 1 over the value axis). */
  density: number[];
  min: number;
  max: number;
  /** Number of tracks contributing to the histogram. */
  n: number;
  quantiles: QuantileThresholds;
}

/** One structural class present in the dataset, with its track count. */
export interface CpsClassInfo {
  code: string;
  label: string;
  group: string;
  count: number;
}

/** Quantile thresholds for max_vor42 across all tracks (global, dataset-level).
 *  Used for intensity-based track coloring and classification.
 *  - p10: 10th percentile — tracks below this are shown in gray
 *  - p10–max range: used for yellow→orange→red gradient
 */
export interface QuantileThresholds {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  max: number;
}

/** Root structure of public/data/summary.json. */
export interface SummaryData {
  /** ISO-8601 datetime when the preprocessing script was run. */
  generated: string;
  total_tracks: number;
  date_range: { start: string; end: string };
  /** Sorted list of all years present in the dataset. */
  years: number[];
  /** Sorted list of all genesis months present (1–12). */
  months: number[];
  /** Sorted list of all genesis region names. */
  regions: string[];
  quantile_thresholds: QuantileThresholds;
  /** Distribution of max_vor42 — drives the intensity filter. */
  intensity_pdf?: IntensityPDF;
  /** Structural classes present, with counts (empty when CPS is absent). */
  cps_classes?: CpsClassInfo[];
  /** Coarse structural groups present, with counts. */
  cps_groups?: { group: string; count: number }[];
  /** How many cyclones had a run rejected as a warm seclusion. */
  warm_seclusion_count?: number;
  /** Track counts by processing level. */
  processing_levels?: { processed: number; raw: number };
  tracks: TrackSummary[];
}

/** Single timestep record inside a track detail file. */
export interface Timestep {
  /** ISO-8601 datetime. */
  date: string;
  /** Longitude, degrees. */
  lon: number;
  /** Latitude, degrees. */
  lat: number;
  /** Filtered and normalized relative vorticity (×10⁻⁵ s⁻¹). Intensity measure.
   *  Absolute value is used to keep positive values. */
  vor42: number;
  /**
   * Lifecycle phase, following the Cyclophaser convention
   * (de Souza et al., JOSS 2025; IJC 2024).
   */
  phase: "incipient" | "intensification" | "mature" | "decay" | "dissipation";
  // Lorenz Energy Cycle diagnostics (de Souza et al., Climate Dynamics 2025).
  // Originally 3-hourly, interpolated to 1-hourly in preprocessing.
  /** Zonal available potential energy (J m⁻²). */
  Az?: number;
  /** Eddy available potential energy (J m⁻²). */
  Ae?: number;
  /** Zonal kinetic energy (J m⁻²). */
  Kz?: number;
  /** Eddy kinetic energy (J m⁻²). */
  Ke?: number;
  /** Az→Ae conversion (W m⁻²). */
  Ca?: number;
  /** Ae→Ke conversion (W m⁻²). */
  Ce?: number;
  /** Ke→Kz conversion (W m⁻²).
   *  Positive = KE→KZ (barotropic dissipation); negative = KZ→KE (barotropic
   *  development driving the cyclone). Sign convention from LorenzCycleToolkit
   *  (de Souza et al., JOSS 2024). */
  Ck?: number;
  /** Az→Kz conversion (W m⁻²). */
  Cz?: number;
  /** Boundary flux of zonal APE (W m⁻²). */
  BAz?: number;
  /** Boundary flux of eddy APE (W m⁻²). */
  BAe?: number;
  /** Boundary flux of zonal KE (W m⁻²). */
  BKz?: number;
  /** Boundary flux of eddy KE (W m⁻²). */
  BKe?: number;
  /** Generation of zonal APE (W m⁻²). */
  Gz?: number;
  /** Generation of eddy APE (W m⁻²). */
  Ge?: number;
  /** Residual of zonal APE generation (W m⁻²). RGz = ∂Az/∂t - Gz + Cz + Ca - BAz */
  RGz?: number;
  /** Residual of eddy APE generation (W m⁻²). RGe = ∂Ae/∂t - Ge - Ca + Ce - BAe */
  RGe?: number;
  /** Residual of zonal KE dissipation (W m⁻²). RKz = ∂Kz/∂t - Cz + Ck - BKz */
  RKz?: number;
  /** Residual of eddy KE dissipation (W m⁻²). RKe = ∂Ke/∂t - Ce - Ck - BKe */
  RKe?: number;
  /**
   * True  = LEC value is from the original 3-hourly computation.
   * False = LEC value was linearly interpolated from adjacent 3-hourly values.
   * Absent = no LEC data at this timestep.
   * For JSON files produced before this flag was added, use the heuristic
   * `new Date(date).getUTCHours() % 3 === 0` as an approximation.
   */
  lec_original?: boolean;

  // ── Cyclone Phase Space (Hart 2003 framework) ───────────────────────────────
  // Source is 3-hourly, interpolated to 1-hourly in preprocessing exactly like
  // the LEC terms. Present only where the phase-space parameters exist.
  /** Storm-motion-relative 900–600 hPa thickness asymmetry (m).
   *  Large positive = frontal structure; near zero = symmetric. */
  cps_B?: number;
  /** Lower-tropospheric thermal wind, 900–600 hPa. Positive = warm core. */
  cps_VTL?: number;
  /** Upper-tropospheric thermal wind, 600–300 hPa. Positive = warm core. */
  cps_VTU?: number;
  /** Per-timestep structural label. */
  cps_class?: "extratropical" | "subtropical" | "tropical" | "unclassified";
  /** Diagnosed system radius (km). */
  cps_size_km?: number;
  /** Storm motion direction (degrees, 0–360). Interpolated on the circle. */
  cps_dir?: number;
  /**
   * True  = CPS parameters were computed at this timestep (original 3-hourly).
   * False = linearly interpolated from adjacent 3-hourly values.
   *
   * Anything persistence-based (the >= 36 h gate behind the per-cyclone
   * classification) must be computed on original timesteps only.
   */
  cps_original?: boolean;
}

/** Detail object per track inside a year detail file. */
export interface TrackDetail {
  timesteps: Timestep[];
}

/** Root structure of public/data/details/{year}.json. */
export interface YearDetails {
  year: number;
  /** Map of string(track_id) → detail object. */
  tracks: Record<string, TrackDetail>;
}

// ─── UI state types ───────────────────────────────────────────────────────────

/** Processing level filter. "all" applies no constraint. */
export type ProcessingFilter = "all" | "processed" | "raw";

/**
 * Intensity (max_vor42) selection.
 * - mode "range": keep tracks with min <= max_vor42 <= max
 * - mode "cutoff": keep tracks with max_vor42 >= min (max is ignored)
 * `null` bounds mean "unbounded on that side".
 */
export interface IntensityFilterState {
  mode: "range" | "cutoff";
  min: number | null;
  max: number | null;
}

export interface FilterState {
  /** Empty array means "all years". */
  years: number[];
  /** Empty array means "all months". */
  months: number[];
  /** Empty array means "all regions". */
  regions: string[];
  /** Empty array means "all structural groups" (Extratropical, Subtropical, …). */
  cpsGroups: string[];
  /** Empty array means "all phase_class codes". Applied on top of cpsGroups. */
  cpsClasses: string[];
  /** When true, keep only cyclones flagged with a rejected warm-seclusion run. */
  warmSeclusionOnly: boolean;
  /** Processing level constraint. */
  processing: ProcessingFilter;
  /** Intensity constraint on max_vor42. */
  intensity: IntensityFilterState;
}

export const EMPTY_INTENSITY: IntensityFilterState = {
  mode: "range",
  min: null,
  max: null,
};

export const EMPTY_FILTERS: FilterState = {
  years: [],
  months: [],
  regions: [],
  cpsGroups: [],
  cpsClasses: [],
  warmSeclusionOnly: false,
  processing: "all",
  intensity: EMPTY_INTENSITY,
};

/**
 * Colour per structural group, used by the type filter chips and the phase
 * diagram. Kept distinct from PHASE_COLORS (lifecycle) on purpose — the two
 * classifications are orthogonal and must not read as the same scale.
 */
export const CPS_GROUP_COLORS: Record<string, string> = {
  Extratropical: "#2563eb",
  Subtropical:   "#c026d3",
  Tropical:      "#dc2626",
  Transition:    "#ea580c",
  Undetermined:  "#9ca3af",
  "No CPS data": "#d1d5db",
};

/** Colour per per-timestep CPS class, for the Hart diagram trajectory. */
export const CPS_CLASS_COLORS: Record<string, string> = {
  extratropical: "#2563eb",
  subtropical:   "#c026d3",
  tropical:      "#dc2626",
  unclassified:  "#cbd5e1",
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Phase colour mapping.
 * Phases follow the Cyclophaser convention:
 *   de Souza et al. (JOSS, 2025) https://doi.org/10.21105/joss.07363
 *   de Souza et al. (IJC, 2024)  https://doi.org/10.1002/joc.8566
 */
/**
 * Phase colours matching the CycloPhaser convention used in de Souza et al. (2024, IJC).
 * Palette chosen to match the colours in that publication's lifecycle diagrams.
 */
export const PHASE_COLORS: Record<string, string> = {
  incipient:       "#b1cff2",
  intensification: "#fad99b",
  mature:          "#ea9393",
  decay:           "#ccd3bf",
  dissipation:     "#9e9e9e",   // gray for residual/dissipation
};

export const PHASE_LABELS: Record<string, string> = {
  incipient:       "Incipient",
  intensification: "Intensification",
  mature:          "Mature",
  decay:           "Decay",
  dissipation:     "Dissipation",
};

// ─── Wind100 types ────────────────────────────────────────────────────────────
// These types mirror the JSON produced by scripts/generate_wind100_json.py.
// Source dataset: Zenodo DOI 10.5281/zenodo.19353037
//
// Physical meaning:
//   wind100_max = absolute maximum 100 m wind within each Lagrangian quadrant
//   wind100_p99 = 99th-percentile 100 m wind within each Lagrangian quadrant
//
// Quadrant convention (relative to cyclone centre, defined by 850 hPa vor42):
//   NW | NE
//   ---+---
//   SW | SE

/**
 * One quadrant entry: [lon, lat, val, dist].
 * Index 0: longitude of the wind extremum (°)
 * Index 1: latitude of the wind extremum (°)
 * Index 2: wind speed at 100 m (m s⁻¹)
 * Index 3: angular distance from wind point to cyclone centre (°)
 */
export type Wind100QArray = [number, number, number, number];

/**
 * One metric (max or p99) at one timestep.
 * Each quadrant is null when no data is available.
 * gq = quadrant with the global timestep extremum ("NW" | "NE" | "SW" | "SE").
 */
export interface Wind100MetricEntry {
  NW: Wind100QArray | null;
  NE: Wind100QArray | null;
  SW: Wind100QArray | null;
  SE: Wind100QArray | null;
  gq: string | null;
}

/** Combined wind100 record for one timestep (both metrics). */
export interface Wind100TimestepEntry {
  max: Wind100MetricEntry | null;
  p99: Wind100MetricEntry | null;
}

/**
 * Per-year wind100 data, mirroring the structure of details/{year}.json.
 * tracks[String(trackId)][isoDate] = Wind100TimestepEntry
 */
export interface Wind100YearData {
  year: number;
  tracks: Record<string, Record<string, Wind100TimestepEntry>>;
}

/**
 * Global statistics from site/public/data/wind100/meta.json.
 * Used for consistent color-scale normalization across the entire dataset.
 */
export interface Wind100Meta {
  /** Absolute maximum of all wind100_max values across all tracks (m s⁻¹). */
  max_global_max: number;
  /** Absolute maximum of all wind100_p99 values (m s⁻¹). */
  p99_global_max: number;
  /** 95th-percentile of all wind100_max values (informational). */
  max_global_p95: number;
  /** 95th-percentile of all wind100_p99 values (informational). */
  p99_global_p95: number;
  years: number[];
  total_tracks: number;
  generated: string;
}

/** Metric selector for the wind100 visualization. */
export type Wind100Metric = "max" | "p99";

// ─── Sedimentary Basin types ──────────────────────────────────────────────────
// These types support spatial filtering of cyclones by basin intersection.
// Data is pre-computed by scripts/compute_basin_intersections.py.

/**
 * A single sedimentary basin feature from basins.geojson.
 * Geometry is a GeoJSON Polygon or MultiPolygon.
 */
export interface BasinFeature {
  type: "Feature";
  id: string;
  properties: {
    /** Unique basin identifier (e.g., "santos", "pelotas"). */
    id: string;
    /** Original basin name from shapefile (e.g., "Santos", "Pelotas_Mar"). */
    name: string;
    /** User-friendly display name (e.g., "Bacia de Santos"). */
    display_name: string;
    /** Bounding box [minLon, minLat, maxLon, maxLat]. */
    bbox: [number, number, number, number];
    /** Approximate area in km². */
    area_km2: number;
  };
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

/**
 * Root structure of basins.geojson.
 */
export interface BasinCollection {
  type: "FeatureCollection";
  metadata: {
    generated: string;
    crs: string;
    description: string;
    source: string;
    total_basins: number;
  };
  features: BasinFeature[];
}

/**
 * Per-basin statistics from basin_intersections.json.
 */
export interface BasinStats {
  /** Number of tracks whose center passes through this basin. */
  center_count: number;
  /** Number of tracks whose maximum wind position passes through this basin. */
  wind_max_count: number;
  /** Number of tracks that satisfy either condition. */
  any_count: number;
}

/**
 * Intersection data for a single track.
 */
export interface TrackBasinIntersection {
  /** Basin IDs where the cyclone center passes through. */
  center: string[];
  /** Basin IDs where the maximum wind position passes through. */
  wind_max: string[];
  /** Union of center and wind_max (either condition). */
  any: string[];
}

/**
 * Root structure of basin_intersections.json.
 */
export interface BasinIntersections {
  metadata: {
    generated: string;
    description: string;
    total_tracks_with_intersections: number;
    basins_used: number;
  };
  /** Per-basin metadata and statistics. */
  basins: Record<string, {
    name: string;
    stats: BasinStats;
  }>;
  /** Track ID (as string) -> intersection data. */
  tracks: Record<string, TrackBasinIntersection>;
}

/**
 * Basin filter mode: determines how spatial intersection is evaluated.
 * - "center": Track center passes through the basin
 * - "wind_max": Maximum wind position passes through the basin
 * - "any": Either center OR wind_max passes through the basin
 */
export type BasinFilterMode = "center" | "wind_max" | "any";

/**
 * State for basin-based spatial filtering.
 */
export interface BasinFilterState {
  /** Selected basin IDs (empty = no filter). */
  selectedBasins: string[];
  /** Filter mode. */
  mode: BasinFilterMode;
}

/**
 * Default (empty) basin filter state.
 */
export const EMPTY_BASIN_FILTER: BasinFilterState = {
  selectedBasins: [],
  mode: "any",
};
