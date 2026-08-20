"use client";

import Link from "next/link";

import type { DisplayVariable, DisplayVariableInfo } from "@/types/cyclone";

interface HeaderProps {
  displayVariable: DisplayVariable;
  availableVariables: DisplayVariable[];
  displayVariables: Record<DisplayVariable, DisplayVariableInfo>;
  onDisplayVariableChange: (v: DisplayVariable) => void;
  onLogout: () => void;
}

/**
 * Top bar. The display-variable selector sits here, in the space the period and
 * track count used to occupy, because it governs the whole view: the colour of
 * every track, the intensity filter, the wind height in the sidebar, and the
 * shape of the map markers all follow from it.
 */
export default function Header({
  displayVariable,
  availableVariables,
  displayVariables,
  onDisplayVariableChange,
  onLogout,
}: HeaderProps) {
  return (
    <header className="flex-shrink-0 h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 z-10 shadow-sm">
      {/* Title */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Spiral icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-5 h-5 text-blue-600 flex-shrink-0"
        >
          <path strokeLinecap="round" d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9" />
          <path
            strokeLinecap="round"
            d="M12 7.5C9.5 7.5 7.5 9.5 7.5 12S9.5 16.5 12 16.5"
          />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
        <span className="text-sm font-semibold text-gray-900 truncate">
          South Atlantic Cyclone Monitor
        </span>
      </div>

      {/* ── Display variable ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="hidden lg:block text-xs text-gray-400 flex-shrink-0">
          Display
        </span>
        <div
          className="flex items-center rounded-md border border-gray-200 bg-gray-50 p-0.5"
          role="group"
          aria-label="Display variable"
        >
          {availableVariables.map((v) => {
            const info = displayVariables?.[v];
            const active = v === displayVariable;
            return (
              <button
                key={v}
                onClick={() => onDisplayVariableChange(v)}
                aria-pressed={active}
                title={
                  info
                    ? `Colour tracks and filter intensity by ${info.label} (${info.unit})`
                    : undefined
                }
                className={`px-2.5 py-1 text-xs rounded transition whitespace-nowrap ${
                  active
                    ? "bg-white text-gray-900 shadow-sm font-medium"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {/* Full name where there is room, short form on narrow screens */}
                <span className="hidden xl:inline">{info?.label ?? v}</span>
                <span className="xl:hidden">{info?.short_label ?? v}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* About link */}
      <Link
        href="/about"
        className="hidden sm:block text-xs text-gray-500 hover:text-blue-600 transition px-2 py-1 rounded hover:bg-gray-50"
      >
        About
      </Link>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded hover:bg-gray-100"
      >
        Log out
      </button>
    </header>
  );
}
