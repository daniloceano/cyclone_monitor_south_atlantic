"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Timestep, PHASE_COLORS, PHASE_LABELS } from "@/types/cyclone";

interface VorticityTimeSeriesProps {
  timesteps: Timestep[];
  /** Currently selected timestep (for highlighting) */
  selectedTimestep?: Timestep | null;
  /** Callback when clicking on the chart to select a timestep */
  onTimestepSelect?: (ts: Timestep) => void;
}

interface ChartDataPoint {
  idx: number;
  hour: number;
  date: string;
  dateLabel: string;
  vor42: number;
  phase: string;
}

/**
 * Vorticity Time Series Chart
 *
 * Displays the central vorticity (vor42) over the cyclone's lifecycle with
 * colored background regions indicating lifecycle phases (following the
 * CycloPhaser convention from de Souza et al., IJC 2024).
 *
 * Phase colors:
 *   - Incipient: light blue (#b1cff2)
 *   - Intensification: light orange (#fad99b)
 *   - Mature: light red (#ea9393)
 *   - Decay: light green-gray (#ccd3bf)
 *   - Dissipation: gray (#9e9e9e)
 *
 * Variable:
 *   Central relative vorticity — relative vorticity at 850 hPa, spectrally
 *   filtered to T42 and stored as a magnitude (×10⁻⁵ s⁻¹). The column is named
 *   vor42 internally; that name is not shown to the user.
 *   This is the central tracking vorticity from CycloPhaser/Hodges tracking.
 */
export default function VorticityTimeSeries({
  timesteps,
  selectedTimestep,
  onTimestepSelect,
}: VorticityTimeSeriesProps) {
  if (!timesteps || timesteps.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4 text-xs">
        No timestep data available.
      </div>
    );
  }

  // Transform data for the chart
  // Note: vor42 is stored as absolute value (positive), but Southern Hemisphere
  // cyclones have negative vorticity. We multiply by -1 to show the physical value.
  const chartData: ChartDataPoint[] = timesteps.map((ts, idx) => ({
    idx,
    hour: idx, // Assuming hourly data
    date: ts.date,
    dateLabel: new Date(ts.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    }),
    vor42: -ts.vor42,  // Negative for Southern Hemisphere
    phase: ts.phase,
  }));

  // Identify phase regions (contiguous segments of the same phase)
  const phaseRegions: { phase: string; start: number; end: number }[] = [];
  let currentPhase = chartData[0]?.phase;
  let regionStart = 0;
  
  for (let i = 1; i <= chartData.length; i++) {
    const phase = chartData[i]?.phase;
    if (phase !== currentPhase || i === chartData.length) {
      phaseRegions.push({
        phase: currentPhase,
        start: regionStart,
        end: i - 1,
      });
      if (i < chartData.length) {
        currentPhase = phase;
        regionStart = i;
      }
    }
  }

  // Find the index of the selected timestep
  const selectedIdx = selectedTimestep
    ? chartData.findIndex((d) => d.date === selectedTimestep.date)
    : -1;

  // Calculate Y-axis domain with padding
  const vorValues = chartData.map((d) => d.vor42);
  const minVor = Math.min(...vorValues);
  const maxVor = Math.max(...vorValues);
  const padding = (maxVor - minVor) * 0.1 || 0.1;
  const yMin = minVor - padding;
  const yMax = maxVor + padding;

  return (
    <div className="space-y-2">
      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
            onClick={(state) => {
              // Recharts passes state with activePayload on click
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const activePayload = (state as any)?.activePayload;
              if (activePayload?.[0]?.payload && onTimestepSelect) {
                const idx = activePayload[0].payload.idx as number;
                onTimestepSelect(timesteps[idx]);
              }
            }}
          >
            {/* Phase background regions */}
            {phaseRegions.map((region, i) => (
              <ReferenceArea
                key={`phase-${i}`}
                x1={region.start}
                x2={region.end}
                y1={yMin}
                y2={yMax}
                fill={PHASE_COLORS[region.phase] ?? "#e5e7eb"}
                fillOpacity={0.4}
                strokeOpacity={0}
              />
            ))}

            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9 }}
              tickFormatter={(h: number) => `${h}h`}
              interval="preserveStartEnd"
            />
            
            <YAxis
              tick={{ fontSize: 9 }}
              width={35}
              domain={[yMin, yMax]}
              tickFormatter={(v) => v.toFixed(1)}
            />
            
            <Tooltip
              contentStyle={{ fontSize: 11, padding: "8px" }}
              labelFormatter={(h) => {
                const idx = typeof h === "number" ? h : parseInt(String(h), 10) || 0;
                const d = chartData[idx];
                return d ? d.dateLabel : `Hour ${idx}`;
              }}
              formatter={(value, _name, props) => {
                const numValue = typeof value === "number" ? value : 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const phase = (props.payload as any)?.phase;
                return [
                  `${numValue.toFixed(3)} ×10⁻⁵ s⁻¹ (${PHASE_LABELS[phase] ?? phase})`,
                  "Central relative vorticity",
                ];
              }}
            />

            {/* Main vorticity line */}
            <Line
              type="monotone"
              dataKey="vor42"
              stroke="#1e40af"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "#1e40af", stroke: "#fff", strokeWidth: 2 }}
              name="Central relative vorticity"
            />

            {/* Marker for selected timestep */}
            {selectedIdx >= 0 && (
              <ReferenceArea
                x1={selectedIdx}
                x2={selectedIdx}
                y1={yMin}
                y2={yMax}
                stroke="#1e3a8a"
                strokeWidth={2}
                strokeDasharray="4 2"
                fillOpacity={0}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600 px-1">
        {Object.entries(PHASE_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: PHASE_COLORS[key] }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Info text */}
      <p className="text-[9px] text-gray-400 px-1">
        Click on chart to select timestep · relative vorticity at 850 hPa,
        T42-filtered (×10⁻⁵ s⁻¹)
      </p>
    </div>
  );
}
