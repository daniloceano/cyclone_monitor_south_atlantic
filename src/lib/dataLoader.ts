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

import { SummaryData, YearDetails, TrackDetail } from "@/types/cyclone";

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
