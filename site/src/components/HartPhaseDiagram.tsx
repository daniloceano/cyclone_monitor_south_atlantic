"use client";

/**
 * HartPhaseDiagram — Cyclone Phase Space trajectory (Hart 2003).
 *
 * Two stacked panels, following the convention of the original paper:
 *
 *   Panel A   B  (y)  vs  V_T^L (x)   — is the system frontal, and is its lower
 *                                        troposphere warm- or cold-core?
 *   Panel B   V_T^U (y) vs V_T^L (x)  — is the warm core shallow or deep?
 *
 * Sign convention of this dataset (see data/README.md): VTL and VTU are already
 * oriented so that POSITIVE means warm core, matching Hart's -V_T. B is the
 * storm-motion-relative 900–600 hPa thickness asymmetry in metres; large
 * positive values indicate a frontal structure.
 *
 * The classification bands drawn behind the trajectory are the thresholds used
 * to label this dataset (de Souza et al. 2026, after Wood et al. 2023 for
 * extratropical/tropical and Gozzo et al. 2014 for subtropical):
 *
 *     extratropical   B > 10,  VTL < 0,  VTU < 0
 *     subtropical     -25 < B < 25,  VTL > -50,  VTU < -10
 *     tropical        B < 10,  VTL > 0,  VTU > 0
 *
 * The trajectory is coloured by the per-timestep class and runs genesis → lysis.
 * Open markers are interpolated timesteps; filled markers are computed ones
 * (cps_original), so it is always visible which points the classifier actually
 * saw.
 */

import React, { useMemo } from "react";
import { Timestep, CPS_CLASS_COLORS } from "@/types/cyclone";

// ─── Geometry ─────────────────────────────────────────────────────────────────
const W = 300;
const PANEL_H = 128;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 24;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = PANEL_H - PAD_T - PAD_B;

interface HartPhaseDiagramProps {
  timesteps: Timestep[];
  selectedTimestep?: Timestep | null;
  onTimestepSelect?: (ts: Timestep) => void;
}

interface Pt {
  ts: Timestep;
  b: number;
  vtl: number;
  vtu: number;
  original: boolean;
  idx: number;
}

