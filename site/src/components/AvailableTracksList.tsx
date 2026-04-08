"use client";

/**
 * AvailableTracksList — shows available tracks when no track is selected.
 *
 * This component:
 * - Displays a searchable, paginated list of tracks
 * - Allows filtering by track_id (numeric)
 * - Shows essential info: track_id, genesis (start), lysis (end)
 * - Respects filters applied in FilterPanel (only shows filtered tracks)
 *
 * Strategy for large result sets:
 * - Search box: filter by track_id or year prefix
 * - Pagination: 10 items per page (reasonable UX without overwhelming)
 * - When many tracks are available, user can narrow down search
 */

import { useState, useMemo } from "react";
import { TrackSummary } from "@/types/cyclone";
import { formatDatetime } from "@/lib/utils";

interface AvailableTracksListProps {
  tracks: TrackSummary[];
  onTrackSelect: (track: TrackSummary) => void;
}

const ITEMS_PER_PAGE = 10;

export default function AvailableTracksList({
  tracks,
  onTrackSelect,
}: AvailableTracksListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter tracks by search query (track_id or year)
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    
    const query = searchQuery.trim().toLowerCase();
    return tracks.filter((track) => {
      const trackId = String(track.id).toLowerCase();
      const year = String(track.year).toLowerCase();
      return trackId.includes(query) || year.includes(query);
    });
  }, [tracks, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / ITEMS_PER_PAGE));
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedTracks = filteredTracks.slice(startIdx, endIdx);

  // Reset to page 1 when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const handleSelectTrack = (track: TrackSummary) => {
    onTrackSelect(track);
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Available Tracks</h3>
        <p className="text-xs text-gray-500 mb-2">
          {tracks.length > 0 
            ? `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`
            : 'No tracks available'}
        </p>

        {/* Search box */}
        <input
          type="text"
          placeholder="Search track ID or year…"
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Results info */}
      {filteredTracks.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-gray-600 bg-gray-50 flex-shrink-0">
          Showing {startIdx + 1}–{Math.min(endIdx, filteredTracks.length)} of {filteredTracks.length}
        </div>
      )}

      {/* Tracks list */}
      <div className="flex-1 overflow-y-auto">
        {paginatedTracks.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {paginatedTracks.map((track) => (
              <li key={track.id}>
                <button
                  onClick={() => handleSelectTrack(track)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors focus:outline-none focus:bg-blue-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {track.id}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        Genesis: {formatDatetime(track.start)}
                      </div>
                      <div className="text-xs text-gray-600">
                        Lysis: {formatDatetime(track.end)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0 pt-0.5">
                      {track.year}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center h-32 text-center px-3">
            <div className="text-gray-500 text-sm">
              {searchQuery ? (
                <>
                  <p className="font-medium mb-1">No tracks found</p>
                  <p className="text-xs">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="font-medium mb-1">No tracks available</p>
                  <p className="text-xs">Adjust filters to see tracks</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="px-3 py-2.5 border-t border-gray-200 flex-shrink-0 flex items-center justify-between gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>

          <span className="text-xs text-gray-600">
            Page {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
