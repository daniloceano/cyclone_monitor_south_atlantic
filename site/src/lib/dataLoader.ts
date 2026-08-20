/**
 * Data loading utilities for the cyclone monitor.
 *
 * Architecture:
 *   - summary.json  is loaded once on app startup (~10 MB, compressed ~2 MB).
 *   - details/{year}.json and wind/{year}.json are lazy-loaded when a track is
 *     first clicked and kept in module-level Maps, so subsequent clicks on
 *     tracks from the same year are instant.
 *
 * All files are static assets in public/data/ served by Vercel's CDN.
 */

import {
  BasinCollection,
  BasinIntersections,
  SourcesRegistry,
  SummaryData,
  TrackDetail,
  WindMeta,
  WindYearData,
  YearDetails,
} from "@/types/cyclone";

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

// ─── Wind loaders ─────────────────────────────────────────────────────────────
//
// One file per year holds every wind level, so switching between 10 m and 100 m
// costs no extra fetch — the data for both is already in hand.

let windMetaCache: WindMeta | null = null;
const windYearCache = new Map<number, WindYearData>();

/**
 * Load wind/meta.json once per session.
 * Returns null (no throw) if absent — the wind diagnostics are optional.
 */
export async function loadWindMeta(): Promise<WindMeta | null> {
  if (windMetaCache) return windMetaCache;
  try {
    const res = await fetch("/data/wind/meta.json");
    if (!res.ok) return null;
    windMetaCache = (await res.json()) as WindMeta;
    return windMetaCache;
  } catch {
    return null;
  }
}

/**
 * Load wind/{year}.json. Cached after first load.
 *
 * `year` is the cyclone's own year (track_id / 10000), which is how the files
 * are keyed — not the genesis year, which can differ by one for a cyclone that
 * forms in late December.
 *
 * Returns null if the file is absent or cannot be parsed.
 */
export async function loadWindYear(year: number): Promise<WindYearData | null> {
  if (windYearCache.has(year)) return windYearCache.get(year)!;
  try {
    const res = await fetch(`/data/wind/${year}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as WindYearData;
    windYearCache.set(year, data);
    return data;
  } catch {
    return null;
  }
}

// ─── Provenance ───────────────────────────────────────────────────────────────

let sourcesCache: SourcesRegistry | null = null;

/**
 * Load sources.json — the provenance registry emitted from
 * data/metadata/sources.json.
 *
 * The About page renders from this rather than restating DOIs, so a correction
 * to the registry reaches the site without editing any component.
 */
export async function loadSources(): Promise<SourcesRegistry | null> {
  if (sourcesCache) return sourcesCache;
  try {
    const res = await fetch("/data/sources.json");
    if (!res.ok) return null;
    sourcesCache = (await res.json()) as SourcesRegistry;
    return sourcesCache;
  } catch {
    return null;
  }
}

// ─── Sedimentary Basin loaders ────────────────────────────────────────────────

let basinCollectionCache: BasinCollection | null = null;
let basinIntersectionsCache: BasinIntersections | null = null;

/**
 * Load basins.geojson containing all sedimentary basin polygons.
 * Cached after first load.
 * Returns null (no throw) if the file is absent — basin data is optional.
 */
export async function loadBasins(): Promise<BasinCollection | null> {
  if (basinCollectionCache) return basinCollectionCache;
  try {
    const res = await fetch("/data/basins.geojson");
    if (!res.ok) return null;
    basinCollectionCache = (await res.json()) as BasinCollection;
    return basinCollectionCache;
  } catch {
    return null;
  }
}

/**
 * Load basin_intersections.json containing pre-computed track-basin intersections.
 * Cached after first load.
 * Returns null (no throw) if the file is absent — basin data is optional.
 */
export async function loadBasinIntersections(): Promise<BasinIntersections | null> {
  if (basinIntersectionsCache) return basinIntersectionsCache;
  try {
    const res = await fetch("/data/basin_intersections.json");
    if (!res.ok) return null;
    basinIntersectionsCache = (await res.json()) as BasinIntersections;
    return basinIntersectionsCache;
  } catch {
    return null;
  }
}
