"use client";

import Link from "next/link";

type JobsBoardHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  jobCount: number;
  totalCount: number;
};

export default function JobsBoardHeader({ query, onQueryChange, jobCount, totalCount }: JobsBoardHeaderProps) {
  const countLabel =
    jobCount === totalCount
      ? `${totalCount} job${totalCount === 1 ? "" : "s"} in pipeline`
      : `${jobCount} of ${totalCount} jobs shown`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Jobs Board</h1>
          <p className="mt-0.5 text-sm text-slate-500">{countLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search customers, addresses…"
            className="h-9 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-72"
          />
          <Link
            href="/tools/roofing?entry=packet"
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            New Job
          </Link>
        </div>
      </div>
    </div>
  );
}
