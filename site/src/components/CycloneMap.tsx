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
 */

import { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  TrackSummary,
  Timestep,
  PHASE_COLORS,
  Wind100TimestepEntry,
  Wind100Meta,
  Wind100Metric,
} from "@/types/cyclone";
import { formatDatetime, formatLat, formatLon } from "@/lib/utils";
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
const STYLE_DEFAULT      = { color: "#2563eb", weight: 1,   opacity: 0.30 };
const STYLE_HOVER        = { color: "#1d4ed8", weight: 2,   opacity: 0.70 };
const STYLE_SELECTED     = { color: "#ea580c", weight: 2.5, opacity: 1    };
const STYLE_SELECTED_DIM = { color: "#ea580c", weight: 1.5, opacity: 0.12 }; // timestep-active
const STYLE_DIMMED       = { color: "#93c5fd", weight: 0.8, opacity: 0.18 };

export default function CycloneMap({
  tracks,
  selectedTrack,
  timesteps,
  selectedTimestep,
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
        {tracks.map((track) => {
          const isSelected = selectedTrack?.id === track.id;
          const isDimmed = selectedTrack !== null && !isSelected;
          const positions = track.coords.map(
            ([lon, lat]) => [lat, lon] as [number, number]
          );

          const style = isSelected
            ? selectedTrackStyle
            : isDimmed
            ? STYLE_DIMMED
            : STYLE_DEFAULT;

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
        {selectedTrack &&
          timesteps?.map((ts, i) => {
            const pos: [number, number] = [ts.lat, ts.lon];
            const color = PHASE_COLORS[ts.phase] ?? "#94a3b8";
            const isThisSelected =
              selectedTimestep !== null &&
              selectedTimestep.date === ts.date &&
              selectedTimestep.lon === ts.lon;

            // When a timestep is active, fade all others to context
            if (selectedTimestep && !isThisSelected) {
              return (
                <CircleMarker
                  key={`ts-${selectedTrack.id}-${i}`}
                  center={pos}
                  radius={2}
                  pathOptions={{
                    fillColor: color,
                    color: "#ffffff",
                    weight: 0.5,
                    fillOpacity: 0.18,
                    opacity: 0.25,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      onTimestepSelect(ts);
                    },
                  }}
                />
              );
            }

            // Selected timestep: large highlighted marker
            if (isThisSelected) {
              return (
                <CircleMarker
                  key={`ts-${selectedTrack.id}-${i}`}
                  center={pos}
                  radius={9}
                  pathOptions={{
                    fillColor: color,
                    color: "#1e293b",
                    weight: 2.5,
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
                radius={4}
                pathOptions={{
                  fillColor: color,
                  color: "#ffffff",
                  weight: 1,
                  fillOpacity: 0.9,
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    onTimestepSelect(ts);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
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

// ── Per-track polyline with hover handling ────────────────────────────────────
interface TrackPolylineProps {
  track: TrackSummary;
  positions: [number, number][];
  style: typeof STYLE_DEFAULT;
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
