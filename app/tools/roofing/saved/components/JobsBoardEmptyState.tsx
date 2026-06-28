"use client";

import Link from "next/link";

type JobsBoardEmptyStateProps = {
  setupIncomplete: boolean;
  setupPrimaryHref: string | null;
  searchActive: boolean;
};

export default function JobsBoardEmptyState({
  setupIncomplete,
  setupPrimaryHref,
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
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">No jobs yet.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Create your first job to measure a roof and build a proposal.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {setupIncomplete && setupPrimaryHref ? (
          <Link
            href={setupPrimaryHref}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            Finish setup first
          </Link>
        ) : null}
        <Link
          href="/tools/roofing?entry=packet"
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          + New job
        </Link>
      </div>
    </div>
  );
}
