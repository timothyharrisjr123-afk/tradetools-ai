"use client";

import Link from "next/link";
import JobsBoardFiltersSort from "./JobsBoardFiltersSort";
import type { BoardColumnKey, BoardDispositionFilter, BoardSortKey, BoardViewMode } from "../jobsBoardUtils";

type JobsBoardHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  viewMode: BoardViewMode;
  onViewModeChange: (mode: BoardViewMode) => void;
  sortKey: BoardSortKey;
  onSortKeyChange: (key: BoardSortKey) => void;
  visibleColumnKeys: BoardColumnKey[];
  onVisibleColumnKeysChange: (keys: BoardColumnKey[]) => void;
  updatedOnOrAfter: string | null;
  onUpdatedOnOrAfterChange: (value: string | null) => void;
  dispositionFilter: BoardDispositionFilter;
  onDispositionFilterChange: (value: BoardDispositionFilter) => void;
  filtersActive: boolean;
};

export default function JobsBoardHeader({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  sortKey,
  onSortKeyChange,
  visibleColumnKeys,
  onVisibleColumnKeysChange,
  updatedOnOrAfter,
  onUpdatedOnOrAfterChange,
  dispositionFilter,
  onDispositionFilterChange,
  filtersActive,
}: JobsBoardHeaderProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">Job Board</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Your job pipeline from first contact through completion.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto lg:min-w-[320px] lg:max-w-md">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search customers, addresses..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-8 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
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

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white p-0.5"
              role="group"
              aria-label="Board view mode"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("board")}
                aria-pressed={viewMode === "board"}
                className={
                  "rounded-md px-3 py-1 text-sm font-medium transition " +
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
                  "rounded-md px-3 py-1 text-sm font-medium transition " +
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
              dispositionFilter={dispositionFilter}
              onDispositionFilterChange={onDispositionFilterChange}
              filtersActive={filtersActive}
            />

            <Link
              href="/tools/roofing?entry=packet"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              + New job
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
