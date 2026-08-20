"use client";

/**
 * WindMapOverlay — the Lagrangian wind domain drawn on the Leaflet map.
 *
 * Rendered when the user has selected a specific timestep AND wind data exists
 * for that (track, timestep) pair. Only ONE height is ever drawn: the one the
 * display-variable selector has chosen. There is no combined view, so a marker
 * on screen always has a single unambiguous meaning.
 *
 * Visual elements
 * ───────────────
 * 1. A 20° × 20° rectangle centred on the cyclone position at the selected
 *    timestep — the Lagrangian domain the statistics were extracted from.
 *    Dashed border, very light fill so it does not obscure the base map.
 *
 * 2. Two dashed centre lines dividing the domain into the four quadrants.
 *
 * 3. One marker per quadrant at its wind extremum, filled with the storm-alert
 *    colour for that speed. The geometry encodes the height:
 *
 *        circle  →  10 m
 *        square  →  100 m
 *
 *    The quadrant holding the timestep maximum is drawn larger with an orange
 *    ring. Hovering gives quadrant, statistic, speed, distance to centre, the
 *    offsets and the absolute position.
 *
 * 4. A crosshair at the cyclone centre.
 *
 * Quadrant labels are not drawn on the map: the positions are self-evident from
 * the dividing lines, and the labels are in the tooltips where there is room
 * for the geographic correction (see lib/windQuadrants.ts).
 *
 * Coordinate convention
 * ─────────────────────
 * Leaflet wants [lat, lon]. The wind JSON stores OFFSETS from the cyclone
 * centre, so absolute positions are reconstructed here as centre + offset.
 *
 * Normalisation
 * ─────────────
 * Speed colours are normalised against the dataset-wide maximum FOR THE ACTIVE
 * HEIGHT. Using a single shared maximum would squash the 10 m palette against
 * the stronger 100 m winds and make weak-wind structure unreadable.
 */

