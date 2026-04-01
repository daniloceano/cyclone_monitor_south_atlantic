"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

import {
  TrackSummary,
  Timestep,
  FilterState,
  SummaryData,
  EMPTY_FILTERS,
  Wind100YearData,
  Wind100Meta,
  Wind100Metric,
  Wind100TimestepEntry,
} from "@/types/cyclone";
import {
  loadSummary,
  loadYearDetails,
  getTrackDetail,
  loadWind100Meta,
  loadWind100Year,
} from "@/lib/dataLoader";
import { filterTracks } from "@/lib/filters";

import FilterPanel from "@/components/FilterPanel";
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

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);
  const [timesteps, setTimesteps] = useState<Timestep[] | null>(null);
  const [selectedTimestep, setSelectedTimestep] = useState<Timestep | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Wind100 state ──────────────────────────────────────────────────────────
  const [wind100Meta, setWind100Meta] = useState<Wind100Meta | null>(null);
  const [wind100YearData, setWind100YearData] = useState<Wind100YearData | null>(null);
  const [wind100Metric, setWind100Metric] = useState<Wind100Metric>("max");

  // ── Load summary + wind100 meta on mount ───────────────────────────────────
  useEffect(() => {
    Promise.all([loadSummary(), loadWind100Meta()])
      .then(([data, meta]) => {
        setSummaryData(data);
        setWind100Meta(meta); // null-safe: meta is null if file absent
        setInitialLoading(false);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
        setInitialLoading(false);
      });
  }, []);

  // ── Filtered track list ────────────────────────────────────────────────────
  const filteredTracks = useMemo(() => {
    if (!summaryData) return [];
    return filterTracks(summaryData.tracks, filters);
  }, [summaryData, filters]);

  // ── Per-track wind100 lookup for the selected track ────────────────────────
  const wind100TrackData = useMemo((): Record<string, Wind100TimestepEntry> | null => {
    if (!selectedTrack || !wind100YearData) return null;
    return wind100YearData.tracks[String(selectedTrack.id)] ?? null;
  }, [selectedTrack, wind100YearData]);

  // ── Track selection handler ────────────────────────────────────────────────
  const handleTrackSelect = useCallback(async (track: TrackSummary) => {
    // Immediately highlight the selected track
    setSelectedTrack(track);
    setSelectedTimestep(null);
    setTimesteps(null);
    setDetailError(null);
    setDetailLoading(true);
    setWind100YearData(null); // clear stale data while loading

    try {
      const [yearDetails, w100Year] = await Promise.all([
        loadYearDetails(track.year),
        loadWind100Year(track.year), // null if wind100 data absent
      ]);
      const detail = getTrackDetail(yearDetails, track.id);
      setTimesteps(detail?.timesteps ?? []);
      setWind100YearData(w100Year);
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
    setWind100YearData(null);
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
          <p className="text-gray-400 text-xs mt-1">6 789 tracks · 1979–2020</p>
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
        totalTracks={summaryData!.total_tracks}
        filteredCount={filteredTracks.length}
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
          />

          {selectedTrack && (
            <TrackDetailPanel
              track={selectedTrack}
              timesteps={timesteps}
              selectedTimestep={selectedTimestep}
              onTimestepSelect={setSelectedTimestep}
              onClear={handleClearSelection}
              loading={detailLoading}
              error={detailError}
              quantileThresholds={summaryData!.quantile_thresholds}
              wind100TrackData={wind100TrackData}
              wind100Meta={wind100Meta}
              wind100Metric={wind100Metric}
              onWind100MetricChange={setWind100Metric}
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
            onTrackSelect={handleTrackSelect}
            onTimestepSelect={setSelectedTimestep}
            onClearSelection={handleClearSelection}
            wind100TrackData={wind100TrackData}
            wind100Meta={wind100Meta}
            wind100Metric={wind100Metric}
          />
        </main>
      </div>
    </div>
  );
}
