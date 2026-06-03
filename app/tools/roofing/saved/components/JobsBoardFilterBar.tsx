"use client";

import type { BoardQuickFilter } from "../jobsBoardUtils";
import { BOARD_QUICK_FILTERS } from "../jobsBoardUtils";

type JobsBoardFilterBarProps = {
  quickFilter: BoardQuickFilter;
  onQuickFilterChange: (filter: BoardQuickFilter) => void;
  onOpenListView: (filter: string) => void;
};

const LIST_VIEW_SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: "estimate", label: "Draft list" },
  { key: "sent_pending", label: "Sent list" },
  { key: "approved", label: "Approved list" },
  { key: "deposit_paid", label: "Ready list" },
  { key: "scheduled", label: "Scheduled list" },
  { key: "in_progress", label: "On site list" },
  { key: "paid", label: "Completed list" },
];

export default function JobsBoardFilterBar({
  quickFilter,
  onQuickFilterChange,
  onOpenListView,
}: JobsBoardFilterBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filter board</span>
        {BOARD_QUICK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            title={f.hint}
            onClick={() => onQuickFilterChange(f.id)}
            className={
              "rounded-full border px-2.5 py-1 text-xs font-semibold transition " +
              (quickFilter === f.id
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
            }
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Full list view</span>
        {LIST_VIEW_SHORTCUTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenListView(item.key)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
