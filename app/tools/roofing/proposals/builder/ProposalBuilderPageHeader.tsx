import Link from "next/link";
import { ArrowLeft, Clock3, PackageCheck } from "lucide-react";
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
  /** Saved timestamp for contractor continuity with Preview. */
  lastSavedLabel?: string | null;
  /** Contractor-friendly pricing review state. */
  pricingStateLabel?: string | null;
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
  lastSavedLabel = null,
  pricingStateLabel = null,
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
  const proposalDisplay = /\bproposal\b/i.test(proposalLabel)
    ? proposalLabel
    : `${proposalLabel} proposal`;

  return (
    <header
      className={`${BUILDER_STAGE} overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]`}
      data-builder-continuity-header
      data-builder-contractor-edit-mode
    >
      <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-9">
        <div className="min-w-0 flex-1">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700"
            data-builder-back-to-job-card
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to Job Card
          </Link>

          <div className="mt-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1
                className="text-[1.5rem] font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.6rem]"
                data-builder-proposal-primary-title
              >
                Proposal Builder
              </h1>
              <span className="inline-flex items-center rounded-md bg-slate-100/90 px-2 py-0.5 text-[12px] font-semibold text-slate-600">
                {showDraftSavedPill ? "Draft" : shellReady ? "Setup preview" : "Loading"}
              </span>
            </div>

            <p
              className="mt-1.5 truncate text-[14px] text-slate-600"
              data-builder-job-secondary-identity
            >
              {jobLine || "Job-specific proposal"}
            </p>

            <div
              className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-500"
              data-builder-handoff-meta
              data-builder-package-status-line
            >
              {packageLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                  Package <strong className="font-semibold text-slate-700">{packageLabel}</strong>
                </span>
              ) : null}
              {lastSavedLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  Saved <span className="font-medium text-slate-700">{lastSavedLabel}</span>
                </span>
              ) : null}
              {pricingStateLabel ? <span>{pricingStateLabel}</span> : null}
              <span className="text-slate-400">Editing {proposalDisplay}</span>
            </div>
          </div>
        </div>

        {shellReady ? (
          <div className="shrink-0 self-start lg:self-center">
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
