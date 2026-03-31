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
      <p className="text-xs text-gray-500 mb-3 text-center">
        {phaseLabel} ·{" "}
        <span className="text-blue-600">{averages.originalCount} original</span>
        {" / "}
        <span className="text-blue-400">{interpCount} interp.</span>
        {" timesteps"}
      </p>

      {/*
        LEC Box Diagram Layout (following reference figure style):
        
        Clean layout with boxes and external flux labels:
        
                     Gz                          (RKz)
                     ↓                             
           BAz   [∂Az/∂t]  ——Cz——→  [∂Kz/∂t]   BKz
                     |                  ↑
                    Ca                 Ck
                     ↓                  |
           BAe   [∂Ae/∂t]  ——Ce——→  [∂Ke/∂t]   BKe
                     ↑                             
                     Ge                          (RKe)
        
        Boundary terms (BAz, BKz, etc.) shown as simple labels with values below.
      */}
      
      {/*
        LEC Box Diagram - CSS Grid layout for perfect alignment
        
        Grid structure (5 columns × 7 rows):
        
           Col0      Col1       Col2      Col3       Col4
        ──────────────────────────────────────────────────
        R0:         Gz                   RKz          
        R1:         ↓                                  
        R2: BAz→  [∂Az/∂t]    Cz→     [∂Kz/∂t]    ←BKz
        R3:         Ca↓                  Ck↑          
        R4: BAe→  [∂Ae/∂t]    Ce→     [∂Ke/∂t]    ←BKe
        R5:         ↑                                  
        R6:         Ge                   RKe          
      */}
      <div 
        className="grid items-center justify-items-center text-center"
        style={{ 
          gridTemplateColumns: "50px 70px 50px 70px 50px",
          gridTemplateRows: "auto auto auto auto auto auto auto",
          gap: "2px 4px"
        }}
      >
        {/* ═══ Row 0: Top generation terms (Gz, RKz) ═══ */}
        <div />
        <ExternalTerm label="Gz" value={averages.Gz} color={LEC_COLORS.latentHeat} fmt={fmt} />
        <div />
        <ExternalTerm label="RKz" value={null} color={LEC_COLORS.boundary} fmt={fmt} />
        <div />

        {/* ═══ Row 1: Arrows from Gz ═══ */}
        <div />
        <div className="text-base" style={{ color: LEC_COLORS.latentHeat }}>↓</div>
        <div />
        <div />
        <div />

        {/* ═══ Row 2: ∂Az/∂t and ∂Kz/∂t with boundary fluxes ═══ */}
        <ExternalTerm label="BAz" value={averages.BAz} color={LEC_COLORS.boundary} fmt={fmt} arrow="→" />
        <TendencyBox label="∂Az/∂t" value={averages.Az} color="#1e40af" subtext="Zonal APE" fmt={fmt} />
        <ConversionArrow label="Cz" value={averages.Cz} color={LEC_COLORS.latentHeat} fmt={fmt} direction="horizontal" />
        <TendencyBox label="∂Kz/∂t" value={averages.Kz} color="#3b82f6" subtext="Zonal KE" fmt={fmt} />
        <ExternalTerm label="BKz" value={averages.BKz} color={LEC_COLORS.boundary} fmt={fmt} arrow="←" />

        {/* ═══ Row 3: Vertical conversions Ca and Ck ═══ */}
        <div />
        <ConversionArrow label="Ca" value={averages.Ca} color={LEC_COLORS.baroclinic} fmt={fmt} direction="vertical-down" />
        <div />
        <ConversionArrow label="Ck" value={averages.Ck} color={LEC_COLORS.barotropic} fmt={fmt} direction="vertical-up" />
        <div />

        {/* ═══ Row 4: ∂Ae/∂t and ∂Ke/∂t with boundary fluxes ═══ */}
        <ExternalTerm label="BAe" value={averages.BAe} color={LEC_COLORS.boundary} fmt={fmt} arrow="→" />
        <TendencyBox label="∂Ae/∂t" value={averages.Ae} color="#dc2626" subtext="Eddy APE" fmt={fmt} />
        <ConversionArrow label="Ce" value={averages.Ce} color={LEC_COLORS.baroclinic} fmt={fmt} direction="horizontal" />
        <TendencyBox label="∂Ke/∂t" value={averages.Ke} color="#f97316" subtext="Eddy KE" fmt={fmt} />
        <ExternalTerm label="BKe" value={averages.BKe} color={LEC_COLORS.boundary} fmt={fmt} arrow="←" />

        {/* ═══ Row 5: Arrows to Ge ═══ */}
        <div />
        <div className="text-base" style={{ color: LEC_COLORS.latentHeat }}>↑</div>
        <div />
        <div />
        <div />

        {/* ═══ Row 6: Bottom generation terms (Ge, RKe) ═══ */}
        <div />
        <ExternalTerm label="Ge" value={averages.Ge} color={LEC_COLORS.latentHeat} fmt={fmt} />
        <div />
        <ExternalTerm label="RKe" value={null} color={LEC_COLORS.boundary} fmt={fmt} />
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

