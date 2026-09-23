/**
 * One primary forward lifecycle action for Job Card Overview.
 * Overview owns presentation of the single eligible CTA (Approve / Schedule /
 * Start work / Complete job). Canonical eligibility remains authoritative.
 */

import type { CanonicalJobActionEligibility } from "@/app/lib/jobLifecycleActionEligibility";

export type JobCardOverviewForwardKind = "approve_job" | "schedule";

export type JobCardOverviewPrimaryKind =
  | JobCardOverviewForwardKind
  | "start_work"
  | "complete_job";

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

export function resolveJobCardOverviewPrimaryAction(
  eligibility: CanonicalJobActionEligibility
): JobCardOverviewPrimaryAction | null {
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
