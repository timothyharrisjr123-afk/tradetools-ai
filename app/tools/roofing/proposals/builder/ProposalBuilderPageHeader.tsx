import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalBuilderGuidance, ProposalBuilderLifecycleActionId } from "@/app/lib/proposalBuilderGuidance";
import ProposalBuilderDisabledActions from "./ProposalBuilderDisabledActions";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderPageHeaderProps = {
  job: JobRecord | null;
  jobId: string | null;
  shellReady: boolean;
  showDraftSavedPill?: boolean;
  /** Proposal / template title for handoff identity (e.g. Roof replacement). */
  proposalTitle?: string | null;
  /** Selected package label (e.g. Enhanced). */
  selectedPackageLabel?: string | null;
  /** Quiet pricing note under More (not a primary Snapshot link). */
  savedPricingDetails?: string | null;
  guidance?: ProposalBuilderGuidance | null;
  onLifecycleAction?: (
    actionId: ProposalBuilderLifecycleActionId
  ) => void;
};

export default function ProposalBuilderPageHeader({
  job,
  jobId,
  shellReady,
  showDraftSavedPill = false,
  proposalTitle = null,
  selectedPackageLabel = null,
  savedPricingDetails = null,
  guidance = null,
  onLifecycleAction,
}: ProposalBuilderPageHeaderProps) {
  const identity = resolveJobIdentityDisplay(job, "Proposal Builder");
  const jobLabel = identity.primaryLabel;
  const address = identity.secondaryAddress;
  const backHref = jobId
    ? buildJobCardHref(jobId, { tab: "proposals" })
    : "/tools/roofing/saved";

  const proposalLabel = (proposalTitle ?? "").trim() || "Proposal";
  const packageLabel = (selectedPackageLabel ?? "").trim();
  const jobLine = [jobLabel, address].filter(Boolean).join(" · ");
  const statusParts = [
    packageLabel ? `${packageLabel} package` : null,
    showDraftSavedPill ? "Draft" : shellReady ? "Setup preview" : null,
  ].filter(Boolean);

  return (
    <header
      className={`${BUILDER_STAGE} border-b border-slate-200/70 pb-4 pt-4`}
      data-builder-continuity-header
    >
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        data-builder-back-to-job-card
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Job Card
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[1.5rem] font-semibold leading-tight tracking-tight text-slate-950"
            data-builder-proposal-primary-title
          >
            {proposalLabel} proposal
          </h1>

          {jobLine ? (
            <p
              className="mt-1 text-sm text-slate-600"
              data-builder-job-secondary-identity
            >
              {jobLine}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Job-specific proposal</p>
          )}

          {statusParts.length > 0 ? (
            <p
              className="mt-1 text-sm font-medium text-slate-700"
              data-builder-handoff-meta
              data-builder-package-status-line
            >
              {statusParts.join(" · ")}
            </p>
          ) : null}
        </div>

        {shellReady ? (
          <div className="shrink-0 pt-0.5">
            <ProposalBuilderDisabledActions
              lifecycleLocks={guidance?.lifecycleLocks ?? null}
              onLifecycleAction={onLifecycleAction}
              savedPricingDetails={savedPricingDetails}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
