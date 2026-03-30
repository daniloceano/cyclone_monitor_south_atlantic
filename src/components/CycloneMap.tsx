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

import { TrackSummary, Timestep, PHASE_COLORS } from "@/types/cyclone";
import { formatDatetime, formatLat, formatLon } from "@/lib/utils";

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
  onTrackSelect: (track: TrackSummary) => void;
  onTimestepSelect: (ts: Timestep) => void;
  onClearSelection: () => void;
}

// South Atlantic centre
const MAP_CENTER: [number, number] = [-42, -35];
const MAP_ZOOM = 3;

// Polyline style constants
const STYLE_DEFAULT = { color: "#3b82f6", weight: 1, opacity: 0.35 };
const STYLE_HOVER   = { color: "#60a5fa", weight: 2, opacity: 0.75 };
const STYLE_SELECTED = { color: "#f97316", weight: 2.5, opacity: 1 };
const STYLE_DIMMED  = { color: "#1e3a5f", weight: 0.8, opacity: 0.2 };

export default function CycloneMap({
  tracks,
  selectedTrack,
  timesteps,
  onTrackSelect,
  onTimestepSelect,
  onClearSelection,
}: CycloneMapProps) {
  // Module-level canvas renderer — shared across all polylines
  const canvasRef = useRef<L.Canvas | null>(null);
  if (!canvasRef.current) {
    canvasRef.current = L.canvas({ padding: 0.5 });
  }
  const renderer = canvasRef.current;

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      style={{ width: "100%", height: "100%" }}
      className="z-0"
      preferCanvas
    >
      {/* Base tile layer — dark ocean-friendly style */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
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
          ? STYLE_SELECTED
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
      {selectedTrack && timesteps?.map((ts, i) => {
        const pos: [number, number] = [ts.lat, ts.lon];
        const color = PHASE_COLORS[ts.phase] ?? "#94a3b8";

        return (
          <CircleMarker
            key={`ts-${selectedTrack.id}-${i}`}
            center={pos}
            radius={4}
            pathOptions={{
              fillColor: color,
              color: "#0f172a",
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

      {/* ── Map event handler (click on ocean clears selection) ─────────── */}
      <MapClickHandler onClear={onClearSelection} hasSelection={selectedTrack !== null} />
    </MapContainer>
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
