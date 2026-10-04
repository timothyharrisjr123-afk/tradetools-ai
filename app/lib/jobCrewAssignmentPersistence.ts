/**
 * Job → Crew assignment persistence through the SECURITY DEFINER RPCs. The database
 * decides authority (company-scope jobs.assign for writes, jobs.read for reads),
 * resolves the company, and writes Activity atomically. This module validates shape
 * and maps result codes only. It never touches jobs.assigned_to, crew_label, the
 * schedule, or job access grants.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  END_JOB_CREW_ASSIGNMENT_RPC_V1,
  GET_JOB_CREW_ASSIGNMENTS_RPC_V1,
  SET_PRIMARY_JOB_CREW_RPC_V1,
  parseJobCrewAssignments,
  type JobCrewAssignments,
} from "@/app/lib/jobCrewAssignmentModel";
import { isUuidLike } from "@/app/lib/uuid";

export const JOB_CREW_ASSIGNMENT_MESSAGES: Record<string, string> = {
  unauthorized: "Sign in to continue.",
  forbidden: "You don't have access to this job.",
  capability_denied: "You don't have access to change the crew on this job.",
  invalid_payload: "Check the details and try again.",
  not_found: "This job or crew assignment is no longer available. Refresh and try again.",
  disposition_blocks_assignment: "Resume or reopen this job before changing its crew.",
  work_complete_blocks_assignment: "Work on this job is complete. It doesn't take a new crew.",
  stale_assignment: "The crew on this job just changed. Here's the latest.",
  crew_not_eligible: "That crew is no longer available. Pick another.",
  lead_not_eligible: "That person is no longer available as a lead. Pick another.",
  request_id_conflict: "That change could not be submitted. Refresh and try again.",
  person_name_required: "This login has no name yet. They can add it in their FieldDive profile.",
  crew_assignment_unavailable: "Crew assignments are unavailable right now.",
};

const STATUS: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  capability_denied: 403,
  invalid_payload: 400,
  not_found: 404,
  disposition_blocks_assignment: 409,
  work_complete_blocks_assignment: 409,
  stale_assignment: 409,
  crew_not_eligible: 409,
  lead_not_eligible: 409,
  request_id_conflict: 409,
  person_name_required: 409,
};

export class JobCrewAssignmentHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? JOB_CREW_ASSIGNMENT_MESSAGES[code] ?? JOB_CREW_ASSIGNMENT_MESSAGES.crew_assignment_unavailable);
  }
}

type RpcResult = { ok?: boolean; code?: string; [key: string]: unknown };

async function callRpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  let data: unknown;
  let error: unknown = null;
  try {
    const result = await supabase.rpc(fn, args);
    data = result.data;
    error = result.error;
  } catch {
    throw new JobCrewAssignmentHttpError(503, "crew_assignment_unavailable");
  }
  if (error || !data || typeof data !== "object") {
    throw new JobCrewAssignmentHttpError(503, "crew_assignment_unavailable");
  }
  const body = data as RpcResult;
  if (body.ok !== true) {
    const code = typeof body.code === "string" ? body.code : "crew_assignment_unavailable";
    throw new JobCrewAssignmentHttpError(STATUS[code] ?? 503, code);
  }
  return body;
}

const uuid = (value: unknown): string | null => (typeof value === "string" && isUuidLike(value) ? value : null);
const invalid = () => new JobCrewAssignmentHttpError(400, "invalid_payload");

export async function loadJobCrewAssignments(supabase: SupabaseClient, jobId: string): Promise<JobCrewAssignments> {
  if (!uuid(jobId)) throw invalid();
  const body = await callRpc(supabase, GET_JOB_CREW_ASSIGNMENTS_RPC_V1, { p_job_id: jobId });
  const model = parseJobCrewAssignments(body);
  if (!model) throw new JobCrewAssignmentHttpError(503, "crew_assignment_unavailable");
  return model;
}

export type SetPrimaryJobCrewResult = {
  changed: boolean;
  kind: "assigned" | "replaced" | "lead_changed";
  assignmentId: string;
  supersedesAssignmentId: string | null;
  currentPrimaryAssignmentId: string | null;
};

/**
 * A company login without an operational person gets one (idempotent, never merged
 * by name) the first time it is chosen as the Lead for a job.
 */
