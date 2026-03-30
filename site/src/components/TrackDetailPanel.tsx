"use client";

import { TrackSummary, Timestep, QuantileThresholds, PHASE_COLORS, PHASE_LABELS } from "@/types/cyclone";
import {
  formatDatetime,
  formatLat,
  formatLon,
  formatVor42,
  formatDuration,
  monthName,
} from "@/lib/utils";

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
            vor42 = 400 hPa relative vorticity. Ranked against all 6 789 tracks.
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
            <div className="space-y-0.5">
              {timesteps.map((ts, i) => {
                const isSelected =
                  selectedTimestep?.date === ts.date &&
                  selectedTimestep?.lon === ts.lon;
                const hasLec = ts.Kz !== undefined;
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
                    <span className="flex-shrink-0 text-gray-400">
                      {ts.vor42.toFixed(2)}
                    </span>
                    {/* LEC indicator */}
                    {hasLec && (
                      <span
                        className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500"
                        title="LEC data available"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {lecCount > 0 && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                Blue dot = LEC diagnostics available
              </p>
            )}
          </>
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
              — not computed at this timestep (available at ~1/3 of timesteps)
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
            <InfoRow label="Ck — Kz→Ke"     value={ts.Ck  !== undefined ? `${ts.Ck.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="Ca — APE conv."  value={ts.Ca  !== undefined ? `${ts.Ca.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="BAe — Barocl. APE gen." value={ts.BAe !== undefined ? `${ts.BAe.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="BKe — Barocl. KE gen."  value={ts.BKe !== undefined ? `${ts.BKe.toFixed(3)} W m⁻²` : "—"} />
            <InfoRow label="Ge — Eddy APE gen."     value={ts.Ge  !== undefined ? `${ts.Ge.toFixed(3)} W m⁻²` : "—"} />
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Select a timestep with the blue dot indicator to see LEC diagnostics.
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
