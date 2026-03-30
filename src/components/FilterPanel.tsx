"use client";

import { useState } from "react";
import { FilterState, SummaryData, MONTH_NAMES } from "@/types/cyclone";
import { toggleValue } from "@/lib/filters";

interface FilterPanelProps {
  summaryData: SummaryData;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  filteredCount: number;
}

export default function FilterPanel({
  summaryData,
  filters,
  onFiltersChange,
  filteredCount,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState<"year" | "month" | "region" | null>("year");

  const hasFilters =
    filters.years.length > 0 ||
    filters.months.length > 0 ||
    filters.regions.length > 0;

  function clearAll() {
    onFiltersChange({ years: [], months: [], regions: [] });
  }

  function toggleYear(y: number) {
    onFiltersChange({ ...filters, years: toggleValue(filters.years, y) });
  }
  function toggleMonth(m: number) {
    onFiltersChange({ ...filters, months: toggleValue(filters.months, m) });
  }
  function toggleRegion(r: string) {
    onFiltersChange({ ...filters, regions: toggleValue(filters.regions, r) });
  }

  return (
    <div className="flex flex-col border-b border-slate-700/60 flex-shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Filters
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredCount.toLocaleString()} tracks visible
          </p>
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-400 hover:text-blue-300 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Year filter */}
      <FilterSection
        title="Year"
        active={filters.years.length > 0}
        expanded={expanded === "year"}
        onToggle={() => setExpanded(expanded === "year" ? null : "year")}
        badgeCount={filters.years.length}
      >
        <div className="grid grid-cols-5 gap-1">
          {summaryData.years.map((y) => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={`text-xs px-1 py-0.5 rounded transition ${
                filters.years.includes(y)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Month filter */}
      <FilterSection
        title="Month"
        active={filters.months.length > 0}
        expanded={expanded === "month"}
        onToggle={() => setExpanded(expanded === "month" ? null : "month")}
        badgeCount={filters.months.length}
      >
        <div className="grid grid-cols-4 gap-1">
          {summaryData.months.map((m) => (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`text-xs px-1 py-0.5 rounded transition ${
                filters.months.includes(m)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {MONTH_NAMES[m - 1]}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Region filter */}
      <FilterSection
        title="Genesis Region"
        active={filters.regions.length > 0}
        expanded={expanded === "region"}
        onToggle={() => setExpanded(expanded === "region" ? null : "region")}
        badgeCount={filters.regions.length}
      >
        <div className="flex flex-col gap-1">
          {summaryData.regions.map((r) => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`text-xs text-left px-2 py-1 rounded transition ${
                filters.regions.includes(r)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

// ── Sub-component: collapsible filter section ─────────────────────────────────
interface FilterSectionProps {
  title: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  badgeCount: number;
  children: React.ReactNode;
}

function FilterSection({
  title,
  active,
  expanded,
  onToggle,
  badgeCount,
  children,
}: FilterSectionProps) {
  return (
    <div className="border-t border-slate-700/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition"
      >
        <span className={`text-xs font-medium ${active ? "text-blue-400" : "text-slate-400"}`}>
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badgeCount > 0 && (
            <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0 leading-4">
              {badgeCount}
            </span>
          )}
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 custom-scrollbar max-h-40 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}
