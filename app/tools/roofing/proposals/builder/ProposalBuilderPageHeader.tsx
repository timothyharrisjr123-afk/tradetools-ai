import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { JobRecord } from "@/app/lib/jobTypes";
import type {
  ProposalBuilderGuidance,
  ProposalBuilderLifecycleActionId,
} from "@/app/lib/proposalBuilderGuidance";
import ProposalBuilderDisabledActions from "./ProposalBuilderDisabledActions";
import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderPageHeaderProps = {
  job: JobRecord | null;
  jobId: string | null;
  shellReady: boolean;
  showDraftSavedPill?: boolean;
  /** Selected package label (e.g. Enhanced). Only when loaded truth exists. */
  selectedPackageLabel?: string | null;
  /** Quiet pricing note under More — not a primary Snapshot link. */
  savedPricingDetails?: string | null;
  /** Saved timestamp from persisted proposal.updated_at. */
  lastSavedLabel?: string | null;
  /** Customer total from existing loaded pricing preview. */
  proposalTotalLabel?: string | null;
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
  selectedPackageLabel = null,
  savedPricingDetails = null,
  lastSavedLabel = null,
  proposalTotalLabel = null,
  guidance = null,
  onLifecycleAction,
}: ProposalBuilderPageHeaderProps) {
  const identity = job ? resolveJobIdentityDisplay(job, "") : null;
  const jobLabel = (identity?.primaryLabel ?? "").trim();
  const address = (identity?.secondaryAddress ?? "").trim();
  const backHref = jobId
    ? buildJobCardHref(jobId, { tab: "proposals" })
    : "/tools/roofing/saved";

  const packageLabel = shellReady ? (selectedPackageLabel ?? "").trim() : "";
  const totalLabel = shellReady ? (proposalTotalLabel ?? "").trim() : "";
  const savedLabel = shellReady ? (lastSavedLabel ?? "").trim() : "";
  const hasJobContext = Boolean(job && jobLabel);
  const contextReady = shellReady && hasJobContext;

  return (
    <header
      className={`${BUILDER_STAGE}`}
      data-builder-continuity-header
      data-builder-contractor-edit-mode
      data-builder-command-bar
    >
      <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2.5">
        <div className="min-w-0 flex-1">
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0 sm:h-auto"
            data-builder-back-to-job-card
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to Job Card
          </Link>

          {hasJobContext ? (
            <div className="mt-0.5 min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h1
                  className="truncate text-[15px] font-semibold tracking-[-0.015em] text-slate-950"
                  data-builder-job-primary-identity
                  data-builder-proposal-primary-title
                >
                  {jobLabel}
                </h1>
                {contextReady && showDraftSavedPill ? (
                  <span className="text-[11px] font-medium text-slate-400">Draft</span>
                ) : null}
              </div>
              {address ? (
                <p
                  className="truncate text-[12.5px] text-slate-500"
                  data-builder-job-secondary-identity
                >
                  {address}
                </p>
              ) : null}
              {contextReady && (packageLabel || totalLabel || savedLabel) ? (
                <div
                  className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-slate-400"
                  data-builder-handoff-meta
                  data-builder-package-status-line
                >
                  {packageLabel ? (
                    <span className="sr-only" data-builder-command-package>
                      <span className="sr-only">Package </span>
                      {packageLabel}
                    </span>
                  ) : null}
                  {totalLabel ? (
                    <span className="sr-only tabular-nums" data-builder-command-total>
                      {totalLabel}
                    </span>
                  ) : null}
                  {savedLabel ? (
                    <span data-builder-command-saved>
                      Saved {savedLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {shellReady ? (
          <div className="shrink-0 sm:self-center">
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
