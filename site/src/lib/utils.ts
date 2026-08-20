import { MONTH_NAMES } from "@/types/cyclone";

/** Format ISO-8601 datetime string for display (e.g. "15 Mar 2001 06:00 UTC"). */
export function formatDatetime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.getUTCDate().toString().padStart(2, "0");
  const mon = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${day} ${mon} ${year} ${hh}:${mm} UTC`;
}

/** Format a coordinate value with hemisphere label. */
export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "W" : "E"}`;
}

/**
 * Format a central relative vorticity value with its unit.
 *
 * The internal column is named vor42 — relative vorticity at 850 hPa,
 * spectrally filtered to T42 — but that name is never shown to the user.
 * Stored as a magnitude, so the value is positive for a Southern-Hemisphere
 * cyclone; the sign convention is not altered anywhere in the interface.
 */
export function formatVorticity(v: number): string {
  return `${v.toFixed(3)} × 10⁻⁵ s⁻¹`;
}

/**
 * Format a peak value in whichever display variable is active, with its unit.
 * Returns an em dash when the cyclone carries no value for that variable.
 */
export function formatDisplayValue(
  value: number | undefined,
  info: { unit: string; decimals: number } | null,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(info?.decimals ?? 2)} ${info?.unit ?? ""}`.trim();
}

/** Format an energetics value (W m⁻² or J m⁻²) with SI suffix. */
export function formatEnergetics(value: number, unit: string): string {
  return `${value.toFixed(3)} ${unit}`;
}

/** Convert duration in hours to a human-readable string. */
export function formatDuration(hours: number): string {
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (d === 0) return `${h} h`;
  if (h === 0) return `${d} d`;
  return `${d} d ${h} h`;
}

/** Month number → short name (1-indexed). */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}

// ─── Wind100 color scale ──────────────────────────────────────────────────────
//
// Palette: "storm_alert" (10 stops, light yellow → deep purple).
// Matches the R vector:
//   storm_alert <- c("#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c",
//                    "#fc4e2a","#e31a1c","#bd0026","#800026","#4a0066")
//
// Normalization: value / globalMax → t ∈ [0, 1].
// The globalMax MUST be the dataset-wide absolute maximum (from meta.json),
// NOT a per-cyclone or per-timestep maximum, to ensure cross-track comparability.

export const STORM_ALERT_PALETTE: readonly string[] = [
  "#ffffcc",
  "#ffeda0",
  "#fed976",
  "#feb24c",
  "#fd8d3c",
  "#fc4e2a",
  "#e31a1c",
  "#bd0026",
  "#800026",
  "#4a0066",
];

/** Parse a 6-digit hex color to [r, g, b] (0–255). */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Linearly interpolate between two hex colors. */
function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Map a wind speed value to a color from the storm_alert palette.
 *
 * @param value     Wind speed (m s⁻¹) at this point.
 * @param globalMax Dataset-wide maximum wind speed (from Wind100Meta).
 *                  Must be the absolute maximum across all tracks and years,
 *                  NOT a local or per-timestep maximum.
 */
export function getWindColor(value: number, globalMax: number): string {
  if (!isFinite(value) || !isFinite(globalMax) || globalMax <= 0) {
    return STORM_ALERT_PALETTE[0];
  }
  const t = Math.max(0, Math.min(1, value / globalMax));
  const n = STORM_ALERT_PALETTE.length;
  // Map t → floating index in [0, n-1], then interpolate between adjacent stops
  const fi = t * (n - 1);
  const lo = Math.min(Math.floor(fi), n - 2);
  const hi = lo + 1;
  const frac = fi - lo;
  return lerpColor(STORM_ALERT_PALETTE[lo], STORM_ALERT_PALETTE[hi], frac);
}

/**
 * Generate an array of {color, label} pairs for a legend.
 * Produces `steps` evenly-spaced stops from 0 to globalMax.
 */
export function windColorLegendStops(
  globalMax: number,
  steps = 5
): { color: string; label: string }[] {
  return Array.from({ length: steps }, (_, i) => {
    const value = (i / (steps - 1)) * globalMax;
    return { color: getWindColor(value, globalMax), label: `${value.toFixed(0)}` };
  });
}
