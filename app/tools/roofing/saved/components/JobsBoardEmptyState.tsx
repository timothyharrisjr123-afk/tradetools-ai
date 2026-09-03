"use client";

import Link from "next/link";

type JobsBoardEmptyStateProps = {
  companyNameMissing: boolean;
  searchActive: boolean;
};

export default function JobsBoardEmptyState({
  companyNameMissing,
  searchActive,
}: JobsBoardEmptyStateProps) {
  if (searchActive) {
    return (
      <p className="rounded-md border border-slate-200/80 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No jobs match your search.
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center"
      data-jobs-board-empty-first-run
    >
      <h2 className="text-base font-semibold text-slate-900">No jobs yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Create a job to start measuring, pricing, and sending a proposal.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/tools/roofing?entry=packet"
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          data-jobs-board-empty-primary-action
        >
          + New job
        </Link>
        {companyNameMissing ? (
          <Link
            href="/tools/settings"
            className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Add company name
          </Link>
        ) : null}
      </div>
    </div>
  );
}
