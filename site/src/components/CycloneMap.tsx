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
 * Wind overlay:
 *   - Shown when selectedTimestep !== null AND windTrackData / windMeta are
 *     provided. Only the height implied by the active display variable is
 *     drawn — there is no combined view, so the geometry on screen always has
 *     one unambiguous meaning: circles are 10 m, squares are 100 m.
 *   - While the overlay is active the track polyline is dimmed to near-
 *     invisibility; non-selected timestep markers are also faded.
 *   - The selected timestep gets a larger, bright marker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ## Intensity-Based Track Coloring (unselected state)
 *
 * When no cyclone is selected, track colours reflect the peak value of the
 * ACTIVE display variable — central relative vorticity (×10⁻⁵ s⁻¹), 10 m wind,
 * or 100 m wind (m s⁻¹). The intensity filter reads the same thresholds, so the
 * colours on screen and the filter bounds always describe the same quantity.
 *
 * Color scheme:
 *   - **Gray**: Tracks below the 10th percentile (p10) — low-intensity cyclones
 *   - **Yellow → Orange → Red**: Tracks at or above p10, with more intense
 *     cyclones appearing more red
 *
 * Percentile calculation:
 *   - Computed at the **cyclone level** (the track's peak), not per timestep
 *   - Thresholds are **global** across the entire dataset (6,789 tracks),
 *     not recalculated dynamically for filtered subsets
 *   - Pre-computed in `scripts/preprocess_data.py` and stored in `summary.json`
 *
 * When a cyclone is selected:
 *   - Selected track: orange (#ea580c), full opacity
 *   - Other tracks: dimmed light blue (#93c5fd), low opacity
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  Tooltip,
  Pane,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  TrackSummary,
  Timestep,
  PHASE_COLORS,
  QuantileThresholds,
  WindTimestepEntry,
  WindMeta,
  WindMetric,
  WindLevelKey,
  DisplayVariable,
  DisplayVariableInfo,
  BasinCollection,
  BasinFeature,
} from "@/types/cyclone";
import { formatDatetime, formatLat, formatLon } from "@/lib/utils";
import { getIntensityColor, quantileRank, INTENSITY_COLORS } from "@/lib/colors";
import WindMapOverlay, { WindLegend } from "./WindMapOverlay";
import { markerShapeFor } from "@/lib/windQuadrants";

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
  /** Active display variable and its descriptor (thresholds, label, unit). */
  displayVariable: DisplayVariable;
  displayInfo: DisplayVariableInfo | null;
  onTrackSelect: (track: TrackSummary) => void;
  onTimestepSelect: (ts: Timestep) => void;
  onClearSelection: () => void;
  // Wind overlay — all optional; overlay is silently skipped when absent
  windTrackData: Record<string, WindTimestepEntry> | null;
  windMeta: WindMeta | null;
  /** Height to draw, derived from displayVariable — never independent of it. */
  windLevel: WindLevelKey;
  windMetric: WindMetric;
  // Basin overlay — all optional
  basinCollection: BasinCollection | null;
  selectedBasins: string[];
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
const INCREASED_WEIGHT = 2.5; // Used when few tracks are visible
const DEFAULT_OPACITY = 0.45;
// Threshold: if fewer than this many tracks visible, increase weight for easier clicking
const FEW_TRACKS_THRESHOLD = 10;

export default function CycloneMap({
  tracks,
  selectedTrack,
  timesteps,
  selectedTimestep,
  displayVariable,
  displayInfo,
  onTrackSelect,
  onTimestepSelect,
  onClearSelection,
  windTrackData,
  windMeta,
  windLevel,
  windMetric,
  basinCollection,
  selectedBasins,
}: CycloneMapProps) {
  const thresholds = displayInfo?.quantile_thresholds ?? null;
  const decimals = displayInfo?.decimals ?? 3;

  // Resolve the wind entry for the selected timestep, at the active height only.
  const windEntry =
    selectedTimestep && windTrackData
      ? (windTrackData[selectedTimestep.date] ?? null)
      : null;
  const levelEntry = windEntry?.[windLevel] ?? null;
  const metricData = levelEntry
    ? windMetric === "max" ? levelEntry.max : levelEntry.p99
    : null;

  // Colour normalisation uses the active level's dataset-wide maximum, so the
  // palette means the same thing at both heights but is not compressed by the
  // stronger 100 m winds when 10 m is being shown.
  const levelMeta = windMeta?.levels?.[windLevel === "w100" ? "wind100" : "wind10"] ?? null;
  const globalMax = levelMeta
    ? windMetric === "max" ? levelMeta.max_global_max : levelMeta.p99_global_max
    : 54; // safe fallback

  const markerShape = markerShapeFor(displayVariable);

  // Dim the polyline further when a specific timestep is focused
  const selectedTrackStyle = selectedTimestep ? STYLE_SELECTED_DIM : STYLE_SELECTED;

  // When few tracks are visible (due to filters), increase stroke weight for easier clicking
  const hasFewTracks = !selectedTrack && tracks.length < FEW_TRACKS_THRESHOLD;
  const effectiveWeight = hasFewTracks ? INCREASED_WEIGHT : DEFAULT_WEIGHT;

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

        {/* ── Sedimentary Basin polygons (rendered below tracks) ────────────── */}
        {basinCollection && (
          <Pane name="basins" style={{ zIndex: 400 }}>
            <BasinLayer
              basins={basinCollection}
              selectedBasins={selectedBasins}
            />
          </Pane>
        )}

        {/* ── Track polylines pane (above basins, below timestep markers) ──── */}
        <Pane name="tracks" style={{ zIndex: 500 }}>
          {/* Render tracks based on selection state.
              When selected, only render the selected track.
              When not selected, render all tracks with intensity colors. */}
          {selectedTrack ? (
            // Single selected track mode
            <TrackPolyline
              key={`sel-${selectedTrack.id}`}
              track={selectedTrack}
              positions={selectedTrack.coords.map(
                ([lon, lat]) => [lat, lon] as [number, number]
              )}
              style={selectedTrackStyle}
              isSelected={true}
              onSelect={onTrackSelect}
              pane="tracks"
              info={displayInfo}
            />
          ) : (
            // All tracks mode - each track gets a stable key
            tracks.map((track) => {
              const positions = track.coords.map(
                ([lon, lat]) => [lat, lon] as [number, number]
              );
              const trackPeak = displayInfo ? track[displayInfo.field] : undefined;
              const intensityColor = thresholds
                ? getIntensityColor(trackPeak, thresholds)
                : INTENSITY_COLORS.gray;
              const style = { color: intensityColor, weight: effectiveWeight, opacity: DEFAULT_OPACITY };

              return (
                <TrackPolyline
                  key={track.id}
                  track={track}
                  positions={positions}
                  style={style}
                  isSelected={false}
                  onSelect={onTrackSelect}
                  pane="tracks"
                  info={displayInfo}
                />
              );
            })
          )}
        </Pane>

        {/* ── Persistent panes — always in the DOM, never block clicks ───────── */}
        <Pane name="wind-markers" style={{ zIndex: 700 }} />

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
                        e.originalEvent?.stopPropagation();
                        onTimestepSelect(ts);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                      <div className="text-xs">
                        <div className="font-semibold">{formatDatetime(ts.date)}</div>
                        <div>{formatLat(ts.lat)}, {formatLon(ts.lon)}</div>
                        <div className="capitalize" style={{ color }}>
                          {ts.phase} · ζ = {ts.vor42.toFixed(3)}
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
                        e.originalEvent?.stopPropagation();
                        onTimestepSelect(ts);
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                      <div className="text-xs">
                        <div className="font-semibold">{formatDatetime(ts.date)}</div>
                        <div>{formatLat(ts.lat)}, {formatLon(ts.lon)}</div>
                        <div className="capitalize" style={{ color }}>
                          {ts.phase} · ζ = {ts.vor42.toFixed(3)}
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

        {/* ── Wind overlay (only when a timestep is selected) ──────────────── */}
        {selectedTimestep && (
          <WindMapOverlay
            cycloneLat={selectedTimestep.lat}
            cycloneLon={selectedTimestep.lon}
            date={selectedTimestep.date}
            data={metricData}
            metric={windMetric}
            shape={markerShape}
            levelLabel={levelMeta?.label ?? (windLevel === "w100" ? "Wind 100 m" : "Wind 10 m")}
            globalMax={globalMax}
          />
        )}

        {/* ── Intensity legend (only when no track selected) ─────────────── */}
        {!selectedTrack && thresholds && displayInfo && (
          <IntensityLegend thresholds={thresholds} info={displayInfo} />
        )}

        {/* ── Map event handler (click on ocean clears selection) ─────────── */}
        <MapClickHandler onClear={onClearSelection} hasSelection={selectedTrack !== null} />
      </MapContainer>

      {/* ── Wind legend (sits over the map, outside MapContainer) ──────────── */}
      {selectedTimestep && windMeta && (
        <WindLegend
          globalMax={globalMax}
          metric={windMetric}
          shape={markerShape}
          levelLabel={levelMeta?.label ?? (windLevel === "w100" ? "Wind 100 m" : "Wind 10 m")}
        />
      )}
    </div>
  );
}

// ── Intensity Legend ──────────────────────────────────────────────────────────
/**
 * Colour-ramp legend for the active display variable.
 *
 * Labels and units come from the variable's own descriptor, so the legend can
 * never claim a unit the colours do not represent.
 */
function IntensityLegend({
  thresholds,
  info,
}: {
  thresholds: QuantileThresholds;
  info: DisplayVariableInfo;
}) {
  // Vorticity reads naturally at 1 dp here; winds at 0 dp keep the ends short.
  const nd = info.field === "max_vor42" ? 1 : 0;
  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control bg-white/95 backdrop-blur-sm rounded-lg shadow-md p-3 mr-3 mb-3">
        <div className="text-xs font-semibold text-gray-700 mb-2">
          Peak {info.label.toLowerCase()}
        </div>
        <div className="flex items-center gap-1">
          {/* Gray: below p10, or no value for this variable */}
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
              <span>{thresholds.p10.toFixed(nd)}</span>
              <span>{thresholds.max.toFixed(nd)}</span>
            </div>
          </div>
        </div>
        <div className="text-[9px] text-gray-400 mt-1.5">{info.unit}</div>
      </div>
    </div>
  );
}

