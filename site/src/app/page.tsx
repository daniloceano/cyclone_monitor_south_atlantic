"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

import { TrackSummary, Timestep, FilterState, SummaryData, EMPTY_FILTERS } from "@/types/cyclone";
import { loadSummary, loadYearDetails, getTrackDetail } from "@/lib/dataLoader";
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

  // ── Load summary on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadSummary()
      .then((data) => {
        setSummaryData(data);
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

  // ── Track selection handler ────────────────────────────────────────────────
  const handleTrackSelect = useCallback(async (track: TrackSummary) => {
    // Immediately highlight the selected track
    setSelectedTrack(track);
    setSelectedTimestep(null);
    setTimesteps(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const yearDetails = await loadYearDetails(track.year);
      const detail = getTrackDetail(yearDetails, track.id);
      setTimesteps(detail?.timesteps ?? []);
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
            />
          )}
        </aside>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden">
          <CycloneMap
            tracks={filteredTracks}
            selectedTrack={selectedTrack}
            timesteps={timesteps}
            onTrackSelect={handleTrackSelect}
            onTimestepSelect={setSelectedTimestep}
            onClearSelection={handleClearSelection}
          />
        </main>
      </div>
    </div>
  );
}
