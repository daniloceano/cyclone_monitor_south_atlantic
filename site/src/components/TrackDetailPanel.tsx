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
  quantileThresholds: _qt, // available for future use
}: TrackDetailPanelProps) {
  const trackIdStr = String(track.id);

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t border-slate-700/60">
      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <div>
          <h2 className="text-xs font-semibold text-orange-400 uppercase tracking-wide">
            Selected Track
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">#{trackIdStr}</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 transition px-1.5 py-0.5 rounded hover:bg-slate-800"
          title="Clear selection"
        >
          ✕ Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-3">
        {/* ── Track summary ────────────────────────────────────────────── */}
        <div className="bg-slate-800/50 rounded-lg p-2.5 space-y-1.5">
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

        {/* ── Intensity ───────────────────────────────────────────────── */}
        <div className="bg-slate-800/50 rounded-lg p-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-300 mb-1">Intensity (vor42)</p>
          <InfoRow label="Peak intensity" value={formatVor42(track.max_vor42)} />
          <InfoRow
            label="Intensity rank"
            value={track.quantile}
            highlight={track.quantile === "top 5%" || track.quantile === "top 10%"}
          />
          <p className="text-xs text-slate-600 mt-1 leading-tight">
            vor42 = 400 hPa relative vorticity. Ranked against all 6 789 tracks in dataset.
          </p>
        </div>

        {/* ── Phase legend ─────────────────────────────────────────────── */}
        <div className="bg-slate-800/50 rounded-lg p-2.5">
          <p className="text-xs font-semibold text-slate-300 mb-1.5">Phase colours</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: PHASE_COLORS[key] }}
                />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Loading / error / timestep list ─────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
            <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading timesteps…
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-2 py-1.5">
            {error}
          </p>
        )}

        {timesteps && !loading && (
          <>
            <p className="text-xs text-slate-500">
              {timesteps.length} timesteps · click a map marker or a row below to inspect
            </p>
            <div className="space-y-0.5">
              {timesteps.map((ts, i) => {
                const isSelected =
                  selectedTimestep?.date === ts.date &&
                  selectedTimestep?.lon === ts.lon;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      onTimestepSelect(isSelected ? null : ts)
                    }
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition ${
                      isSelected
                        ? "bg-orange-600/30 text-orange-200"
                        : "hover:bg-slate-800 text-slate-400"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PHASE_COLORS[ts.phase] }}
                    />
                    <span className="font-mono flex-1 truncate">
                      {ts.date.replace("T", " ").slice(0, 16)}
                    </span>
                    <span className="flex-shrink-0 text-slate-500">
                      {ts.vor42.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
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
    ts.Kz !== undefined ||
    ts.Ke !== undefined ||
    ts.Ck !== undefined ||
    ts.Ca !== undefined ||
    ts.BAe !== undefined ||
    ts.BKe !== undefined ||
    ts.Ge !== undefined;

  return (
    <div className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-2.5 space-y-1.5">
      <p className="text-xs font-semibold text-orange-300 mb-1">
        Timestep detail
      </p>
      <InfoRow label="Date / time" value={formatDatetime(ts.date)} />
      <InfoRow label="Position" value={`${formatLat(ts.lat)}, ${formatLon(ts.lon)}`} />
      <InfoRow label="Phase" value={PHASE_LABELS[ts.phase] ?? ts.phase} highlight />
      <InfoRow label="vor42" value={formatVor42(ts.vor42)} />

      {hasEnergetics && (
        <>
          <p className="text-xs font-semibold text-slate-400 mt-2 pt-1 border-t border-slate-700/40">
            Lorenz Energy Cycle
          </p>
          {ts.Kz  !== undefined && <InfoRow label="Kz"  value={`${ts.Kz.toFixed(0)} J m⁻²`} />}
          {ts.Ke  !== undefined && <InfoRow label="Ke"  value={`${ts.Ke.toFixed(0)} J m⁻²`} />}
          {ts.Ck  !== undefined && <InfoRow label="Ck"  value={`${ts.Ck.toFixed(3)} W m⁻²`} />}
          {ts.Ca  !== undefined && <InfoRow label="Ca"  value={`${ts.Ca.toFixed(3)} W m⁻²`} />}
          {ts.BAe !== undefined && <InfoRow label="BAe" value={`${ts.BAe.toFixed(3)} W m⁻²`} />}
          {ts.BKe !== undefined && <InfoRow label="BKe" value={`${ts.BKe.toFixed(3)} W m⁻²`} />}
          {ts.Ge  !== undefined && <InfoRow label="Ge"  value={`${ts.Ge.toFixed(3)} W m⁻²`} />}
        </>
      )}

      {!hasEnergetics && (
        <p className="text-xs text-slate-600 italic">
          LEC diagnostics not available at this timestep.
        </p>
      )}
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
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-right font-medium leading-tight ${
          highlight ? "text-blue-300" : "text-slate-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
