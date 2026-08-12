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
  EMPTY_FILTERS,
  ProcessingFilter,
  CPS_GROUP_COLORS,
} from "@/types/cyclone";
import { toggleValue, getBasinFilterModeLabel, hasActiveFilters } from "@/lib/filters";
import IntensityFilter from "./IntensityFilter";

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
  type SectionKey =
    | "year" | "month" | "region" | "basin"
    | "intensity" | "type" | "processing";
  const [expanded, setExpanded] = useState<SectionKey | null>("year");

  const hasFilters = hasActiveFilters(filters);

  const hasBasinFilter = basinFilter.selectedBasins.length > 0;
  const hasAnyFilter = hasFilters || hasBasinFilter;

  function clearAll() {
    onFiltersChange(EMPTY_FILTERS);
    onBasinFilterChange(EMPTY_BASIN_FILTER);
  }

  function toggleCpsGroup(g: string) {
    onFiltersChange({ ...filters, cpsGroups: toggleValue(filters.cpsGroups, g) });
  }
  function toggleCpsClass(c: string) {
    onFiltersChange({ ...filters, cpsClasses: toggleValue(filters.cpsClasses, c) });
  }
  function setProcessing(p: ProcessingFilter) {
    onFiltersChange({ ...filters, processing: p });
  }

  const typeBadge =
    filters.cpsGroups.length +
    filters.cpsClasses.length +
    (filters.warmSeclusionOnly ? 1 : 0);
  const intensityActive =
    filters.intensity.min !== null || filters.intensity.max !== null;

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

      {/* Intensity filter */}
      {summaryData.intensity_pdf && (
        <FilterSection
          title="Intensity (vor42)"
          active={intensityActive}
          expanded={expanded === "intensity"}
          onToggle={() => setExpanded(expanded === "intensity" ? null : "intensity")}
          badgeCount={intensityActive ? 1 : 0}
          maxHeightClass="max-h-none"
        >
          <IntensityFilter
            pdf={summaryData.intensity_pdf}
            value={filters.intensity}
            onChange={(intensity) => onFiltersChange({ ...filters, intensity })}
            matchCount={filteredCount}
          />
        </FilterSection>
      )}

      {/* Cyclone type (CPS) filter */}
      {summaryData.cps_groups && summaryData.cps_groups.length > 0 && (
        <FilterSection
          title="Cyclone Type (CPS)"
          active={typeBadge > 0}
          expanded={expanded === "type"}
          onToggle={() => setExpanded(expanded === "type" ? null : "type")}
          badgeCount={typeBadge}
          maxHeightClass="max-h-72"
        >
          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 leading-tight">
              Thermal structure from the Cyclone Phase Space. A class is only
              assigned when it persists ≥ 36 h.
            </p>

            {/* Coarse groups */}
            <div className="flex flex-col gap-1">
              {summaryData.cps_groups.map(({ group, count }) => {
                const on = filters.cpsGroups.includes(group);
                return (
                  <button
                    key={group}
                    onClick={() => toggleCpsGroup(group)}
                    className={`text-xs text-left px-2 py-1 rounded transition flex items-center justify-between ${
                      on ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={on ? { background: CPS_GROUP_COLORS[group] ?? "#2563eb" } : undefined}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: CPS_GROUP_COLORS[group] ?? "#9ca3af" }}
                      />
                      {group}
                    </span>
                    <span className={`text-[10px] ${on ? "text-white/70" : "text-gray-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Exact phase_class codes */}
            {summaryData.cps_classes && summaryData.cps_classes.length > 0 && (
              <details className="mt-1">
                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700">
                  Exact class codes
                </summary>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {summaryData.cps_classes.map(({ code, label, count }) => {
                    const on = filters.cpsClasses.includes(code);
                    return (
                      <button
                        key={code}
                        onClick={() => toggleCpsClass(code)}
                        title={`${label} — ${count} cyclones`}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                          on
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {code} <span className="opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            )}

            {/* Warm seclusion */}
            {(summaryData.warm_seclusion_count ?? 0) > 0 && (
              <label className="flex items-start gap-1.5 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.warmSeclusionOnly}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, warmSeclusionOnly: e.target.checked })
                  }
                  className="mt-0.5"
                />
                <span className="text-[11px] text-gray-600 leading-tight">
                  Warm seclusion only{" "}
                  <span className="text-gray-400">
                    ({summaryData.warm_seclusion_count})
                  </span>
                  <span className="block text-[9px] text-gray-400">
                    Systems with a persistent run rejected as a Shapiro–Keyser
                    warm seclusion rather than a genuine hybrid core.
                  </span>
                </span>
              </label>
            )}
          </div>
        </FilterSection>
      )}

      {/* Processing level filter */}
      {summaryData.processing_levels && (
        <FilterSection
          title="Processing Level"
          active={filters.processing !== "all"}
          expanded={expanded === "processing"}
          onToggle={() => setExpanded(expanded === "processing" ? null : "processing")}
          badgeCount={filters.processing !== "all" ? 1 : 0}
        >
          <div className="space-y-1.5">
            {([
              ["all", "All cyclones", null],
              ["processed", "Processed", summaryData.processing_levels.processed],
              ["raw", "Track only", summaryData.processing_levels.raw],
            ] as [ProcessingFilter, string, number | null][]).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setProcessing(key)}
                disabled={count === 0}
                className={`w-full text-xs text-left px-2 py-1 rounded transition flex items-center justify-between ${
                  filters.processing === key
                    ? "bg-blue-600 text-white"
                    : count === 0
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{label}</span>
                {count !== null && (
                  <span
                    className={`text-[10px] ${
                      filters.processing === key ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
            <p className="text-[10px] text-gray-400 leading-tight pt-1">
              <span className="font-medium text-gray-500">Processed</span> cyclones
              carry LEC energetics, lifecycle phases and a genesis region.{" "}
              <span className="font-medium text-gray-500">Track only</span> cyclones
              come from the raw tracking catalogue with position and vorticity
              alone.
              {summaryData.processing_levels.raw === 0 && (
                <span className="block mt-1 text-amber-600">
                  The raw catalogue is not ingested yet, so every cyclone here is
                  fully processed.
                </span>
              )}
            </p>
          </div>
        </FilterSection>
      )}

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
  /** Tailwind max-height for the expanded body. Sections whose content is taller
   *  than the default (charts, long lists) override it so nothing is clipped. */
  maxHeightClass?: string;
  children: React.ReactNode;
}

function FilterSection({
  title,
  active,
  expanded,
  onToggle,
  badgeCount,
  maxHeightClass = "max-h-40",
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
        <div className={`px-3 pb-2.5 custom-scrollbar ${maxHeightClass} overflow-y-auto`}>
          {children}
        </div>
      )}
    </div>
  );
}
