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
 * Four-box representation of the Lorenz Energy Cycle showing energy tendencies:
 *
 *        Gz (≈RGz)               (RKz)
 *            ↓                     
 *   BAz → [∂Az/∂t]  — Cz →  [∂Kz/∂t] ← BKz
 *             ↓ Ca              ↑ Ck
 *   BAe → [∂Ae/∂t]  — Ce →  [∂Ke/∂t] ← BKe
 *            ↑                     
 *        Ge (≈RGe)               (RKe)
 *
 * Diagram geometry follows the reference figure provided for positive flow directions.
 * All arrow directions represent the POSITIVE sense of each flux.
 *
 * Flow conventions (positive direction):
 *   - Cz: ∂Az/∂t → ∂Kz/∂t (horizontal, right)
 *   - Ca: ∂Az/∂t → ∂Ae/∂t (vertical, down)
 *   - Ce: ∂Ae/∂t → ∂Ke/∂t (horizontal, right)
 *   - Ck: ∂Ke/∂t → ∂Kz/∂t (vertical, up)
 *
 * Boundary fluxes (positive = entering the reservoir):
 *   - BAz: entering ∂Az/∂t from left
 *   - BAe: entering ∂Ae/∂t from left
 *   - BKz: entering ∂Kz/∂t from right
 *   - BKe: entering ∂Ke/∂t from right
 *
 * Generation/Residual terms:
 *   - Gz (≈RGz): entering ∂Az/∂t from top
 *   - Ge (≈RGe): entering ∂Ae/∂t from bottom
 *   - RKz, RKe: placeholders (data not available)
 *
 * Color semantics:
 *   - Purple: baroclinic chain (Ca, Ce)
 *   - Green: barotropic conversion (Ck)
 *   - Red: latent heat release / zonal generation (Cz, Gz, Ge)
 *   - Gray: boundary fluxes and residuals
 *
 * Sign conventions follow LorenzCycleToolkit (de Souza et al., JOSS 2024).
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

/**
 * Semantic colors for LEC diagram following reference figure convention:
 * - Purple (#9333ea): Baroclinic chain (Ca, Ce) - eddy growth pathway
 * - Green (#16a34a): Barotropic conversion (Ck) - zonal/eddy KE exchange
 * - Red (#dc2626): Latent heat / zonal generation (Cz, Gz, Ge)
 * - Gray (#6b7280): Boundary fluxes and residuals
 */
