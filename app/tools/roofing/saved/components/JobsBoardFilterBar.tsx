"use client";

import type { BoardQuickFilter } from "../jobsBoardUtils";
import { BOARD_QUICK_FILTERS } from "../jobsBoardUtils";

type JobsBoardFilterBarProps = {
  quickFilter: BoardQuickFilter;
  onQuickFilterChange: (filter: BoardQuickFilter) => void;
};

export default function JobsBoardFilterBar({ quickFilter, onQuickFilterChange }: JobsBoardFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {BOARD_QUICK_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.hint}
          onClick={() => onQuickFilterChange(f.id)}
          className={
            "rounded-md border px-2.5 py-1.5 text-xs font-medium transition " +
            (quickFilter === f.id
              ? "border-slate-300 bg-slate-100 text-slate-900"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
          }
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
