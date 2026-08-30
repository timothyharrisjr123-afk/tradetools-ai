"use client";

import type { JobSearchResult } from "@/app/lib/jobSearch";
import type { CompanyJobSearchStatus } from "../useCompanyJobSearch";

type JobsBoardSearchResultsProps = {
  query: string;
  status: CompanyJobSearchStatus;
  results: JobSearchResult[];
  onOpenJob: (href: string) => void;
};

export default function JobsBoardSearchResults({
  query,
  status,
  results,
  onOpenJob,
}: JobsBoardSearchResultsProps) {
  return (
    <section
      className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
      data-jobs-board-search-results
      aria-label="Job search results"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Jobs</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Company jobs matching “{query.trim()}”
        </p>
      </div>

      {status === "loading" ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Searching…</p>
      ) : null}

      {status === "error" ? (
        <p className="px-4 py-8 text-center text-sm text-slate-600">
          Could not search jobs. Try again.
        </p>
      ) : null}

      {status === "ready" && results.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500" data-jobs-board-search-empty>
          No jobs match that search.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {results.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                className="flex min-h-[52px] w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
                data-jobs-board-search-open
                aria-label={`Open job card for ${job.customerName}`}
                onClick={() => onOpenJob(job.href)}
              >
                <span className="w-full truncate text-sm font-semibold text-slate-900">
                  {job.customerName}
                </span>
                <span className="w-full truncate text-xs text-slate-500">
                  {job.address || "No address on file"}
                </span>
                <span className="text-[11px] font-medium text-slate-600">{job.stageLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