import { Rectangle, Polyline, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

import { WindMetricEntry, WindMetric } from "@/types/cyclone";
import {
  QUADRANT_DISPLAY,
  QUADRANT_KEYS,
  globalQuadrant,
  quadrantDistance,
} from "@/lib/windQuadrants";
import {
  getWindColor,
  windColorLegendStops,
  STORM_ALERT_PALETTE,
  formatDatetime,
} from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Half-width of the Lagrangian domain in degrees. */
const HALF = 10; // → 20° × 20° total domain

/** Statistic display labels. */
const METRIC_LABELS: Record<WindMetric, string> = {
  max: "Max wind",
  p99: "P99 wind",
};

/**
 * Square marker, sized in PIXELS so it stays visually comparable to the circle
 * used at 10 m.
 *
 * A polygon in degrees was the obvious first attempt and is wrong: it scales
 * with the map, so at the zoom the 20° domain is normally viewed at the square
 * shrank to a few pixels while the circle stayed at its 12 px radius. A
 * divIcon keeps a constant pixel size, which is what CircleMarker does.
 */
function squareIcon(
  size: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${fill};
      border:${strokeWidth}px solid ${stroke};
      border-radius:2px;
      opacity:0.95;
      box-sizing:border-box;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface WindMapOverlayProps {
  /** Cyclone centre latitude at the selected timestep. */
  cycloneLat: number;
  /** Cyclone centre longitude at the selected timestep. */
  cycloneLon: number;
  /** ISO-8601 datetime of the selected timestep. */
  date: string;
  /** Wind data for the active height and statistic, or null if absent. */
  data: WindMetricEntry | null;
  /** Active statistic. */
  metric: WindMetric;
  /** Marker geometry for the active height: circle = 10 m, square = 100 m. */
  shape: "circle" | "square";
  /** Human-readable height label, e.g. "Wind 100 m". */
  levelLabel: string;
  /** Dataset-wide maximum for the active height and statistic. */
  globalMax: number;
}

export default function WindMapOverlay({
  cycloneLat,
  cycloneLon,
  date,
  data,
  metric,
  shape,
  levelLabel,
  globalMax,
}: WindMapOverlayProps) {
  // Domain bounds: [SW corner, NE corner] in Leaflet [lat, lon]
  const domainBounds: [[number, number], [number, number]] = [
    [cycloneLat - HALF, cycloneLon - HALF],
    [cycloneLat + HALF, cycloneLon + HALF],
  ];

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

  // The quadrant carrying the timestep extremum, recomputed from the values.
  const gq = globalQuadrant(data);

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
      {/* Drawn in the wind-markers pane (zIndex 700, declared in CycloneMap so  */}
      {/* the pane div is always present and never blocks clicks).              */}
      {data &&
        QUADRANT_KEYS.map((qd) => {
          const q = data[qd];
          if (!q) return null;

          const [dLon, dLat, qVal] = q;
          if (dLon == null || dLat == null || qVal == null) return null;

          // Stored as offsets from the centre; rebuild the absolute position.
          const qLon = cycloneLon + dLon;
          const qLat = cycloneLat + dLat;

          const color = getWindColor(qVal, globalMax);
          const isGlobal = gq === qd;
          // Geographic label — the source inverts N/S (see windQuadrants.ts).
          const geoLabel = QUADRANT_DISPLAY[qd] ?? qd;
          // Euclidean degrees, exactly as the source defines it.
          const qDist = quadrantDistance(q);

          const pathOptions = {
            fillColor: color,
            color: isGlobal ? "#ea580c" : "#ffffff",
            weight: isGlobal ? 3 : 1.5,
            fillOpacity: 0.95,
          };

          const tooltip = (
            <Tooltip direction="top" offset={[0, -10]} opacity={0.96}>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span
                    style={{
                      background: color,
                      width: 10,
                      height: 10,
                      borderRadius: shape === "circle" ? "50%" : 2,
                      display: "inline-block",
                      border: "1px solid #fff",
                    }}
                  />
                  {geoLabel} quadrant
                  {isGlobal && (
                    <span className="text-orange-600 font-semibold ml-1">★ global max</span>
                  )}
                </div>
                <div className="text-gray-500">
                  {levelLabel} · {metricLabel} · {dateLabel}
                </div>
                <div className="font-semibold text-gray-900">
                  Wind speed: {qVal.toFixed(2)} m s⁻¹
                </div>
                {qDist != null && (
                  <div className="text-gray-600">
                    Distance to centre: {qDist.toFixed(2)}°
                  </div>
                )}
                <div className="text-gray-600">
                  Δlon: {dLon.toFixed(3)}°&ensp;Δlat: {dLat.toFixed(3)}°
                </div>
                <div className="text-gray-500 font-mono text-[10px]">
                  {Math.abs(qLat).toFixed(3)}°{qLat < 0 ? "S" : "N"},{" "}
                  {Math.abs(qLon).toFixed(3)}°{qLon < 0 ? "W" : "E"}
                </div>
              </div>
            </Tooltip>
          );

          // Circle = 10 m, square = 100 m. Sizes match the circle radii below
          // (diameter 24 / 14 px) so neither height looks more prominent.
          if (shape === "square") {
            return (
              <Marker
                key={`wind-${qd}`}
                position={[qLat, qLon]}
                pane="wind-markers"
                icon={squareIcon(
                  isGlobal ? 22 : 13,
                  color,
                  isGlobal ? "#ea580c" : "#ffffff",
                  isGlobal ? 3 : 1.5,
                )}
              >
                {tooltip}
              </Marker>
            );
          }

          return (
            <CircleMarker
              key={`wind-${qd}`}
              center={[qLat, qLon]}
              radius={isGlobal ? 12 : 7}
              pane="wind-markers"
              pathOptions={pathOptions}
            >
              {tooltip}
            </CircleMarker>
          );
        })}
    </>
  );
}

// ─── WindLegend ───────────────────────────────────────────────────────────────
// Rendered as an absolutely-positioned div on top of the map.

interface WindLegendProps {
  globalMax: number;
  metric: WindMetric;
  shape: "circle" | "square";
  levelLabel: string;
}

export function WindLegend({ globalMax, metric, shape, levelLabel }: WindLegendProps) {
  const stops = windColorLegendStops(globalMax, 5);
  const gradientStops = STORM_ALERT_PALETTE.map(
    (c, i) => `${c} ${((i / (STORM_ALERT_PALETTE.length - 1)) * 100).toFixed(0)}%`
  ).join(", ");

  return (
    <div
      className="absolute bottom-6 right-3 z-[1000] bg-white/90 border border-gray-200 rounded-lg px-3 py-2 shadow-md"
      style={{ minWidth: 130 }}
    >
      <p className="text-[10px] font-semibold text-gray-700 mb-1 leading-tight flex items-center gap-1.5">
        {/* The marker geometry, so the legend identifies which height is drawn */}
        <span
          className="inline-block border border-gray-400 bg-gray-300"
          style={{
            width: 9,
            height: 9,
            borderRadius: shape === "circle" ? "50%" : 2,
          }}
        />
        {levelLabel}&ensp;
        <span className="text-blue-700 font-bold">
          {metric === "max" ? "MAX" : "P99"}
        </span>
      </p>
      <p className="text-[9px] text-gray-400 mb-1.5 leading-tight">(m s⁻¹)</p>

      {/* Colour gradient bar */}
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
