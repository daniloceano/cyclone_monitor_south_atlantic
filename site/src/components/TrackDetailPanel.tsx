"use client";

import { useState } from "react";
import {
  TrackSummary,
  Timestep,
  QuantileThresholds,
  PHASE_COLORS,
  PHASE_LABELS,
  Wind100TimestepEntry,
  Wind100Meta,
  Wind100Metric,
  Wind100QArray,
} from "@/types/cyclone";
import {
  formatDatetime,
  formatLat,
  formatLon,
  formatVor42,
  formatDuration,
  monthName,
  getWindColor,
  STORM_ALERT_PALETTE,
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
  // Wind100 data for this track (keyed by ISO timestamp)
  wind100TrackData: Record<string, Wind100TimestepEntry> | null;
  wind100Meta: Wind100Meta | null;
  wind100Metric: Wind100Metric;
  onWind100MetricChange: (m: Wind100Metric) => void;
}

const QUADRANT_KEYS = ["NW", "NE", "SW", "SE"] as const;

export default function TrackDetailPanel({
  track,
  timesteps,
  selectedTimestep,
  onTimestepSelect,
  onClear,
  loading,
  error,
  quantileThresholds: _qt,
  wind100TrackData,
  wind100Meta,
  wind100Metric,
  onWind100MetricChange,
}: TrackDetailPanelProps) {
  const trackIdStr = String(track.id);
  const [showLECCharts, setShowLECCharts] = useState(false);
  const [lecTab, setLecTab] = useState<"timeseries" | "boxdiagram">("timeseries");

  // Count timesteps that carry LEC data
  const lecCount = timesteps?.filter((t) => t.Kz !== undefined).length ?? 0;

  // Resolve wind100 entry for the selected timestep
  const w100Entry =
    selectedTimestep && wind100TrackData
      ? (wind100TrackData[selectedTimestep.date] ?? null)
      : null;

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

        {/* ── Timestep selector (dropdown) ─────────────────────────────────── */}
        {timesteps && !loading && (
          <>
            <p className="text-xs text-gray-400 mb-1">
              {timesteps.length} timesteps
              {lecCount > 0 && (
                <span className="ml-1">
                  · <span className="text-blue-600 font-medium">{lecCount}</span> with LEC data
                </span>
              )}
            </p>

            {/* Dropdown selector */}
            <div className="relative">
              <select
                value={selectedTimestep ? timesteps.findIndex(ts => ts.date === selectedTimestep.date && ts.lon === selectedTimestep.lon) : ""}
                onChange={(e) => {
                  const idx = e.target.value;
                  if (idx === "") {
                    onTimestepSelect(null);
                  } else {
                    onTimestepSelect(timesteps[parseInt(idx)]);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="">Select a timestep...</option>
                {timesteps.map((ts, i) => {
                  const hasLec = ts.Kz !== undefined;
                  const lecIsOriginal = hasLec
                    ? (ts.lec_original !== undefined ? ts.lec_original : new Date(ts.date).getUTCHours() % 3 === 0)
                    : false;
                  const lecIndicator = hasLec ? (lecIsOriginal ? " ●" : " ○") : "";
                  return (
                    <option key={i} value={i}>
                      {ts.date.replace("T", " ").slice(0, 16)} · {PHASE_LABELS[ts.phase]} · vor42: {ts.vor42.toFixed(2)}{lecIndicator}
                    </option>
                  );
                })}
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Selected timestep details */}
            {selectedTimestep && (
              <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: PHASE_COLORS[selectedTimestep.phase] }}
                    />
                    <span className="font-medium text-orange-800">
                      {PHASE_LABELS[selectedTimestep.phase]}
                    </span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-600 font-mono">
                      {selectedTimestep.date.replace("T", " ").slice(0, 16)} UTC
                    </span>
                  </div>
                  {/* Back to track button */}
                  <button
                    onClick={() => onTimestepSelect(null)}
                    className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition flex items-center gap-1"
                    title="Exit timestep view and return to track overview"
                  >
                    ← Back to track
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600">
                  <span>Lat: {formatLat(selectedTimestep.lat)}</span>
                  <span>Lon: {formatLon(selectedTimestep.lon)}</span>
                  <span>vor42: {selectedTimestep.vor42.toFixed(2)}</span>
                  {selectedTimestep.Kz !== undefined && (
                    <span className="text-blue-600">LEC data available</span>
                  )}
                </div>
              </div>
            )}

            {lecCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="font-bold">●</span> LEC original (3-hourly)
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-bold">○</span> LEC interpolated
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Wind100 Section ────────────────────────────────────────────── */}
        {timesteps && !loading && wind100Meta && (
          <Wind100Section
            selectedTimestep={selectedTimestep}
            w100Entry={w100Entry}
            wind100Meta={wind100Meta}
            wind100Metric={wind100Metric}
            onMetricChange={onWind100MetricChange}
          />
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
        {selectedTimestep && <TimestepDetail ts={selectedTimestep} w100Entry={w100Entry} wind100Metric={wind100Metric} />}
      </div>
    </div>
  );
}

// ── Wind100 section ────────────────────────────────────────────────────────────

interface Wind100SectionProps {
  selectedTimestep: Timestep | null;
  w100Entry: Wind100TimestepEntry | null;
  wind100Meta: Wind100Meta;
  wind100Metric: Wind100Metric;
  onMetricChange: (m: Wind100Metric) => void;
}

function Wind100Section({
  selectedTimestep,
  w100Entry,
  wind100Meta,
  wind100Metric,
  onMetricChange,
}: Wind100SectionProps) {
  const metricData = w100Entry
    ? wind100Metric === "max" ? w100Entry.max : w100Entry.p99
    : null;
  const globalMax = wind100Metric === "max"
    ? wind100Meta.max_global_max
    : wind100Meta.p99_global_max;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <span className="text-xs font-semibold text-emerald-800">
          🌬️ Wind 100 m
        </span>

        {/* Metric toggle */}
        <div className="flex gap-0.5 bg-white border border-emerald-200 rounded-md p-0.5">
          <button
            onClick={() => onMetricChange("max")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              wind100Metric === "max"
                ? "bg-emerald-600 text-white"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            MAX
          </button>
          <button
            onClick={() => onMetricChange("p99")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              wind100Metric === "p99"
                ? "bg-emerald-600 text-white"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            P99
          </button>
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* Metric description */}
        <p className="text-[10px] text-emerald-700 leading-tight">
          {wind100Metric === "max"
            ? "Absolute maximum 100 m wind speed per quadrant (ERA5, Lagrangian)."
            : "99th-percentile 100 m wind speed per quadrant (ERA5, Lagrangian)."}
        </p>

        {!selectedTimestep ? (
          <p className="text-xs text-gray-400 italic py-1">
            Select a timestep to see wind100 data on the map and here.
          </p>
        ) : !w100Entry || (w100Entry.max === null && w100Entry.p99 === null) ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No wind100 data for this timestep.
          </p>
        ) : !metricData ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No {wind100Metric === "max" ? "max" : "P99"} data at this timestep.
          </p>
        ) : (
          <>
            {/* Quadrant grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {QUADRANT_KEYS.map((qd) => {
                const q: Wind100QArray | null = metricData[qd];
                const isGlobal = metricData.gq === qd;
                if (!q) {
                  return (
                    <div key={qd} className="bg-white border border-gray-200 rounded-md px-2 py-1.5 opacity-50">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] font-bold text-gray-500">{qd}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">—</span>
                    </div>
                  );
                }
                const [qLon, qLat, qVal, qDist] = q;
                const color = getWindColor(qVal, globalMax);
                return (
                  <div
                    key={qd}
                    className={`bg-white rounded-md px-2 py-1.5 border ${
                      isGlobal ? "border-emerald-400 ring-1 ring-emerald-300" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color, border: "1px solid #e5e7eb" }}
                      />
                      <span className="text-[10px] font-bold text-gray-700">{qd}</span>
                      {isGlobal && (
                        <span className="text-[9px] text-emerald-600 font-semibold">★</span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-900">
                      {qVal.toFixed(2)} <span className="text-[9px] font-normal text-gray-500">m s⁻¹</span>
                    </div>
                    {qDist != null && (
                      <div className="text-[9px] text-gray-500">dist: {qDist.toFixed(2)}°</div>
                    )}
                    {qLon != null && qLat != null && (
                      <div className="text-[9px] text-gray-400 leading-tight">
                        Δ{(qLon - (selectedTimestep?.lon ?? 0)).toFixed(2)}°, Δ{(qLat - (selectedTimestep?.lat ?? 0)).toFixed(2)}°
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Global quad note */}
            {metricData.gq && (
              <p className="text-[10px] text-gray-500 leading-tight">
                ★ Global maximum in <span className="font-semibold text-emerald-700">{metricData.gq}</span> quadrant.
                &ensp;Scale max: {globalMax.toFixed(1)} m s⁻¹ (dataset-wide).
              </p>
            )}

            {/* Mini color scale */}
            <MiniColorScale globalMax={globalMax} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Mini color scale for the panel ────────────────────────────────────────────

function MiniColorScale({ globalMax }: { globalMax: number }) {
  const steps = 5;
  const gradientStops = STORM_ALERT_PALETTE.map(
    (c, i) => `${c} ${((i / (STORM_ALERT_PALETTE.length - 1)) * 100).toFixed(0)}%`
  ).join(", ");

  return (
    <div className="mt-1">
      <div
        className="h-2 rounded-sm"
        style={{ background: `linear-gradient(to right, ${gradientStops})` }}
      />
      <div className="flex justify-between mt-0.5">
        {Array.from({ length: steps }, (_, i) => {
          const v = (i / (steps - 1)) * globalMax;
          return (
            <span key={i} className="text-[9px] text-gray-400 leading-none">
              {v.toFixed(0)}
            </span>
          );
        })}
      </div>
      <p className="text-[9px] text-gray-400 text-right mt-0.5">m s⁻¹</p>
    </div>
  );
}

// ── Timestep detail card ───────────────────────────────────────────────────────
interface TimestepDetailProps {
  ts: Timestep;
  w100Entry: Wind100TimestepEntry | null;
  wind100Metric: Wind100Metric;
}

function TimestepDetail({ ts, w100Entry, wind100Metric }: TimestepDetailProps) {
  const hasEnergetics =
    ts.Az  !== undefined || ts.Ae  !== undefined ||
    ts.Kz  !== undefined || ts.Ke  !== undefined;

  const fJ  = (v: number | undefined) => v !== undefined ? `${v.toFixed(0)} J m⁻²` : "—";
  const fW  = (v: number | undefined) => v !== undefined ? `${v.toFixed(3)} W m⁻²` : "—";

  // Wind100 data for the selected metric
  const metricData = w100Entry
    ? wind100Metric === "max" ? w100Entry.max : w100Entry.p99
    : null;
  const metricLabel = wind100Metric === "max" ? "Maximum" : "99th percentile";

  // Format wind value
  const fWind = (v: number | undefined) => v !== undefined ? `${v.toFixed(1)} m/s` : "—";
  const fDist = (v: number | undefined) => v !== undefined ? `${v.toFixed(1)} km` : "—";
  const fCoord = (v: number | undefined) => v !== undefined ? `${v.toFixed(2)}°` : "—";

  return (
    <div className="bg-white border border-orange-200 rounded-lg p-2.5 space-y-1.5 shadow-sm">
      <p className="text-xs font-semibold text-orange-700 mb-1">Timestep detail</p>
      <InfoRow label="Date / time" value={formatDatetime(ts.date)} />
      <InfoRow label="Position" value={`${formatLat(ts.lat)}, ${formatLon(ts.lon)}`} />
      <InfoRow label="Phase" value={PHASE_LABELS[ts.phase] ?? ts.phase} highlight />
      <InfoRow label="vor42" value={formatVor42(ts.vor42)} />

      {/* ── Wind100 data ──────────────────────────────────────────────── */}
      <div className="pt-1.5 border-t border-gray-200">
        <p className="text-xs font-semibold text-emerald-700 mb-1.5">
          🌬️ Wind 100 m ({metricLabel})
          {!metricData && (
            <span className="font-normal text-gray-400 ml-1">
              — not available at this timestep
            </span>
          )}
        </p>

        {metricData ? (
          <div className="space-y-1">
            {/* Global maximum */}
            <InfoRow label="Global max" value={fWind(metricData.global?.[2])} />
            {metricData.global && (
              <>
                <InfoRow label="  Δlon, Δlat" value={`${fCoord(metricData.global[0])}, ${fCoord(metricData.global[1])}`} />
                <InfoRow label="  Distance" value={fDist(metricData.global[3])} />
              </>
            )}
            
            {/* Per-quadrant values */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">By quadrant</p>
            {QUADRANT_KEYS.map((q) => {
              const qData = metricData[q];
              if (!qData) return (
                <InfoRow key={q} label={q} value="— no data" />
              );
              return (
                <div key={q} className="pl-1 border-l-2 border-emerald-100 ml-1">
                  <InfoRow label={q} value={fWind(qData[2])} />
                  <InfoRow label="  Δlon, Δlat" value={`${fCoord(qData[0])}, ${fCoord(qData[1])}`} />
                  <InfoRow label="  Distance" value={fDist(qData[3])} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            No wind data available for this timestep.
          </p>
        )}
      </div>

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
            {/* Energy reservoirs (J m⁻²) */}
            <p className="text-xs text-gray-400 font-medium mt-1">Energy reservoirs (J m⁻²)</p>
            <InfoRow label="Az — Zonal APE"  value={fJ(ts.Az)} />
            <InfoRow label="Ae — Eddy APE"   value={fJ(ts.Ae)} />
            <InfoRow label="Kz — Zonal KE"   value={fJ(ts.Kz)} />
            <InfoRow label="Ke — Eddy KE"    value={fJ(ts.Ke)} />
            {/* Conversion terms (W m⁻²) */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">Conversions (W m⁻²)</p>
            <InfoRow label="Ca — Az→Ae"      value={fW(ts.Ca)} />
            <InfoRow label="Ce — Ae→Ke"      value={fW(ts.Ce)} />
            <InfoRow label="Ck — Ke→Kz (+)"  value={fW(ts.Ck)} />
            <InfoRow label="Cz — Az→Kz"      value={fW(ts.Cz)} />
            {/* Generation terms (W m⁻²) */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">Generation (W m⁻²)</p>
            <InfoRow label="Gz — Zonal APE gen." value={fW(ts.Gz)} />
            <InfoRow label="Ge — Eddy APE gen."  value={fW(ts.Ge)} />
            {/* Boundary fluxes (W m⁻²) */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">Boundary fluxes (W m⁻²)</p>
            <InfoRow label="BAz — Az boundary" value={fW(ts.BAz)} />
            <InfoRow label="BAe — Ae boundary" value={fW(ts.BAe)} />
            <InfoRow label="BKz — Kz boundary" value={fW(ts.BKz)} />
            <InfoRow label="BKe — Ke boundary" value={fW(ts.BKe)} />
            {/* Residual terms (W m⁻²) */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">Residuals (W m⁻²)</p>
            <InfoRow label="RGz — Zonal APE res." value={fW(ts.RGz)} />
            <InfoRow label="RGe — Eddy APE res."  value={fW(ts.RGe)} />
            <InfoRow label="RKz — Zonal KE res."  value={fW(ts.RKz)} />
            <InfoRow label="RKe — Eddy KE res."   value={fW(ts.RKe)} />
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
