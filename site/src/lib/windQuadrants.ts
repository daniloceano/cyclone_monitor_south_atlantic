/**
 * Quadrant helpers for the cyclone-relative wind diagnostics.
 *
 * Everything here exists because the wind JSON stores the minimum needed to
 * reconstruct the full picture, and because the source's quadrant labels are
 * not the ones a reader expects. Both concerns used to be handled by literals
 * duplicated across components; they live here now so the two can never drift.
 */

import type {
  DisplayVariable,
  WindLevelKey,
  WindMetricEntry,
  WindQArray,
} from "@/types/cyclone";

/** Source quadrant keys, in the order the data uses them. */
export const QUADRANT_KEYS = ["NW", "NE", "SW", "SE"] as const;
export type QuadrantKey = (typeof QUADRANT_KEYS)[number];

/**
 * Source label → geographic label.
 *
 * The producing dataset's N/S labels are inverted with respect to the
 * geographic convention, so a quadrant stored as "NW" is in fact the
 * south-west one. Every user-facing label must pass through here; the stored
 * data are deliberately left as a faithful copy of the archive.
 */
export const QUADRANT_DISPLAY: Record<QuadrantKey, string> = {
  NW: "SW",
  NE: "SE",
  SW: "NW",
  SE: "NE",
};

/** Iteration order that makes a 2×2 grid read NW, NE, SW, SE once relabelled. */
export const GRID_KEYS: readonly QuadrantKey[] = ["SW", "SE", "NW", "NE"];

/** Full geographic name, for tooltips. */
export const QUADRANT_NAMES: Record<string, string> = {
  NW: "Northwest",
  NE: "Northeast",
  SW: "Southwest",
  SE: "Southeast",
};

/** Wind level implied by the active display variable.
 *  Vorticity carries no height of its own, so it falls back to 10 m — the
 *  single-state rule that stops any two panels disagreeing about height. */
export function windLevelFor(display: DisplayVariable): WindLevelKey {
  return display === "wind100" ? "w100" : "w10";
}

/** Height in metres for the active display variable. */
export function windHeightFor(display: DisplayVariable): 10 | 100 {
  return display === "wind100" ? 100 : 10;
}

/** Marker geometry per height: circle at 10 m, square at 100 m. */
export function markerShapeFor(display: DisplayVariable): "circle" | "square" {
  return display === "wind100" ? "square" : "circle";
}

/** Absolute position of a quadrant extremum, from its offset and the centre. */
export function quadrantPosition(
  q: WindQArray,
  centerLon: number,
  centerLat: number,
): { lon: number; lat: number } | null {
  const [dlon, dlat] = q;
  if (dlon === null || dlat === null) return null;
  return { lon: centerLon + dlon, lat: centerLat + dlat };
}

/**
 * Distance from the quadrant extremum to the cyclone centre, in degrees.
 *
 * The source defines this as a plain Euclidean hypot of the offsets — not a
 * great-circle distance — so recomputing it here reproduces the archived value
 * exactly (verified to 1e-14° over 13,968 comparisons). That is why the field
 * is not stored in the JSON.
 */
export function quadrantDistance(q: WindQArray): number | null {
  const [dlon, dlat] = q;
  if (dlon === null || dlat === null) return null;
  return Math.hypot(dlon, dlat);
}

/**
 * The quadrant carrying the timestep extremum.
 *
 * Equal to the source's own `mx_mx_*` column, which holds a quadrant NAME
 * rather than a value despite what the Zenodo description says. Recomputing it
 * as the argmax reproduces it exactly (74,242 comparisons, zero mismatches,
 * zero ties), so it is not stored either.
 */
export function globalQuadrant(entry: WindMetricEntry | null): QuadrantKey | null {
  if (!entry) return null;
  let best: QuadrantKey | null = null;
  let bestVal = -Infinity;
  for (const key of QUADRANT_KEYS) {
    const q = entry[key];
    const v = q?.[2];
    if (v !== null && v !== undefined && v > bestVal) {
      bestVal = v;
      best = key;
    }
  }
  return best;
}

/** Largest of the four quadrant values at one timestep, or null if none. */
export function timestepMax(entry: WindMetricEntry | null): number | null {
  const key = globalQuadrant(entry);
  if (!key || !entry) return null;
  return entry[key]?.[2] ?? null;
}
