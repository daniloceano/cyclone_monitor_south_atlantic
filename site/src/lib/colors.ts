/**
 * Intensity-based color utilities for cyclone track visualization.
 *
 * ## Color Scheme (unselected state only)
 *
 * - **Gray (#9ca3af)**: Tracks with max_vor42 below the 10th percentile (p10).
 *   These are considered low-intensity cyclones.
 *
 * - **Yellow → Orange → Red gradient**: Tracks at or above p10.
 *   - Yellow (#facc15): intensity at p10
 *   - Orange (#f97316): intensity at mid-range
 *   - Red (#dc2626): intensity at maximum observed value
 *
 * ## Intensity Variable
 *
 * `max_vor42` — Maximum filtered and normalized relative vorticity (×10⁻⁵ s⁻¹)
 * along the cyclone track. This is computed at the cyclone level (not timestep),
 * and thresholds are calculated globally across all 6,789 tracks in the dataset.
 *
 * ## Percentile Calculation
 *
 * Percentiles are pre-computed in `scripts/preprocess_data.py` and stored in
 * `summary.json` under `quantile_thresholds`. The scale is global (entire dataset),
 * not dynamically recalculated for filtered subsets.
 *
 * Reference:
 *   - Gramcianinov et al. (2019), Climate Dynamics: cyclone tracking methodology
 *   - de Souza et al. (2025), JOSS: Cyclophaser lifecycle classification
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
 * Get the intensity-based color for a track.
 *
 * @param maxVor42 The track's maximum vor42 value
 * @param thresholds Global quantile thresholds from summary.json
 * @returns Hex color string
 *
 * Color mapping:
 *   - Below p10: gray
 *   - p10 to midpoint: yellow → orange gradient
 *   - midpoint to max: orange → red gradient
 */
export function getIntensityColor(
  maxVor42: number,
  thresholds: QuantileThresholds
): string {
  const { p10, max } = thresholds;

  // Below p10 → gray
  if (maxVor42 < p10) {
    return COLOR_GRAY;
  }

  // Normalize intensity to [0, 1] range within [p10, max]
  const range = max - p10;
  if (range <= 0) {
    return COLOR_YELLOW;
  }

  const normalized = Math.min(1, Math.max(0, (maxVor42 - p10) / range));

  // Two-stage gradient: yellow→orange (0–0.5), orange→red (0.5–1)
  if (normalized <= 0.5) {
    return lerpColor(COLOR_YELLOW, COLOR_ORANGE, normalized * 2);
  } else {
    return lerpColor(COLOR_ORANGE, COLOR_RED, (normalized - 0.5) * 2);
  }
}

/**
 * Legend data for the intensity color scale.
 * Returns stops for rendering a gradient legend.
 */
export function getIntensityLegendStops(thresholds: QuantileThresholds): {
  color: string;
  label: string;
  value: number;
}[] {
  const { p10, max } = thresholds;
  const mid = p10 + (max - p10) / 2;

  return [
    { color: COLOR_GRAY, label: `< p10`, value: 0 },
    { color: COLOR_YELLOW, label: `p10 (${p10.toFixed(1)})`, value: p10 },
    { color: COLOR_ORANGE, label: `${mid.toFixed(1)}`, value: mid },
    { color: COLOR_RED, label: `max (${max.toFixed(1)})`, value: max },
  ];
}

// Export color constants for legend component
export const INTENSITY_COLORS = {
  gray: COLOR_GRAY,
  yellow: COLOR_YELLOW,
  orange: COLOR_ORANGE,
  red: COLOR_RED,
};
