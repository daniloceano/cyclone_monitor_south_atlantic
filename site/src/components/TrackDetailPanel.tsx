"use client";

import { useState } from "react";
import { TrackSummary, Timestep, QuantileThresholds, PHASE_COLORS, PHASE_LABELS } from "@/types/cyclone";
import {
  formatDatetime,
  formatLat,
  formatLon,
  formatVor42,
  formatDuration,
  monthName,
} from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamic imports for chart components (client-side only, no SSR)
const LECTimeSeries = dynamic(() => import("./LECTimeSeries"), { ssr: false });
const LECBoxDiagram = dynamic(() => import("./LECBoxDiagram"), { ssr: false });

interface TrackDetailPanelProps {
  track: TrackSummary;
  timesteps: Timestep[] | null;
  selectedTimestep: Timestep | null;
  onTimestepSelect: (ts: Timestep | null) => void;
  onClear: () => void;
  loading: boolean;
  error: string | null;
  quantileThresholds: QuantileThresholds;
}

export default function TrackDetailPanel({
  track,
  timesteps,
  selectedTimestep,
  onTimestepSelect,
  onClear,
  loading,
  error,
  quantileThresholds: _qt,
}: TrackDetailPanelProps) {
  const trackIdStr = String(track.id);
  const [showLECCharts, setShowLECCharts] = useState(false);
  const [lecTab, setLecTab] = useState<"timeseries" | "boxdiagram">("timeseries");

  // Count timesteps that carry LEC data
  const lecCount = timesteps?.filter((t) => t.Kz !== undefined).length ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t border-gray-200">
      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 bg-orange-50 border-b border-orange-100">
        <div>
          <h2 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
            Selected Track
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">#{trackIdStr}</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-600 transition px-1.5 py-0.5 rounded hover:bg-orange-100"
          title="Clear selection"
        >
          ✕ Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-3 pt-2">
        {/* ── Track summary ─────────────────────────────────────────────── */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5">
          <InfoRow label="Genesis" value={formatDatetime(track.start)} />
          <InfoRow
            label="Genesis loc."
            value={`${formatLat(track.genesis_lat)}, ${formatLon(track.genesis_lon)}`}
          />
          <InfoRow label="Region" value={track.genesis_region} highlight />
          <InfoRow label="Lysis" value={formatDatetime(track.end)} />
          <InfoRow
            label="Lysis loc."
            value={`${formatLat(track.lysis_lat)}, ${formatLon(track.lysis_lon)}`}
          />
          <InfoRow label="Duration" value={formatDuration(track.duration_h)} />
          <InfoRow label="Genesis month" value={monthName(track.month)} />
        </div>

        {/* ── Intensity ─────────────────────────────────────────────────── */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700 mb-1">Intensity (vor42)</p>
          <InfoRow label="Peak intensity" value={formatVor42(track.max_vor42)} />
          <InfoRow
            label="Intensity rank"
            value={track.quantile}
            highlight={track.quantile === "top 5%" || track.quantile === "top 10%"}
          />
          <p className="text-xs text-gray-400 mt-1 leading-tight">
            vor42 = filtered and normalized relative vorticity. Ranked against all 6 789 tracks.
          </p>
        </div>

        {/* ── Phase legend ──────────────────────────────────────────────── */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Lifecycle phases</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: PHASE_COLORS[key] }}
                />
                <span className="text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Loading / error ────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading timesteps…
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
            {error}
          </p>
        )}

        {/* ── Timestep list ─────────────────────────────────────────────── */}
        {timesteps && !loading && (
          <>
            <p className="text-xs text-gray-400">
              {timesteps.length} timesteps
              {lecCount > 0 && (
                <span className="ml-1">
                  · <span className="text-blue-600 font-medium">{lecCount}</span> with LEC data
                </span>
              )}
              {" "}· click a row or map marker
            </p>
            {/* Column header */}
            <div className="flex items-center gap-2 px-2 py-0.5 text-xs text-gray-400 border-b border-gray-100">
              <span className="w-2 h-2 flex-shrink-0 invisible" />
              <span className="flex-1">Date / Time (UTC)</span>
              <span
                className="flex-shrink-0"
                title="vor42: filtered and normalized 850 hPa relative vorticity (×10⁻⁵ s⁻¹). Absolute value used."
              >
                vor42
              </span>
              {lecCount > 0 && <span className="w-1.5 flex-shrink-0" />}
            </div>
            <div className="space-y-0.5">
              {timesteps.map((ts, i) => {
                const isSelected =
                  selectedTimestep?.date === ts.date &&
                  selectedTimestep?.lon === ts.lon;
                const hasLec = ts.Kz !== undefined;
                // Determine if LEC value at this timestep is original (3-hourly) or interpolated.
                // Use lec_original flag from JSON when available; fall back to hour-divisible-by-3 heuristic.
                const lecIsOriginal = hasLec
                  ? (ts.lec_original !== undefined
                      ? ts.lec_original
                      : new Date(ts.date).getUTCHours() % 3 === 0)
                  : false;
                return (
                  <button
                    key={i}
                    onClick={() => onTimestepSelect(isSelected ? null : ts)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition ${
                      isSelected
                        ? "bg-orange-100 text-orange-800 border border-orange-200"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {/* Phase dot */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PHASE_COLORS[ts.phase] }}
                    />
                    {/* Date */}
                    <span className="font-mono flex-1 truncate">
                      {ts.date.replace("T", " ").slice(0, 16)}
                    </span>
                    {/* vor42 */}
                    <span
                      className="flex-shrink-0 text-gray-400 font-mono"
                      title="vor42 (×10⁻⁵ s⁻¹)"
                    >
                      {ts.vor42.toFixed(2)}
                    </span>
                    {/* LEC indicator: solid = original 3-hourly; ring = interpolated */}
                    {hasLec && (
                      lecIsOriginal ? (
                        <span
                          className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500"
                          title="LEC data: original (3-hourly)"
                        />
                      ) : (
                        <span
                          className="flex-shrink-0 w-1.5 h-1.5 rounded-full border border-blue-400"
                          title="LEC data: linearly interpolated"
                        />
                      )
                    )}
                  </button>
                );
              })}
            </div>
            {lecCount > 0 && (
              <div className="space-y-0.5 pt-0.5">
                <p className="text-xs text-gray-400">
                  vor42 = filtered 850 hPa relative vorticity (×10⁻⁵ s⁻¹)
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                    LEC original (3-hourly)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full border border-blue-400 inline-block flex-shrink-0" />
                    LEC interpolated (1-hourly)
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── LEC Charts Section ─────────────────────────────────────────── */}
        {timesteps && lecCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowLECCharts(!showLECCharts)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-100 transition"
            >
              <span className="text-xs font-semibold text-blue-700">
                📊 Lorenz Energy Cycle Charts
              </span>
              <span className="text-blue-500 text-xs">
                {showLECCharts ? "▲ Hide" : "▼ Show"}
              </span>
            </button>
            
            {showLECCharts && (
              <div className="px-3 pb-3 space-y-3">
                {/* Tab selector */}
                <div className="flex gap-1 border-b border-blue-200 pb-2">
                  <button
                    onClick={() => setLecTab("timeseries")}
                    className={`px-2 py-1 text-xs rounded-t transition ${
                      lecTab === "timeseries"
                        ? "bg-white text-blue-700 font-medium border border-b-white border-blue-200 -mb-[1px]"
                        : "text-blue-500 hover:text-blue-700"
                    }`}
                  >
                    Time Series
                  </button>
                  <button
                    onClick={() => setLecTab("boxdiagram")}
                    className={`px-2 py-1 text-xs rounded-t transition ${
                      lecTab === "boxdiagram"
                        ? "bg-white text-blue-700 font-medium border border-b-white border-blue-200 -mb-[1px]"
                        : "text-blue-500 hover:text-blue-700"
                    }`}
                  >
                    Energy Box Diagram
                  </button>
                </div>
                
                {/* Chart content */}
                <div className="bg-white rounded-lg p-2 border border-blue-100">
                  {lecTab === "timeseries" ? (
                    <LECTimeSeries timesteps={timesteps} />
                  ) : (
                    <LECBoxDiagram timesteps={timesteps} />
                  )}
                </div>
                
                <p className="text-xs text-blue-600 leading-tight">
                  LEC data from De Souza et al. (2025). Original 3-hourly resolution 
                  interpolated to 1-hourly. See About page for methodology.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Selected timestep detail ──────────────────────────────────── */}
        {selectedTimestep && <TimestepDetail ts={selectedTimestep} />}
      </div>
    </div>
  );
}

// ── Timestep detail card ───────────────────────────────────────────────────────
function TimestepDetail({ ts }: { ts: Timestep }) {
  const hasEnergetics =
    ts.Kz  !== undefined ||
    ts.Ke  !== undefined ||
    ts.Ck  !== undefined ||
    ts.Ca  !== undefined ||
    ts.BAe !== undefined ||
    ts.BKe !== undefined ||
    ts.Ge  !== undefined;

  return (
    <div className="bg-white border border-orange-200 rounded-lg p-2.5 space-y-1.5 shadow-sm">
      <p className="text-xs font-semibold text-orange-700 mb-1">Timestep detail</p>
      <InfoRow label="Date / time" value={formatDatetime(ts.date)} />
      <InfoRow label="Position" value={`${formatLat(ts.lat)}, ${formatLon(ts.lon)}`} />
      <InfoRow label="Phase" value={PHASE_LABELS[ts.phase] ?? ts.phase} highlight />
      <InfoRow label="vor42" value={formatVor42(ts.vor42)} />

      {/* ── All LEC terms ──────────────────────────────────────────────── */}
      <div className="pt-1.5 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-600 mb-1.5">
          Lorenz Energy Cycle
          {!hasEnergetics && (
            <span className="font-normal text-gray-400 ml-1">
              — not available at this timestep
            </span>
          )}
        </p>

        {hasEnergetics ? (
          <div className="space-y-1">
            {/* Energy reservoirs */}
            <p className="text-xs text-gray-400 font-medium mt-1">Energy reservoirs</p>
            <InfoRow label="Kz — Zonal KE"  value={ts.Kz  !== undefined ? `${ts.Kz.toFixed(0)} J m⁻²` : "—"} />
            <InfoRow label="Ke — Eddy KE"   value={ts.Ke  !== undefined ? `${ts.Ke.toFixed(0)} J m⁻²` : "—"} />
            {/* Conversion & generation terms */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">Conversion & generation</p>
            <InfoRow label="Ck — Ke→Kz (+)"  value={ts.Ck  !== undefined ? `${ts.Ck.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="Ca — Az→Ae"      value={ts.Ca  !== undefined ? `${ts.Ca.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="BAe — Ae boundary" value={ts.BAe !== undefined ? `${ts.BAe.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="BKe — Ke boundary" value={ts.BKe !== undefined ? `${ts.BKe.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="Ge — Eddy APE gen." value={ts.Ge  !== undefined ? `${ts.Ge.toFixed(3)} W m⁻²` : "—"} />
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Select a timestep with a blue dot (solid = original, ring = interpolated) to see LEC diagnostics.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Utility: info row ──────────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-right font-medium leading-tight ${
          highlight ? "text-blue-700" : "text-gray-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
