import {
  TrackSummary,
  FilterState,
  BasinFilterState,
  BasinIntersections,
  BasinTrackEntry,
  BasinFilterMode,
  BasinWindHeight,
  DisplayVariable,
  DisplayVariableInfo,
  IntensityFilterState,
} from "@/types/cyclone";

/**
 * The track's peak value in a given display variable.
 *
 * Returns undefined when the cyclone carries no value for that variable, which
 * the colour ramp renders gray and the intensity filter treats as "no opinion"
 * unless the user has actually set a bound.
 */
export function trackValue(
  track: TrackSummary,
  info: DisplayVariableInfo
): number | undefined {
  return track[info.field];
}

/**
 * Does a track pass the intensity constraint on the active display variable?
 *
 * - "range"  : min <= value <= max
 * - "cutoff" : value >= min  (the upper bound is ignored)
 *
 * A null bound is unbounded on that side, so the default state passes
 * everything. A track with no value for the active variable is excluded only
 * once a bound is actually set — an unmeasured cyclone cannot be shown to
 * satisfy a numeric threshold.
 */
export function passesIntensity(
  value: number | undefined,
  intensity: IntensityFilterState
): boolean {
  const { mode, min, max } = intensity;
  const bounded = min !== null || (mode === "range" && max !== null);

  if (value === undefined || value === null || !Number.isFinite(value)) {
    return !bounded;
  }
  if (min !== null && value < min) return false;
  if (mode === "range" && max !== null && value > max) return false;
  return true;
}

/**
 * Filter track summaries by every non-spatial constraint: year, month, genesis
 * region, structural type (CPS), warm seclusion and intensity.
 *
 * Empty arrays / null bounds mean "no constraint".
 *
 * The intensity constraint applies to whichever display variable is active, so
 * the caller passes that variable's descriptor. The map's colour ramp reads the
 * same descriptor, which is what keeps the two from ever disagreeing.
 *
 * The CPS constraints are skipped for tracks with no CPS data only when the
 * filter itself is inactive — an active type filter deliberately excludes
 * cyclones that carry no classification, since "unknown" is not a match.
 */
export function filterTracks(
  tracks: TrackSummary[],
  filters: FilterState,
  displayInfo: DisplayVariableInfo
): TrackSummary[] {
  const {
    years,
    months,
    regions,
    cpsGroups,
    cpsClasses,
    warmSeclusionOnly,
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

    if (!passesIntensity(trackValue(t, displayInfo), intensity)) return false;

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
    f.intensity.min !== null ||
    f.intensity.max !== null
  );
}

/** Toggle a value in/out of an array (immutable). */
export function toggleValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/**
 * The basin list a track's wind maxima intersect, at the requested height.
 *
 * "any" is a union — a logical OR across the two heights — which is why the
 * control is labelled "Any" and not "Both": "Both" would read as requiring the
 * condition to hold at 10 m AND at 100 m.
 */
function windBasins(
  entry: BasinTrackEntry,
  height: BasinWindHeight
): string[] {
  switch (height) {
    case "10":
      return entry.wind10 ?? [];
    case "100":
      return entry.wind100 ?? [];
    case "any":
    default:
      return [...(entry.wind10 ?? []), ...(entry.wind100 ?? [])];
  }
}

/**
 * Filter tracks by basin intersection.
 *
 * Two independent dimensions:
 *
 *   mode        WHICH positions are tested
 *     "center"   the cyclone centre along the track
 *     "wind_max" the position of the wind maximum
 *     "any"      centre OR wind maximum
 *
 *   windHeight  WHICH height supplies the wind positions
 *     "10" | "100" | "any"   ("any" = 10 m OR 100 m)
 *
 * windHeight is irrelevant when mode is "center", which tests no wind position
 * at all.
 *
 * A track is kept when the selected positions fall inside ANY selected basin.
 */
export function filterTracksByBasin(
  tracks: TrackSummary[],
  basinFilter: BasinFilterState,
  intersections: BasinIntersections | null
): TrackSummary[] {
  const { selectedBasins, mode, windHeight } = basinFilter;

  if (selectedBasins.length === 0) return tracks;
  if (!intersections) return tracks;

  const selectedSet = new Set(selectedBasins);

  return tracks.filter((track) => {
    const entry = intersections.tracks[String(track.id)];

    // No intersection record at all = intersects no basin.
    if (!entry) return false;

    let relevant: string[];
    switch (mode) {
      case "center":
        relevant = entry.center ?? [];
        break;
      case "wind_max":
        relevant = windBasins(entry, windHeight);
        break;
      case "any":
      default:
        relevant = [...(entry.center ?? []), ...windBasins(entry, windHeight)];
        break;
    }

    return relevant.some((basinId) => selectedSet.has(basinId));
  });
}

/**
 * Display label for a basin filter mode.
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

/**
 * Display label for the basin wind-height selector.
 */
export function getBasinWindHeightLabel(height: BasinWindHeight): string {
  switch (height) {
    case "10":
      return "10 m";
    case "100":
      return "100 m";
    case "any":
      return "Any";
    default:
      return height;
  }
}

/**
 * Key into the per-basin count table for a given mode + height combination.
 * Mirrors the keys emitted by scripts/compute_basin_intersections.py.
 */
export function basinStatKey(
  mode: BasinFilterMode,
  height: BasinWindHeight
): string {
  if (mode === "center") return "center";
  return `${mode}_${height}`;
}
