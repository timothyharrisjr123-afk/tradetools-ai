import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalBuilderGuidance, ProposalBuilderLifecycleActionId } from "@/app/lib/proposalBuilderGuidance";
import ProposalBuilderDisabledActions from "./ProposalBuilderDisabledActions";
import {
  BUILDER_HEADER_DRAFT_PILL,
  BUILDER_HEADER_KICKER,
  BUILDER_HEADER_SETUP_PILL,
  BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE,
  BUILDER_HEADER_WORKSPACE_KICKER,
  BUILDER_STAGE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageHeaderProps = {
  job: JobRecord | null;
  jobId: string | null;
  shellReady: boolean;
  showDraftSavedPill?: boolean;
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
  guidance = null,
  onLifecycleAction,
}: ProposalBuilderPageHeaderProps) {
  const identity = resolveJobIdentityDisplay(job, "Proposal Builder");
  const title = identity.primaryLabel;
  const subtitle = identity.secondaryAddress;
  const backHref = jobId
    ? buildJobCardHref(jobId, { tab: "proposals" })
    : "/tools/roofing/saved";

  const showSetupPill = shellReady && !showDraftSavedPill;

  return (
    <header className={`${BUILDER_STAGE} border-b border-slate-200/80 pb-5 pt-5`}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            data-builder-back-to-job-card
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Job Card
          </Link>

          <p className={`mt-3 ${BUILDER_HEADER_KICKER}`}>{BUILDER_HEADER_WORKSPACE_KICKER}</p>

          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1
              className="text-[1.65rem] font-semibold leading-tight tracking-tight text-slate-950"
              data-builder-job-primary-identity
            >
              {title}
            </h1>
            {showDraftSavedPill ? (
              <span className={BUILDER_HEADER_DRAFT_PILL}>Draft • Saved</span>
            ) : showSetupPill ? (
              <span className={BUILDER_HEADER_SETUP_PILL} title="No saved draft yet — this is a setup preview.">
                Setup preview
              </span>
            ) : null}
          </div>

          {subtitle ? (
            <p className="mt-1.5 text-sm text-slate-600" data-builder-job-secondary-identity>
              {subtitle}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-slate-500">Job-specific proposal</p>
          )}

          {shellReady ? (
            <p className="mt-1.5 text-xs text-slate-400">{BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE}</p>
          ) : null}
        </div>

        {shellReady ? (
          <div className="shrink-0 pt-6">
            <ProposalBuilderDisabledActions
              lifecycleLocks={guidance?.lifecycleLocks ?? null}
              onLifecycleAction={onLifecycleAction}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
