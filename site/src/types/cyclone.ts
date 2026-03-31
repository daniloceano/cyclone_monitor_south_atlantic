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
  /** Simplified track coordinates as [lon, lat] pairs (GeoJSON convention). */
  coords: [number, number][];
}

/** Quantile thresholds for max_vor42 across all tracks. */
export interface QuantileThresholds {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
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

export interface FilterState {
  /** Empty array means "all years". */
  years: number[];
  /** Empty array means "all months". */
  months: number[];
  /** Empty array means "all regions". */
  regions: string[];
}

export const EMPTY_FILTERS: FilterState = {
  years: [],
  months: [],
  regions: [],
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
