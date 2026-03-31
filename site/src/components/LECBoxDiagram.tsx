"use client";

import React, { useMemo } from "react";
import { Timestep } from "@/types/cyclone";

interface LECBoxDiagramProps {
  timesteps: Timestep[];
}

/**
 * LEC Box Diagram
 * 
 * Classic 4-box representation of the Lorenz Energy Cycle:
 * - Az (Zonal Available Potential Energy)
 * - Ae (Eddy Available Potential Energy)
 * - Kz (Zonal Kinetic Energy)
 * - Ke (Eddy Kinetic Energy)
 * 
 * Arrows show energy conversions (lifecycle averages).
 * Arrow direction and thickness indicate conversion direction and magnitude.
 * 
 * Data source: De Souza et al. (2025), Climate Dynamics.
 */
export default function LECBoxDiagram({ timesteps }: LECBoxDiagramProps) {
  // Calculate lifecycle averages
  const averages = useMemo(() => {
    const validTs = timesteps.filter(
      (ts) => ts.Az != null && ts.Ae != null && ts.Kz != null && ts.Ke != null
    );

    if (validTs.length === 0) return null;

    const mean = (arr: (number | null | undefined)[]) => {
      const valid = arr.filter((x): x is number => x != null);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    };

    return {
      // Energy reservoirs (×10⁵ J/m²)
      Az: mean(validTs.map((ts) => ts.Az)) / 1e5,
      Ae: mean(validTs.map((ts) => ts.Ae)) / 1e5,
      Kz: mean(validTs.map((ts) => ts.Kz)) / 1e5,
      Ke: mean(validTs.map((ts) => ts.Ke)) / 1e5,
      // Conversions (W/m²)
      Ca: mean(validTs.map((ts) => ts.Ca)),
      Ce: mean(validTs.map((ts) => ts.Ce)),
      Ck: mean(validTs.map((ts) => ts.Ck)),
      Cz: mean(validTs.map((ts) => ts.Cz)),
      // Generation terms
      Gz: mean(validTs.map((ts) => ts.Gz)),
      Ge: mean(validTs.map((ts) => ts.Ge)),
      // Count for display
      count: validTs.length,
    };
  }, [timesteps]);

  if (!averages) {
    return (
      <div className="text-center text-gray-500 py-8">
        No LEC energetics data available for this cyclone.
      </div>
    );
  }

  // Format number for display
  const fmt = (val: number, decimals = 1) => {
    if (Math.abs(val) < 0.01) return "0.0";
    return val.toFixed(decimals);
  };

  // Arrow component for energy flow
  const Arrow = ({
    value,
    direction,
    label,
  }: {
    value: number;
    direction: "right" | "down" | "left" | "up";
    label: string;
  }) => {
    const isPositive = value >= 0;
    const thickness = Math.min(3, Math.max(1, Math.abs(value) / 2));
    const color = isPositive ? "#16a34a" : "#dc2626";
    
    const arrows: Record<string, string> = {
      right: isPositive ? "→" : "←",
      left: isPositive ? "←" : "→",
      down: isPositive ? "↓" : "↑",
      up: isPositive ? "↑" : "↓",
    };

    return (
      <div className="flex flex-col items-center justify-center text-xs">
        <span className="font-medium text-gray-600">{label}</span>
        <span
          style={{ color, fontWeight: "bold", fontSize: `${12 + thickness * 2}px` }}
        >
          {arrows[direction]}
        </span>
        <span style={{ color }}>{fmt(Math.abs(value))}</span>
      </div>
    );
  };

  // Box component for energy reservoir
  const EnergyBox = ({
    label,
    value,
    color,
    subtext,
  }: {
    label: string;
    value: number;
    color: string;
    subtext: string;
  }) => (
    <div
      className="w-20 h-20 rounded-lg flex flex-col items-center justify-center border-2"
      style={{ borderColor: color, backgroundColor: `${color}15` }}
    >
      <span className="text-xs text-gray-500">{subtext}</span>
      <span className="font-bold text-lg" style={{ color }}>
        {label}
      </span>
      <span className="text-xs font-medium">{fmt(value)}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      <h4 className="text-sm font-medium text-gray-700 mb-3">
        Lorenz Energy Cycle (Lifecycle Averages)
      </h4>
      
      {/* LEC Box Diagram */}
      <div className="grid grid-cols-5 gap-2 items-center justify-items-center">
        {/* Row 1: Generation Gz */}
        <div></div>
        <Arrow value={averages.Gz} direction="down" label="Gz" />
        <div></div>
        <Arrow value={averages.Ge} direction="down" label="Ge" />
        <div></div>

        {/* Row 2: Az and Ae */}
        <div></div>
        <EnergyBox label="Az" value={averages.Az} color="#1e40af" subtext="Zonal APE" />
        <Arrow value={averages.Ca} direction="right" label="Ca" />
        <EnergyBox label="Ae" value={averages.Ae} color="#dc2626" subtext="Eddy APE" />
        <div></div>

        {/* Row 3: Cz and Ce arrows */}
        <div></div>
        <Arrow value={averages.Cz} direction="down" label="Cz" />
        <div></div>
        <Arrow value={averages.Ce} direction="down" label="Ce" />
        <div></div>

        {/* Row 4: Kz and Ke */}
        <div></div>
        <EnergyBox label="Kz" value={averages.Kz} color="#3b82f6" subtext="Zonal KE" />
        <Arrow value={averages.Ck} direction="left" label="Ck" />
        <EnergyBox label="Ke" value={averages.Ke} color="#f97316" subtext="Eddy KE" />
        <div></div>
      </div>

      {/* Legend */}
      <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
        <p>
          Reservoirs: ×10⁵ J/m² | Conversions: W/m²
        </p>
        <p>
          <span className="text-green-600">Green</span> = positive (forward) |{" "}
          <span className="text-red-600">Red</span> = negative (reverse)
        </p>
        <p className="text-gray-400">
          Based on {averages.count} timesteps with valid LEC data
        </p>
      </div>
    </div>
  );
}
