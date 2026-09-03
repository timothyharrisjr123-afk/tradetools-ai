"use client";

import Link from "next/link";
import type { CompanySetupReadinessResult } from "@/app/lib/companySetupReadiness";

type JobsBoardPipelineGuidanceProps = {
  readiness: CompanySetupReadinessResult;
};

/**
 * Jobs Board first-run chrome.
 * Healthy / loading / catalog-incomplete: stay quiet (FLOW WHEN NEEDED).
 * Company name missing: one quiet identity ask — not a four-step setup tour.
 */
export default function JobsBoardPipelineGuidance({ readiness }: JobsBoardPipelineGuidanceProps) {
  if (readiness.loading) return null;

  if (!readiness.showBanner) return null;

  return (
    <section
      aria-labelledby="jobs-board-company-identity-heading"
      className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm"
      data-jobs-board-company-identity-ask
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id="jobs-board-company-identity-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Add your company name
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            Proposals need it so customers know who they are hiring. You can still create jobs now.
          </p>
        </div>
        <Link
          href="/tools/settings"
          className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:h-9 sm:min-h-0"
        >
          Add company name
        </Link>
      </div>
    </section>
  );
}
