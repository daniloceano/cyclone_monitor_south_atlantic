"use client";

/**
 * IntensityFilter — select cyclones by peak value of the ACTIVE display
 * variable: central relative vorticity, 10 m wind, or 100 m wind.
 *
 * Shows the dataset-wide distribution of that variable's track-level peaks as
 * a filled density curve, with the current selection highlighted and the
 * variable's own quantiles drawn as guide lines. The selection can be set three
 * ways, all writing to the same state:
 *
 *   1. dragging either handle on the curve
 *   2. clicking anywhere on the curve (moves the nearest handle)
 *   3. typing the bounds into the numeric inputs
 *
 * Two modes:
 *   - "range"  : keep p_min <= value <= p_max      (two handles)
 *   - "cutoff" : keep value >= p_min               (one handle)
 *
 * Nothing here is specific to any one variable: the curve, the guide lines and
 * the shortcut chips are all read from the descriptor the caller passes, which
 * is the same object the map colours tracks with. Switching variable therefore
 * reshapes the whole control, and the bounds are cleared by the caller because
 * a threshold in ×10⁻⁵ s⁻¹ means nothing in m s⁻¹.
 *
 * The curve is drawn from the pre-computed histogram in summary.json
 * (`display_variables[v].intensity_pdf`), so no client-side binning happens.
 * The y-axis is a
 * probability density; its absolute scale is not shown because only the shape
 * matters for choosing a threshold.
 *
 * Rendered as raw SVG rather than through the charting library because the
 * brush interaction has to share a coordinate system with the curve, and the
 * library's own brush cannot be constrained to one axis with custom handles.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  DisplayVariableInfo,
  IntensityFilterState,
  IntensityPDF,
} from "@/types/cyclone";

// ─── Geometry (SVG user units; the element itself scales to its container) ────
const W = 300;
const H = 96;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 8;
const PAD_B = 18;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

/** Quantiles drawn as guide lines, in draw order. */
const GUIDES: { key: keyof IntensityPDF["quantiles"]; label: string }[] = [
  { key: "p10", label: "p10" },
  { key: "p25", label: "p25" },
  { key: "p50", label: "p50" },
  { key: "p75", label: "p75" },
  { key: "p90", label: "p90" },
  { key: "p95", label: "p95" },
];

interface IntensityFilterProps {
  pdf: IntensityPDF;
  /** Active display variable, supplying the label, unit and precision. */
  info: DisplayVariableInfo;
  value: IntensityFilterState;
  onChange: (v: IntensityFilterState) => void;
  /** Number of tracks currently passing the whole filter stack. */
  matchCount: number;
}

