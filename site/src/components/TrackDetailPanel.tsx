"use client";

import { useState } from "react";
import {
  TrackSummary,
  Timestep,
  PHASE_COLORS,
  PHASE_LABELS,
  DisplayVariable,
  DisplayVariableInfo,
  WindTimestepEntry,
  WindMeta,
  WindMetric,
  WindLevelKey,
  WindQArray,
} from "@/types/cyclone";
import {
  formatDatetime,
  formatLat,
  formatLon,
  formatVorticity,
  formatDisplayValue,
  formatDuration,
  monthName,
  getWindColor,
  STORM_ALERT_PALETTE,
} from "@/lib/utils";
import { quantileRank } from "@/lib/colors";
import {
  GRID_KEYS,
  QUADRANT_DISPLAY,
  QUADRANT_KEYS,
  globalQuadrant,
  quadrantDistance,
} from "@/lib/windQuadrants";
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
  /** Active display variable and its descriptor. */
  displayVariable: DisplayVariable;
  displayInfo: DisplayVariableInfo | null;
  // Wind data for this track (keyed by ISO timestamp), all heights
  windTrackData: Record<string, WindTimestepEntry> | null;
  windMeta: WindMeta | null;
  /** Height to report, derived from displayVariable — never independent. */
  windLevel: WindLevelKey;
  windMetric: WindMetric;
  onWindMetricChange: (m: WindMetric) => void;
}