// ── Per-track polyline with hover handling ────────────────────────────────────
interface TrackPolylineProps {
  track: TrackSummary;
  positions: [number, number][];
  style: { color: string; weight: number; opacity: number };
  isSelected: boolean;
  onSelect: (t: TrackSummary) => void;
  pane: string;
  /** Active display variable, so the tooltip reports the quantity on screen. */
  info: DisplayVariableInfo | null;
}

function TrackPolyline({
  track,
  positions,
  style,
  isSelected,
  onSelect,
  pane,
  info,
}: TrackPolylineProps) {
  // Tooltip reports the ACTIVE variable, and derives the rank from the same
  // thresholds that produced the colour — so the number, the word and the
  // colour on screen can never describe different things.
  const label = info ? info.label.toLowerCase() : "intensity";
  const peak = info ? track[info.field] : undefined;
  const peakText =
    peak === undefined || peak === null
      ? "no data"
      : `${peak.toFixed(info?.decimals ?? 2)} ${info?.unit ?? ""}`.trim();
  const rank = info ? quantileRank(peak, info.quantile_thresholds) : null;
  const polylineRef = useRef<L.Polyline | null>(null);

  const handleClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      // Stop both Leaflet and DOM propagation so the map-level click handler
      // (which calls onClear) never fires when a track polyline is clicked.
      L.DomEvent.stopPropagation(e);
      e.originalEvent?.stopPropagation();
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
      pathOptions={{ ...style, pane }}
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
            <div>
              Peak {label}: {peakText}
              {rank ? ` · ${rank}` : ""}
            </div>
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

  // useLayoutEffect (synchronous) ensures the handler is removed immediately
  // after `hasSelection` becomes false — before the next browser paint.
  // This closes the race-condition window where a track click could fire the
  // map click (which calls onClear) within the same React batch, clearing the
  // selection that was just set.
  useLayoutEffect(() => {
    if (!hasSelection) return;
    const handler = () => onClear();
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClear, hasSelection]);

  return null;
}

