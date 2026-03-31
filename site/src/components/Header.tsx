"use client";

import Link from "next/link";

interface HeaderProps {
  totalTracks: number;
  filteredCount: number;
  onLogout: () => void;
}

export default function Header({ totalTracks, filteredCount, onLogout }: HeaderProps) {
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
          <path
            strokeLinecap="round"
            d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9"
          />
          <path
            strokeLinecap="round"
            d="M12 7.5C9.5 7.5 7.5 9.5 7.5 12S9.5 16.5 12 16.5"
          />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
        <span className="text-sm font-semibold text-gray-900 truncate">
          South Atlantic Cyclone Monitor
        </span>
        <span className="hidden sm:block text-xs text-gray-400 flex-shrink-0">
          1979–2020
        </span>
      </div>

      {/* Track count */}
      <div className="hidden md:flex items-center gap-1.5 ml-2">
        <span className="text-xs text-gray-500">
          {filteredCount === totalTracks
            ? `${totalTracks.toLocaleString()} tracks`
            : `${filteredCount.toLocaleString()} / ${totalTracks.toLocaleString()} tracks`}
        </span>
      </div>

      <div className="flex-1" />

      {/* About link */}
      <Link
        href="/about"
        className="hidden sm:block text-xs text-gray-500 hover:text-blue-600 transition px-2 py-1 rounded hover:bg-gray-50"
      >
        About
      </Link>

      {/* Data source badge */}
      <a
        href="https://doi.org/10.5281/zenodo.18133432"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden lg:block text-xs text-gray-400 hover:text-gray-600 transition truncate max-w-xs"
        title="Zenodo dataset DOI"
      >
        DOI: 10.5281/zenodo.18133432
      </a>

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
