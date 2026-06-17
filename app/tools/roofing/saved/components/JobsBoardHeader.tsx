"use client";

import Link from "next/link";
import JobsBoardFiltersSort from "./JobsBoardFiltersSort";
import type { BoardColumnKey, BoardSortKey, BoardViewMode } from "../jobsBoardUtils";

type JobsBoardHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  jobCount: number;
  viewMode: BoardViewMode;
  onViewModeChange: (mode: BoardViewMode) => void;
  sortKey: BoardSortKey;
  onSortKeyChange: (key: BoardSortKey) => void;
  visibleColumnKeys: BoardColumnKey[];
  onVisibleColumnKeysChange: (keys: BoardColumnKey[]) => void;
  updatedOnOrAfter: string | null;
  onUpdatedOnOrAfterChange: (value: string | null) => void;
  filtersActive: boolean;
};

export default function JobsBoardHeader({
  query,
  onQueryChange,
  jobCount,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortKeyChange,
  visibleColumnKeys,
  onVisibleColumnKeysChange,
  updatedOnOrAfter,
  onUpdatedOnOrAfterChange,
  filtersActive,
}: JobsBoardHeaderProps) {
  const countLabel = `${jobCount} active job${jobCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Job Board</h1>
          <p className="mt-0.5 text-sm text-slate-500">{countLabel}</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            Operational job pipeline — primary DB records open in Job Card. Legacy saved estimates stay in the
            section below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="relative w-full min-w-[200px] sm:w-72">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search customers, addresses..."
              className="h-9 w-full rounded-md border border-slate-200 bg-white py-0 pl-3 pr-8 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            />
            {query.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            ) : null}
          </div>

          <div
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-slate-200 bg-white p-0.5"
            role="group"
            aria-label="Board view mode"
          >
            <button
              type="button"
              onClick={() => onViewModeChange("board")}
              aria-pressed={viewMode === "board"}
              className={
                "rounded px-3 py-1 text-sm font-medium transition " +
                (viewMode === "board"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              aria-pressed={viewMode === "list"}
              className={
                "rounded px-3 py-1 text-sm font-medium transition " +
                (viewMode === "list"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              List
            </button>
          </div>

          <JobsBoardFiltersSort
            sortKey={sortKey}
            onSortKeyChange={onSortKeyChange}
            visibleColumnKeys={visibleColumnKeys}
            onVisibleColumnKeysChange={onVisibleColumnKeysChange}
            updatedOnOrAfter={updatedOnOrAfter}
            onUpdatedOnOrAfterChange={onUpdatedOnOrAfterChange}
            filtersActive={filtersActive}
          />
          <Link
            href="/tools/roofing?entry=packet"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            New Job
          </Link>
        </div>
      </div>
    </div>
  );
}
