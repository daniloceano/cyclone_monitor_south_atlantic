"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Timestep } from "@/types/cyclone";

interface LECTimeSeriesProps {
  timesteps: Timestep[];
  showReservoirs?: boolean;
  showConversions?: boolean;
  showBoundaries?: boolean;
}

/**
 * LEC Time Series Chart
 *
 * Three optional panels:
 *   1. Energy Reservoirs: Az, Ae, Kz, Ke  (×10⁵ J m⁻²)
 *   2. Energy Conversions & Generation: Ca, Ce, Ck, Cz, Gz, Ge  (W m⁻²)
 *   3. Boundary Fluxes: BAz, BAe, BKz, BKe  (W m⁻²)
 *
 * Colour palette (grouping: Zonal APE = #b1cff2, Eddy APE = #ccd3bf,
 *                            Zonal KE  = #fad99b, Eddy KE  = #ea9393,
 *                            Gz = #b566f3, Ge = #a66e5b)
 *
 * Data source: De Souza et al. (2025), Climate Dynamics.
 */
export default function LECTimeSeries({
  timesteps,
  showReservoirs = true,
  showConversions = true,
  showBoundaries = true,
}: LECTimeSeriesProps) {
  // Colour palette — grouped by energy reservoir affinity
  const C = {
    Az:  "#b1cff2",  // Zonal APE
    Ae:  "#ccd3bf",  // Eddy APE
    Kz:  "#fad99b",  // Zonal KE
    Ke:  "#ea9393",  // Eddy KE
    // Conversions share colours with source reservoir
    Cz:  "#b1cff2",  // Az→Kz
    Ca:  "#ccd3bf",  // Az→Ae
    Ck:  "#fad99b",  // Ke→Kz
    Ce:  "#ea9393",  // Ae→Ke
    // Boundaries share colours with their reservoir
    BAz: "#b1cff2",
    BAe: "#ccd3bf",
    BKz: "#fad99b",
    BKe: "#ea9393",
    // Generation
    Gz:  "#b566f3",
    Ge:  "#a66e5b",
  };

  const chartData = timesteps.map((ts, idx) => ({
    hour: idx,
    date: new Date(ts.date).toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      hour:  "2-digit",
    }),
    // Reservoirs scaled to ×10⁵ J m⁻²
    Az:  ts.Az  != null ? ts.Az  / 1e5 : null,
    Ae:  ts.Ae  != null ? ts.Ae  / 1e5 : null,
    Kz:  ts.Kz  != null ? ts.Kz  / 1e5 : null,
    Ke:  ts.Ke  != null ? ts.Ke  / 1e5 : null,
    // Conversions (W m⁻²)
    Ca:  ts.Ca,
    Ce:  ts.Ce,
    Ck:  ts.Ck,
    Cz:  ts.Cz,
    // Generation (W m⁻²)
    Gz:  ts.Gz,
    Ge:  ts.Ge,
    // Boundary fluxes (W m⁻²)
    BAz: ts.BAz,
    BAe: ts.BAe,
    BKz: ts.BKz,
    BKe: ts.BKe,
  }));

  const hasLECData = chartData.some((d) => d.Az != null || d.Ca != null);

  if (!hasLECData) {
    return (
      <div className="text-center text-gray-500 py-8 text-xs">
        No LEC energetics data available for this cyclone.
      </div>
    );
  }

  const commonXAxis = (
    <XAxis
      dataKey="hour"
      tick={{ fontSize: 10 }}
      tickFormatter={(h: number) => `${h}h`}
      interval="preserveStartEnd"
    />
  );

  const commonTooltip = (
    <Tooltip
      contentStyle={{ fontSize: 11 }}
      labelFormatter={(h: number) => `Hour ${h}`}
      formatter={(value: number) =>
        typeof value === "number" ? value.toFixed(3) : "N/A"
      }
    />
  );

  return (
    <div className="space-y-6">
      {/* ── 1. Energy Reservoirs ─────────────────────────────────────────── */}
      {showReservoirs && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Energy Reservoirs (×10⁵ J m⁻²)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                {commonXAxis}
                <YAxis tick={{ fontSize: 10 }} width={40} />
                {commonTooltip}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Az" stroke={C.Az} strokeWidth={2} dot={false} name="Az (Zonal APE)" connectNulls />
                <Line type="monotone" dataKey="Ae" stroke={C.Ae} strokeWidth={2} dot={false} name="Ae (Eddy APE)"  connectNulls />
                <Line type="monotone" dataKey="Kz" stroke={C.Kz} strokeWidth={2} dot={false} name="Kz (Zonal KE)"  connectNulls />
                <Line type="monotone" dataKey="Ke" stroke={C.Ke} strokeWidth={2} dot={false} name="Ke (Eddy KE)"   connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 2. Energy Conversions & Generation ──────────────────────────── */}
      {showConversions && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Energy Conversions &amp; Generation (W m⁻²)
          </h4>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                {commonXAxis}
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                {commonTooltip}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Ca" stroke={C.Ca} strokeWidth={2} dot={false} name="Ca (Az→Ae)"      connectNulls />
                <Line type="monotone" dataKey="Ce" stroke={C.Ce} strokeWidth={2} dot={false} name="Ce (Ae→Ke)"      connectNulls />
                <Line type="monotone" dataKey="Ck" stroke={C.Ck} strokeWidth={2} dot={false} name="Ck (Ke→Kz)"      connectNulls />
                <Line type="monotone" dataKey="Cz" stroke={C.Cz} strokeWidth={2} dot={false} name="Cz (Az→Kz)"      connectNulls strokeDasharray="5 3" />
                <Line type="monotone" dataKey="Gz" stroke={C.Gz} strokeWidth={2} dot={false} name="Gz (Zonal gen.)" connectNulls strokeDasharray="3 3" />
                <Line type="monotone" dataKey="Ge" stroke={C.Ge} strokeWidth={2} dot={false} name="Ge (Eddy gen.)"  connectNulls strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 3. Boundary Fluxes ───────────────────────────────────────────── */}
      {showBoundaries && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Boundary Fluxes (W m⁻²)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                {commonXAxis}
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                {commonTooltip}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="BAz" stroke={C.BAz} strokeWidth={2} dot={false} name="BAz (Az boundary)" connectNulls />
                <Line type="monotone" dataKey="BAe" stroke={C.BAe} strokeWidth={2} dot={false} name="BAe (Ae boundary)" connectNulls />
                <Line type="monotone" dataKey="BKz" stroke={C.BKz} strokeWidth={2} dot={false} name="BKz (Kz boundary)" connectNulls />
                <Line type="monotone" dataKey="BKe" stroke={C.BKe} strokeWidth={2} dot={false} name="BKe (Ke boundary)" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