async function resolveMemberLead(supabase: SupabaseClient, userId: string): Promise<string> {
  let body: RpcResult;
  try {
    body = await callRpc(supabase, "ensure_member_person_v1", { p_user_id: userId });
  } catch (error) {
    if (error instanceof JobCrewAssignmentHttpError && error.code === "not_found") {
      throw new JobCrewAssignmentHttpError(409, "lead_not_eligible");
    }
    throw error;
  }
  const personId = uuid(body.person_id);
  if (!personId) throw new JobCrewAssignmentHttpError(503, "crew_assignment_unavailable");
  return personId;
}

/**
 * Assign, replace, or change/clear the Assignment Lead of the primary Crew. A retried
 * request id returns the original result (changed: false), never a stale error.
 * The Lead is a person id, or a company login (assignmentLeadUserId) resolved to its person.
 */
export async function setPrimaryJobCrew(
  supabase: SupabaseClient,
  input: {
    jobId: unknown;
    crewId: unknown;
    assignmentLeadPersonId?: unknown;
    assignmentLeadUserId?: unknown;
    expectedPrimaryAssignmentId?: unknown;
    requestId: unknown;
  }
): Promise<SetPrimaryJobCrewResult> {
  const jobId = uuid(input.jobId);
  const crewId = uuid(input.crewId);
  const leadPerson = input.assignmentLeadPersonId == null ? null : uuid(input.assignmentLeadPersonId);
  const leadUser = input.assignmentLeadUserId == null ? null : uuid(input.assignmentLeadUserId);
  const expected = input.expectedPrimaryAssignmentId == null ? null : uuid(input.expectedPrimaryAssignmentId);
  const requestId =
    typeof input.requestId === "string" && input.requestId.trim().length >= 1 && input.requestId.trim().length <= 120
      ? input.requestId.trim()
      : null;
  if (
    !jobId || !crewId || !requestId ||
    (input.assignmentLeadPersonId != null && !leadPerson) ||
    (input.assignmentLeadUserId != null && !leadUser) ||
    (leadPerson && leadUser) ||
    (input.expectedPrimaryAssignmentId != null && !expected)
  ) {
    throw invalid();
  }
  const lead = leadPerson ?? (leadUser ? await resolveMemberLead(supabase, leadUser) : null);
  const body = await callRpc(supabase, SET_PRIMARY_JOB_CREW_RPC_V1, {
    p_job_id: jobId,
    p_crew_id: crewId,
    p_assignment_lead_person_id: lead,
    p_expected_primary_assignment_id: expected,
    p_request_id: requestId,
  });
  const assignmentId = uuid(body.assignment_id);
  const kind = body.kind;
  if (!assignmentId || (kind !== "assigned" && kind !== "replaced" && kind !== "lead_changed")) {
    throw new JobCrewAssignmentHttpError(503, "crew_assignment_unavailable");
  }
  return {
    changed: body.changed === true,
    kind,
    assignmentId,
    supersedesAssignmentId: uuid(body.supersedes_assignment_id),
    currentPrimaryAssignmentId: uuid(body.current_primary_assignment_id),
  };
}

/** End/clear an assignment. Idempotent: an already-ended assignment returns changed: false. */
export async function endJobCrewAssignment(
  supabase: SupabaseClient,
  input: { jobId: unknown; assignmentId: unknown }
): Promise<{ changed: boolean; assignmentId: string; endReason: string | null }> {
  const jobId = uuid(input.jobId);
  const assignmentId = uuid(input.assignmentId);
  if (!jobId || !assignmentId) throw invalid();
  const body = await callRpc(supabase, END_JOB_CREW_ASSIGNMENT_RPC_V1, {
    p_job_id: jobId,
    p_assignment_id: assignmentId,
  });
  return {
    changed: body.changed === true,
    assignmentId,
    endReason: typeof body.end_reason === "string" ? body.end_reason : null,
  };
}