export default function HartPhaseDiagram({
  timesteps,
  selectedTimestep,
  onTimestepSelect,
}: HartPhaseDiagramProps) {
  const pts: Pt[] = useMemo(
    () =>
      timesteps
        .map((ts, idx) => ({ ts, idx }))
        .filter(
          ({ ts }) =>
            ts.cps_B !== undefined &&
            ts.cps_VTL !== undefined &&
            ts.cps_VTU !== undefined
        )
        .map(({ ts, idx }) => ({
          ts,
          idx,
          b: ts.cps_B as number,
          vtl: ts.cps_VTL as number,
          vtu: ts.cps_VTU as number,
          original: ts.cps_original === true,
        })),
    [timesteps]
  );

  if (pts.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-3 text-center">
        No Cyclone Phase Space data for this cyclone.
      </p>
    );
  }

  // Shared x domain (VTL) across both panels so they read as one trajectory
  const vtlDomain = padDomain(pts.map((p) => p.vtl), [-60, 60]);
  const bDomain = padDomain(pts.map((p) => p.b), [-30, 60]);
  const vtuDomain = padDomain(pts.map((p) => p.vtu), [-60, 30]);

  const selIdx = selectedTimestep
    ? pts.findIndex((p) => p.ts.date === selectedTimestep.date)
    : -1;

  return (
    <div className="space-y-2">
      <Panel
        title="B vs V<sub>T</sub><sup>L</sup>"
        xLabel="V_T^L  (lower thermal wind)"
        yLabel="B (m)"
        xDomain={vtlDomain}
        yDomain={bDomain}
        pts={pts}
        xOfPt={(p) => p.vtl}
        yOfPt={(p) => p.b}
        selIdx={selIdx}
        onSelect={onTimestepSelect}
        bands={[
          // B > 10 with cold core → frontal / extratropical half-plane
          { y1: 10, y2: bDomain[1], x1: vtlDomain[0], x2: 0, color: "#2563eb", label: "EC" },
          // |B| < 25 and VTL > -50 → hybrid band
          { y1: -25, y2: 25, x1: Math.max(-50, vtlDomain[0]), x2: vtlDomain[1], color: "#c026d3", label: "SC" },
          // B < 10 with warm core → tropical
          { y1: bDomain[0], y2: 10, x1: 0, x2: vtlDomain[1], color: "#dc2626", label: "TC" },
        ]}
        guides={{ x: [0], y: [0, 10, -25, 25] }}
      />

      <Panel
        title="V<sub>T</sub><sup>U</sup> vs V<sub>T</sub><sup>L</sup>"
        xLabel="V_T^L  (lower thermal wind)"
        yLabel="V_T^U"
        xDomain={vtlDomain}
        yDomain={vtuDomain}
        pts={pts}
        xOfPt={(p) => p.vtl}
        yOfPt={(p) => p.vtu}
        selIdx={selIdx}
        onSelect={onTimestepSelect}
        bands={[
          // deep warm core → tropical
          { y1: 0, y2: vtuDomain[1], x1: 0, x2: vtlDomain[1], color: "#dc2626", label: "TC" },
          // shallow warm core → subtropical
          { y1: vtuDomain[0], y2: -10, x1: Math.max(-50, vtlDomain[0]), x2: vtlDomain[1], color: "#c026d3", label: "SC" },
          // cold core throughout → extratropical
          { y1: vtuDomain[0], y2: 0, x1: vtlDomain[0], x2: 0, color: "#2563eb", label: "EC" },
        ]}
        guides={{ x: [0], y: [0, -10] }}
      />

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-gray-600">
        {(["extratropical", "subtropical", "tropical", "unclassified"] as const).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: CPS_CLASS_COLORS[c] }}
            />
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-[9px] text-gray-400">
        <span>● computed (3-hourly)</span>
        <span>○ interpolated</span>
        <span>▲ genesis</span>
        <span>■ lysis</span>
      </div>
      <p className="text-[9px] text-gray-400 leading-tight">
        Shaded bands are the classification thresholds. Positive V<sub>T</sub> = warm
        core. Persistence (≥ 36 h) decides the per-cyclone class, so a brief
        excursion into a band does not reclassify the system.
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Domain covering the data and a required minimum window, with 8% padding. */
function padDomain(values: number[], required: [number, number]): [number, number] {
  const lo = Math.min(...values, required[0]);
  const hi = Math.max(...values, required[1]);
  const pad = (hi - lo) * 0.08 || 1;
  return [lo - pad, hi + pad];
}

interface Band {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  color: string;
  label: string;
}

interface PanelProps {
  title: string;
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  pts: Pt[];
  xOfPt: (p: Pt) => number;
  yOfPt: (p: Pt) => number;
  selIdx: number;
  onSelect?: (ts: Timestep) => void;
  bands: Band[];
  guides: { x: number[]; y: number[] };
}

