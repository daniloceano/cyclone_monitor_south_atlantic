/**
 * Data loading utilities for the cyclone monitor.
 *
 * Architecture:
 *   - summary.json  is loaded once on app startup (~10 MB, compressed ~2 MB).
 *   - details/{year}.json files are lazy-loaded when a track is first clicked
 *     and kept in a module-level Map so subsequent clicks on tracks from the
 *     same year are instant.
 *
 * All files are static assets in public/data/ served by Vercel's CDN.
 */

import { SummaryData, YearDetails, TrackDetail, Wind100YearData, Wind100Meta } from "@/types/cyclone";

// Module-level caches (persist across React re-renders within a session)
let summaryCache: SummaryData | null = null;
const detailsCache = new Map<number, YearDetails>();

/** Load summary.json. Subsequent calls return the in-memory cache. */
export async function loadSummary(): Promise<SummaryData> {
  if (summaryCache) return summaryCache;
  const res = await fetch("/data/summary.json");
  if (!res.ok) throw new Error(`Failed to load summary.json (HTTP ${res.status})`);
  summaryCache = (await res.json()) as SummaryData;
  return summaryCache;
}

/** Load details/{year}.json for a given year. Cached after first load. */
export async function loadYearDetails(year: number): Promise<YearDetails> {
  if (detailsCache.has(year)) return detailsCache.get(year)!;
  const res = await fetch(`/data/details/${year}.json`);
  if (!res.ok)
    throw new Error(`Failed to load details/${year}.json (HTTP ${res.status})`);
  const data = (await res.json()) as YearDetails;
  detailsCache.set(year, data);
  return data;
}

/** Retrieve a single track's detail from an already-loaded YearDetails object. */
export function getTrackDetail(
  yearDetails: YearDetails,
  trackId: number
): TrackDetail | null {
  return yearDetails.tracks[String(trackId)] ?? null;
}

// ─── Wind100 loaders ──────────────────────────────────────────────────────────

let wind100MetaCache: Wind100Meta | null = null;
const wind100YearCache = new Map<number, Wind100YearData>();

/**
 * Load wind100/meta.json once per session.
 * Returns null (no throw) if the file is absent — wind100 data is optional.
 */
export async function loadWind100Meta(): Promise<Wind100Meta | null> {
  if (wind100MetaCache) return wind100MetaCache;
  try {
    const res = await fetch("/data/wind100/meta.json");
    if (!res.ok) return null;
    wind100MetaCache = (await res.json()) as Wind100Meta;
    return wind100MetaCache;
  } catch {
    return null;
  }
}

/**
 * Load wind100/{year}.json for a given year.  Cached after first load.
 * Returns null if the file is absent or cannot be parsed.
 */
export async function loadWind100Year(year: number): Promise<Wind100YearData | null> {
  if (wind100YearCache.has(year)) return wind100YearCache.get(year)!;
  try {
    const res = await fetch(`/data/wind100/${year}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as Wind100YearData;
    wind100YearCache.set(year, data);
    return data;
  } catch {
    return null;
  }
}
