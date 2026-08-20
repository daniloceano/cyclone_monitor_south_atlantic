"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

import {
  TrackSummary,
  Timestep,
  FilterState,
  SummaryData,
  EMPTY_FILTERS,
  EMPTY_INTENSITY,
  DisplayVariable,
  WindYearData,
  WindMeta,
  WindMetric,
  WindTimestepEntry,
  BasinCollection,
  BasinIntersections,
  BasinFilterState,
  EMPTY_BASIN_FILTER,
} from "@/types/cyclone";
import {
  loadSummary,
  loadYearDetails,
  getTrackDetail,
  loadWindMeta,
  loadWindYear,
  loadBasins,
  loadBasinIntersections,
} from "@/lib/dataLoader";
import { filterTracks, filterTracksByBasin } from "@/lib/filters";
import { windLevelFor } from "@/lib/windQuadrants";

import FilterPanel from "@/components/FilterPanel";
import AvailableTracksList from "@/components/AvailableTracksList";
import TrackDetailPanel from "@/components/TrackDetailPanel";
import Header from "@/components/Header";

// Leaflet uses browser globals (window, document) — must be loaded client-side only.
const CycloneMap = dynamic(() => import("@/components/CycloneMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <p className="text-gray-400 text-sm">Initialising map…</p>
    </div>
  ),
});

