import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { JobRecord } from "@/app/lib/jobTypes";
import ProposalBuilderDisabledActions from "./ProposalBuilderDisabledActions";

type ProposalBuilderPageHeaderProps = {
  job: JobRecord | null;
  jobId: string | null;
  shellReady: boolean;
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
}: ProposalBuilderPageHeaderProps) {
  const title = resolveJobTitle(job);
  const subtitle = resolveJobSubtitle(job);
  const backHref = jobId ? buildJobCardHref(jobId) : "/tools/roofing/saved";

  return (
    <header className="space-y-4 border-b border-slate-200 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:text-cyan-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Job Card
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Proposal Builder</p>
            )}
          </div>
        </div>
        {shellReady ? <ProposalBuilderDisabledActions /> : null}
      </div>
      {shellReady ? (
        <p className="text-xs text-slate-500">
          Builder shell · setup preview only · no proposal document is created or sent from this page
        </p>
      ) : null}
    </header>
  );
}
