import { TrackSummary, FilterState, BasinFilterState, BasinIntersections, BasinFilterMode } from "@/types/cyclone";

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

/**
 * Filter tracks by basin intersection.
 * 
 * @param tracks - List of tracks to filter
 * @param basinFilter - Basin filter state (selected basins and mode)
 * @param intersections - Pre-computed basin intersections data
 * @returns Filtered list of tracks that match the basin criteria
 * 
 * Filter modes:
 * - "center": Track's cyclone center passes through any selected basin
 * - "wind_max": Track's maximum wind position passes through any selected basin
 * - "any": Either center OR wind_max passes through any selected basin
 */
export function filterTracksByBasin(
  tracks: TrackSummary[],
  basinFilter: BasinFilterState,
  intersections: BasinIntersections | null
): TrackSummary[] {
  const { selectedBasins, mode } = basinFilter;
  
  // No basin filter active
  if (selectedBasins.length === 0) {
    return tracks;
  }
  
  // No intersection data available
  if (!intersections) {
    return tracks;
  }
  
  const selectedSet = new Set(selectedBasins);
  
  return tracks.filter((track) => {
    const trackIntersections = intersections.tracks[String(track.id)];
    
    // Track has no intersection data = doesn't intersect any basin
    if (!trackIntersections) {
      return false;
    }
    
    // Get the relevant basin list based on filter mode
    let relevantBasins: string[];
    switch (mode) {
      case "center":
        relevantBasins = trackIntersections.center;
        break;
      case "wind_max":
        relevantBasins = trackIntersections.wind_max;
        break;
      case "any":
        relevantBasins = trackIntersections.any;
        break;
      default:
        relevantBasins = trackIntersections.any;
    }
    
    // Check if track intersects any of the selected basins
    return relevantBasins.some((basinId) => selectedSet.has(basinId));
  });
}

/**
 * Get display label for a basin filter mode.
 */
export function getBasinFilterModeLabel(mode: BasinFilterMode): string {
  switch (mode) {
    case "center":
      return "Cyclone center";
    case "wind_max":
      return "Maximum wind";
    case "any":
      return "Center or wind";
    default:
      return mode;
  }
}
