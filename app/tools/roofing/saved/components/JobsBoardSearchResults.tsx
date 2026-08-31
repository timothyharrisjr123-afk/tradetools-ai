"use client";

import {
  groupWorkspaceSearchResults,
  workspaceSearchEmptyCopy,
  type WorkspaceSearchResult,
} from "@/app/lib/workspaceSearch";
import type { WorkspaceSearchStatus } from "../useWorkspaceSearch";

type JobsBoardSearchResultsProps = {
  query: string;
  status: WorkspaceSearchStatus;
  results: WorkspaceSearchResult[];
  onOpen: (href: string) => void;
};

function ResultButton({
  item,
  onOpen,
}: {
  item: WorkspaceSearchResult;
  onOpen: (href: string) => void;
}) {
  const typeLabel =
    item.type === "customer" ? "Customer" : item.type === "property" ? "Property" : "Job";
  return (
    <li>
      <button
        type="button"
        className="flex min-h-[52px] w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
        data-jobs-board-search-open
        data-search-type={item.type}
        aria-label={`Open ${typeLabel.toLowerCase()} ${item.primary}`}
        onClick={() => onOpen(item.href)}
      >
        <span className="w-full truncate text-sm font-semibold text-slate-900">
          {item.primary}
        </span>
        <span className="w-full truncate text-xs text-slate-500">
          {[item.secondary, item.stageLabel].filter(Boolean).join(" · ") || typeLabel}
        </span>
      </button>
    </li>
  );
}

function TypeGroup({
  label,
  items,
  onOpen,
}: {
  label: string;
  items: WorkspaceSearchResult[];
  onOpen: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </h3>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <ResultButton key={`${item.type}-${item.id}`} item={item} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

export default function JobsBoardSearchResults({
  query,
  status,
  results,
  onOpen,
}: JobsBoardSearchResultsProps) {
  const grouped = groupWorkspaceSearchResults(results);

  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
      data-jobs-board-search-results
      aria-label="Search results"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Search</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Jobs, customers, and properties matching “{query.trim()}”
        </p>
      </div>

      {status === "loading" ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Searching…</p>
      ) : null}

      {status === "error" ? (
        <p className="px-4 py-8 text-center text-sm text-slate-600">
          Could not search. Try again.
        </p>
      ) : null}

      {status === "ready" && results.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500" data-jobs-board-search-empty>
          {workspaceSearchEmptyCopy(query)}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="pb-2">
          <TypeGroup label="Jobs" items={grouped.jobs} onOpen={onOpen} />
          <TypeGroup label="Customers" items={grouped.customers} onOpen={onOpen} />
          <TypeGroup label="Properties" items={grouped.properties} onOpen={onOpen} />
        </div>
      ) : null}
    </section>
  );
}
