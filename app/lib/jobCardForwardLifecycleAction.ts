/**
 * One primary operational action for Job Card Overview.
 * Phase 8: Approve / Schedule / Start work / Complete job.
 * Phase 9 / Astra G8: disposition recovery takes precedence when not active.
 */

import type { CanonicalJobActionEligibility } from "@/app/lib/jobLifecycleActionEligibility";
import { isActiveJobDisposition } from "@/app/lib/jobLifecycleActionEligibility";
import {
  isProductionClosedReopenAndCompletePath,
  resolveOperationalDisposition,
} from "@/app/lib/jobDispositionManagement";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";

export type JobCardOverviewForwardKind = "approve_job" | "schedule";

export type JobCardOverviewPrimaryKind =
  | JobCardOverviewForwardKind
  | "start_work"
  | "complete_job"
  | "resume_job"
  | "reopen_job"
  | "reopen_and_complete";

export type JobCardOverviewForwardAction = {
  kind: JobCardOverviewForwardKind;
  label: string;
};

export type JobCardOverviewPrimaryAction = {
  kind: JobCardOverviewPrimaryKind;
  label: string;
  /** Overview presents the CTA; schedule section must not duplicate it. */
  owner: "overview_primary";
};

export function resolveJobCardOverviewForwardAction(
  eligibility: CanonicalJobActionEligibility
): JobCardOverviewForwardAction | null {
  if (eligibility.canApproveJob) {
    return { kind: "approve_job", label: "Approve" };
  }
  if (eligibility.canSchedule) {
    return { kind: "schedule", label: "Schedule" };
  }
  return null;
}

export type ResolveJobCardOverviewPrimaryOptions = {
  disposition?: string | null;
  stage?: CanonicalJobStage | string | null;
  /** Capability: Hold/Resume. Default true when omitted (owner paths). */
  canPauseResume?: boolean;
  /** Capability: Lost/Close/Reopen. Default true when omitted. */
  canFinalizeDisposition?: boolean;
  /**
   * Whether Complete would be eligible if disposition were active
   * (used for Production + Closed composed recovery).
   */
  canCompleteIfActive?: boolean;
};

/**
 * Exactly one primary operational CTA.
 * Priority:
 * 1. disposition != active → Resume (on hold) / Reopen or Reopen and complete (closed); none (lost)
 * 2. else Phase 8 lifecycle CTA
 * 3. else none
 */
export function resolveJobCardOverviewPrimaryAction(
  eligibility: CanonicalJobActionEligibility,
  options?: ResolveJobCardOverviewPrimaryOptions
): JobCardOverviewPrimaryAction | null {
  const dispositionRaw = options?.disposition;
  if (!isActiveJobDisposition(dispositionRaw)) {
    const disposition = resolveOperationalDisposition(dispositionRaw);
    const canPause = options?.canPauseResume !== false;
    const canFinalize = options?.canFinalizeDisposition !== false;

    if (disposition === "on_hold") {
      if (!canPause) return null;
      return {
        kind: "resume_job",
        label: "Resume job",
        owner: "overview_primary",
      };
    }
    if (disposition === "lost") {
      return null;
    }
    if (disposition === "closed") {
      if (!canFinalize) return null;
      if (
        isProductionClosedReopenAndCompletePath({
          stage: options?.stage,
          disposition,
          canCompleteIfActive: options?.canCompleteIfActive === true,
        })
      ) {
        return {
          kind: "reopen_and_complete",
          label: "Reopen and complete",
          owner: "overview_primary",
        };
      }
      return {
        kind: "reopen_job",
        label: "Reopen job",
        owner: "overview_primary",
      };
    }
    return null;
  }

  const forward = resolveJobCardOverviewForwardAction(eligibility);
  if (forward) {
    return { ...forward, owner: "overview_primary" };
  }
  if (eligibility.canStartWork) {
    return { kind: "start_work", label: "Start work", owner: "overview_primary" };
  }
  if (eligibility.canCompleteJob) {
    return {
      kind: "complete_job",
      label: "Complete job",
      owner: "overview_primary",
    };
  }
  return null;
}

export const JOB_CARD_AWAITING_CONTRACTOR_APPROVAL =
  "Awaiting contractor approval" as const;

export const REOPEN_AND_COMPLETE_CONFIRM_TITLE = "Reopen and complete" as const;

export const REOPEN_AND_COMPLETE_CONFIRM_BODY =
  "This reopens the job to Active, then records Complete using the normal completion rules. If reopen succeeds but Complete cannot run, the job stays Active in Production — Complete remains available. Closing history is not rolled back." as const;
