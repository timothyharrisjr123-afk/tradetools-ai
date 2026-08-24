/**
 * Shared canonical Job lifecycle action eligibility.
 *
 * Pure read model mirroring guarded RPC disposition rules. Does not write
 * jobs.stage, call RPCs, or interpret Board column aliases / legacy estimate
 * statuses.
 */

import { isDbBoardJobEntry } from "@/app/lib/jobBoardAdapter";
import type { RoofingEstimate } from "@/app/lib/estimateStore";
import { resolveCanonicalJobStage } from "@/app/lib/jobLifecycleMapper";
import type {
  CanonicalJobStage,
  JobLifecycleMapperInput,
} from "@/app/lib/jobLifecycleTypes";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

export type CanonicalJobActionEligibilityInput = {
  stage: CanonicalJobStage;
  /** True only when jobs.status disposition is active. */
  dispositionActive: boolean;
  /** Active planned work schedule (kind=work, status=scheduled). */
  hasActivePlannedSchedule: boolean;
  /** Contractor Approve job attention context (acceptance pending approval). */
  approvalAcceptancePending?: boolean;
};

export type CanonicalJobActionEligibility = {
  canApproveJob: boolean;
  canSchedule: boolean;
  canReschedule: boolean;
  canUnschedule: boolean;
  canStartWork: boolean;
  canCompleteJob: boolean;
};

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Mirrors RPC active-only disposition guards for operational lifecycle actions. */
export function isActiveJobDisposition(
  disposition: string | null | undefined
): boolean {
  return normalizeToken(disposition || "active") === "active";
}

export function hasActivePlannedWorkSchedule(
  schedule: Pick<JobSchedule, "kind" | "status"> | null | undefined
): boolean {
  return schedule?.kind === "work" && schedule.status === "scheduled";
}

export function resolveCanonicalJobStageFromFacts(
  facts: JobLifecycleMapperInput
): CanonicalJobStage {
  return resolveCanonicalJobStage(facts);
}

export function buildCanonicalJobActionEligibilityInput(input: {
  stage: string | null | undefined;
  disposition: string | null | undefined;
  schedule: Pick<JobSchedule, "kind" | "status"> | null | undefined;
  approvalAcceptancePending?: boolean;
  lifecycleFacts?: JobLifecycleMapperInput;
}): CanonicalJobActionEligibilityInput {
  const facts: JobLifecycleMapperInput = input.lifecycleFacts ?? {
    stage: input.stage ?? "intake",
    status: input.disposition ?? "active",
  };
  return {
    stage: resolveCanonicalJobStageFromFacts(facts),
    dispositionActive: isActiveJobDisposition(input.disposition),
    hasActivePlannedSchedule: hasActivePlannedWorkSchedule(input.schedule),
    approvalAcceptancePending: input.approvalAcceptancePending,
  };
}

export function resolveCanonicalJobActionEligibility(
  input: CanonicalJobActionEligibilityInput
): CanonicalJobActionEligibility {
  const { stage, dispositionActive, hasActivePlannedSchedule } = input;
  const approvalPending = input.approvalAcceptancePending === true;

  return {
    canApproveJob:
      dispositionActive && stage === "proposal" && approvalPending,
    canSchedule:
      dispositionActive && stage === "approved" && !hasActivePlannedSchedule,
    canReschedule:
      dispositionActive && stage === "scheduled" && hasActivePlannedSchedule,
    canUnschedule:
      dispositionActive && stage === "scheduled" && hasActivePlannedSchedule,
    canStartWork:
      dispositionActive && stage === "scheduled" && hasActivePlannedSchedule,
    canCompleteJob:
      dispositionActive && stage === "production" && hasActivePlannedSchedule,
  };
}

export function resolveCanonicalJobActionEligibilityFromFacts(input: {
  stage: string | null | undefined;
  disposition: string | null | undefined;
  schedule: Pick<JobSchedule, "kind" | "status"> | null | undefined;
  approvalAcceptancePending?: boolean;
  lifecycleFacts?: JobLifecycleMapperInput;
}): CanonicalJobActionEligibility {
  return resolveCanonicalJobActionEligibility(
    buildCanonicalJobActionEligibilityInput(input)
  );
}

/**
 * Canonical lifecycle action eligibility for DB-backed Jobs Board rows only.
 * Returns null for legacy saved-estimate rows — they must not use canonical RPC
 * action eligibility derived from legacy status strings such as paid/paid lane.
 */
export function resolveDbBoardJobActionEligibility(
  entry: RoofingEstimate,
  schedule: Pick<JobSchedule, "kind" | "status"> | null | undefined,
  opts?: { approvalAcceptancePending?: boolean }
): CanonicalJobActionEligibility | null {
  if (!isDbBoardJobEntry(entry)) return null;

  const extended = entry as RoofingEstimate & {
    canonicalJobStage?: CanonicalJobStage;
    jobDisposition?: string | null;
    jobId?: string | null;
  };

  const stageFromEntry = extended.canonicalJobStage;
  const lifecycleFacts: JobLifecycleMapperInput = {
    stage: stageFromEntry ?? "intake",
    status: extended.jobDisposition ?? "active",
  };

  return resolveCanonicalJobActionEligibilityFromFacts({
    stage: stageFromEntry ?? lifecycleFacts.stage,
    disposition: extended.jobDisposition,
    schedule,
    approvalAcceptancePending: opts?.approvalAcceptancePending,
    lifecycleFacts,
  });
}

/** Legacy estimate rows must never receive canonical Complete/Start/Schedule actions. */
export function legacyEstimateBlocksCanonicalLifecycleActions(
  entry: RoofingEstimate
): boolean {
  return !isDbBoardJobEntry(entry);
}