// ── Basin layer component ─────────────────────────────────────────────────────
// Basin polygon styling constants
// Note: interactive: false allows clicks to pass through to tracks
const BASIN_STYLE_DEFAULT: L.PathOptions = {
  color: "#0d9488",      // teal-600
  weight: 1.5,
  opacity: 0.6,
  fillColor: "#14b8a6",  // teal-500
  fillOpacity: 0.08,
  interactive: false,    // Don't capture mouse events - let tracks handle them
};

const BASIN_STYLE_SELECTED: L.PathOptions = {
  color: "#0f766e",      // teal-700
  weight: 2.5,
  opacity: 0.9,
  fillColor: "#14b8a6",  // teal-500
  fillOpacity: 0.18,
  interactive: false,
};

const BASIN_STYLE_HOVER: L.PathOptions = {
  color: "#0d9488",      // teal-600
  weight: 2,
  opacity: 0.8,
  fillColor: "#14b8a6",  // teal-500
  fillOpacity: 0.15,
  interactive: false,
};

interface BasinLayerProps {
  basins: BasinCollection;
  selectedBasins: string[];
}

function BasinLayer({ basins, selectedBasins }: BasinLayerProps) {
  const selectedSet = new Set(selectedBasins);

  // Style function for GeoJSON features
  // Note: interactive: false is set in the style constants, so basins don't capture
  // mouse events. This allows tracks to be clicked even when they overlap basins.
  // Basin selection is done via the FilterPanel, not by clicking on the map.
  const getStyle = useCallback((feature?: GeoJSON.Feature): L.PathOptions => {
    if (!feature) return BASIN_STYLE_DEFAULT;
    const basinId = feature.id as string;
    return selectedSet.has(basinId) ? BASIN_STYLE_SELECTED : BASIN_STYLE_DEFAULT;
  }, [selectedSet]);

  // Create a unique key that changes when selection changes
  // This forces GeoJSON component to re-render with new styles
  const key = `basins-${selectedBasins.sort().join('-')}`;

  return (
    <GeoJSON
      key={key}
      data={basins as unknown as GeoJSON.GeoJsonObject}
      style={getStyle}
    />
  );
}
