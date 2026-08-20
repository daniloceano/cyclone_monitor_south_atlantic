/**
 * Intensity-based colour utilities for cyclone track visualisation.
 *
 * ## Colour scheme (unselected state only)
 *
 * - **Gray (#9ca3af)**: tracks below the 10th percentile of the active
 *   variable — the low-intensity tail.
 * - **Yellow → orange → red**: tracks at or above p10.
 *   - Yellow (#facc15): at p10
 *   - Orange (#f97316): mid-range
 *   - Red (#dc2626): at the maximum observed value
 *
 * ## The active variable
 *
 * The ramp is not tied to any one quantity. It is applied to whichever display
 * variable is selected — central relative vorticity (×10⁻⁵ s⁻¹), 10 m wind, or
 * 100 m wind (m s⁻¹) — using that variable's own thresholds.
 *
 * Thresholds are pre-computed per variable in `scripts/preprocess_data.py` and
 * stored in `summary.json` under `display_variables[v].quantile_thresholds`.
 * The intensity filter reads the same object, which is what guarantees the map
 * and the filter can never describe different quantities. The scale is global
 * across the dataset, not recomputed for the filtered subset.
 *
 * References:
 *   - Gramcianinov et al. (2019), Climate Dynamics: cyclone tracking methodology
 *   - de Souza et al. (2025), JOSS: CycloPhaser lifecycle classification
 *   - Paredes Quispe (2026), Zenodo: the 10 m and 100 m wind diagnostics
 */

import { QuantileThresholds } from "@/types/cyclone";

// Color constants
const COLOR_GRAY = "#9ca3af";      // Below p10 — gray-400
const COLOR_YELLOW = "#facc15";    // At p10 — yellow-400
const COLOR_ORANGE = "#f97316";    // Mid-range — orange-500
const COLOR_RED = "#dc2626";       // At max — red-600

/**
 * Linearly interpolate between two hex colors.
 * @param color1 Start color (hex)
 * @param color2 End color (hex)
 * @param t Interpolation factor [0, 1]
 */
function lerpColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Colour for a track's peak value in the active display variable.
 *
 * @param value      the track's peak in the active variable
 * @param thresholds that variable's quantile thresholds from summary.json
 * @returns hex colour string
 *
 * Mapping:
 *   - no value (variable unavailable for this cyclone): gray
 *   - below p10: gray
 *   - p10 → midpoint: yellow → orange
 *   - midpoint → max: orange → red
 */
export function getIntensityColor(
  value: number | undefined,
  thresholds: QuantileThresholds
): string {
  // A cyclone with no value for the active variable is drawn in the same gray
  // as the low tail rather than hidden: it is present, just not measured here.
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return COLOR_GRAY;
  }

  const { p10, max } = thresholds;

  if (value < p10) {
    return COLOR_GRAY;
  }

  // Normalize intensity to [0, 1] range within [p10, max]
  const range = max - p10;
  if (range <= 0) {
    return COLOR_YELLOW;
  }

  const normalized = Math.min(1, Math.max(0, (value - p10) / range));

  // Two-stage gradient: yellow→orange (0–0.5), orange→red (0.5–1)
  if (normalized <= 0.5) {
    return lerpColor(COLOR_YELLOW, COLOR_ORANGE, normalized * 2);
  } else {
    return lerpColor(COLOR_ORANGE, COLOR_RED, (normalized - 0.5) * 2);
  }
}

// Colour constants, for the legend component.
export const INTENSITY_COLORS = {
  gray: COLOR_GRAY,
  yellow: COLOR_YELLOW,
  orange: COLOR_ORANGE,
  red: COLOR_RED,
};

/** Rank labels, strongest first. */
export type QuantileRank =
  | "top 5%"
  | "top 10%"
  | "top 25%"
  | "top 50%"
  | "bottom 50%";

/**
 * Where a value sits in the distribution of the active display variable.
 *
 * Derived here rather than baked into summary.json because the answer depends
 * on which variable is active: a cyclone in the top 5% by vorticity need not be
 * in the top 5% by 10 m wind. Computing it from the same thresholds the colour
 * ramp uses keeps the rank and the colour consistent by construction.
 */
export function quantileRank(
  value: number | undefined,
  thresholds: QuantileThresholds
): QuantileRank | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value >= thresholds.p95) return "top 5%";
  if (value >= thresholds.p90) return "top 10%";
  if (value >= thresholds.p75) return "top 25%";
  if (value >= thresholds.p50) return "top 50%";
  return "bottom 50%";
}
