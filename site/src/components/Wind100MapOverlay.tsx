"use client";

/**
 * Wind100MapOverlay — Lagrangian wind domain drawn on the Leaflet map.
 *
 * Rendered when the user has selected a specific timestep AND wind100 data
 * is available for that (track, timestep) pair.
 *
 * Visual elements
 * ───────────────
 * 1. A 20° × 20° rectangle centred on the cyclone position at the selected
 *    timestep.  Drawn with a dashed border; very light semi-transparent fill
 *    so it does not obscure the base map.
 *
 * 2. Two dashed centre lines (horizontal + vertical) dividing the domain into
 *    the four Lagrangian quadrants: NW | NE / SW | SE.
 *
 * 3. A CircleMarker for each quadrant's wind extremum position.
 *    – Radius 8 px; filled with the storm_alert color mapped to wind speed.
 *    – White border (weight 2) for contrast against the base map.
 *    – A Tooltip (visible on hover) showing quadrant, metric, speed, distance,
 *      coordinates, and timestamp.
 *
 * 4. A cross-hair marker at the cyclone centre position.
 *
 * Note: Quadrant labels (NW, NE, SW, SE) have been removed to reduce visual
 * clutter — the quadrant positions are self-evident from the dividing lines.
 *
 * Coordinate convention
 * ─────────────────────
 * Leaflet: [lat, lon].  All positions from wind100 data (lon, lat) are flipped.
 *
 * Normalization
 * ─────────────
 * The wind speed color is normalized against the dataset-wide maximum
 * (globalMax from Wind100Meta), ensuring cross-track comparability.
 */

