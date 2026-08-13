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

// ─── Track-only (raw catalogue) loaders ───────────────────────────────────────
//
// These are fetched lazily: summary_raw.json is ~25 MB against summary.json's
// ~11 MB, and most sessions never ask for track-only cyclones. Nothing here is
// requested until the processing filter includes them.

import {
  RawSummaryData,
  RawYearDetails,
  RawTrackDetail,
  TrackSummary,
  Timestep,
} from "@/types/cyclone";

let rawSummaryCache: RawSummaryData | null = null;
const rawDetailsCache = new Map<number, RawYearDetails>();

/**
 * Load summary_raw.json. Returns null (no throw) when absent — the raw
 * catalogue is optional and the app degrades to processed cyclones only.
 */
export async function loadRawSummary(): Promise<RawSummaryData | null> {
  if (rawSummaryCache) return rawSummaryCache;
  try {
    const res = await fetch("/data/summary_raw.json");
    if (!res.ok) return null;
    rawSummaryCache = (await res.json()) as RawSummaryData;
    return rawSummaryCache;
  } catch {
    return null;
  }
}

/** Load details_raw/{year}.json. Cached after first load. */
export async function loadRawYearDetails(year: number): Promise<RawYearDetails | null> {
  if (rawDetailsCache.has(year)) return rawDetailsCache.get(year)!;
  try {
    const res = await fetch(`/data/details_raw/${year}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as RawYearDetails;
    rawDetailsCache.set(year, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Adapt raw track summaries into the shape the rest of the app consumes.
 *
 * Track-only cyclones have no genesis region, no structural class and no
 * lifecycle phases, so those fields are left absent and `processed` is false.
 * Every component already branches on `processed` or on the presence of the
 * optional fields, which keeps a single code path for both kinds of cyclone.
 *
 * The intensity quantile is deliberately NOT assigned: the thresholds in
 * summary.json were computed over the processed catalogue, and labelling a
 * different tracking vintage against them would imply a comparability that has
 * not been established. Intensity colouring still works, since it reads
 * max_vor42 directly.
 */
export function adaptRawSummaries(raw: RawSummaryData): TrackSummary[] {
  return raw.tracks.map((t) => ({
    id: t.id,
    src: t.src,
    year: t.year,
    month: t.month,
    start: t.start,
    end: t.end,
    duration_h: t.duration_h,
    genesis_lat: t.genesis_lat,
    genesis_lon: t.genesis_lon,
    lysis_lat: t.lysis_lat,
    lysis_lon: t.lysis_lon,
    genesis_region: "Unclassified",
    max_vor42: t.max_vor42,
    quantile: "bottom 50%" as const,
    processed: false,
    coords: t.coords,
  }));
}

/**
 * Expand a columnar raw detail into the Timestep array the panels expect.
 * Only date, position and vorticity exist; `phase` is "unknown" so the phase
 * colour and label maps resolve without special-casing.
 */
export function expandRawDetail(detail: RawTrackDetail): Timestep[] {
  const t0 = new Date(detail.t0 + "Z").getTime();
  return detail.dt.map((hours, i) => ({
    date: new Date(t0 + hours * 3600_000).toISOString().slice(0, 19),
    lon: detail.x[i],
    lat: detail.y[i],
    vor42: detail.v[i],
    phase: "unknown" as const,
  }));
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

// ─── Sedimentary Basin loaders ────────────────────────────────────────────────

import { BasinCollection, BasinIntersections } from "@/types/cyclone";

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
