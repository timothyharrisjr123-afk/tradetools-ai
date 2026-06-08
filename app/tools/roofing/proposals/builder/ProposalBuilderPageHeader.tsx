import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { JobRecord } from "@/app/lib/jobTypes";
import ProposalBuilderDisabledActions from "./ProposalBuilderDisabledActions";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderPageHeaderProps = {
  job: JobRecord | null;
  jobId: string | null;
  shellReady: boolean;
  showDraftSavedPill?: boolean;
};

function resolveJobTitle(job: JobRecord | null): string {
  if (!job) return "Proposal Builder";
  const name =
    (job.job_name ?? "").trim() ||
    (job.contact?.customer_name ?? "").trim() ||
    "Untitled job";
  return name;
}

function resolveJobSubtitle(job: JobRecord | null): string | null {
  if (!job) return null;
  const formatted = (job.address?.formatted ?? "").trim();
  if (formatted) return formatted;
  const parts = [
    job.address?.line1,
    job.address?.city,
    job.address?.state,
    job.address?.zip,
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function ProposalBuilderPageHeader({
  job,
  jobId,
  shellReady,
  showDraftSavedPill = false,
}: ProposalBuilderPageHeaderProps) {
  const title = resolveJobTitle(job);
  const subtitle = resolveJobSubtitle(job);
  const backHref = jobId ? buildJobCardHref(jobId) : "/tools/roofing/saved";

  return (
    <header className={`${BUILDER_STAGE} border-b border-slate-200/80 pb-5 pt-5`}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Job Card
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-slate-950">
              {title}
            </h1>
            {showDraftSavedPill ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Draft • Saved
              </span>
            ) : null}
          </div>

          {subtitle ? (
            <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>
          ) : (
            <p className="mt-1.5 text-sm text-slate-500">Proposal Builder</p>
          )}
        </div>

        {shellReady ? (
          <div className="shrink-0 pt-6">
            <ProposalBuilderDisabledActions />
          </div>
        ) : null}
      </div>
    </header>
  );
}
