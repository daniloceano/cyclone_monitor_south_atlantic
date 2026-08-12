import {
  TrackSummary,
  FilterState,
  BasinFilterState,
  BasinIntersections,
  BasinFilterMode,
  IntensityFilterState,
} from "@/types/cyclone";

/**
 * Does a track pass the intensity constraint on max_vor42?
 *
 * - "range"  : min <= max_vor42 <= max
 * - "cutoff" : max_vor42 >= min  (the upper bound is ignored)
 *
 * A null bound is unbounded on that side, so the default state passes everything.
 */
export function passesIntensity(
  maxVor42: number,
  intensity: IntensityFilterState
): boolean {
  const { mode, min, max } = intensity;
  if (min !== null && maxVor42 < min) return false;
  if (mode === "range" && max !== null && maxVor42 > max) return false;
  return true;
}

/**
 * Filter track summaries by every non-spatial constraint: year, month, genesis
 * region, structural type (CPS), warm seclusion, processing level and intensity.
 *
 * Empty arrays / null bounds mean "no constraint".
 *
 * The CPS constraints are skipped for tracks with no CPS data only when the
 * filter itself is inactive — an active type filter deliberately excludes
 * cyclones that carry no classification, since "unknown" is not a match.
 */
export function filterTracks(
  tracks: TrackSummary[],
  filters: FilterState
): TrackSummary[] {
  const {
    years,
    months,
    regions,
    cpsGroups,
    cpsClasses,
    warmSeclusionOnly,
    processing,
    intensity,
  } = filters;

  return tracks.filter((t) => {
    if (years.length > 0 && !years.includes(t.year)) return false;
    if (months.length > 0 && !months.includes(t.month)) return false;
    if (regions.length > 0 && !regions.includes(t.genesis_region)) return false;

    if (cpsGroups.length > 0 && (!t.cps_group || !cpsGroups.includes(t.cps_group)))
      return false;
    if (cpsClasses.length > 0 && (!t.cps_class || !cpsClasses.includes(t.cps_class)))
      return false;
    if (warmSeclusionOnly && !t.warm_seclusion) return false;

    if (processing === "processed" && !t.processed) return false;
    if (processing === "raw" && t.processed) return false;

    if (!passesIntensity(t.max_vor42, intensity)) return false;

    return true;
  });
}

/** True when any non-spatial filter is currently constraining the list. */
export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.years.length > 0 ||
    f.months.length > 0 ||
    f.regions.length > 0 ||
    f.cpsGroups.length > 0 ||
    f.cpsClasses.length > 0 ||
    f.warmSeclusionOnly ||
    f.processing !== "all" ||
    f.intensity.min !== null ||
    f.intensity.max !== null
  );
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
