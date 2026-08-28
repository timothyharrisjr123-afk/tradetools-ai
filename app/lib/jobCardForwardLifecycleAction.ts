/**
 * One primary forward lifecycle action for Job Card Overview.
 * Start/Complete remain owned by the Overview schedule section so those
 * existing surfaces stay the single CTA for those stages.
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
  owner: "forward_strip" | "schedule_section";
};

export function resolveJobCardOverviewForwardAction(
  eligibility: CanonicalJobActionEligibility
): JobCardOverviewForwardAction | null {
  if (eligibility.canApproveJob) {
    return { kind: "approve_job", label: "Approve job" };
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
    return { ...forward, owner: "forward_strip" };
  }
  if (eligibility.canStartWork) {
    return { kind: "start_work", label: "Start work", owner: "schedule_section" };
  }
  if (eligibility.canCompleteJob) {
    return {
      kind: "complete_job",
      label: "Complete job",
      owner: "schedule_section",
    };
  }
  return null;
}

export const JOB_CARD_AWAITING_CONTRACTOR_APPROVAL =
  "Awaiting contractor approval" as const;
