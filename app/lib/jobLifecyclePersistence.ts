/**
 * Job Lifecycle Foundation — guarded RPC persistence contracts.
 *
 * Writes jobs.stage / operational jobs.status / job_activity_events only
 * through the RPCs in 20260816_038_job_lifecycle_foundation.sql.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import {
  assertCanonicalWriteStage,
  assertOperationalDispositionWrite,
  isAllowedStageEdge,
  resolveCanonicalJobStage,
} from "@/app/lib/jobLifecycleMapper";
import {
  JOB_ACTIVITY_EVENT_TYPES,
  JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED,
  JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED,
  type CanonicalJobStage,
  type JobActivityEventType,
  type OperationalJobDisposition,
} from "@/app/lib/jobLifecycleTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TRANSITION_JOB_STAGE_RPC_V1 = "transition_job_stage_v1";
export const CHANGE_JOB_DISPOSITION_RPC_V1 = "change_job_disposition_v1";
export const RECORD_JOB_ACTIVITY_RPC_V1 = "record_job_activity_v1";

export class JobLifecyclePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobLifecyclePersistenceError";
  }
}

export type TransitionJobStageInput = {
  company_id: string;
  job_id: string;
  to_stage: CanonicalJobStage;
  reason?: string | null;
  mode?: "auto" | "manual" | "confirm";
};

export type ChangeJobDispositionInput = {
  company_id: string;
  job_id: string;
  to_status: OperationalJobDisposition;
  reason?: string | null;
};

export type RecordJobActivityInput = {
  company_id: string;
  job_id: string;
  event_type: JobActivityEventType;
  payload_json?: Record<string, unknown>;
  occurred_at?: string | null;
  actor_user_id?: string | null;
};

export type TransitionJobStageResult =
  | {
      ok: true;
      idempotent: boolean;
      job_id: string;
      from_stage: CanonicalJobStage;
      to_stage: CanonicalJobStage;
      stage_entered_at: string | null;
      status_unchanged: string;
      activity_id?: string;
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "invalid_payload"
        | "forbidden"
        | "not_found"
        | "noncanonical_target"
        | "scheduled_blocked_until_r3f"
        | "approved_blocked_until_r3c"
        | "production_blocked_until_start_work"
        | "complete_blocked_until_complete_action"
        | "illegal_edge"
        | "proposal_truth_required"
        | "proposal_truth_mismatch";
      from_stage?: string;
      to_stage?: string;
    };

export type ChangeJobDispositionResult =
  | {
      ok: true;
      idempotent: boolean;
      job_id: string;
      from_status: string;
      to_status: OperationalJobDisposition;
      stage_unchanged: string;
      stage_entered_at_unchanged: string | null;
      activity_id?: string;
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "invalid_payload"
        | "forbidden"
        | "not_found"
        | "illegal_disposition_target";
    };

export type RecordJobActivityResult =
  | {
      ok: true;
      id: string;
      event_type: JobActivityEventType;
      occurred_at: string;
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "invalid_payload"
        | "invalid_event_type"
        | "forbidden"
        | "not_found"
        | "event_type_reserved";
    };

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobLifecyclePersistenceError(`Invalid ${label}.`);
  }
  return id;
}

export function buildTransitionJobStagePayload(
  input: TransitionJobStageInput
): Record<string, unknown> {
  const toStage = assertCanonicalWriteStage(input.to_stage);
  if (toStage === "approved" && !JOB_LIFECYCLE_APPROVED_TRANSITIONS_ENABLED) {
    throw new JobLifecyclePersistenceError(
      "Proposal → Approved is blocked until R3C"
    );
  }
  if (toStage === "scheduled" && !JOB_LIFECYCLE_SCHEDULED_TRANSITIONS_ENABLED) {
    throw new JobLifecyclePersistenceError(
      "Approved → Scheduled is blocked until R3F"
    );
  }
  if (toStage === "production" && !JOB_LIFECYCLE_PRODUCTION_TRANSITIONS_ENABLED) {
    throw new JobLifecyclePersistenceError(
      "Scheduled → Production is blocked until a guarded Start work action exists"
    );
  }
  if (toStage === "complete" && !JOB_LIFECYCLE_COMPLETE_TRANSITIONS_ENABLED) {
    throw new JobLifecyclePersistenceError(
      "Production → Complete is blocked until a guarded Complete action exists"
    );
  }
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    to_stage: toStage,
    reason: input.reason ?? null,
    mode: input.mode ?? "manual",
  };
}

export function buildChangeJobDispositionPayload(
  input: ChangeJobDispositionInput
): Record<string, unknown> {
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    to_status: assertOperationalDispositionWrite(input.to_status),
    reason: input.reason ?? null,
  };
}

export function buildRecordJobActivityPayload(
  input: RecordJobActivityInput
): Record<string, unknown> {
  const eventType = input.event_type;
  if (!(JOB_ACTIVITY_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new JobLifecyclePersistenceError(
      `Invalid job activity event type: ${eventType}`
    );
  }
  if (
    eventType === "job_created" ||
    eventType === "stage_changed" ||
    eventType === "disposition_changed" ||
    eventType === "job_scheduled" ||
    eventType === "job_rescheduled" ||
    eventType === "job_unscheduled" ||
    eventType === "job_work_started" ||
    eventType === "job_work_completed"
  ) {
    throw new JobLifecyclePersistenceError(
      `Job activity event type is reserved for lifecycle writers: ${eventType}`
    );
  }
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    event_type: eventType,
    payload_json: input.payload_json ?? {},
    occurred_at: input.occurred_at ?? null,
  };
}

export function parseTransitionJobStageResult(
  data: unknown
): TransitionJobStageResult {
  if (!data || typeof data !== "object") {
    throw new JobLifecyclePersistenceError(
      `${TRANSITION_JOB_STAGE_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const code = String(row.code ?? "");
    return {
      ok: false,
      code: code as Extract<TransitionJobStageResult, { ok: false }>["code"],
      from_stage: typeof row.from_stage === "string" ? row.from_stage : undefined,
      to_stage: typeof row.to_stage === "string" ? row.to_stage : undefined,
    };
  }
  if (row.ok !== true) {
    throw new JobLifecyclePersistenceError(
      `${TRANSITION_JOB_STAGE_RPC_V1} returned an invalid payload.`
    );
  }
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    job_id: parseUuid(row.job_id, "job_id"),
    from_stage: resolveCanonicalJobStage({
      stage: String(row.from_stage ?? ""),
    }),
    to_stage: resolveCanonicalJobStage({ stage: String(row.to_stage ?? "") }),
    stage_entered_at:
      typeof row.stage_entered_at === "string" ? row.stage_entered_at : null,
    status_unchanged: String(row.status_unchanged ?? ""),
    activity_id:
      typeof row.activity_id === "string" ? row.activity_id : undefined,
  };
}

export function parseChangeJobDispositionResult(
  data: unknown
): ChangeJobDispositionResult {
  if (!data || typeof data !== "object") {
    throw new JobLifecyclePersistenceError(
      `${CHANGE_JOB_DISPOSITION_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "") as Extract<
        ChangeJobDispositionResult,
        { ok: false }
      >["code"],
    };
  }
  if (row.ok !== true) {
    throw new JobLifecyclePersistenceError(
      `${CHANGE_JOB_DISPOSITION_RPC_V1} returned an invalid payload.`
    );
  }
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    job_id: parseUuid(row.job_id, "job_id"),
    from_status: String(row.from_status ?? ""),
    to_status: assertOperationalDispositionWrite(String(row.to_status ?? "")),
    stage_unchanged: String(row.stage_unchanged ?? ""),
    stage_entered_at_unchanged:
      typeof row.stage_entered_at_unchanged === "string"
        ? row.stage_entered_at_unchanged
        : null,
    activity_id:
      typeof row.activity_id === "string" ? row.activity_id : undefined,
  };
}

export async function transitionJobStageViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: TransitionJobStageInput
): Promise<TransitionJobStageResult> {
  const payload = buildTransitionJobStagePayload(input);
  const { data, error } = await supabase.rpc(TRANSITION_JOB_STAGE_RPC_V1, {
    p_payload: payload,
  });
  if (error) {
    throw new JobLifecyclePersistenceError(
      `${TRANSITION_JOB_STAGE_RPC_V1} failed: ${error.message}`
    );
  }
  return parseTransitionJobStageResult(data);
}

export async function changeJobDispositionViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: ChangeJobDispositionInput
): Promise<ChangeJobDispositionResult> {
  const payload = buildChangeJobDispositionPayload(input);
  const { data, error } = await supabase.rpc(CHANGE_JOB_DISPOSITION_RPC_V1, {
    p_payload: payload,
  });
  if (error) {
    throw new JobLifecyclePersistenceError(
      `${CHANGE_JOB_DISPOSITION_RPC_V1} failed: ${error.message}`
    );
  }
  return parseChangeJobDispositionResult(data);
}

export async function recordJobActivityViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: RecordJobActivityInput
): Promise<RecordJobActivityResult> {
  const payload = buildRecordJobActivityPayload(input);
  const { data, error } = await supabase.rpc(RECORD_JOB_ACTIVITY_RPC_V1, {
    p_payload: payload,
  });
  if (error) {
    throw new JobLifecyclePersistenceError(
      `${RECORD_JOB_ACTIVITY_RPC_V1} failed: ${error.message}`
    );
  }
  if (!data || typeof data !== "object") {
    throw new JobLifecyclePersistenceError(
      `${RECORD_JOB_ACTIVITY_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "") as Extract<
        RecordJobActivityResult,
        { ok: false }
      >["code"],
    };
  }
  return {
    ok: true,
    id: parseUuid(row.id, "id"),
    event_type: row.event_type as JobActivityEventType,
    occurred_at: String(row.occurred_at ?? ""),
  };
}

export function previewStageTransition(
  fromStored: { stage: string; status?: string | null; archived?: boolean | null },
  to: CanonicalJobStage
): {
  allowed: boolean;
  from: CanonicalJobStage;
  blockedUntilR3c: boolean;
  blockedUntilR3f: boolean;
  blockedUntilStartWork: boolean;
  blockedUntilCompleteAction: boolean;
} {
  const from = resolveCanonicalJobStage(fromStored);
  return {
    allowed: isAllowedStageEdge(from, to),
    from,
    blockedUntilR3c: from === "proposal" && to === "approved",
    blockedUntilR3f: to === "scheduled",
    blockedUntilStartWork: to === "production",
    blockedUntilCompleteAction: to === "complete",
  };
}
