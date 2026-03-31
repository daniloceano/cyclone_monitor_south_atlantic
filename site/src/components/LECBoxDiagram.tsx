"use client";

import React, { useMemo, useState } from "react";
import { Timestep, PHASE_LABELS, PHASE_COLORS } from "@/types/cyclone";

interface LECBoxDiagramProps {
  timesteps: Timestep[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseKey = "all" | "incipient" | "intensification" | "mature" | "decay" | "dissipation";
type LecTermKey =
  | "Az" | "Ae" | "Kz" | "Ke"
  | "Ca" | "Ce" | "Ck" | "Cz"
  | "BAz" | "BAe" | "BKz" | "BKe"
  | "Gz" | "Ge";

interface PhaseAverages extends Record<LecTermKey, number> {
  count: number;
  /** Number of timesteps where LEC values are from the original 3-hourly computation. */
  originalCount: number;
}

const ORDERED_PHASES: Exclude<PhaseKey, "all">[] = [
  "incipient", "intensification", "mature", "decay", "dissipation",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mean(values: (number | undefined | null)[]): number {
  const valid = values.filter((x): x is number => x != null && !isNaN(x));
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function computeAverages(ts: Timestep[]): PhaseAverages | null {
  // Require all four energy reservoirs to be present for a valid LEC timestep
  const valid = ts.filter(
    (t) => t.Az != null && t.Ae != null && t.Kz != null && t.Ke != null
  );
  if (valid.length === 0) return null;

  // Count original 3-hourly timesteps.
  // Use lec_original flag when available; fall back to hour-divisible-by-3 heuristic
  // (approximation for JSON files generated before the flag was added).
  const originalCount = valid.filter((t) =>
    t.lec_original !== undefined
      ? t.lec_original
      : new Date(t.date).getUTCHours() % 3 === 0
  ).length;

  return {
    Az:  mean(valid.map((t) => t.Az)) / 1e5,
    Ae:  mean(valid.map((t) => t.Ae)) / 1e5,
    Kz:  mean(valid.map((t) => t.Kz)) / 1e5,
    Ke:  mean(valid.map((t) => t.Ke)) / 1e5,
    Ca:  mean(valid.map((t) => t.Ca)),
    Ce:  mean(valid.map((t) => t.Ce)),
    Ck:  mean(valid.map((t) => t.Ck)),
    Cz:  mean(valid.map((t) => t.Cz)),
    BAz: mean(valid.map((t) => t.BAz)),
    BAe: mean(valid.map((t) => t.BAe)),
    BKz: mean(valid.map((t) => t.BKz)),
    BKe: mean(valid.map((t) => t.BKe)),
    Gz:  mean(valid.map((t) => t.Gz)),
    Ge:  mean(valid.map((t) => t.Ge)),
    count: valid.length,
    originalCount,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * LEC Box Diagram
 *
 * Classic 4-box representation of the Lorenz Energy Cycle:
 *   Az (Zonal APE) → Ca → Ae (Eddy APE)
 *       Cz ↓                 Ce ↓
 *   Kz (Zonal KE) ← Ck ← Ke (Eddy KE)
 *
 * Lifecycle-phase tabs allow comparison across phases.
 * Table view shows all terms (including boundary fluxes) numerically per phase.
 *
 * Sign conventions follow LorenzCycleToolkit (de Souza et al., JOSS 2024):
 *   - Positive Ck = Ke→Kz (barotropic dissipation)
 *   - Negative Ck = Kz→Ke (barotropic development / cyclone growth)
 *
 * Data source: De Souza et al. (2025), Climate Dynamics.
 */
export default function LECBoxDiagram({ timesteps }: LECBoxDiagramProps) {
  const [selectedPhase, setSelectedPhase] = useState<PhaseKey>("all");
  const [viewMode, setViewMode] = useState<"diagram" | "table">("diagram");

  // Compute lifecycle averages for every phase simultaneously
  const allAverages = useMemo(() => {
    const result: Record<PhaseKey, PhaseAverages | null> = {
      all: computeAverages(timesteps),
      incipient:       computeAverages(timesteps.filter((t) => t.phase === "incipient")),
      intensification: computeAverages(timesteps.filter((t) => t.phase === "intensification")),
      mature:          computeAverages(timesteps.filter((t) => t.phase === "mature")),
      decay:           computeAverages(timesteps.filter((t) => t.phase === "decay")),
      dissipation:     computeAverages(timesteps.filter((t) => t.phase === "dissipation")),
    };
    return result;
  }, [timesteps]);

  const availablePhases = ORDERED_PHASES.filter((p) => allAverages[p] !== null);
  const currentAverages = allAverages[selectedPhase];

  if (!allAverages["all"]) {
    return (
      <div className="text-center text-gray-500 py-8 text-xs">
        No LEC energetics data available for this cyclone.
      </div>
    );
  }

  const fmt = (val: number, decimals = 2): string => {
    if (Math.abs(val) < 0.001 && decimals >= 3) return "0.000";
    if (Math.abs(val) < 0.01  && decimals >= 2) return val.toFixed(decimals);
    return val.toFixed(decimals);
  };

  return (
    <div className="flex flex-col space-y-2">
      {/* ── Phase selector tabs ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSelectedPhase("all")}
          className={`px-2 py-0.5 text-xs rounded border transition ${
            selectedPhase === "all"
              ? "bg-gray-700 text-white border-gray-700"
              : "text-gray-600 border-gray-300 hover:border-gray-400"
          }`}
        >
          All Phases
        </button>
        {availablePhases.map((phase) => (
          <button
            key={phase}
            onClick={() => setSelectedPhase(phase)}
            className={`px-2 py-0.5 text-xs rounded border transition ${
              selectedPhase === phase ? "text-white border-transparent" : "border-gray-300 hover:border-gray-400"
            }`}
            style={
              selectedPhase === phase
                ? { backgroundColor: PHASE_COLORS[phase], borderColor: PHASE_COLORS[phase] }
                : { color: PHASE_COLORS[phase] }
            }
          >
            {PHASE_LABELS[phase]}
          </button>
        ))}
      </div>

      {/* ── Diagram / Table toggle ──────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 pb-1.5">
        {(["diagram", "table"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-2 py-0.5 text-xs rounded transition capitalize ${
              viewMode === mode
                ? "bg-blue-100 text-blue-700 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {mode === "diagram" ? "Diagram" : "Table"}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {viewMode === "diagram" ? (
        currentAverages ? (
          <DiagramView
            averages={currentAverages}
            phase={selectedPhase}
            fmt={fmt}
          />
        ) : (
          <div className="text-center text-gray-400 py-4 text-xs">
            No LEC data for{" "}
            {selectedPhase === "all"
              ? "this track"
              : `"${PHASE_LABELS[selectedPhase as string]}" phase`}
            .
          </div>
        )
      ) : (
        <TableView
          allAverages={allAverages}
          availablePhases={availablePhases}
          fmt={fmt}
        />
      )}
    </div>
  );
}

// ─── Diagram view ─────────────────────────────────────────────────────────────

function DiagramView({
  averages,
  phase,
  fmt,
}: {
  averages: PhaseAverages;
  phase: PhaseKey;
  fmt: (val: number, decimals?: number) => string;
}) {
  const phaseLabel =
    phase === "all"
      ? "Lifecycle average"
      : `${PHASE_LABELS[phase as string]} phase average`;
  const interpCount = averages.count - averages.originalCount;

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-gray-500 mb-2 text-center">
        {phaseLabel} ·{" "}
        <span className="text-blue-600">{averages.originalCount} original</span>
        {" / "}
        <span className="text-blue-400">{interpCount} interp.</span>
        {" timesteps"}
      </p>

      {/* 5-column grid */}
      <div className="grid grid-cols-5 gap-2 items-center justify-items-center">
        {/* Row 1: Generation arrows */}
        <div />
        <Arrow value={averages.Gz} direction="down" label="Gz" fmt={fmt} />
        <div />
        <Arrow value={averages.Ge} direction="down" label="Ge" fmt={fmt} />
        <div />

        {/* Row 2: Az and Ae reservoirs */}
        <div />
        <EnergyBox label="Az" value={averages.Az} color="#1e40af" subtext="Zonal APE" fmt={fmt} />
        <Arrow value={averages.Ca} direction="right" label="Ca" fmt={fmt} />
        <EnergyBox label="Ae" value={averages.Ae} color="#dc2626" subtext="Eddy APE" fmt={fmt} />
        <div />

        {/* Row 3: Cz and Ce vertical arrows */}
        <div />
        <Arrow value={averages.Cz} direction="down" label="Cz" fmt={fmt} />
        <div />
        <Arrow value={averages.Ce} direction="down" label="Ce" fmt={fmt} />
        <div />

        {/* Row 4: Kz and Ke reservoirs */}
        <div />
        <EnergyBox label="Kz" value={averages.Kz} color="#3b82f6" subtext="Zonal KE" fmt={fmt} />
        <Arrow value={averages.Ck} direction="left" label="Ck" fmt={fmt} />
        <EnergyBox label="Ke" value={averages.Ke} color="#f97316" subtext="Eddy KE" fmt={fmt} />
        <div />
      </div>

      <div className="mt-3 space-y-0.5 text-xs text-gray-400 text-center">
        <p>Reservoirs: ×10⁵ J m⁻² · Conversions: W m⁻²</p>
        <p>
          <span className="text-green-600">Green</span> = positive (forward) ·{" "}
          <span className="text-red-500">Red</span> = negative (reverse)
        </p>
        <p className="text-gray-300">
          Ck positive = Ke→Kz (barotropic dissipation); negative = Kz→Ke (cyclone growth)
        </p>
        <p className="text-gray-300">
          Boundary fluxes (BAz, BAe, BKz, BKe) and generation (Gz, Ge) visible in Table view
        </p>
      </div>
    </div>
  );
}

// ── Arrow ──────────────────────────────────────────────────────────────────────

function Arrow({
  value,
  direction,
  label,
  fmt,
}: {
  value: number;
  direction: "right" | "down" | "left" | "up";
  label: string;
  fmt: (val: number, decimals?: number) => string;
}) {
  const isPositive = value >= 0;
  const thickness = Math.min(3, Math.max(1, Math.abs(value) / 2));
  const color = isPositive ? "#16a34a" : "#dc2626";
  const symbols: Record<string, string> = {
    right: isPositive ? "→" : "←",
    left:  isPositive ? "←" : "→",
    down:  isPositive ? "↓" : "↑",
    up:    isPositive ? "↑" : "↓",
  };
  return (
    <div className="flex flex-col items-center justify-center text-xs">
      <span className="font-medium text-gray-600">{label}</span>
      <span style={{ color, fontWeight: "bold", fontSize: `${12 + thickness * 2}px` }}>
        {symbols[direction]}
      </span>
      <span style={{ color }}>{fmt(Math.abs(value))}</span>
    </div>
  );
}

// ── Energy reservoir box ───────────────────────────────────────────────────────

function EnergyBox({
  label,
  value,
  color,
  subtext,
  fmt,
}: {
  label: string;
  value: number;
  color: string;
  subtext: string;
  fmt: (val: number, decimals?: number) => string;
}) {
  return (
    <div
      className="w-20 h-20 rounded-lg flex flex-col items-center justify-center border-2"
      style={{ borderColor: color, backgroundColor: `${color}15` }}
    >
      <span className="text-xs text-gray-500">{subtext}</span>
      <span className="font-bold text-lg" style={{ color }}>
        {label}
      </span>
      <span className="text-xs font-medium">{fmt(value)}</span>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

const TABLE_GROUPS: { header: string; terms: { key: LecTermKey; label: string; desc: string }[] }[] = [
  {
    header: "Energy Reservoirs (×10⁵ J m⁻²)",
    terms: [
      { key: "Az",  label: "Az",  desc: "Zonal APE" },
      { key: "Ae",  label: "Ae",  desc: "Eddy APE"  },
      { key: "Kz",  label: "Kz",  desc: "Zonal KE"  },
      { key: "Ke",  label: "Ke",  desc: "Eddy KE"   },
    ],
  },
  {
    header: "Conversions (W m⁻²)",
    terms: [
      { key: "Ca",  label: "Ca",  desc: "Az→Ae (baroclinic)"     },
      { key: "Ce",  label: "Ce",  desc: "Ae→Ke (eddy growth)"    },
      { key: "Ck",  label: "Ck",  desc: "Ke→Kz (+) / Kz→Ke (−)" },
      { key: "Cz",  label: "Cz",  desc: "Az→Kz"                  },
    ],
  },
  {
    header: "Boundary Fluxes (W m⁻²)",
    terms: [
      { key: "BAz", label: "BAz", desc: "Az flux through boundary" },
      { key: "BAe", label: "BAe", desc: "Ae flux through boundary" },
      { key: "BKz", label: "BKz", desc: "Kz flux through boundary" },
      { key: "BKe", label: "BKe", desc: "Ke flux through boundary" },
    ],
  },
  {
    header: "Generation (W m⁻²)",
    terms: [
      { key: "Gz",  label: "Gz",  desc: "Zonal APE generation" },
      { key: "Ge",  label: "Ge",  desc: "Eddy APE generation"  },
    ],
  },
];

const PHASE_COL_LABELS: Record<PhaseKey, string> = {
  all:             "All",
  incipient:       "Incip.",
  intensification: "Intens.",
  mature:          "Mature",
  decay:           "Decay",
  dissipation:     "Dissip.",
};

function TableView({
  allAverages,
  availablePhases,
  fmt,
}: {
  allAverages: Record<PhaseKey, PhaseAverages | null>;
  availablePhases: Exclude<PhaseKey, "all">[];
  fmt: (val: number, decimals?: number) => string;
}) {
  const cols: PhaseKey[] = ["all", ...availablePhases];

  const cell = (avg: PhaseAverages | null, key: LecTermKey): string => {
    if (!avg) return "—";
    const v = avg[key];
    return fmt(v, 2);
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1 pr-1 text-gray-500 font-medium whitespace-nowrap">Term</th>
            <th className="text-left py-1 pr-2 text-gray-400 font-normal hidden sm:table-cell">Meaning</th>
            {cols.map((p) => (
              <th
                key={p}
                className="text-right py-1 px-1.5 text-gray-600 font-medium min-w-[46px]"
                style={p !== "all" ? { color: PHASE_COLORS[p] } : undefined}
              >
                {PHASE_COL_LABELS[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_GROUPS.map((group) => (
            <React.Fragment key={group.header}>
              <tr>
                <td
                  colSpan={2 + cols.length}
                  className="pt-2 pb-0.5 text-xs text-gray-400 font-semibold uppercase tracking-wide"
                >
                  {group.header}
                </td>
              </tr>
              {group.terms.map((term) => (
                <tr key={term.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-0.5 pr-1 font-mono font-medium text-gray-700">{term.label}</td>
                  <td className="py-0.5 pr-2 text-gray-400 whitespace-nowrap hidden sm:table-cell">
                    {term.desc}
                  </td>
                  {cols.map((p) => {
                    const avg = allAverages[p];
                    const numVal = avg ? avg[term.key] : null;
                    return (
                      <td
                        key={p}
                        className={`py-0.5 px-1.5 text-right font-mono ${
                          numVal !== null && numVal < 0 ? "text-red-600" : "text-gray-700"
                        }`}
                      >
                        {cell(avg, term.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}

          {/* Row counts */}
          <tr className="border-t border-gray-300 text-gray-400">
            <td className="pt-1 pr-1 font-medium" colSpan={2}>n</td>
            {cols.map((p) => (
              <td key={p} className="pt-1 px-1.5 text-right">
                {allAverages[p]?.count ?? "—"}
              </td>
            ))}
          </tr>
          <tr className="text-gray-400">
            <td
              className="pb-1 pr-1"
              colSpan={2}
              title="Timesteps with original (3-hourly) LEC values"
            >
              original
            </td>
            {cols.map((p) => (
              <td key={p} className="pb-1 px-1.5 text-right text-blue-500">
                {allAverages[p]?.originalCount ?? "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400 leading-tight">
        Positive values = forward direction. Negative = reverse. Ck: positive = Ke→Kz, negative = Kz→Ke.
        Blue = original 3-hourly timesteps used in averages.
      </p>
    </div>
  );
}