export default function IntensityFilter({
  pdf,
  info,
  value,
  onChange,
  matchCount,
}: IntensityFilterProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<"min" | "max" | null>(null);

  const lo = pdf.min;
  const hi = pdf.max;
  const span = hi - lo || 1;

  // Effective bounds (nulls mean "unbounded" → clamp to the data range)
  const vMin = value.min ?? lo;
  const vMax = value.mode === "cutoff" ? hi : value.max ?? hi;

  // ── Scales ────────────────────────────────────────────────────────────────
  const xOf = useCallback(
    (v: number) => PAD_L + ((v - lo) / span) * PLOT_W,
    [lo, span]
  );
  const vOf = useCallback(
    (x: number) => lo + ((x - PAD_L) / PLOT_W) * span,
    [lo, span]
  );

  // ── Curve path ────────────────────────────────────────────────────────────
  const { areaPath, linePath } = useMemo(() => {
    const dMax = Math.max(...pdf.density) || 1;
    const yOf = (d: number) => PAD_T + PLOT_H - (d / dMax) * PLOT_H;

    // One point per bin centre
    const pts = pdf.density.map((d, i) => {
      const c = (pdf.bin_edges[i] + pdf.bin_edges[i + 1]) / 2;
      return [xOf(c), yOf(d)] as const;
    });

    if (pts.length === 0) return { areaPath: "", linePath: "" };

    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
    const base = PAD_T + PLOT_H;
    const area =
      `M${pts[0][0].toFixed(2)},${base.toFixed(2)}` +
      pts.map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`).join("") +
      `L${pts[pts.length - 1][0].toFixed(2)},${base.toFixed(2)}Z`;

    return { areaPath: area, linePath: line };
  }, [pdf, xOf]);

  // ── Pointer interaction ───────────────────────────────────────────────────
  const valueAtPointer = useCallback(
    (clientX: number): number => {
      const svg = svgRef.current;
      if (!svg) return lo;
      const rect = svg.getBoundingClientRect();
      // Map client pixels → SVG user units (the SVG scales with its container)
      const xUser = ((clientX - rect.left) / rect.width) * W;
      const v = vOf(xUser);
      return Math.min(hi, Math.max(lo, v));
    },
    [lo, hi, vOf]
  );

  const commit = useCallback(
    (which: "min" | "max", v: number) => {
      const rounded = Math.round(v * 1000) / 1000;
      if (value.mode === "cutoff") {
        onChange({ ...value, min: rounded, max: null });
        return;
      }
      if (which === "min") {
        onChange({ ...value, min: Math.min(rounded, vMax), max: value.max ?? hi });
      } else {
        onChange({ ...value, min: value.min ?? lo, max: Math.max(rounded, vMin) });
      }
    },
    [value, onChange, vMin, vMax, lo, hi]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const v = valueAtPointer(e.clientX);
      // Pick the nearer handle (in cutoff mode there is only one)
      const which: "min" | "max" =
        value.mode === "cutoff"
          ? "min"
          : Math.abs(v - vMin) <= Math.abs(v - vMax)
          ? "min"
          : "max";
      setDragging(which);
      commit(which, v);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [valueAtPointer, value.mode, vMin, vMax, commit]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return;
      commit(dragging, valueAtPointer(e.clientX));
    },
    [dragging, commit, valueAtPointer]
  );

  const endDrag = useCallback(() => setDragging(null), []);

  // ── Numeric inputs ────────────────────────────────────────────────────────
  const onTypedMin = (raw: string) => {
    const n = raw.trim() === "" ? null : Number(raw);
    if (n !== null && !isFinite(n)) return;
    onChange({ ...value, min: n });
  };
  const onTypedMax = (raw: string) => {
    const n = raw.trim() === "" ? null : Number(raw);
    if (n !== null && !isFinite(n)) return;
    onChange({ ...value, max: n });
  };

  const setMode = (mode: "range" | "cutoff") => {
    onChange(
      mode === "cutoff"
        ? { mode, min: value.min ?? pdf.quantiles.p75, max: null }
        : { mode, min: value.min, max: value.max }
    );
  };

  const reset = () => onChange({ mode: value.mode, min: null, max: null });

  const selX1 = xOf(vMin);
  const selX2 = xOf(vMax);
  const isActive = value.min !== null || value.max !== null;

  return (
    <div className="space-y-2">
      {/* ── Mode toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-md p-0.5">
          <button
            onClick={() => setMode("range")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              value.mode === "range"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            Range
          </button>
          <button
            onClick={() => setMode("cutoff")}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
              value.mode === "cutoff"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            Cut-off
          </button>
        </div>
        {isActive && (
          <button
            onClick={reset}
            className="text-[10px] text-blue-600 hover:text-blue-700 transition"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Distribution + brush ────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none cursor-ew-resize"
        style={{ height: 96 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="group"
        aria-label="Intensity distribution and selection"
      >
        {/* Full distribution (muted) */}
        <path d={areaPath} fill="#e5e7eb" />

        {/* Selected region, clipped to the selection */}
        <defs>
          <clipPath id="intensity-sel">
            <rect
              x={Math.min(selX1, selX2)}
              y={0}
              width={Math.abs(selX2 - selX1)}
              height={H}
            />
          </clipPath>
        </defs>
        <path d={areaPath} fill="#93c5fd" clipPath="url(#intensity-sel)" />
        <path d={linePath} fill="none" stroke="#1d4ed8" strokeWidth={1.2} />

        {/* Quantile guide lines */}
        {GUIDES.map(({ key, label }) => {
          const q = pdf.quantiles[key];
          if (q == null || q < lo || q > hi) return null;
          const x = xOf(q);
          return (
            <g key={key}>
              <line
                x1={x}
                x2={x}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke="#94a3b8"
                strokeWidth={0.6}
                strokeDasharray="2 2"
              />
              <text
                x={x}
                y={PAD_T + PLOT_H + 8}
                textAnchor="middle"
                fontSize={6}
                fill="#94a3b8"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Axis end labels */}
        <text x={PAD_L} y={H - 2} fontSize={6.5} fill="#6b7280">
          {lo.toFixed(1)}
        </text>
        <text x={W - PAD_R} y={H - 2} fontSize={6.5} fill="#6b7280" textAnchor="end">
          {hi.toFixed(1)}
        </text>

        {/* Handles */}
        <HandleMark x={selX1} />
        {value.mode === "range" && <HandleMark x={selX2} />}
      </svg>

      {/* ── Numeric entry ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <label className="block text-[9px] text-gray-400 mb-0.5">
            {value.mode === "cutoff" ? "Minimum" : "From"}
          </label>
          <input
            type="number"
            step="0.1"
            value={value.min ?? ""}
            placeholder={lo.toFixed(2)}
            onChange={(e) => onTypedMin(e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] border border-gray-300 rounded
                       focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        {value.mode === "range" && (
          <div className="flex-1">
            <label className="block text-[9px] text-gray-400 mb-0.5">To</label>
            <input
              type="number"
              step="0.1"
              value={value.max ?? ""}
              placeholder={hi.toFixed(2)}
              onChange={(e) => onTypedMax(e.target.value)}
              className="w-full px-1.5 py-1 text-[11px] border border-gray-300 rounded
                         focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        )}
      </div>

      {/* ── Quantile shortcuts ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1">
        {(["p50", "p75", "p90", "p95"] as const).map((q) => (
          <button
            key={q}
            onClick={() =>
              onChange({ mode: "cutoff", min: pdf.quantiles[q], max: null })
            }
            className="px-1.5 py-0.5 text-[9px] rounded border border-gray-200
                       text-gray-600 hover:bg-blue-50 hover:border-blue-300 transition"
            title={`Keep cyclones above the ${q} threshold (${pdf.quantiles[q]?.toFixed(
              info.decimals
            )} ${info.unit})`}
          >
            ≥ {q}
          </button>
        ))}
      </div>

      <p className="text-[9px] text-gray-400 leading-tight">
        Peak {info.label.toLowerCase()} ({info.unit}) per cyclone,{" "}
        {pdf.n.toLocaleString()} tracks.{" "}
        <span className="text-gray-500 font-medium">
          {matchCount.toLocaleString()} match
        </span>{" "}
        the current filters.
      </p>
    </div>
  );
}

/** Draggable handle drawn on the curve. */
function HandleMark({ x }: { x: number }) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={PAD_T - 4}
        y2={PAD_T + PLOT_H}
        stroke="#1d4ed8"
        strokeWidth={1.4}
      />
      <circle cx={x} cy={PAD_T - 4} r={3.2} fill="#1d4ed8" stroke="#fff" strokeWidth={1} />
    </g>
  );
}