const LEC_COLORS = {
  baroclinic: "#9333ea",  // Purple: Ca, Ce
  barotropic: "#16a34a",  // Green: Ck
  latentHeat: "#dc2626",  // Red: Cz, Gz, Ge
  boundary: "#6b7280",    // Gray: BAz, BAe, BKz, BKe
};

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

      {/*
        LEC Box Diagram Layout (following reference figure):
        
        Layout uses a 5-column × 5-row grid:
        
               Col0       Col1         Col2         Col3       Col4
        Row0:            Gz↓                       (RKz)       
        Row1:  BAz→    [∂Az/∂t]  ——Cz→→    [∂Kz/∂t]      ←BKz
        Row2:             ↓Ca               ↑Ck            
        Row3:  BAe→    [∂Ae/∂t]  ——Ce→→    [∂Ke/∂t]      ←BKe
        Row4:            Ge↑                       (RKe)
        
        Arrow directions shown are for POSITIVE values.
        When value is negative, arrow direction reverses.
        
        Note: RKz and RKe are placeholders (data not available).
      */}
      <div className="grid grid-cols-5 gap-1 items-center justify-items-center"
           style={{ gridTemplateRows: "auto auto auto auto auto" }}>
        
        {/* ═══ Row 0: Generation terms entering from top ═══ */}
        <div />
        <FluxArrow
          value={averages.Gz}
          positiveDirection="down"
          label="Gz"
          semanticColor={LEC_COLORS.latentHeat}
          fmt={fmt}
          tooltip="Zonal APE generation (entering ∂Az/∂t from top)"
        />
        <div />
        {/* RKz placeholder - data not available */}
        <div className="text-[9px] text-gray-300 h-9 flex items-center">(RKz)</div>
        <div />

        {/* ═══ Row 1: ∂Az/∂t and ∂Kz/∂t reservoirs with boundary fluxes ═══ */}
        <FluxArrow
          value={averages.BAz}
          positiveDirection="right"
          label="BAz"
          semanticColor={LEC_COLORS.boundary}
          fmt={fmt}
          tooltip="Az boundary flux (entering ∂Az/∂t from left)"
        />
        <TendencyBox
          label="∂Az/∂t"
          value={averages.Az}
          color="#1e40af"
          subtext="Zonal APE"
          fmt={fmt}
        />
        <FluxArrow
          value={averages.Cz}
          positiveDirection="right"
          label="Cz"
          semanticColor={LEC_COLORS.latentHeat}
          fmt={fmt}
          tooltip="Cz: ∂Az/∂t → ∂Kz/∂t (positive = rightward)"
        />
        <TendencyBox
          label="∂Kz/∂t"
          value={averages.Kz}
          color="#3b82f6"
          subtext="Zonal KE"
          fmt={fmt}
        />
        <FluxArrow
          value={averages.BKz}
          positiveDirection="left"
          label="BKz"
          semanticColor={LEC_COLORS.boundary}
          fmt={fmt}
          tooltip="Kz boundary flux (entering ∂Kz/∂t from right)"
        />

        {/* ═══ Row 2: Vertical conversions Ca and Ck ═══ */}
        <div />
        <FluxArrow
          value={averages.Ca}
          positiveDirection="down"
          label="Ca"
          semanticColor={LEC_COLORS.baroclinic}
          fmt={fmt}
          tooltip="Ca: ∂Az/∂t → ∂Ae/∂t (positive = downward, baroclinic)"
        />
        <div />
        <FluxArrow
          value={averages.Ck}
          positiveDirection="up"
          label="Ck"
          semanticColor={LEC_COLORS.barotropic}
          fmt={fmt}
          tooltip="Ck: ∂Ke/∂t → ∂Kz/∂t (positive = upward, barotropic)"
        />
        <div />

        {/* ═══ Row 3: ∂Ae/∂t and ∂Ke/∂t reservoirs with boundary fluxes ═══ */}
        <FluxArrow
          value={averages.BAe}
          positiveDirection="right"
          label="BAe"
          semanticColor={LEC_COLORS.boundary}
          fmt={fmt}
          tooltip="Ae boundary flux (entering ∂Ae/∂t from left)"
        />
        <TendencyBox
          label="∂Ae/∂t"
          value={averages.Ae}
          color="#dc2626"
          subtext="Eddy APE"
          fmt={fmt}
        />
        <FluxArrow
          value={averages.Ce}
          positiveDirection="right"
          label="Ce"
          semanticColor={LEC_COLORS.baroclinic}
          fmt={fmt}
          tooltip="Ce: ∂Ae/∂t → ∂Ke/∂t (positive = rightward, baroclinic)"
        />
        <TendencyBox
          label="∂Ke/∂t"
          value={averages.Ke}
          color="#f97316"
          subtext="Eddy KE"
          fmt={fmt}
        />
        <FluxArrow
          value={averages.BKe}
          positiveDirection="left"
          label="BKe"
          semanticColor={LEC_COLORS.boundary}
          fmt={fmt}
          tooltip="Ke boundary flux (entering ∂Ke/∂t from right)"
        />

        {/* ═══ Row 4: Generation terms entering from bottom ═══ */}
        <div />
        <FluxArrow
          value={averages.Ge}
          positiveDirection="up"
          label="Ge"
          semanticColor={LEC_COLORS.latentHeat}
          fmt={fmt}
          tooltip="Eddy APE generation (entering ∂Ae/∂t from bottom)"
        />
        <div />
        {/* RKe placeholder - data not available */}
        <div className="text-[9px] text-gray-300 h-9 flex items-center">(RKe)</div>
        <div />
      </div>

      {/* ═══ Legend ═══ */}
      <div className="mt-4 space-y-1 text-xs text-gray-500 text-center">
        <p className="font-medium">Arrows show positive flux direction</p>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
          <span>
            <span style={{ color: LEC_COLORS.baroclinic }}>●</span> Baroclinic (Ca, Ce)
          </span>
          <span>
            <span style={{ color: LEC_COLORS.barotropic }}>●</span> Barotropic (Ck)
          </span>
          <span>
            <span style={{ color: LEC_COLORS.latentHeat }}>●</span> Generation (Cz, Gz, Ge)
          </span>
          <span>
            <span style={{ color: LEC_COLORS.boundary }}>●</span> Boundary (BA*, BK*)
          </span>
        </div>
        <p className="text-gray-400">
          Reservoirs: ×10⁵ J m⁻² · Fluxes: W m⁻²
        </p>
      </div>
    </div>
  );
}

// ── Flux Arrow ─────────────────────────────────────────────────────────────────

/**
 * Arrow component for LEC fluxes.
 *
 * The `positiveDirection` parameter defines which direction the arrow points
 * when the flux value is positive. When the value is negative, the arrow
 * reverses direction to indicate flow in the opposite sense.
 *
 * Color intensity scales with magnitude for visual emphasis.
 */
