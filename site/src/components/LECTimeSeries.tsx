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
}

/**
 * LEC Time Series Chart
 * 
 * Displays temporal evolution of Lorenz Energy Cycle terms:
 * - Energy reservoirs: Az, Ae, Kz, Ke (units: J/m²)
 * - Energy conversions: Ca, Ce, Ck, Cz (units: W/m²)
 * 
 * Data source: De Souza et al. (2025), Climate Dynamics.
 * LEC terms interpolated from 3-hourly to 1-hourly resolution.
 */
export default function LECTimeSeries({
  timesteps,
  showReservoirs = true,
  showConversions = true,
}: LECTimeSeriesProps) {
  // Prepare data for chart
  const chartData = timesteps.map((ts, idx) => ({
    // Use relative hours from start
    hour: idx,
    date: new Date(ts.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    }),
    // Energy reservoirs (×10⁵ J/m²)
    Az: ts.Az != null ? ts.Az / 1e5 : null,
    Ae: ts.Ae != null ? ts.Ae / 1e5 : null,
    Kz: ts.Kz != null ? ts.Kz / 1e5 : null,
    Ke: ts.Ke != null ? ts.Ke / 1e5 : null,
    // Conversions (W/m²)
    Ca: ts.Ca,
    Ce: ts.Ce,
    Ck: ts.Ck,
    Cz: ts.Cz,
    // Lifecycle phase for reference
    phase: ts.phase,
  }));

  // Check if we have any LEC data
  const hasLECData = chartData.some(
    (d) => d.Az != null || d.Ae != null || d.Ca != null
  );

  if (!hasLECData) {
    return (
      <div className="text-center text-gray-500 py-8">
        No LEC energetics data available for this cyclone.
      </div>
    );
  }

  // Colors for energy terms (based on LorenzCycleToolkit conventions)
  const colors = {
    // Zonal terms - blue shades
    Az: "#1e40af", // dark blue
    Kz: "#3b82f6", // medium blue
    // Eddy terms - red/orange shades
    Ae: "#dc2626", // red
    Ke: "#f97316", // orange
    // Conversions
    Ca: "#16a34a", // green
    Ce: "#8b5cf6", // purple
    Ck: "#ec4899", // pink
    Cz: "#06b6d4", // cyan
  };

  return (
    <div className="space-y-6">
      {showReservoirs && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Energy Reservoirs (×10⁵ J/m²)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(h) => `${h}h`}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(h) => `Hour ${h}`}
                  formatter={(value) =>
                    typeof value === "number" ? value.toFixed(2) : "N/A"
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Az"
                  stroke={colors.Az}
                  strokeWidth={2}
                  dot={false}
                  name="Az (Zonal APE)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Ae"
                  stroke={colors.Ae}
                  strokeWidth={2}
                  dot={false}
                  name="Ae (Eddy APE)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Kz"
                  stroke={colors.Kz}
                  strokeWidth={2}
                  dot={false}
                  name="Kz (Zonal KE)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Ke"
                  stroke={colors.Ke}
                  strokeWidth={2}
                  dot={false}
                  name="Ke (Eddy KE)"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {showConversions && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Energy Conversions (W/m²)
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(h) => `${h}h`}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  labelFormatter={(h) => `Hour ${h}`}
                  formatter={(value) =>
                    typeof value === "number" ? value.toFixed(2) : "N/A"
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Ca"
                  stroke={colors.Ca}
                  strokeWidth={2}
                  dot={false}
                  name="Ca (Az→Ae)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Ce"
                  stroke={colors.Ce}
                  strokeWidth={2}
                  dot={false}
                  name="Ce (Ae→Ke)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Ck"
                  stroke={colors.Ck}
                  strokeWidth={2}
                  dot={false}
                  name="Ck (Ke→Kz)"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Cz"
                  stroke={colors.Cz}
                  strokeWidth={2}
                  dot={false}
                  name="Cz (Az→Kz)"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
