"use client";

import Link from "next/link";
import {
  ASTRA_G5_FIRST_JOB_HINT,
  ASTRA_G5_FIRST_JOB_HREF,
  ASTRA_G5_FIRST_JOB_LABEL,
  ASTRA_G5_USUAL_ROOF_HINT,
  ASTRA_G5_USUAL_ROOF_HREF,
  ASTRA_G5_USUAL_ROOF_LABEL,
} from "@/app/lib/astraG5Activation";

/** Who is looking at an empty board. Only authors get the first-proposal start. */
export type JobsBoardEmptyAudience = "author" | "field" | "coordinator" | "unknown";

type JobsBoardEmptyStateProps = {
  companyNameMissing: boolean;
  searchActive: boolean;
  audience: JobsBoardEmptyAudience;
};

export default function JobsBoardEmptyState({
  companyNameMissing,
  searchActive,
  audience,
}: JobsBoardEmptyStateProps) {
  if (searchActive) {
    return (
      <p className="rounded-md border border-slate-200/80 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No jobs match your search.
      </p>
    );
  }

  if (audience !== "author") {
    const heading =
      audience === "field"
        ? "No work assigned yet"
        : audience === "coordinator"
          ? "No jobs to coordinate yet"
          : "No jobs yet";
    const body =
      audience === "field"
        ? "Jobs show up here when someone at your company assigns you to one."
        : audience === "coordinator"
          ? "Jobs show up here once the office creates them."
          : "Jobs show up here once they are created.";
    return (
      <div className="px-6 py-10 text-center" data-jobs-board-empty-assigned data-jobs-board-empty-audience={audience}>
        <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center"
      data-jobs-board-empty-first-run
      data-astra-g5-entry
    >
      <h2 className="text-base font-semibold text-slate-900">Ready for your first proposal</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Start a real job, or prepare your usual roof setup once for every proposal after.
      </p>
      <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={ASTRA_G5_FIRST_JOB_HREF}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          data-jobs-board-empty-primary-action
          data-astra-g5-first-job
        >
          {ASTRA_G5_FIRST_JOB_LABEL}
        </Link>
        <Link
          href={ASTRA_G5_USUAL_ROOF_HREF}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          data-astra-g5-usual-roof-entry
        >
          {ASTRA_G5_USUAL_ROOF_LABEL}
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
      <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-slate-500">
        {ASTRA_G5_FIRST_JOB_HINT} {ASTRA_G5_USUAL_ROOF_HINT}
      </p>
    </div>
  );
}