function Panel({
  title,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  pts,
  xOfPt,
  yOfPt,
  selIdx,
  onSelect,
  bands,
  guides,
}: PanelProps) {
  const sx = (v: number) =>
    PAD_L + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * PLOT_W;
  const sy = (v: number) =>
    PAD_T + PLOT_H - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * PLOT_H;

  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(xOfPt(p)).toFixed(2)},${sy(yOfPt(p)).toFixed(2)}`)
    .join("");

  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <div>
      <p
        className="text-[10px] font-semibold text-gray-600 mb-0.5"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <svg viewBox={`0 0 ${W} ${PANEL_H}`} className="w-full" style={{ height: PANEL_H }}>
        {/* Classification bands */}
        {bands.map((b, i) => {
          const x1 = sx(Math.max(b.x1, xDomain[0]));
          const x2 = sx(Math.min(b.x2, xDomain[1]));
          const y1 = sy(Math.min(b.y2, yDomain[1]));
          const y2 = sy(Math.max(b.y1, yDomain[0]));
          if (x2 <= x1 || y2 <= y1) return null;
          return (
            <rect
              key={i}
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill={b.color}
              opacity={0.07}
            />
          );
        })}

        {/* Plot frame */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={PLOT_W}
          height={PLOT_H}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={0.8}
        />

        {/* Guide lines at the threshold values */}
        {guides.x.map((v) =>
          v >= xDomain[0] && v <= xDomain[1] ? (
            <line
              key={`gx${v}`}
              x1={sx(v)}
              x2={sx(v)}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke="#94a3b8"
              strokeWidth={0.6}
              strokeDasharray="2 2"
            />
          ) : null
        )}
        {guides.y.map((v) =>
          v >= yDomain[0] && v <= yDomain[1] ? (
            <line
              key={`gy${v}`}
              x1={PAD_L}
              x2={PAD_L + PLOT_W}
              y1={sy(v)}
              y2={sy(v)}
              stroke="#94a3b8"
              strokeWidth={0.6}
              strokeDasharray="2 2"
            />
          ) : null
        )}

        {/* Trajectory */}
        <path d={path} fill="none" stroke="#475569" strokeWidth={0.9} opacity={0.65} />

        {/* Timestep markers */}
        {pts.map((p, i) => {
          const cx = sx(xOfPt(p));
          const cy = sy(yOfPt(p));
          const color = CPS_CLASS_COLORS[p.ts.cps_class ?? "unclassified"] ?? "#cbd5e1";
          const isSel = i === selIdx;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={isSel ? 4.5 : 2.4}
              fill={p.original ? color : "#ffffff"}
              stroke={isSel ? "#1e293b" : color}
              strokeWidth={isSel ? 1.6 : 1}
              className={onSelect ? "cursor-pointer" : undefined}
              onClick={() => onSelect?.(p.ts)}
            >
              <title>
                {`${p.ts.date} · ${p.ts.cps_class ?? "unclassified"}\n` +
                  `B = ${p.b.toFixed(1)} m\nVTL = ${p.vtl.toFixed(1)}\nVTU = ${p.vtu.toFixed(1)}` +
                  (p.original ? "\n(computed)" : "\n(interpolated)")}
              </title>
            </circle>
          );
        })}

        {/* Genesis (triangle) and lysis (square) */}
        {first && (
          <polygon
            points={trianglePoints(sx(xOfPt(first)), sy(yOfPt(first)), 4)}
            fill="#111827"
            opacity={0.85}
          />
        )}
        {last && (
          <rect
            x={sx(xOfPt(last)) - 3}
            y={sy(yOfPt(last)) - 3}
            width={6}
            height={6}
            fill="#111827"
            opacity={0.85}
          />
        )}

        {/* Axis ticks */}
        <text x={PAD_L} y={PANEL_H - 12} fontSize={6.5} fill="#9ca3af">
          {xDomain[0].toFixed(0)}
        </text>
        <text
          x={PAD_L + PLOT_W}
          y={PANEL_H - 12}
          fontSize={6.5}
          fill="#9ca3af"
          textAnchor="end"
        >
          {xDomain[1].toFixed(0)}
        </text>
        <text
          x={W / 2}
          y={PANEL_H - 3}
          fontSize={6.5}
          fill="#6b7280"
          textAnchor="middle"
        >
          {xLabel}
        </text>
        <text x={2} y={PAD_T + 6} fontSize={6.5} fill="#9ca3af">
          {yDomain[1].toFixed(0)}
        </text>
        <text x={2} y={PAD_T + PLOT_H} fontSize={6.5} fill="#9ca3af">
          {yDomain[0].toFixed(0)}
        </text>
        <text
          x={2}
          y={PAD_T + PLOT_H / 2}
          fontSize={6.5}
          fill="#6b7280"
          transform={`rotate(-90 8 ${PAD_T + PLOT_H / 2})`}
          textAnchor="middle"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

function trianglePoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx - r},${cy + r * 0.8} ${cx + r},${cy + r * 0.8}`;
}