function FluxArrow({
  value,
  positiveDirection,
  label,
  semanticColor,
  fmt,
  tooltip,
}: {
  value: number;
  positiveDirection: "right" | "down" | "left" | "up";
  label: string;
  semanticColor: string;
  fmt: (val: number, decimals?: number) => string;
  tooltip?: string;
}) {
  const isPositive = value >= 0;
  const magnitude = Math.abs(value);
  
  // Scale arrow size based on magnitude (1-4 range)
  const thickness = Math.min(4, Math.max(1, magnitude / 1.5));
  
  // Determine actual arrow direction based on sign
  const oppositeDir: Record<string, string> = {
    right: "left",
    left: "right",
    up: "down",
    down: "up",
  };
  const actualDirection = isPositive ? positiveDirection : oppositeDir[positiveDirection];
  
  // Arrow symbols
  const symbols: Record<string, string> = {
    right: "→",
    left: "←",
    down: "↓",
    up: "↑",
  };
  
  // Dim color when value is very small
  const opacity = magnitude < 0.1 ? 0.4 : magnitude < 0.5 ? 0.7 : 1;
  const displayColor = semanticColor;
  
  const isVertical = actualDirection === "up" || actualDirection === "down";
  
  return (
    <div
      className={`flex ${isVertical ? "flex-col" : "flex-row"} items-center justify-center text-xs gap-0.5`}
      title={tooltip}
      style={{ minWidth: isVertical ? "auto" : "40px", minHeight: isVertical ? "36px" : "auto" }}
    >
      <span className="font-medium text-gray-600 text-[10px]">{label}</span>
      <span
        style={{
          color: displayColor,
          fontWeight: "bold",
          fontSize: `${10 + thickness * 2}px`,
          opacity,
        }}
      >
        {symbols[actualDirection]}
      </span>
      <span style={{ color: displayColor, opacity }} className="text-[10px]">
        {fmt(magnitude)}
      </span>
    </div>
  );
}

// ── Tendency Box (Energy Reservoir) ────────────────────────────────────────────

/**
 * Box representing an energy tendency term (∂E/∂t).
 * Shows the reservoir label, type description, and current value.
 */
function TendencyBox({
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
      className="w-16 h-16 rounded-lg flex flex-col items-center justify-center border-2"
      style={{ borderColor: color, backgroundColor: `${color}15` }}
    >
      <span className="text-[9px] text-gray-500 leading-tight">{subtext}</span>
      <span className="font-bold text-sm leading-tight" style={{ color }}>
        {label}
      </span>
      <span className="text-[10px] font-medium leading-tight">{fmt(value)}</span>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

const TABLE_GROUPS: { header: string; terms: { key: LecTermKey; label: string; desc: string }[] }[] = [
  {
    header: "Energy Tendencies (×10⁵ J m⁻²)",
    terms: [
      { key: "Az",  label: "∂Az/∂t",  desc: "Zonal APE tendency" },
      { key: "Ae",  label: "∂Ae/∂t",  desc: "Eddy APE tendency"  },
      { key: "Kz",  label: "∂Kz/∂t",  desc: "Zonal KE tendency"  },
      { key: "Ke",  label: "∂Ke/∂t",  desc: "Eddy KE tendency"   },
    ],
  },
  {
    header: "Conversions (W m⁻²)",
    terms: [
      { key: "Cz",  label: "Cz",  desc: "∂Az/∂t → ∂Kz/∂t"                  },
      { key: "Ca",  label: "Ca",  desc: "∂Az/∂t → ∂Ae/∂t (baroclinic)"     },
      { key: "Ce",  label: "Ce",  desc: "∂Ae/∂t → ∂Ke/∂t (baroclinic)"    },
      { key: "Ck",  label: "Ck",  desc: "∂Ke/∂t → ∂Kz/∂t (barotropic)" },
    ],
  },
  {
    header: "Boundary Fluxes (W m⁻²)",
    terms: [
      { key: "BAz", label: "BAz", desc: "Entering ∂Az/∂t from left" },
      { key: "BAe", label: "BAe", desc: "Entering ∂Ae/∂t from left" },
      { key: "BKz", label: "BKz", desc: "Entering ∂Kz/∂t from right" },
      { key: "BKe", label: "BKe", desc: "Entering ∂Ke/∂t from right" },
    ],
  },
  {
    header: "Generation (W m⁻²)",
    terms: [
      { key: "Gz",  label: "Gz",  desc: "Entering ∂Az/∂t from top" },
      { key: "Ge",  label: "Ge",  desc: "Entering ∂Ae/∂t from bottom"  },
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
        Positive values = flux in arrow direction (see Diagram). Negative = reverse direction.
        Blue = original 3-hourly timesteps used in averages.
      </p>
    </div>
  );
}
