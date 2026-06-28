"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { CompanySetupReadinessResult } from "@/app/lib/companySetupReadiness";

type JobsBoardPipelineGuidanceProps = {
  readiness: CompanySetupReadinessResult;
};

function stepChipClass(complete: boolean, unknown: boolean): string {
  if (complete) return "border-emerald-200/90 bg-emerald-50/90 text-emerald-900";
  if (unknown) return "border-slate-200 bg-white text-slate-600";
  return "border-amber-200/90 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/60";
}

export default function JobsBoardPipelineGuidance({ readiness }: JobsBoardPipelineGuidanceProps) {
  if (readiness.loading) {
    return (
      <section
        aria-label="Loading setup status"
        className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm"
      >
        <p className="text-sm text-slate-500">Checking company setup…</p>
      </section>
    );
  }

  if (readiness.showBanner) {
    const progressLabel = `${readiness.completeCount} of ${readiness.totalCount} complete`;

    return (
      <section
        aria-labelledby="jobs-board-setup-banner-heading"
        className="rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-white to-white px-4 py-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/80">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Company setup
            </div>
            <h2
              id="jobs-board-setup-banner-heading"
              className="mt-1 text-base font-semibold text-slate-900"
            >
              Finish company setup to send proposals
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Complete these once. Every job uses this setup.
            </p>
            <p className="mt-1.5 text-xs font-medium text-amber-900/75">{progressLabel}</p>
          </div>
          {readiness.primaryHref ? (
            <Link
              href={readiness.primaryHref}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Continue setup
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
        <ul className="mt-3.5 flex flex-wrap gap-2">
          {readiness.steps.map((step) => {
            const complete = step.status === "complete";
            const unknown = step.status === "unknown";
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    stepChipClass(complete, unknown)
                  }
                >
                  <span aria-hidden className={complete ? "text-emerald-600" : unknown ? "text-slate-400" : "text-amber-600"}>
                    {complete ? "✓" : "○"}
                  </span>
                  {step.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="jobs-board-guidance-heading"
      className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-white px-4 py-3.5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0">
          <h2 id="jobs-board-guidance-heading" className="text-sm font-semibold text-slate-900">
            Company setup complete
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            Open a job card to review measurements, proposals, and next actions.
          </p>
        </div>
      </div>
    </section>
  );
}