import { Rectangle, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { Wind100MetricEntry, Wind100Metric } from "@/types/cyclone";
import { getWindColor, windColorLegendStops, STORM_ALERT_PALETTE } from "@/lib/utils";
import { formatDatetime } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Half-width of the Lagrangian domain in degrees. */
const HALF = 10; // → 20° × 20° total domain

const QUADRANT_KEYS = ["NW", "NE", "SW", "SE"] as const;

/**
 * The source dataset stores quadrant labels with N/S inverted relative to
 * geographic convention (verified against raw CSV coordinates — the positions
 * labeled "NW"/"NE" are south of the cyclone centre; those labeled "SW"/"SE"
 * are north).  This mapping converts dataset keys → geographic display labels
 * so that the UI agrees with the marker positions drawn on the map.
 *
 * E/W is correct in the dataset; only N↔S is swapped.
 */
const QUADRANT_DISPLAY: Record<string, string> = {
  NW: "SW", NE: "SE", SW: "NW", SE: "NE",
};

/** Metric display labels. */
const METRIC_LABELS: Record<Wind100Metric, string> = {
  max: "Max wind",
  p99: "P99 wind",
};

// ─── Main component ───────────────────────────────────────────────────────────

export interface Wind100MapOverlayProps {
  /** Cyclone centre latitude at the selected timestep. */
  cycloneLat: number;
  /** Cyclone centre longitude at the selected timestep. */
  cycloneLon: number;
  /** ISO-8601 datetime of the selected timestep. */
  date: string;
  /** Wind100 data for the selected metric at this timestep, or null if absent. */
  data: Wind100MetricEntry | null;
  /** Currently selected metric. */
  metric: Wind100Metric;
  /** Dataset-wide absolute maximum for the selected metric (from Wind100Meta). */
  globalMax: number;
}

export default function Wind100MapOverlay({
  cycloneLat,
  cycloneLon,
  date,
  data,
  metric,
  globalMax,
}: Wind100MapOverlayProps) {
  // Domain bounds: [SW corner, NE corner] in Leaflet [lat, lon]
  const domainBounds: [[number, number], [number, number]] = [
    [cycloneLat - HALF, cycloneLon - HALF],
    [cycloneLat + HALF, cycloneLon + HALF],
  ];

  // Quadrant divider lines (Leaflet expects [lat, lon])
  const hLine: [number, number][] = [
    [cycloneLat, cycloneLon - HALF],
    [cycloneLat, cycloneLon + HALF],
  ];
  const vLine: [number, number][] = [
    [cycloneLat - HALF, cycloneLon],
    [cycloneLat + HALF, cycloneLon],
  ];

  const metricLabel = METRIC_LABELS[metric];
  const dateLabel = formatDatetime(date);

  return (
    <>
      {/* ── 1. Domain rectangle ─────────────────────────────────────────── */}
      <Rectangle
        bounds={domainBounds}
        pathOptions={{
          color: "#475569",
          weight: 1.5,
          dashArray: "6 5",
          fill: true,
          fillColor: "#1e40af",
          fillOpacity: 0.04,
          interactive: false,
        }}
      />

      {/* ── 2. Quadrant divider lines ────────────────────────────────────── */}
      <Polyline
        positions={hLine}
        pathOptions={{ color: "#475569", weight: 1, dashArray: "4 5", opacity: 0.55, interactive: false }}
      />
      <Polyline
        positions={vLine}
        pathOptions={{ color: "#475569", weight: 1, dashArray: "4 5", opacity: 0.55, interactive: false }}
      />

      {/* ── 3. Cyclone centre crosshair ──────────────────────────────────── */}
      <CircleMarker
        center={[cycloneLat, cycloneLon]}
        radius={5}
        pathOptions={{
          fillColor: "#ffffff",
          color: "#1e293b",
          weight: 2,
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={0.92}>
          <div className="text-xs">
            <div className="font-semibold text-gray-800">Cyclone centre</div>
            <div className="text-gray-500">{dateLabel}</div>
          </div>
        </Tooltip>
      </CircleMarker>

      {/* ── 4. Wind extremum markers (one per quadrant) ──────────────────── */}
      {/* Rendered in the wind100-markers pane (zIndex 700, declared in         */}
      {/* CycloneMap so the pane div is always present and never blocks clicks) */}
      {data && QUADRANT_KEYS.map((qd) => {
        const q = data[qd];
        if (!q) return null;

        const [qLon, qLat, qVal, qDist] = q;
        if (qLon == null || qLat == null || qVal == null) return null;

        const color = getWindColor(qVal, globalMax);
        const isGlobal = data.gq === qd;
        // Geographic display label (N/S inverted in source dataset — see QUADRANT_DISPLAY)
        const geoLabel = QUADRANT_DISPLAY[qd] ?? qd;

        return (
          <CircleMarker
            key={`w100-${qd}`}
            center={[qLat, qLon]}
            radius={isGlobal ? 12 : 7}
            pane="wind100-markers"
            pathOptions={{
              fillColor: color,
              color: isGlobal ? "#ea580c" : "#ffffff",
              weight: isGlobal ? 3 : 1.5,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.96}>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span
                    style={{ background: color, width: 10, height: 10, borderRadius: "50%", display: "inline-block", border: "1px solid #fff" }}
                  />
                  {geoLabel} quadrant
                  {isGlobal && (
                    <span className="text-orange-600 font-semibold ml-1">★ global max</span>
                  )}
                </div>
                <div className="text-gray-500">{metricLabel} · {dateLabel}</div>
                <div className="font-semibold text-gray-900">
                  Wind speed: {qVal.toFixed(2)} m s⁻¹
                </div>
                {qDist != null && (
                  <div className="text-gray-600">Distance to centre: {qDist.toFixed(2)}°</div>
                )}
                <div className="text-gray-600">
                  Δlon: {(qLon - cycloneLon).toFixed(3)}°
                  &ensp;Δlat: {(qLat - cycloneLat).toFixed(3)}°
                </div>
                <div className="text-gray-500 font-mono text-[10px]">
                  {Math.abs(qLat).toFixed(3)}°{qLat < 0 ? "S" : "N"}, {Math.abs(qLon).toFixed(3)}°{qLon < 0 ? "W" : "E"}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

// ─── Wind100Legend ────────────────────────────────────────────────────────────
// Rendered as an absolutely-positioned div on top of the map.

interface Wind100LegendProps {
  globalMax: number;
  metric: Wind100Metric;
}

export function Wind100Legend({ globalMax, metric }: Wind100LegendProps) {
  const stops = windColorLegendStops(globalMax, 5);
  const gradientStops = STORM_ALERT_PALETTE.map(
    (c, i) => `${c} ${((i / (STORM_ALERT_PALETTE.length - 1)) * 100).toFixed(0)}%`
  ).join(", ");

  return (
    <div
      className="absolute bottom-6 right-3 z-[1000] bg-white/90 border border-gray-200 rounded-lg px-3 py-2 shadow-md"
      style={{ minWidth: 130 }}
    >
      <p className="text-[10px] font-semibold text-gray-700 mb-1 leading-tight">
        Wind 100 m&ensp;
        <span className="text-blue-700 font-bold">{metric === "max" ? "MAX" : "P99"}</span>
      </p>
      <p className="text-[9px] text-gray-400 mb-1.5 leading-tight">(m s⁻¹)</p>

      {/* Color gradient bar */}
      <div
        className="h-3 rounded-sm mb-1"
        style={{
          background: `linear-gradient(to right, ${gradientStops})`,
          width: 100,
        }}
      />

      {/* Tick labels */}
      <div className="flex justify-between" style={{ width: 100 }}>
        {stops.map((s) => (
          <span key={s.label} className="text-[9px] text-gray-500 leading-none">
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
