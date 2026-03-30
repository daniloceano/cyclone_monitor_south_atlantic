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

/** Format vor42 value with units. */
export function formatVor42(v: number): string {
  return `${v.toFixed(3)} × 10⁻⁵ s⁻¹`;
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
