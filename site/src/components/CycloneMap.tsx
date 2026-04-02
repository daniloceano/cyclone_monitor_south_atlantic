"use client";

/**
 * CycloneMap — the interactive Leaflet map.
 *
 * Imported with { ssr: false } from page.tsx because Leaflet requires browser
 * globals (window, document) that are not available during server-side rendering.
 *
 * Canvas renderer is used for track polylines (better performance with
 * thousands of simultaneous features vs. the default SVG renderer).
 *
 * Coordinate convention:
 *   - Track coords from the JSON are stored as [lon, lat] (GeoJSON order).
 *   - Leaflet expects [lat, lon], so coords are flipped on use.
 *
 * Wind100 overlay (added 2026):
 *   - Shown when selectedTimestep !== null AND wind100TrackData / wind100Meta
 *     are provided.
 *   - While the overlay is active the track polyline is dimmed to near-
 *     invisibility; non-selected timestep markers are also faded.
 *   - The selected timestep gets a larger, bright marker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ## Intensity-Based Track Coloring (unselected state)
 *
 * When no cyclone is selected, track colors reflect intensity using `max_vor42`
 * (maximum filtered relative vorticity, ×10⁻⁵ s⁻¹) — the same metric used
 * throughout the application for intensity classification.
 *
 * Color scheme:
 *   - **Gray**: Tracks below the 10th percentile (p10) — low-intensity cyclones
 *   - **Yellow → Orange → Red**: Tracks at or above p10, with more intense
 *     cyclones appearing more red
 *
 * Percentile calculation:
 *   - Computed at the **cyclone level** (max_vor42 per track), not timestep
 *   - Thresholds are **global** across the entire dataset (6,789 tracks),
 *     not recalculated dynamically for filtered subsets
 *   - Pre-computed in `scripts/preprocess_data.py` and stored in `summary.json`
 *
 * When a cyclone is selected:
 *   - Selected track: orange (#ea580c), full opacity
 *   - Other tracks: dimmed light blue (#93c5fd), low opacity
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  Tooltip,
  Pane,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  TrackSummary,
  Timestep,
  PHASE_COLORS,
  QuantileThresholds,
  Wind100TimestepEntry,
  Wind100Meta,
  Wind100Metric,
} from "@/types/cyclone";
import { formatDatetime, formatLat, formatLon } from "@/lib/utils";
import { getIntensityColor, INTENSITY_COLORS } from "@/lib/colors";
import Wind100MapOverlay, { Wind100Legend } from "./Wind100MapOverlay";

// Fix Leaflet's default icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface CycloneMapProps {
  tracks: TrackSummary[];
  selectedTrack: TrackSummary | null;
  timesteps: Timestep[] | null;
  selectedTimestep: Timestep | null;
  quantileThresholds: QuantileThresholds;
  onTrackSelect: (track: TrackSummary) => void;
  onTimestepSelect: (ts: Timestep) => void;
  onClearSelection: () => void;
  // Wind100 overlay — all optional; overlay is silently skipped when absent
  wind100TrackData: Record<string, Wind100TimestepEntry> | null;
  wind100Meta: Wind100Meta | null;
  wind100Metric: Wind100Metric;
}

// South Atlantic centre
const MAP_CENTER: [number, number] = [-42, -35];
const MAP_ZOOM = 3;

// Polyline style constants (tuned for light CARTO base layer)
const STYLE_HOVER        = { color: "#1d4ed8", weight: 2,   opacity: 0.70 };
const STYLE_SELECTED     = { color: "#ea580c", weight: 2.5, opacity: 1    };
const STYLE_SELECTED_DIM = { color: "#ea580c", weight: 1.5, opacity: 0.12 }; // timestep-active

// Default style for unselected tracks (intensity color applied separately)
const DEFAULT_WEIGHT = 1;
const DEFAULT_OPACITY = 0.45;

export default function CycloneMap({
  tracks,
  selectedTrack,
  timesteps,
  selectedTimestep,
  quantileThresholds,
  onTrackSelect,
  onTimestepSelect,
  onClearSelection,
  wind100TrackData,
  wind100Meta,
  wind100Metric,
}: CycloneMapProps) {
  // Module-level canvas renderer — shared across all polylines
  const canvasRef = useRef<L.Canvas | null>(null);
  if (!canvasRef.current) {
    canvasRef.current = L.canvas({ padding: 0.5 });
  }
  const renderer = canvasRef.current;

  // Resolve wind100 data for the selected timestep (null-safe)
  const w100Entry =
    selectedTimestep && wind100TrackData
      ? (wind100TrackData[selectedTimestep.date] ?? null)
      : null;
  const metricData = w100Entry
    ? wind100Metric === "max" ? w100Entry.max : w100Entry.p99
    : null;
  const globalMax = wind100Meta
    ? wind100Metric === "max" ? wind100Meta.max_global_max : wind100Meta.p99_global_max
    : 54; // dataset-computed absolute maximum as safe fallback

  // Dim the polyline further when a specific timestep is focused
  const selectedTrackStyle = selectedTimestep ? STYLE_SELECTED_DIM : STYLE_SELECTED;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ width: "100%", height: "100%" }}
        className="z-0"
        preferCanvas
      >
        {/* Base tile layer — light style */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {/* ── Track polylines ─────────────────────────────────────────────── */}
        {/* When a track is selected, only render the selected track.
            When no track is selected, render all tracks with intensity colors. */}
        {tracks.map((track) => {
          const isSelected = selectedTrack?.id === track.id;
          
          // If there's a selection and this isn't the selected track, don't render it
          if (selectedTrack !== null && !isSelected) {
            return null;
          }
          
          const positions = track.coords.map(
            ([lon, lat]) => [lat, lon] as [number, number]
          );

          // Compute style based on selection state
          let style: { color: string; weight: number; opacity: number };
          if (isSelected) {
            style = selectedTrackStyle;
          } else {
            // No selection — use intensity-based color
            const intensityColor = getIntensityColor(track.max_vor42, quantileThresholds);
            style = { color: intensityColor, weight: DEFAULT_WEIGHT, opacity: DEFAULT_OPACITY };
          }

          return (
            <TrackPolyline
              key={track.id}
              track={track}
              positions={positions}
              style={style}
              renderer={renderer}
              isSelected={isSelected}
              onSelect={onTrackSelect}
            />
          );
        })}

        {/* ── Timestep markers (only for selected track) ──────────────────── */}
        {/* Wrapped in a Pane to ensure markers render above the track polyline */}
        <Pane name="timestep-markers" style={{ zIndex: 650 }}>
          {selectedTrack &&
            timesteps?.map((ts, i) => {
              const pos: [number, number] = [ts.lat, ts.lon];
              const color = PHASE_COLORS[ts.phase] ?? "#94a3b8";
              const isThisSelected =
                selectedTimestep !== null &&
                selectedTimestep.date === ts.date &&
                selectedTimestep.lon === ts.lon;

              // When a timestep is active, fade all others to context but keep clickable
              if (selectedTimestep && !isThisSelected) {
                return (
                  <CircleMarker
                    key={`ts-${selectedTrack.id}-${i}`}
                    center={pos}
                    radius={6}
                    pathOptions={{
                      fillColor: color,
                      color: "#ffffff",
                      weight: 1,
                      fillOpacity: 0.5,
                      opacity: 0.7,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        onTimestepSelect(ts);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                      <div className="text-xs">
                        <div className="font-semibold">{formatDatetime(ts.date)}</div>
                        <div>{formatLat(ts.lat)}, {formatLon(ts.lon)}</div>
                        <div className="capitalize" style={{ color }}>
                          {ts.phase} · vor42 = {ts.vor42.toFixed(3)}
                        </div>
                        <div className="text-gray-500 text-[10px]">Click to select</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              }

              // Selected timestep: large highlighted marker
              if (isThisSelected) {
                return (
                  <CircleMarker
                    key={`ts-${selectedTrack.id}-${i}`}
                    center={pos}
                    radius={10}
                    pathOptions={{
                      fillColor: color,
                      color: "#1e293b",
                      weight: 3,
                      fillOpacity: 1,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e);
                        onTimestepSelect(ts);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                      <div className="text-xs">
                        <div className="font-semibold">{formatDatetime(ts.date)}</div>
                        <div>{formatLat(ts.lat)}, {formatLon(ts.lon)}</div>
                        <div className="capitalize" style={{ color }}>
                          {ts.phase} · vor42 = {ts.vor42.toFixed(3)}
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              }

              // Normal state (no timestep selected yet)
              return (
                <CircleMarker
                  key={`ts-${selectedTrack.id}-${i}`}
                  center={pos}
                  radius={6}
                  pathOptions={{
                    fillColor: color,
                    color: "#ffffff",
                    weight: 1.5,
                    fillOpacity: 0.9,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      onTimestepSelect(ts);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                    <div className="text-xs">
                      <div className="font-semibold">{formatDatetime(ts.date)}</div>
                      <div>{formatLat(ts.lat)}, {formatLon(ts.lon)}</div>
                      <div className="capitalize" style={{ color }}>
                        {ts.phase} · vor42 = {ts.vor42.toFixed(3)}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </Pane>

        {/* ── Wind100 overlay (only when a timestep is selected) ───────────── */}
        {selectedTimestep && (
          <Wind100MapOverlay
            cycloneLat={selectedTimestep.lat}
            cycloneLon={selectedTimestep.lon}
            date={selectedTimestep.date}
            data={metricData}
            metric={wind100Metric}
            globalMax={globalMax}
          />
        )}

        {/* ── Intensity legend (only when no track selected) ─────────────── */}
        {!selectedTrack && <IntensityLegend thresholds={quantileThresholds} />}

        {/* ── Map event handler (click on ocean clears selection) ─────────── */}
        <MapClickHandler onClear={onClearSelection} hasSelection={selectedTrack !== null} />
      </MapContainer>

      {/* ── Wind100 legend (sits over the map, outside MapContainer) ───────── */}
      {selectedTimestep && wind100Meta && (
        <Wind100Legend globalMax={globalMax} metric={wind100Metric} />
      )}
    </div>
  );
}

// ── Intensity Legend ──────────────────────────────────────────────────────────
function IntensityLegend({ thresholds }: { thresholds: QuantileThresholds }) {
  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3 mr-3 mb-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">
          Intensity (max vor42)
        </div>
        <div className="flex items-center gap-1">
          {/* Gray for below p10 */}
          <div className="flex flex-col items-center">
            <div
              className="w-4 h-3 rounded-sm border border-gray-300"
              style={{ backgroundColor: INTENSITY_COLORS.gray }}
            />
            <span className="text-[10px] text-gray-500 mt-0.5">&lt;p10</span>
          </div>
          {/* Gradient bar from yellow to red */}
          <div className="flex flex-col items-center mx-1">
            <div
              className="w-20 h-3 rounded-sm border border-gray-300"
              style={{
                background: `linear-gradient(to right, ${INTENSITY_COLORS.yellow}, ${INTENSITY_COLORS.orange}, ${INTENSITY_COLORS.red})`,
              }}
            />
            <div className="flex justify-between w-20 text-[10px] text-gray-500 mt-0.5">
              <span>{thresholds.p10.toFixed(1)}</span>
              <span>{thresholds.max.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div className="text-[9px] text-gray-400 mt-1.5">
          ×10⁻⁵ s⁻¹ (vorticity)
        </div>
      </div>
    </div>
  );
}

// ── Per-track polyline with hover handling ────────────────────────────────────
interface TrackPolylineProps {
  track: TrackSummary;
  positions: [number, number][];
  style: { color: string; weight: number; opacity: number };
  renderer: L.Canvas;
  isSelected: boolean;
  onSelect: (t: TrackSummary) => void;
}

function TrackPolyline({
  track,
  positions,
  style,
  renderer,
  isSelected,
  onSelect,
}: TrackPolylineProps) {
  const polylineRef = useRef<L.Polyline | null>(null);

  const handleClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      onSelect(track);
    },
    [track, onSelect]
  );

  const handleMouseover = useCallback(() => {
    if (!isSelected && polylineRef.current) {
      polylineRef.current.setStyle(STYLE_HOVER);
      polylineRef.current.bringToFront();
    }
  }, [isSelected]);

  const handleMouseout = useCallback(() => {
    if (!isSelected && polylineRef.current) {
      polylineRef.current.setStyle(style);
    }
  }, [isSelected, style]);

  return (
    <Polyline
      ref={polylineRef}
      positions={positions}
      pathOptions={{ ...style, renderer }}
      eventHandlers={{
        click: handleClick,
        mouseover: handleMouseover,
        mouseout: handleMouseout,
      }}
    >
      {!isSelected && (
        <Tooltip sticky direction="top" opacity={0.85}>
          <div className="text-xs">
            <div className="font-semibold">Track #{track.id}</div>
            <div>{track.genesis_region}</div>
            <div>
              {track.start.slice(0, 10)} → {track.end.slice(0, 10)}
            </div>
            <div>Max vor42: {track.max_vor42.toFixed(3)} · {track.quantile}</div>
          </div>
        </Tooltip>
      )}
    </Polyline>
  );
}

// ── Map-level click clears selection ──────────────────────────────────────────
function MapClickHandler({
  onClear,
  hasSelection,
}: {
  onClear: () => void;
  hasSelection: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!hasSelection) return;
    const handler = () => onClear();
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClear, hasSelection]);

  return null;
}
