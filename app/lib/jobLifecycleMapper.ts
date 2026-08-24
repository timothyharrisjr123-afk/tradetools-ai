/**
 * Canonical Job stage read mapping + write-policy helpers.
 * Pure. No Supabase, React, or jobs.stage writes.
 */

import {
  CANONICAL_JOB_STAGE_LABELS,
  CANONICAL_JOB_STAGES,
  FOUNDATION_ENABLED_STAGE_EDGES,
  JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED,
  OPERATIONAL_JOB_DISPOSITIONS,
  isHistoricalIntakeAliasStage,
  type CanonicalJobStage,
  type JobLifecycleMapperInput,
  type OperationalJobDisposition,
} from "@/app/lib/jobLifecycleTypes";

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isCanonicalJobStage(
  value: string | null | undefined
): value is CanonicalJobStage {
  return (CANONICAL_JOB_STAGES as readonly string[]).includes(
    normalizeToken(value)
  );
}

export function isOperationalJobDisposition(
  value: string | null | undefined
): value is OperationalJobDisposition {
  return (OPERATIONAL_JOB_DISPOSITIONS as readonly string[]).includes(
    normalizeToken(value)
  );
}

function hasProposalPointer(input: JobLifecycleMapperInput): boolean {
  const active = String(input.active_proposal_id ?? "").trim();
  const latest = String(input.latest_proposal_id ?? "").trim();
  return active.length > 0 || latest.length > 0;
}

function resolveLegacyArchivedStage(
  input: JobLifecycleMapperInput
): CanonicalJobStage {
  const status = normalizeToken(input.status);
  if (status === "lost") return "proposal";
  if (status === "won") return "approved";
  if (hasProposalPointer(input)) return "proposal";
  return "intake";
}

/**
 * Map stored jobs.stage (+ won/archived compatibility) to a canonical stage.
 * Does not mutate rows. Does not guess Complete from display labels.
 */
export function resolveCanonicalJobStage(
  input: JobLifecycleMapperInput
): CanonicalJobStage {
  const stage = normalizeToken(input.stage);
  const status = normalizeToken(input.status);

  if (stage === "archived") {
    return resolveLegacyArchivedStage(input);
  }

  if (status === "won") {
    if (
      stage === "approved" ||
      stage === "scheduled" ||
      stage === "production" ||
      stage === "complete"
    ) {
      return stage;
    }
    if (
      stage === "intake" ||
      isHistoricalIntakeAliasStage(stage) ||
      stage === "proposal"
    ) {
      return "approved";
    }
  }

  if (isHistoricalIntakeAliasStage(stage)) {
    return "intake";
  }

  if (isCanonicalJobStage(stage)) {
    return stage;
  }

  return "intake";
}

export function canonicalJobStageLabel(stage: CanonicalJobStage): string {
  return CANONICAL_JOB_STAGE_LABELS[stage];
}

export function resolveCanonicalJobStageLabel(
  input: JobLifecycleMapperInput
): string {
  return canonicalJobStageLabel(resolveCanonicalJobStage(input));
}

export function isAllowedStageEdge(
  from: CanonicalJobStage,
  to: CanonicalJobStage
): boolean {
  if (from === to) return true;
  if (from === "proposal" && to === "approved" && !JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED) {
    return false;
  }
  if (to === "scheduled" && !JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED) {
    return false;
  }
  if (to === "production" && !JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED) {
    return false;
  }
  if (to === "complete" && !JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED) {
    return false;
  }
  return FOUNDATION_ENABLED_STAGE_EDGES.some(([a, b]) => a === from && b === to);
}

export function assertCanonicalWriteStage(
  value: string | null | undefined
): CanonicalJobStage {
  const stage = normalizeToken(value);
  if (!isCanonicalJobStage(stage)) {
    throw new Error(`Non-canonical job stage write target: ${value ?? ""}`);
  }
  if (stage === "scheduled" && !JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED) {
    throw new Error("Approved → Scheduled is blocked until R3F");
  }
  if (stage === "approved" && !JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED) {
    throw new Error("Proposal → Approved is blocked until R3C");
  }
  if (stage === "production" && !JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED) {
    throw new Error("Scheduled → Production is blocked until a guarded Start work action exists");
  }
  if (stage === "complete" && !JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED) {
    throw new Error("Production → Complete is blocked until a guarded Complete action exists");
  }
  return stage;
}

export function assertOperationalDispositionWrite(
  value: string | null | undefined
): OperationalJobDisposition {
  const status = normalizeToken(value);
  if (status === "won" || status === "archived") {
    throw new Error(`Illegal disposition write target: ${status}`);
  }
  if (!isOperationalJobDisposition(status)) {
    throw new Error(`Illegal disposition write target: ${value ?? ""}`);
  }
  return status;
}

/** Time in stage owner. Null/invalid → omit (never created_at fallback). */
export function resolveStageEnteredAtIso(
  stageEnteredAt: string | null | undefined
): string | null {
  const iso = String(stageEnteredAt ?? "").trim();
  if (!iso) return null;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? iso : null;
}

export function shouldOmitTimeInStage(
  stageEnteredAt: string | null | undefined
): boolean {
  return resolveStageEnteredAtIso(stageEnteredAt) == null;
}
