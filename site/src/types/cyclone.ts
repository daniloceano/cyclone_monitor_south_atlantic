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
  /**
   * Peak intensity over the life cycle, one field per display variable.
   *
   * `max_vor42` — maximum of vor42, the relative vorticity at 850 hPa
   * spectrally filtered to T42, stored as a magnitude (×10⁻⁵ s⁻¹).
   *
   * `max_wind10` / `max_wind100` — maximum, over all timesteps, of the largest
   * of the four quadrant maxima at that height (m s⁻¹). Built from the `max`
   * statistic only: p99 is a detailed diagnostic, never an intensity
   * classifier. Absent when the cyclone has no wind data at that height.
   *
   * The active DisplayVariable picks which of these colours the map and drives
   * the intensity filter — they always move together.
   */
  max_vor42: number;
  max_wind10?: number;
  max_wind100?: number;
  /** CPS phase_class code (EC, SC, ST, SD, EC_like, …). Absent without CPS. */
  cps_class?: string;
  /** Human-readable expansion of cps_class. */
  cps_label?: string;
  /** Coarse group used by the type filter (Extratropical, Subtropical, …). */
  cps_group?: string;
  /** True only for an identified type (EC, SC, TC, ST, SD, TT, ET). False for
   *  the `*_like` characteristic classes, which are descriptions, not claims. */
  cps_identified?: boolean;
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

// ─── Display variables ────────────────────────────────────────────────────────

/**
 * The variable that colours the tracks and drives the intensity filter.
 *
 * The internal key `vor42` is kept because it is the column name throughout the
 * pipeline and the data files. It is never shown to the user: the interface
 * calls it "Central relative vorticity" (see DISPLAY_VARIABLES below).
 */
export type DisplayVariable = "vor42" | "wind10" | "wind100";

/** Wind height implied by the active display variable, in metres.
 *  There is deliberately no independent wind-height state: the display
 *  selector is the single source of truth, so no two parts of the interface
 *  can ever disagree about which height they are showing. */
export type WindHeight = 10 | 100;

/** Per-variable distribution and labelling, emitted by preprocess_data.py. */
export interface DisplayVariableInfo {
  /** User-facing name, e.g. "Central relative vorticity". */
  label: string;
  /** Short form for tight spaces, e.g. "Vorticity". */
  short_label: string;
  /** Unit as rendered, e.g. "×10⁻⁵ s⁻¹" or "m s⁻¹". */
  unit: string;
  /** Field on TrackSummary holding this variable's per-track peak. */
  field: "max_vor42" | "max_wind10" | "max_wind100";
  /** Number of decimals to render. */
  decimals: number;
  /** How many tracks carry a value for this variable. */
  n: number;
  quantile_thresholds: QuantileThresholds;
  intensity_pdf: IntensityPDF;
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
  /**
   * One entry per display variable. The colour scale and the intensity filter
   * both read the entry for the active variable, which is what keeps them from
   * ever representing different quantities.
   */
  display_variables: Record<DisplayVariable, DisplayVariableInfo>;
  /** Structural classes present, with counts (empty when CPS is absent). */
  cps_classes?: CpsClassInfo[];
  /** Coarse structural groups present, with counts. */
  cps_groups?: { group: string; count: number }[];
  /** How many cyclones had a run rejected as a warm seclusion. */
  warm_seclusion_count?: number;
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
  phase:
    | "incipient"
    | "intensification"
    | "mature"
    | "decay"
    | "dissipation";
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
  /**
   * Raw per-timestep threshold label — unguarded, no persistence requirement.
   * Right for colouring the phase diagram, WRONG for counting cyclone types:
   * for that use the cyclone's own category (TrackSummary.cps_class).
   */
  cps_class?: "extratropical" | "subtropical" | "tropical" | "unclassified";
  /**
   * The guarded view of the same timestep: the accepted, ≥36 h persistent
   * state covering it, or absent. A timestep whose run was rejected (warm
   * seclusion, genesis out of band) is absent here even when cps_class above
   * reads "subtropical" — which is exactly the distinction that gets lost if
   * only the raw label is consulted.
   */
  cps_state?: "EC" | "SC" | "TC";
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

/**
 * Intensity selection, applied to whichever display variable is active.
 * - mode "range":  keep tracks with min <= value <= max
 * - mode "cutoff": keep tracks with value >= min (max is ignored)
 * `null` bounds mean "unbounded on that side".
 *
 * Bounds are in the active variable's own units, so they are reset when the
 * display variable changes — a threshold in ×10⁻⁵ s⁻¹ is meaningless in m s⁻¹.
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
  /** Intensity constraint on the active display variable. */
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
  intensity: EMPTY_INTENSITY,
};