export default function TrackDetailPanel({
  track,
  timesteps,
  selectedTimestep,
  onTimestepSelect,
  onClear,
  loading,
  error,
  displayVariable,
  displayInfo,
  windTrackData,
  windMeta,
  windLevel,
  windMetric,
  onWindMetricChange,
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

  // Wind at the ACTIVE height only. Every wind number in this panel comes from
  // here, so the panel can never show a height other than the one the display
  // selector names.
  const levelKey = windLevel === "w100" ? "wind100" : "wind10";
  const levelMeta = windMeta?.levels?.[levelKey] ?? null;
  const levelLabel = levelMeta?.label ?? (windLevel === "w100" ? "Wind 100 m" : "Wind 10 m");

  const windEntryAll =
    selectedTimestep && windTrackData
      ? (windTrackData[selectedTimestep.date] ?? null)
      : null;
  const w100Entry = windEntryAll?.[windLevel] ?? null;

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
        </div>

        {/* ── Intensity ─────────────────────────────────────────────────── */}
        {/* Every variable is listed, with the active one marked, so the panel
            answers "how intense is this cyclone?" without forcing the user to
            flip the display selector to find out. The rank is computed from the
            active variable's thresholds — the same ones that colour the map. */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700 mb-1">Peak intensity</p>

          <InfoRow
            label="Central relative vorticity"
            value={formatVorticity(track.max_vor42)}
            highlight={displayVariable === "vor42"}
          />
          <InfoRow
            label="Wind 10 m"
            value={formatDisplayValue(track.max_wind10, { unit: "m s⁻¹", decimals: 2 })}
            highlight={displayVariable === "wind10"}
          />
          <InfoRow
            label="Wind 100 m"
            value={formatDisplayValue(track.max_wind100, { unit: "m s⁻¹", decimals: 2 })}
            highlight={displayVariable === "wind100"}
          />

          {displayInfo && (
            <InfoRow
              label={`Rank (${displayInfo.short_label.toLowerCase()})`}
              value={
                quantileRank(track[displayInfo.field], displayInfo.quantile_thresholds) ??
                "—"
              }
              highlight={
                quantileRank(track[displayInfo.field], displayInfo.quantile_thresholds) ===
                  "top 5%" ||
                quantileRank(track[displayInfo.field], displayInfo.quantile_thresholds) ===
                  "top 10%"
              }
            />
          )}

          <p className="text-xs text-gray-400 mt-1 leading-tight">
            Wind values are the largest quadrant maximum over the life cycle.
            Ranked against all {(displayInfo?.n ?? 0).toLocaleString()} cyclones.
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

        {/* ── Wind section ───────────────────────────────────────────────── */}
        {timesteps && !loading && levelMeta && (
          <WindSection
            selectedTimestep={selectedTimestep}
            entry={w100Entry}
            levelLabel={levelLabel}
            shape={windLevel === "w100" ? "square" : "circle"}
            globalMaxForMetric={(m) =>
              m === "max" ? levelMeta.max_global_max : levelMeta.p99_global_max
            }
            metric={windMetric}
            onMetricChange={onWindMetricChange}
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
        {selectedTimestep && (
          <TimestepDetail
            ts={selectedTimestep}
            entry={w100Entry}
            levelLabel={levelLabel}
            metric={windMetric}
          />
        )}
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
            <span>ζ: {selectedTimestep.vor42.toFixed(2)}</span>
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

// ── Wind section ────────────────────────────────────────────────────────────

/**
 * Per-quadrant wind statistics for the selected timestep.
 *
 * Reports BOTH max and p99 — the MAX/P99 toggle switches which is shown, and
 * both remain available. That the intensity filter uses only `max` is a
 * separate decision about classifying a whole track; it is no reason to hide
 * the percentile here, where the question is what the wind field looked like.
 *
 * The height is not selectable in this panel: it follows the display variable,
 * so the heading and the numbers cannot disagree.
 */
interface WindSectionProps {
  selectedTimestep: Timestep | null;
  entry: WindLevelEntryOrNull;
  levelLabel: string;
  /** Marker geometry for this height, echoed in the header. */
  shape: "circle" | "square";
  globalMaxForMetric: (m: WindMetric) => number;
  metric: WindMetric;
  onMetricChange: (m: WindMetric) => void;
}

type WindLevelEntryOrNull = { max: WindMetricEntryT | null; p99: WindMetricEntryT | null } | null;
type WindMetricEntryT = NonNullable<
  NonNullable<WindTimestepEntry["w10"]>["max"]
>;

function WindSection({
  selectedTimestep,
  entry,
  levelLabel,
  shape,
  globalMaxForMetric,
  metric,
  onMetricChange,
}: WindSectionProps) {
  const metricData = entry ? (metric === "max" ? entry.max : entry.p99) : null;
  const globalMax = globalMaxForMetric(metric);
  // Recomputed from the values; the source stores it as a label, and the two
  // agree exactly (verified over 74,242 timestep-metric comparisons).
  const gq = globalQuadrant(metricData);

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          🌬️ {levelLabel}
          {/* The marker geometry used for this height on the map */}
          <span
            className="inline-block border border-emerald-400 bg-emerald-200"
            style={{ width: 8, height: 8, borderRadius: shape === "circle" ? "50%" : 2 }}
            title={`Shown on the map as ${shape === "circle" ? "circles" : "squares"}`}
          />
        </span>

        {/* Metric toggle */}
        <div className="flex gap-0.5 bg-white border border-emerald-200 rounded-md p-0.5">
          <button
            onClick={() => onMetricChange("max")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              metric === "max"
                ? "bg-emerald-600 text-white"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            MAX
          </button>
          <button
            onClick={() => onMetricChange("p99")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              metric === "p99"
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
          {metric === "max"
            ? `Absolute maximum ${levelLabel.toLowerCase()} speed per quadrant (ERA5, Lagrangian).`
            : `99th-percentile ${levelLabel.toLowerCase()} speed per quadrant (ERA5, Lagrangian).`}
        </p>

        {!selectedTimestep ? (
          <p className="text-xs text-gray-400 italic py-1">
            Select a timestep to see wind data on the map and here.
          </p>
        ) : !entry || (entry.max === null && entry.p99 === null) ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No {levelLabel.toLowerCase()} data for this timestep.
          </p>
        ) : !metricData ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No {metric === "max" ? "max" : "P99"} data at this timestep.
          </p>
        ) : (
          <>
            {/* Quadrant grid — GRID_KEYS iterates dataset keys in geographic
                display order: SW→NW(top-left), SE→NE(top-right),
                NW→SW(bottom-left), NE→SE(bottom-right). */}
            <div className="grid grid-cols-2 gap-1.5">
              {GRID_KEYS.map((qd) => {
                const q: WindQArray | null = metricData[qd];
                const isGlobal = gq === qd;
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
                const [dLon, dLat, qVal] = q;
                if (qVal == null) return null;
                // Euclidean degrees, exactly as the source defines it.
                const qDist = quadrantDistance(q);
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
                    {dLon != null && dLat != null && (
                      <div className="text-[9px] text-gray-400 leading-tight">
                        Δ{dLon.toFixed(2)}°, Δ{dLat.toFixed(2)}°
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Global quad note */}
            {gq && (
              <p className="text-[10px] text-gray-500 leading-tight">
                ★ Largest value in{" "}
                <span className="font-semibold text-emerald-700">
                  {QUADRANT_DISPLAY[gq] ?? gq}
                </span>{" "}
                quadrant. &ensp;Scale max: {globalMax.toFixed(1)} m s⁻¹
                (dataset-wide, {levelLabel.toLowerCase()}).
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
  /** Wind data at the ACTIVE height only. */
  entry: WindLevelEntryOrNull;
  levelLabel: string;
  metric: WindMetric;
}

function TimestepDetail({ ts, entry, levelLabel, metric }: TimestepDetailProps) {
  const hasEnergetics =
    ts.Az  !== undefined || ts.Ae  !== undefined ||
    ts.Kz  !== undefined || ts.Ke  !== undefined;

  const fJ  = (v: number | undefined) => v !== undefined ? `${v.toFixed(0)} J m⁻²` : "—";
  const fW  = (v: number | undefined) => v !== undefined ? `${v.toFixed(3)} W m⁻²` : "—";

  // Wind at the active height, for the selected statistic.
  const metricData = entry ? (metric === "max" ? entry.max : entry.p99) : null;
  const metricLabel = metric === "max" ? "Maximum" : "99th percentile";
  const gq = globalQuadrant(metricData);

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
      <InfoRow label="Central relative vorticity" value={formatVorticity(ts.vor42)} />

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

      {/* ── Wind at the active height ─────────────────────────────────── */}
      <div className="pt-1.5 border-t border-gray-200">
        <p className="text-xs font-semibold text-emerald-700 mb-1.5">
          🌬️ {levelLabel} ({metricLabel})
          {!metricData && (
            <span className="font-normal text-gray-400 ml-1">
              — not available at this timestep
            </span>
          )}
        </p>

        {metricData ? (
          <div className="space-y-1">
            {/* Largest of the four quadrants at this timestep */}
            {(() => {
              const globalData = gq ? metricData[gq] : null;
              const geoLabel = gq ? (QUADRANT_DISPLAY[gq] ?? gq) : null;
              if (!globalData || !geoLabel) {
                return <InfoRow label="Largest value" value="— no data" />;
              }
              // Stored as offsets from the cyclone centre.
              const [dlon, dlat, val] = globalData;
              return (
                <>
                  <InfoRow label={`Largest value (${geoLabel})`} value={fWind(val ?? undefined)} />
                  <InfoRow
                    label="  Δlon, Δlat"
                    value={`${fDelta(dlon ?? undefined)}, ${fDelta(dlat ?? undefined)}`}
                  />
                  <InfoRow
                    label="  Distance"
                    value={fDist(quadrantDistance(globalData) ?? undefined)}
                  />
                </>
              );
            })()}
            
            {/* Per-quadrant values — GRID_KEYS gives geographic display order */}
            <p className="text-xs text-gray-400 font-medium mt-1.5">By quadrant</p>
            {GRID_KEYS.map((q) => {
              const qData = metricData[q];
              const isGlobal = gq === q;
              const geoLabel = QUADRANT_DISPLAY[q] ?? q;
              if (!qData) {
                return <InfoRow key={q} label={geoLabel} value="— no data" />;
              }
              const [dlon, dlat, val] = qData;
              return (
                <div
                  key={q}
                  className={`pl-1 border-l-2 ${
                    isGlobal ? "border-emerald-400" : "border-emerald-100"
                  } ml-1`}
                >
                  <InfoRow
                    label={`${geoLabel}${isGlobal ? " ★" : ""}`}
                    value={fWind(val ?? undefined)}
                  />
                  <InfoRow
                    label="  Δlon, Δlat"
                    value={`${fDelta(dlon ?? undefined)}, ${fDelta(dlat ?? undefined)}`}
                  />
                  <InfoRow
                    label="  Distance"
                    value={fDist(quadrantDistance(qData) ?? undefined)}
                  />
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
