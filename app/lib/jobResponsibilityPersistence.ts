/**
 * Phase 13C — the Coordinator (jobs.assigned_to) is a Job responsibility.
 * The database owns it: public.set_job_coordinator_v1 checks company-scope jobs.assign,
 * target eligibility (any active same-company member), staleness, and request replay, and
 * writes Activity in the same transaction. public.get_job_coordinator_v1 reads it with the
 * shared visible name. This module validates shape and maps result codes only.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidLike } from "@/app/lib/uuid";

export const SET_JOB_COORDINATOR_RPC_V1 = "set_job_coordinator_v1";
export const GET_JOB_COORDINATOR_RPC_V1 = "get_job_coordinator_v1";

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,120}$/;

export class JobResponsibilityHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message ?? code);
  }
}

export type CoordinatorEventType =
  | "production_lead_assigned"
  | "production_lead_changed"
  | "production_lead_cleared";

export type ProductionLeadSetResult = {
  jobId: string;
  previousAssignedTo: string | null;
  assignedTo: string | null;
  displayName: string | null;
  changed: boolean;
  replay: boolean;
  activityEventType: CoordinatorEventType | null;
};

export type JobCoordinatorRead = {
  jobId: string;
  assignedTo: string | null;
  displayName: string | null;
  email: string | null;
  coordinatorActive: boolean;
  canAssign: boolean;
};

const STATUS_BY_CODE: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  capability_denied: 403,
  not_found: 404,
  invalid_payload: 400,
  invalid_assignee: 400,
  coordinator_not_eligible: 400,
  stale_coordinator: 409,
  request_id_conflict: 409,
};

const MESSAGE_BY_CODE: Record<string, string> = {
  coordinator_not_eligible: "Only people with FieldDive access can coordinate a job.",
  stale_coordinator: "The coordinator changed while you were editing. Review and try again.",
  capability_denied: "You can't change the coordinator.",
};

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && isUuidLike(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function eventTypeOrNull(value: unknown): CoordinatorEventType | null {
  return value === "production_lead_assigned" ||
    value === "production_lead_changed" ||
    value === "production_lead_cleared"
    ? value
    : null;
}

function failure(code: unknown, details?: Record<string, unknown>): JobResponsibilityHttpError {
  const key = typeof code === "string" && code ? code : "internal_error";
  return new JobResponsibilityHttpError(
    STATUS_BY_CODE[key] ?? 500,
    STATUS_BY_CODE[key] ? key : "internal_error",
    MESSAGE_BY_CODE[key],
    details
  );
}

/** Optional id: null clears. Anything else must be a UUID. */
export function parseCoordinatorId(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || !isUuidLike(value.trim())) return { ok: false };
  return { ok: true, value: value.trim() };
}

/** Set or clear the Coordinator through the database owner RPC. */
export async function setJobProductionLead(input: {
  supabase: SupabaseClient;
  jobId: string;
  assignedTo: string | null;
  expectedPrevious: string | null;
  requestId: string;
}): Promise<ProductionLeadSetResult> {
  if (!isUuidLike(input.jobId) || !REQUEST_ID.test(input.requestId)) {
    throw new JobResponsibilityHttpError(400, "invalid_payload");
  }
  if (input.assignedTo !== null && !isUuidLike(input.assignedTo)) {
    throw new JobResponsibilityHttpError(400, "invalid_assignee");
  }
  if (input.expectedPrevious !== null && !isUuidLike(input.expectedPrevious)) {
    throw new JobResponsibilityHttpError(400, "invalid_payload");
  }

  const { data, error } = await input.supabase.rpc(SET_JOB_COORDINATOR_RPC_V1, {
    p_job_id: input.jobId,
    p_assigned_to: input.assignedTo,
    p_expected_previous: input.expectedPrevious,
    p_request_id: input.requestId,
  });
  if (error) throw failure("internal_error");
  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || body.ok !== true) {
    throw failure(body?.code, {
      currentAssignedTo: body && "current_assigned_to" in body ? uuidOrNull(body.current_assigned_to) : undefined,
    });
  }
  const jobId = uuidOrNull(body.job_id);
  if (!jobId) throw failure("internal_error");
  return {
    jobId,
    previousAssignedTo: uuidOrNull(body.previous_assigned_to),
    assignedTo: uuidOrNull(body.assigned_to),
    displayName: textOrNull(body.display_name),
    changed: body.changed === true,
    replay: body.replay === true,
    activityEventType: eventTypeOrNull(body.event_type),
  };
}

/** Read the Coordinator and its shared visible name. */
export async function readJobCoordinator(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobCoordinatorRead> {
  if (!isUuidLike(jobId)) throw new JobResponsibilityHttpError(400, "invalid_payload");
  const { data, error } = await supabase.rpc(GET_JOB_COORDINATOR_RPC_V1, { p_job_id: jobId });
  if (error) throw failure("internal_error");
  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || body.ok !== true) throw failure(body?.code);
  const id = uuidOrNull(body.job_id);
  if (!id) throw failure("internal_error");
  return {
    jobId: id,
    assignedTo: uuidOrNull(body.assigned_to),
    displayName: textOrNull(body.display_name),
    email: textOrNull(body.email),
    coordinatorActive: body.coordinator_active === true,
    canAssign: body.can_assign === true,
  };
}