export default function HomePage() {
  // ── Data state ─────────────────────────────────────────────────────────────
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Display variable ───────────────────────────────────────────────────────
  // The single source of truth for "what is being shown". It drives the map's
  // colour ramp, the intensity filter, the marker geometry and the height of
  // every wind diagnostic. There is deliberately no separate wind-height state:
  // two independent states could disagree, and a user reading a 10 m number
  // under a 100 m heading has been misled.
  const [displayVariable, setDisplayVariable] = useState<DisplayVariable>("vor42");

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);
  const [timesteps, setTimesteps] = useState<Timestep[] | null>(null);
  const [selectedTimestep, setSelectedTimestep] = useState<Timestep | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Wind state ─────────────────────────────────────────────────────────────
  // Only the statistic is held here; the height comes from displayVariable.
  const [windMeta, setWindMeta] = useState<WindMeta | null>(null);
  const [windYearData, setWindYearData] = useState<WindYearData | null>(null);
  const [windMetric, setWindMetric] = useState<WindMetric>("max");

  // ── Basin state ────────────────────────────────────────────────────────────
  const [basinCollection, setBasinCollection] = useState<BasinCollection | null>(null);
  const [basinIntersections, setBasinIntersections] = useState<BasinIntersections | null>(null);
  const [basinFilter, setBasinFilter] = useState<BasinFilterState>(EMPTY_BASIN_FILTER);

  // ── Load summary + wind meta + basin data on mount ─────────────────────────
  useEffect(() => {
    Promise.all([
      loadSummary(),
      loadWindMeta(),
      loadBasins(),
      loadBasinIntersections(),
    ])
      .then(([data, meta, basins, intersections]) => {
        setSummaryData(data);
        setWindMeta(meta); // null-safe: meta is null if file absent
        setBasinCollection(basins); // null-safe
        setBasinIntersections(intersections); // null-safe
        setInitialLoading(false);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setInitialLoading(false);
      });
  }, []);

  // ── The active variable's descriptor ───────────────────────────────────────
  // Both the colour ramp and the intensity filter read this one object, which is
  // what makes it impossible for the map to be coloured by one quantity while
  // the filter constrains another.
  const displayInfo = useMemo(
    () => summaryData?.display_variables?.[displayVariable] ?? null,
    [summaryData, displayVariable],
  );

  /** Which display variables this build actually has data for. */
  const availableVariables = useMemo<DisplayVariable[]>(() => {
    const dv = summaryData?.display_variables;
    if (!dv) return ["vor42"];
    return (["vor42", "wind10", "wind100"] as DisplayVariable[]).filter(
      (v) => dv[v] && dv[v].n > 0,
    );
  }, [summaryData]);

  /**
   * Switching variable clears the intensity bounds.
   *
   * The bounds are plain numbers in the active variable's units, so carrying
   * "≥ 8" from vorticity (×10⁻⁵ s⁻¹) over to 10 m wind (m s⁻¹) would silently
   * apply a meaningless threshold to a different quantity.
   */
  const handleDisplayVariableChange = useCallback((next: DisplayVariable) => {
    setDisplayVariable(next);
    setFilters((f) => ({ ...f, intensity: EMPTY_INTENSITY }));
  }, []);

  // ── Filtered track list ────────────────────────────────────────────────────
  const filteredTracks = useMemo(() => {
    if (!summaryData || !displayInfo) return [];
    const tracks = filterTracks(summaryData.tracks, filters, displayInfo);
    return filterTracksByBasin(tracks, basinFilter, basinIntersections);
  }, [summaryData, displayInfo, filters, basinFilter, basinIntersections]);

  // ── Per-track wind lookup for the selected track ───────────────────────────
  const windTrackData = useMemo((): Record<string, WindTimestepEntry> | null => {
    if (!selectedTrack || !windYearData) return null;
    return windYearData.tracks[String(selectedTrack.id)] ?? null;
  }, [selectedTrack, windYearData]);

  // Level key ("w10" / "w100") implied by the display variable. Under
  // vorticity this falls back to 10 m — see windLevelFor().
  const windLevel = windLevelFor(displayVariable);

  // ── Track selection handler ────────────────────────────────────────────────
  const handleTrackSelect = useCallback(async (track: TrackSummary) => {
    setSelectedTrack(track);
    setSelectedTimestep(null);
    setTimesteps(null);
    setDetailError(null);
    setDetailLoading(true);
    setWindYearData(null); // clear stale data while loading

    try {
      // One wind file per year carries both heights, so switching the display
      // variable later needs no further fetch.
      const [yearDetails, windYear] = await Promise.all([
        loadYearDetails(track.year),
        loadWindYear(track.year), // null if wind data absent
      ]);
      const detail = getTrackDetail(yearDetails, track.id);
      setTimesteps(detail?.timesteps ?? []);
      setWindYearData(windYear);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load track details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTrack(null);
    setTimesteps(null);
    setSelectedTimestep(null);
    setDetailError(null);
    setWindYearData(null);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading cyclone dataset…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="max-w-sm text-center">
          <p className="text-red-600 font-semibold mb-2">Failed to load data</p>
          <p className="text-gray-600 text-sm">{loadError}</p>
          <p className="text-gray-400 text-xs mt-3">
            Ensure you have run{" "}
            <code className="bg-gray-200 px-1 rounded">npm run preprocess</code>{" "}
            to generate the processed data files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header
        displayVariable={displayVariable}
        availableVariables={availableVariables}
        displayVariables={summaryData!.display_variables}
        onDisplayVariableChange={handleDisplayVariableChange}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ───────────────────────────────────────────────── */}
        <aside className="w-80 xl:w-96 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-sm">
          <FilterPanel
            summaryData={summaryData!}
            filters={filters}
            onFiltersChange={setFilters}
            filteredCount={filteredTracks.length}
            displayVariable={displayVariable}
            displayInfo={displayInfo}
            basinCollection={basinCollection}
            basinIntersections={basinIntersections}
            basinFilter={basinFilter}
            onBasinFilterChange={setBasinFilter}
          />

          {!selectedTrack && (
            <AvailableTracksList
              tracks={filteredTracks}
              onTrackSelect={handleTrackSelect}
            />
          )}

          {selectedTrack && (
            <TrackDetailPanel
              track={selectedTrack}
              timesteps={timesteps}
              selectedTimestep={selectedTimestep}
              onTimestepSelect={setSelectedTimestep}
              onClear={handleClearSelection}
              loading={detailLoading}
              error={detailError}
              displayVariable={displayVariable}
              displayInfo={displayInfo}
              windTrackData={windTrackData}
              windMeta={windMeta}
              windLevel={windLevel}
              windMetric={windMetric}
              onWindMetricChange={setWindMetric}
            />
          )}
        </aside>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden">
          <CycloneMap
            tracks={filteredTracks}
            selectedTrack={selectedTrack}
            timesteps={timesteps}
            selectedTimestep={selectedTimestep}
            displayVariable={displayVariable}
            displayInfo={displayInfo}
            onTrackSelect={handleTrackSelect}
            onTimestepSelect={setSelectedTimestep}
            onClearSelection={handleClearSelection}
            windTrackData={windTrackData}
            windMeta={windMeta}
            windLevel={windLevel}
            windMetric={windMetric}
            basinCollection={basinCollection}
            selectedBasins={basinFilter.selectedBasins}
          />
        </main>
      </div>
    </div>
  );
}
