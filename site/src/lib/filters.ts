import { TrackSummary, FilterState } from "@/types/cyclone";

/**
 * Filter a list of track summaries by year, month, and genesis region.
 * Empty arrays in FilterState mean "no constraint" (all values pass).
 */
export function filterTracks(
  tracks: TrackSummary[],
  filters: FilterState
): TrackSummary[] {
  const { years, months, regions } = filters;
  return tracks.filter((t) => {
    if (years.length > 0 && !years.includes(t.year)) return false;
    if (months.length > 0 && !months.includes(t.month)) return false;
    if (regions.length > 0 && !regions.includes(t.genesis_region)) return false;
    return true;
  });
}

/** Toggle a value in/out of an array (immutable). */
export function toggleValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
