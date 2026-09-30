/**
 * Viewer presentation flags derived from the database policy engine
 * (public.get_member_effective_access_v1). Only booleans leave the server; capability
 * keys, packages, and restrictions are never sent to the client. Flags drive what the
 * UI offers; every action is still authorized by its own route and RPC.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidLike } from "@/app/lib/uuid";

export const GET_MEMBER_EFFECTIVE_ACCESS_RPC_V1 = "get_member_effective_access_v1";

export type ViewerAccessFlags = {
  canAdminMembers: boolean;
  canAssignJobs: boolean;
  canAssignTasks: boolean;
  canPauseResume: boolean;
  canFinalizeDisposition: boolean;
  /**
   * Start work: company-scope jobs.progress (and not restricted at the job). A
   * job-scoped holder (Lead) also needs to be the active assignment Lead (D-S1),
   * which the server cannot confirm yet, so it is never offered to them.
   */
  canStartWork: boolean;
  canCompleteJob: boolean;
  canManageSchedule: boolean;
  canWriteScopeChanges: boolean;
  canIssueScopeChanges: boolean;
  canSendProposals: boolean;
  canReadCommercial: boolean;
  canCreateJobs: boolean;
  canManageCompany: boolean;
  canManagePricing: boolean;
  canManageTemplates: boolean;
  canConfigurePayments: boolean;
};

export const NO_VIEWER_ACCESS: ViewerAccessFlags = {
  canAdminMembers: false,
  canAssignJobs: false,
  canAssignTasks: false,
  canPauseResume: false,
  canFinalizeDisposition: false,
  canStartWork: false,
  canCompleteJob: false,
  canManageSchedule: false,
  canWriteScopeChanges: false,
  canIssueScopeChanges: false,
  canSendProposals: false,
  canReadCommercial: false,
  canCreateJobs: false,
  canManageCompany: false,
  canManagePricing: false,
  canManageTemplates: false,
  canConfigurePayments: false,
};

function stringSet(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    out.add(item);
  }
  return out;
}

/**
 * Pure; exported for tests. Returns null when the response is an error or malformed;
 * callers treat that as unavailable (no flags), never as a grant.
 */
export function mapViewerAccess(data: unknown): ViewerAccessFlags | null {
  const body = data as
    | { ok?: unknown; company_capabilities?: unknown; job_capabilities?: unknown }
    | null
    | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body) || body.ok !== true) {
    return null;
  }
  const company = stringSet(body.company_capabilities);
  if (!company) return null;
  const job = body.job_capabilities == null ? null : stringSet(body.job_capabilities);
  if (body.job_capabilities != null && !job) return null;
  const atJob = (cap: string) => company.has(cap) || (job?.has(cap) ?? false);
  const companyAndJob = (cap: string) => company.has(cap) && (job == null || job.has(cap));
  const evaluatedAtJob = (cap: string) => (job ? job.has(cap) : company.has(cap));
  return {
    canAdminMembers: company.has("team.manage"),
    canAssignJobs: company.has("jobs.assign"),
    canAssignTasks: atJob("tasks.manage"),
    canPauseResume: company.has("jobs.hold"),
    canFinalizeDisposition: company.has("jobs.finalize"),
    canStartWork: companyAndJob("jobs.progress"),
    canCompleteJob: companyAndJob("jobs.complete"),
    canManageSchedule: evaluatedAtJob("schedule.manage"),
    canWriteScopeChanges: company.has("scope_changes.write"),
    canIssueScopeChanges: company.has("scope_changes.issue"),
    canSendProposals: company.has("proposals.send"),
    canReadCommercial: company.has("proposals.read"),
    canCreateJobs: company.has("jobs.manage"),
    canManageCompany: company.has("company.manage"),
    canManagePricing: company.has("pricing.manage"),
    canManageTemplates: company.has("templates.manage"),
    canConfigurePayments: company.has("payments.configure"),
  };
}

async function readEffectiveAccess(
  supabase: SupabaseClient,
  jobId: string | null
): Promise<{ data: unknown } | null> {
  try {
    const { data, error } = await supabase.rpc(GET_MEMBER_EFFECTIVE_ACCESS_RPC_V1, {
      p_user_id: null,
      p_job_id: jobId,
    });
    return error ? null : { data };
  } catch {
    return null;
  }
}

/**
 * Viewer flags, optionally at a job (job-scoped grants such as a Field member's
 * tasks on a granted job). A job the viewer cannot see answers company-scope flags
 * only. Null means access could not be read.
 */
export async function loadViewerAccess(
  supabase: SupabaseClient,
  jobId?: string | null
): Promise<ViewerAccessFlags | null> {
  const scopedJob = jobId && isUuidLike(jobId) ? jobId : null;
  const first = await readEffectiveAccess(supabase, scopedJob);
  if (!first) return null;
  const code = (first.data as { ok?: unknown; code?: unknown } | null)?.code;
  if (scopedJob && code === "not_found") {
    const companyOnly = await readEffectiveAccess(supabase, null);
    return companyOnly ? mapViewerAccess(companyOnly.data) : null;
  }
  return mapViewerAccess(first.data);
}
