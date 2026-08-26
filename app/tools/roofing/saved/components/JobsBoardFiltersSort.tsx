"use client";

import { useEffect, useRef, useState } from "react";
import {
  BOARD_DEFAULT_DISPOSITION_FILTER,
  BOARD_DEFAULT_SORT_KEY,
  BOARD_DISPOSITION_FILTER_OPTIONS,
  BOARD_SORT_OPTIONS,
  getAllBoardColumnKeys,
  getDefaultVisibleColumnKeys,
  JOBS_BOARD_COLUMNS,
  JOBS_BOARD_WORKING_COLUMN_KEYS,
  type BoardColumnKey,
  type BoardDispositionFilter,
  type BoardSortKey,
} from "../jobsBoardUtils";

type JobsBoardFiltersSortProps = {
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

export default function JobsBoardFiltersSort({
  sortKey,
  onSortKeyChange,
  visibleColumnKeys,
  onVisibleColumnKeysChange,
  updatedOnOrAfter,
  onUpdatedOnOrAfterChange,
  dispositionFilter,
  onDispositionFilterChange,
  filtersActive,
}: JobsBoardFiltersSortProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleColumn = (key: BoardColumnKey) => {
    const all = getAllBoardColumnKeys();
    const isVisible = visibleColumnKeys.includes(key);
    if (isVisible && visibleColumnKeys.length <= 1) return;
    const next = isVisible
      ? visibleColumnKeys.filter((k) => k !== key)
      : [...visibleColumnKeys, key].sort((a, b) => all.indexOf(a) - all.indexOf(b));
    onVisibleColumnKeysChange(next.length > 0 ? next : getDefaultVisibleColumnKeys());
  };

  const clearFilters = () => {
    onSortKeyChange(BOARD_DEFAULT_SORT_KEY);
    onVisibleColumnKeysChange(getDefaultVisibleColumnKeys());
    onUpdatedOnOrAfterChange(null);
    onDispositionFilterChange(BOARD_DEFAULT_DISPOSITION_FILTER);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={
          "inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-sm font-medium transition " +
          (filtersActive
            ? "border-slate-300 bg-slate-50 text-slate-900"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")
        }
      >
        Filters &amp; sort
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filters and sort"
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,320px)] rounded-md border border-slate-200 bg-white p-4 shadow-lg"
        >
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</h3>
            <div className="space-y-1">
              {BOARD_SORT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="board-sort"
                    checked={sortKey === opt.id}
                    onChange={() => onSortKeyChange(opt.id)}
                    className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-200"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          <div className="my-3 border-t border-slate-100" />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stages</h3>
            <div className="space-y-1">
              {JOBS_BOARD_WORKING_COLUMN_KEYS.map((key) => {
                const col = JOBS_BOARD_COLUMNS.find((c) => c.key === key);
                if (!col) return null;
                return (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumnKeys.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-200"
                  />
                  {col.label}
                </label>
                );
              })}
            </div>
          </section>

          <div className="my-3 border-t border-slate-100" />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disposition</h3>
            <div className="space-y-1">
              {BOARD_DISPOSITION_FILTER_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="board-disposition"
                    checked={dispositionFilter === opt.id}
                    onChange={() => onDispositionFilterChange(opt.id)}
                    className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-200"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          <div className="my-3 border-t border-slate-100" />

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated date</h3>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block text-xs text-slate-500">Updated on or after</span>
              <input
                type="date"
                value={updatedOnOrAfter ?? ""}
                onChange={(e) => onUpdatedOnOrAfterChange(e.target.value || null)}
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </section>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