// ── External Term (boundary flux / generation) ─────────────────────────────────

/**
 * External flux term shown as a simple label with value below.
 * Used for boundary fluxes (BAz, BAe, BKz, BKe) and generation terms (Gz, Ge).
 * 
 * ADJUSTMENT GUIDE: This component fills its grid cell. Adjust the parent grid
 * column widths in DiagramView (gridTemplateColumns) to change sizing.
 */
function ExternalTerm({
  label,
  value,
  color,
  fmt,
  arrow,
}: {
  label: string;
  value: number | null;
  color: string;
  fmt: (val: number, decimals?: number) => string;
  arrow?: "→" | "←";
}) {
  const isPlaceholder = value === null;
  
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-0.5">
        {arrow && !isPlaceholder && (
          <span style={{ color }} className="text-sm font-bold">{arrow}</span>
        )}
        <span 
          className="text-[10px] font-semibold"
          style={{ color: isPlaceholder ? "#d1d5db" : color }}
        >
          {label}
        </span>
      </div>
      <span 
        className="text-[10px]"
        style={{ color: isPlaceholder ? "#d1d5db" : color }}
      >
        {isPlaceholder ? "(n/a)" : fmt(value)}
      </span>
    </div>
  );
}

// ── Conversion Arrow ───────────────────────────────────────────────────────────

/**
 * Arrow component for conversion terms (Cz, Ca, Ce, Ck).
 * Shows label, arrow, and value in a compact format.
 * 
 * ADJUSTMENT GUIDE: This component fills its grid cell. Adjust the parent grid
 * column widths in DiagramView (gridTemplateColumns) to change sizing.
 */
function ConversionArrow({
  label,
  value,
  color,
  fmt,
  direction,
}: {
  label: string;
  value: number;
  color: string;
  fmt: (val: number, decimals?: number) => string;
  direction: "horizontal" | "vertical-down" | "vertical-up";
}) {
  const isPositive = value >= 0;
  
  // Determine arrow symbol based on direction and sign
  const getArrow = () => {
    if (direction === "horizontal") {
      return isPositive ? "→" : "←";
    } else if (direction === "vertical-down") {
      return isPositive ? "↓" : "↑";
    } else {
      return isPositive ? "↑" : "↓";
    }
  };
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
      <span className="text-base font-bold" style={{ color }}>{getArrow()}</span>
      <span className="text-[10px]" style={{ color }}>{fmt(Math.abs(value))}</span>
    </div>
  );
}

// ── Tendency Box (Energy Reservoir) ────────────────────────────────────────────

/**
 * Box representing an energy tendency term (∂E/∂t).
 * Shows the reservoir label, type description, and current value.
 * 
 * ADJUSTMENT GUIDE: Box size is fixed at 64x64px (w-16 h-16). Adjust here if needed.
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
