"use client";

import { useState } from "react";
import { 
  FilterState, 
  SummaryData, 
  MONTH_NAMES, 
  BasinFilterState,
  BasinCollection,
  BasinIntersections,
  BasinFilterMode,
  EMPTY_BASIN_FILTER,
} from "@/types/cyclone";
import { toggleValue, getBasinFilterModeLabel } from "@/lib/filters";

interface FilterPanelProps {
  summaryData: SummaryData;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  filteredCount: number;
  // Basin filter props
  basinCollection: BasinCollection | null;
  basinIntersections: BasinIntersections | null;
  basinFilter: BasinFilterState;
  onBasinFilterChange: (f: BasinFilterState) => void;
}

export default function FilterPanel({
  summaryData,
  filters,
  onFiltersChange,
  filteredCount,
  basinCollection,
  basinIntersections,
  basinFilter,
  onBasinFilterChange,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState<"year" | "month" | "region" | "basin" | null>("year");

  const hasFilters =
    filters.years.length > 0 ||
    filters.months.length > 0 ||
    filters.regions.length > 0;
  
  const hasBasinFilter = basinFilter.selectedBasins.length > 0;
  const hasAnyFilter = hasFilters || hasBasinFilter;

  function clearAll() {
    onFiltersChange({ years: [], months: [], regions: [] });
    onBasinFilterChange(EMPTY_BASIN_FILTER);
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
  function toggleBasin(basinId: string) {
    onBasinFilterChange({
      ...basinFilter,
      selectedBasins: toggleValue(basinFilter.selectedBasins, basinId),
    });
  }
  function setBasinMode(mode: BasinFilterMode) {
    onBasinFilterChange({
      ...basinFilter,
      mode,
    });
  }
  function clearBasinFilter() {
    onBasinFilterChange(EMPTY_BASIN_FILTER);
  }

  // Get basin count for display
  const getBasinTrackCount = (basinId: string): number => {
    if (!basinIntersections) return 0;
    const basinData = basinIntersections.basins[basinId];
    if (!basinData) return 0;
    // Return count based on current filter mode
    switch (basinFilter.mode) {
      case "center":
        return basinData.stats.center_count;
      case "wind_max":
        return basinData.stats.wind_max_count;
      case "any":
        return basinData.stats.any_count;
      default:
        return basinData.stats.any_count;
    }
  };

  return (
    <div className="flex flex-col border-b border-gray-200 flex-shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Filters
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredCount.toLocaleString()} tracks visible
          </p>
        </div>
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 hover:text-blue-700 transition"
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Basin filter */}
      {basinCollection && (
        <FilterSection
          title="Sedimentary Basin"
          active={hasBasinFilter}
          expanded={expanded === "basin"}
          onToggle={() => setExpanded(expanded === "basin" ? null : "basin")}
          badgeCount={basinFilter.selectedBasins.length}
        >
          <div className="space-y-2">
            {/* Filter mode selector */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-gray-500 mr-1">Filter by:</span>
              {(["any", "center", "wind_max"] as BasinFilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBasinMode(mode)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                    basinFilter.mode === mode
                      ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  title={
                    mode === "center" 
                      ? "Track center passes through basin" 
                      : mode === "wind_max" 
                      ? "Maximum wind position passes through basin"
                      : "Either center or maximum wind passes through basin"
                  }
                >
                  {getBasinFilterModeLabel(mode)}
                </button>
              ))}
            </div>

            {/* Clear basin filter */}
            {hasBasinFilter && (
              <button
                onClick={clearBasinFilter}
                className="text-[10px] text-teal-600 hover:text-teal-700 mb-1"
              >
                Clear basin filter
              </button>
            )}

            {/* Basin list */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
              {basinCollection.features
                .filter((basin) => {
                  // Only show basins that have tracks (for selected mode)
                  const count = getBasinTrackCount(basin.id);
                  return count > 0;
                })
                .sort((a, b) => {
                  // Sort by track count descending
                  return getBasinTrackCount(b.id) - getBasinTrackCount(a.id);
                })
                .map((basin) => {
                  const isSelected = basinFilter.selectedBasins.includes(basin.id);
                  const trackCount = getBasinTrackCount(basin.id);
                  return (
                    <button
                      key={basin.id}
                      onClick={() => toggleBasin(basin.id)}
                      className={`text-xs text-left px-2 py-1.5 rounded transition flex items-center justify-between ${
                        isSelected
                          ? "bg-teal-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span className="truncate mr-2">{basin.properties.display_name}</span>
                      <span className={`text-[10px] ${isSelected ? "text-teal-200" : "text-gray-400"}`}>
                        {trackCount}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Info text */}
            <p className="text-[10px] text-gray-400 mt-1">
              {basinFilter.mode === "center" && "Tracks where cyclone center passes through basin"}
              {basinFilter.mode === "wind_max" && "Tracks where max wind (100m) passes through basin"}
              {basinFilter.mode === "any" && "Tracks where center or max wind passes through basin"}
            </p>
          </div>
        </FilterSection>
      )}
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
    <div className="border-t border-gray-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition"
      >
        <span className={`text-xs font-medium ${active ? "text-blue-600" : "text-gray-500"}`}>
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
            className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
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
