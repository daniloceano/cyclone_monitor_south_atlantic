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
const VorticityTimeSeries = dynamic(() => import("./VorticityTimeSeries"), { ssr: false });
const HartPhaseDiagram = dynamic(() => import("./HartPhaseDiagram"), { ssr: false });

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

/**
 * N/S labels are inverted in the source dataset relative to geographic
 * convention (verified against raw CSV coordinates).  E/W is correct.
 * Use this mapping wherever a quadrant label is shown to the user.
 */
const QUADRANT_DISPLAY: Record<string, string> = {
  NW: "SW", NE: "SE", SW: "NW", SE: "NE",
};

/**
 * Grid iteration order for the 2×2 quadrant panel, arranged so that the
 * displayed geographic labels read correctly (NW top-left … SE bottom-right).
 *   dataset SW → display NW (top-left)
 *   dataset SE → display NE (top-right)
 *   dataset NW → display SW (bottom-left)
 *   dataset NE → display SE (bottom-right)
 */
const GRID_KEYS = ["SW", "SE", "NW", "NE"] as const;

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
  const [showCPS, setShowCPS] = useState(false);

  // Count timesteps that carry LEC data
  const lecCount = timesteps?.filter((t) => t.Kz !== undefined).length ?? 0;
  // Count timesteps carrying phase-space parameters, and how many were computed
  const cpsCount = timesteps?.filter((t) => t.cps_B !== undefined).length ?? 0;
  const cpsOriginalCount = timesteps?.filter((t) => t.cps_original === true).length ?? 0;

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
          {track.cps_label && (
            <InfoRow
              label="Structure (CPS)"
              value={track.cps_seq ? `${track.cps_label} · ${track.cps_seq}` : track.cps_label}
              highlight
            />
          )}
          {track.warm_seclusion && (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 leading-tight">
              A persistent hybrid run in this cyclone was rejected as a
              Shapiro–Keyser warm seclusion rather than counted as subtropical.
            </p>
          )}
          {track.processed === false && (
            <>
              {track.src !== undefined && (
                <InfoRow label="Catalogue ID" value={String(track.src)} />
              )}
              <p className="text-[10px] text-gray-600 bg-gray-100 border border-gray-200 rounded px-1.5 py-1 leading-tight">
                <strong>Track-only cyclone.</strong> Position and vorticity from
                the raw tracking catalogue — no energetics, lifecycle phases,
                genesis region, phase space or 100 m wind. It also comes from a
                different tracking vintage than the processed cyclones, so its
                trajectory is not directly comparable with theirs. The ID shown
                in the header is namespaced; the catalogue&apos;s own ID is above.
              </p>
            </>
          )}
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

        {/* ── Vorticity Time Series ───────────────────────────────────────── */}
        {timesteps && timesteps.length > 0 && !loading && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
            <p className="text-xs font-semibold text-indigo-700 mb-2">
              Central Vorticity Time Series
            </p>
            <VorticityTimeSeries
              timesteps={timesteps}
              selectedTimestep={selectedTimestep}
              onTimestepSelect={(ts) => onTimestepSelect(ts)}
            />
          </div>
        )}

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

        {/* ── Timestep navigator (slider + prev/next) ──────────────────────── */}
        {timesteps && !loading && (
          <TimestepNavigator
            timesteps={timesteps}
            selectedTimestep={selectedTimestep}
            onSelect={onTimestepSelect}
            lecCount={lecCount}
          />
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

        {/* ── Cyclone Phase Space Section ────────────────────────────────── */}
        {timesteps && cpsCount > 0 && (
          <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowCPS(!showCPS)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-fuchsia-100 transition"
            >
              <span className="text-xs font-semibold text-fuchsia-800">
                🌀 Cyclone Phase Space
              </span>
              <span className="text-fuchsia-600 text-xs">
                {showCPS ? "▲ Hide" : "▼ Show"}
              </span>
            </button>

            {showCPS && (
              <div className="px-3 pb-3 space-y-2">
                <div className="bg-white rounded-lg p-2 border border-fuchsia-100">
                  <HartPhaseDiagram
                    timesteps={timesteps}
                    selectedTimestep={selectedTimestep}
                    onTimestepSelect={onTimestepSelect}
                  />
                </div>
                <p className="text-[10px] text-fuchsia-700 leading-tight">
                  {cpsCount} timesteps with phase-space parameters
                  {cpsOriginalCount > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium">{cpsOriginalCount}</span> computed
                      at the native 3-hourly step
                    </>
                  )}
                  . Hart (2003) framework; thresholds after de Souza et al. (2026).
                  See the About page for the classification protocol and its caveats.
                </p>
              </div>
            )}
          </div>
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

// ── Timestep navigator ────────────────────────────────────────────────────────

interface TimestepNavigatorProps {
  timesteps: import("@/types/cyclone").Timestep[];
  selectedTimestep: import("@/types/cyclone").Timestep | null;
  onSelect: (ts: import("@/types/cyclone").Timestep | null) => void;
  lecCount: number;
}

function TimestepNavigator({ timesteps, selectedTimestep, onSelect, lecCount }: TimestepNavigatorProps) {
  const n = timesteps.length;

  // Index of the currently selected timestep (-1 = none)
  const idx = selectedTimestep
    ? timesteps.findIndex(
        (ts) => ts.date === selectedTimestep.date && ts.lon === selectedTimestep.lon
      )
    : -1;

  // Slider display value: use the found index, default to 0 when unset
  const sliderVal = idx >= 0 ? idx : 0;

  // Build a CSS linear-gradient coloring each segment by lifecycle phase
  const trackGradient =
    n <= 1
      ? (PHASE_COLORS[timesteps[0]?.phase] ?? "#94a3b8")
      : `linear-gradient(to right, ${timesteps
          .map((ts, i) => {
            const pct = ((i / (n - 1)) * 100).toFixed(1);
            return `${PHASE_COLORS[ts.phase] ?? "#94a3b8"} ${pct}%`;
          })
          .join(", ")})`;

  const goTo = (newIdx: number) => onSelect(timesteps[newIdx]);
  const canPrev = idx > 0;
  const canNext = idx < n - 1;

  // Thumb color follows the current phase (or neutral when nothing selected)
  const thumbColor =
    idx >= 0 ? (PHASE_COLORS[timesteps[idx].phase] ?? "#94a3b8") : "#cbd5e1";

  return (
    <div className="space-y-1.5">
      {/* ── Count row ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {n} timesteps
          {lecCount > 0 && (
            <>
              {" · "}
              <span className="text-blue-600 font-medium">{lecCount}</span> with LEC
            </>
          )}
        </span>
        {idx >= 0 && (
          <span className="font-mono text-gray-500">
            {idx + 1} / {n}
          </span>
        )}
      </div>

      {/* ── Slider + prev/next row ───────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Prev button */}
        <button
          onClick={() => goTo(idx <= 0 ? 0 : idx - 1)}
          disabled={!canPrev}
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition
            disabled:opacity-30 disabled:cursor-not-allowed
            enabled:hover:bg-orange-50 enabled:hover:border-orange-300 enabled:active:bg-orange-100
            border-gray-300 text-gray-600 text-base leading-none"
          title="Previous timestep"
          aria-label="Previous timestep"
        >
          ‹
        </button>

        {/* Slider track */}
        <div className="relative flex-1 py-1">
          <input
            type="range"
            min={0}
            max={n - 1}
            step={1}
            value={sliderVal}
            onChange={(e) => goTo(parseInt(e.target.value))}
            className="timestep-slider w-full cursor-pointer"
            style={
              {
                "--track-bg": trackGradient,
                "--thumb-color": thumbColor,
              } as React.CSSProperties
            }
            aria-label="Timestep slider"
          />
        </div>

        {/* Next button */}
        <button
          onClick={() => goTo(idx < 0 ? 0 : Math.min(idx + 1, n - 1))}
          disabled={canNext === false && idx >= 0}
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition
            disabled:opacity-30 disabled:cursor-not-allowed
            enabled:hover:bg-orange-50 enabled:hover:border-orange-300 enabled:active:bg-orange-100
            border-gray-300 text-gray-600 text-base leading-none"
          title="Next timestep"
          aria-label="Next timestep"
        >
          ›
        </button>
      </div>

      {/* ── Selected timestep info card ──────────────────────────────── */}
      {selectedTimestep ? (
        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: PHASE_COLORS[selectedTimestep.phase] }}
              />
              <span className="font-medium text-orange-800 truncate">
                {PHASE_LABELS[selectedTimestep.phase]}
              </span>
              <span className="text-gray-500 flex-shrink-0">·</span>
              <span className="text-gray-600 font-mono text-[11px] flex-shrink-0">
                {selectedTimestep.date.replace("T", " ").slice(0, 16)} UTC
              </span>
            </div>
            <button
              onClick={() => onSelect(null)}
              className="ml-2 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition flex-shrink-0"
              title="Exit timestep view and return to track overview"
            >
              ← Track
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
      ) : (
        <p className="text-[11px] text-gray-400 italic text-center">
          Drag the slider or press › to select a timestep
        </p>
      )}

      {/* ── LEC legend ──────────────────────────────────────────────── */}
      {lecCount > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="font-bold">●</span> LEC original (3-hourly)
          </span>
          <span className="flex items-center gap-1">
            <span className="font-bold">○</span> LEC interpolated
          </span>
        </div>
      )}
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
            {/* Quadrant grid — GRID_KEYS iterates dataset keys in geographic
                display order: SW→NW(top-left), SE→NE(top-right),
                NW→SW(bottom-left), NE→SE(bottom-right). */}
            <div className="grid grid-cols-2 gap-1.5">
              {GRID_KEYS.map((qd) => {
                const q: Wind100QArray | null = metricData[qd];
                const isGlobal = metricData.gq === qd;
                const geoLabel = QUADRANT_DISPLAY[qd] ?? qd;
                if (!q) {
                  return (
                    <div key={qd} className="bg-white border border-gray-200 rounded-md px-2 py-1.5 opacity-50">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] font-bold text-gray-500">{geoLabel}</span>
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
                      <span className="text-[10px] font-bold text-gray-700">{geoLabel}</span>
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
                ★ Global maximum in <span className="font-semibold text-emerald-700">{QUADRANT_DISPLAY[metricData.gq] ?? metricData.gq}</span> quadrant.
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
  const fWind = (v: number | undefined) => v !== undefined ? `${v.toFixed(1)} m s⁻¹` : "—";
  // Distance is stored as angular distance in degrees, not km
  const fDist = (v: number | undefined) => v !== undefined ? `${v.toFixed(2)}°` : "—";
  const fDelta = (v: number | undefined) => v !== undefined ? `${v > 0 ? "+" : ""}${v.toFixed(2)}°` : "—";

  return (
    <div className="bg-white border border-orange-200 rounded-lg p-2.5 space-y-1.5 shadow-sm">
      <p className="text-xs font-semibold text-orange-700 mb-1">Timestep detail</p>
      <InfoRow label="Date / time" value={formatDatetime(ts.date)} />
      <InfoRow label="Position" value={`${formatLat(ts.lat)}, ${formatLon(ts.lon)}`} />
      <InfoRow label="Phase" value={PHASE_LABELS[ts.phase] ?? ts.phase} highlight />
      <InfoRow label="vor42" value={formatVor42(ts.vor42)} />

      {/* ── Cyclone Phase Space at this timestep ───────────────────────── */}
      {ts.cps_B !== undefined && (
        <div className="pt-1.5 border-t border-gray-200">
          <p className="text-xs font-semibold text-fuchsia-700 mb-1.5">
            🌀 Phase Space
            <span className="font-normal text-gray-400 ml-1">
              {ts.cps_original ? "(computed)" : "(interpolated)"}
            </span>
          </p>
          {ts.cps_class && (
            <InfoRow label="Structure" value={ts.cps_class} highlight />
          )}
          <InfoRow label="B — thickness asym." value={`${ts.cps_B.toFixed(1)} m`} />
          <InfoRow
            label="VTL — lower thermal wind"
            value={ts.cps_VTL !== undefined ? ts.cps_VTL.toFixed(1) : "—"}
          />
          <InfoRow
            label="VTU — upper thermal wind"
            value={ts.cps_VTU !== undefined ? ts.cps_VTU.toFixed(1) : "—"}
          />
          {ts.cps_size_km !== undefined && (
            <InfoRow label="Radius" value={`${ts.cps_size_km.toFixed(0)} km`} />
          )}
          {ts.cps_dir !== undefined && (
            <InfoRow label="Motion direction" value={`${ts.cps_dir.toFixed(0)}°`} />
          )}
        </div>
      )}

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
            {/* Global maximum - from the quadrant identified by gq */}
            {(() => {
              const gq = metricData.gq as "NW" | "NE" | "SW" | "SE" | null;
              const globalData = gq ? metricData[gq] : null;
              const geoLabel = gq ? (QUADRANT_DISPLAY[gq] ?? gq) : null;
              if (!globalData || !geoLabel) return <InfoRow label="Global max" value="— no data" />;
              // globalData[0] = absolute lon, [1] = absolute lat
              const dlon = globalData[0] != null ? globalData[0] - ts.lon : undefined;
              const dlat = globalData[1] != null ? globalData[1] - ts.lat : undefined;
              return (
                <>
                  <InfoRow label={`Global max (${geoLabel})`} value={fWind(globalData[2])} />
                  <InfoRow label="  Δlon, Δlat" value={`${fDelta(dlon)}, ${fDelta(dlat)}`} />
                  <InfoRow label="  Distance" value={fDist(globalData[3])} />
                </>
              );
            })()}
            
            {/* Per-quadrant values — GRID_KEYS gives geographic display order */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">By quadrant</p>
            {GRID_KEYS.map((q) => {
              const qData = metricData[q];
              const isGlobal = metricData.gq === q;
              const geoLabel = QUADRANT_DISPLAY[q] ?? q;
              if (!qData) return (
                <InfoRow key={q} label={geoLabel} value="— no data" />
              );
              const dlon = qData[0] != null ? qData[0] - ts.lon : undefined;
              const dlat = qData[1] != null ? qData[1] - ts.lat : undefined;
              return (
                <div key={q} className={`pl-1 border-l-2 ${isGlobal ? "border-emerald-400" : "border-emerald-100"} ml-1`}>
                  <InfoRow label={`${geoLabel}${isGlobal ? " ★" : ""}`} value={fWind(qData[2])} />
                  <InfoRow label="  Δlon, Δlat" value={`${fDelta(dlon)}, ${fDelta(dlat)}`} />
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