/**
 * Colour per structural group, used by the type filter chips and the phase
 * diagram. Kept distinct from PHASE_COLORS (lifecycle) on purpose — the two
 * classifications are orthogonal and must not read as the same scale.
 */
export const CPS_GROUP_COLORS: Record<string, string> = {
  // Identified types — saturated.
  Extratropical:             "#2563eb",
  Subtropical:               "#c026d3",
  Tropical:                  "#dc2626",
  "Subtropical transition":  "#ea580c",
  "Subtropical decay":       "#f59e0b",
  "Tropical transition":     "#e11d48",
  "Extratropical transition": "#0891b2",
  // Not an identification: the structure was shown but never sustained for the
  // 36 h gate, and none of the identification guards was applied. Deliberately
  // grey so it never reads as a type — it used to be folded into Subtropical
  // and Tropical, which put 548 unguarded cyclones under "Subtropical".
  "Not sustained (<36 h)":   "#9ca3af",
  Undetermined:              "#cbd5e1",
  "No CPS data":             "#e5e7eb",
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

// ─── Wind types ───────────────────────────────────────────────────────────────
// These types mirror the JSON produced by scripts/generate_wind_json.py, which
// derives them from the consolidated per-cyclone base.
//
// Sources (both by Paredes Quispe, J. A.):
//   wind10   Zenodo DOI 10.5281/zenodo.19378255
//   wind100  Zenodo DOI 10.5281/zenodo.19353037
//
// Physical meaning, identical at both heights:
//   max = absolute maximum wind within each Lagrangian quadrant
//   p99 = 99th-percentile wind within each Lagrangian quadrant
//
// Both are kept: `max` alone classifies track intensity, while the sidebar
// reports max AND p99 per quadrant as detailed diagnostics.
//
// Quadrant keys are the SOURCE's own labels. The producer's N/S labels are
// inverted relative to the geographic convention, so anything shown to the
// user must go through QUADRANT_DISPLAY in lib/windQuadrants.ts. Never label a
// quadrant with its raw key.

/** Prefix identifying a wind level inside the JSON payload. */
export type WindLevelKey = "w10" | "w100";

/** Which statistic is being shown. */
export type WindMetric = "max" | "p99";

/**
 * One quadrant entry: [dlon, dlat, val].
 *   0  longitude OFFSET from the cyclone centre (°)
 *   1  latitude OFFSET from the cyclone centre (°)
 *   2  wind speed (m s⁻¹)
 *
 * Offsets, not absolute coordinates: the centre is already on the timestep, so
 * absolute position is centre + offset and the encoding is lossless while
 * costing fewer bytes.
 *
 * The distance to the centre is NOT stored because it is exactly recoverable —
 * the source defines it as the Euclidean hypot(dlon, dlat) in degrees, verified
 * to 1e-14°. Use quadrantDistance() in lib/windQuadrants.ts.
 */
export type WindQArray = [number | null, number | null, number | null];

/**
 * One metric at one timestep. A quadrant is null when it carries no data.
 *
 * The quadrant holding the timestep extremum is not stored either: it is
 * exactly the argmax of the four values (verified over 74,242 comparisons with
 * zero ties). Use globalQuadrant() in lib/windQuadrants.ts.
 */
export interface WindMetricEntry {
  NW: WindQArray | null;
  NE: WindQArray | null;
  SW: WindQArray | null;
  SE: WindQArray | null;
}

/** Both statistics for one level at one timestep. */
export interface WindLevelEntry {
  max: WindMetricEntry | null;
  p99: WindMetricEntry | null;
}

/** Every configured level at one timestep. A level is absent without data. */
export type WindTimestepEntry = Partial<Record<WindLevelKey, WindLevelEntry>>;

/**
 * Per-year wind data, mirroring the structure of details/{year}.json.
 * tracks[String(trackId)][isoDate] = WindTimestepEntry
 */
export interface WindYearData {
  year: number;
  levels: string[];
  tracks: Record<string, Record<string, WindTimestepEntry>>;
}

/** Global statistics for one level, used to normalise the colour scale. */
export interface WindLevelMeta {
  label: string;
  unit: string;
  height_m: number;
  doi: string;
  /** Dataset-wide maximum of the per-quadrant `max` values (m s⁻¹). */
  max_global_max: number;
  /** Dataset-wide maximum of the per-quadrant `p99` values (m s⁻¹). */
  p99_global_max: number;
  max_global_p95: number;
  p99_global_p95: number;
}

/** Root structure of site/public/data/wind/meta.json. */
export interface WindMeta {
  levels: Record<string, WindLevelMeta>;
  years: number[];
  total_tracks: number;
  generated: string;
}

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
 * Per-basin track counts, one per mode + wind-height combination.
 *
 * Keys follow `basinStatKey()` in lib/filters.ts:
 *   "center"        centre positions only (no height involved)
 *   "wind_max_10"   10 m wind maxima          "wind_max_100"  100 m
 *   "wind_max_any"  10 m OR 100 m wind maxima
 *   "any_10"        centre OR 10 m            "any_100"       centre OR 100 m
 *   "any_any"       centre OR either height
 *
 * Counts are dataset-wide, not counts within the current filter.
 */
export type BasinStats = Record<string, number>;

/**
 * Intersection data for a single track.
 *
 * Only the primitive sets are stored; the unions the filter needs are computed
 * from them, so a new wind height means one more array here rather than a
 * combinatorial explosion of precomputed unions.
 */
export interface BasinTrackEntry {
  /** Basin IDs the cyclone centre passes through. */
  center: string[];
  /** Basin IDs the 10 m wind maximum passes through. */
  wind10: string[];
  /** Basin IDs the 100 m wind maximum passes through. */
  wind100: string[];
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
  tracks: Record<string, BasinTrackEntry>;
}

/**
 * Basin filter mode: determines how spatial intersection is evaluated.
 * - "center": Track center passes through the basin
 * - "wind_max": Maximum wind position passes through the basin
 * - "any": Either center OR wind_max passes through the basin
 */
export type BasinFilterMode = "center" | "wind_max" | "any";

/**
 * Which height's wind maximum the spatial test uses.
 * - "10"  : the 10 m wind maximum position
 * - "100" : the 100 m wind maximum position
 * - "any" : satisfied if EITHER height satisfies it (a logical OR)
 *
 * Deliberately labelled "Any" rather than "Both", which would read as an AND.
 * Orthogonal to BasinFilterMode: mode picks WHICH positions are tested,
 * this picks WHICH HEIGHT supplies the wind positions.
 */
export type BasinWindHeight = "10" | "100" | "any";

/**
 * State for basin-based spatial filtering.
 */
export interface BasinFilterState {
  /** Selected basin IDs (empty = no filter). */
  selectedBasins: string[];
  /** Which positions are tested. */
  mode: BasinFilterMode;
  /** Which height supplies the wind positions (ignored when mode is "center"). */
  windHeight: BasinWindHeight;
}

/**
 * Default (empty) basin filter state.
 */
export const EMPTY_BASIN_FILTER: BasinFilterState = {
  selectedBasins: [],
  mode: "any",
  windHeight: "any",
};

// ─── Provenance ───────────────────────────────────────────────────────────────
// Mirrors site/public/data/sources.json, emitted from data/metadata/sources.json.
// The About page renders from this so there is exactly one copy of every DOI in
// the project and a correction cannot land in one place and not the other.

/** One dataset or publication the monitor draws on. */
export interface SourceEntry {
  /** "data" for a distributed dataset, "method" for the paper documenting it. */
  kind?: "data" | "method";
  name: string;
  authors?: string[];
  orcid?: string[];
  affiliation?: string;
  year?: number;
  version?: string;
  publication_date?: string;
  journal?: string;
  volume?: string;
  pages?: string;
  doi?: string | null;
  url?: string;
  repository?: string;
  license?: string;
  /** True while the dataset is unpublished; pairs with pending_note. */
  pending?: boolean;
  pending_note?: string;
  status?: string;
  /** What this source contributes to the monitor. */
  role?: string;
  /** Monitor fields that originate here. */
  variables?: string[];
  coverage?: Record<string, string | number>;
  /** What the pipeline does to the data locally. */
  transforms?: string[];
  /** Conventions a consumer has to respect to read the data correctly. */
  conventions?: string[];
}

/** Root structure of site/public/data/sources.json. */
export interface SourcesRegistry {
  generated_by?: string;
  sources: Record<string, SourceEntry>;
  additional_references?: Record<string, SourceEntry>;
}
