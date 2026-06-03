"use client";

import Link from "next/link";

type JobsBoardHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  boardView: "board" | "list";
  onBoardViewChange: (view: "board" | "list") => void;
  jobCount: number;
};

export default function JobsBoardHeader({
  query,
  onQueryChange,
  boardView,
  onBoardViewChange,
  jobCount,
}: JobsBoardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Jobs Board</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Pipeline command board — {jobCount} job{jobCount === 1 ? "" : "s"} in motion
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search customers, addresses…"
          className="h-9 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
        />
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => onBoardViewChange("board")}
            className={
              "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
              (boardView === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")
            }
          >
            Board
          </button>
          <button
            type="button"
            onClick={() => onBoardViewChange("list")}
            className={
              "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
              (boardView === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")
            }
          >
            List
          </button>
        </div>
        <Link
          href="/tools/roofing?entry=packet"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          New Job
        </Link>
        <Link
          href="/tools/roofing/catalog"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Catalog setup
        </Link>
      </div>
    </div>
  );
}
