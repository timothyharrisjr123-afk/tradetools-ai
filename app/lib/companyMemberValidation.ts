/**
 * Astra G7 — live company member validation for assignment writers.
 *
 * Reads go through list_company_directory_v1 (Phase 13B-B): the caller's own active
 * company only, active members only, no emails. Foreign, disabled, and missing users
 * are indistinguishable (`member_not_found`); a failed read is `member_unavailable`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GET_JOB_FIELD_BRIEF_RPC_V1, parseJobFieldBrief } from "@/app/lib/jobFieldBrief";
import { isUuidLike } from "@/app/lib/uuid";

export const COMPANY_DIRECTORY_RPC_V1 = "list_company_directory_v1";

export type LiveCompanyMember = {
  userId: string;
  companyId: string;
  role: string;
  displayName: string | null;
  email: string | null;
};

export type MemberValidationResult =
  | { ok: true; member: LiveCompanyMember }
  | {
      ok: false;
      code: "invalid_assignee" | "member_not_found" | "member_unavailable";
    };

export type CompanyDirectoryRow = {
  userId: string;
  displayName: string | null;
  role: string;
};

export type CompanyDirectoryResult =
  | { ok: true; members: CompanyDirectoryRow[] }
  | { ok: false; code: "member_unavailable" };

export function parseCompanyDirectoryRows(data: unknown): CompanyDirectoryRow[] | null {
  if (!Array.isArray(data)) return null;
  const rows: CompanyDirectoryRow[] = [];
  for (const raw of data) {
    const row = raw as { user_id?: unknown; display_name?: unknown; role?: unknown };
    if (typeof row?.user_id !== "string" || !isUuidLike(row.user_id)) return null;
    if (typeof row.role !== "string") return null;
    const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
    rows.push({ userId: row.user_id, displayName: name || null, role: row.role });
  }
  return rows;
}

export async function loadCompanyDirectory(
  supabase: SupabaseClient
): Promise<CompanyDirectoryResult> {
  try {
    const { data, error } = await supabase.rpc(COMPANY_DIRECTORY_RPC_V1);
    if (error) return { ok: false, code: "member_unavailable" };
    const members = parseCompanyDirectoryRows(data);
    if (!members) return { ok: false, code: "member_unavailable" };
    return { ok: true, members };
  } catch {
    return { ok: false, code: "member_unavailable" };
  }
}

/**
 * Live members named on the job's Field brief (coordinator and current task
 * assignees). Viewers without the company directory (Lead) see only these.
 */
async function loadJobBriefPeople(
  supabase: SupabaseClient,
  jobId: string
): Promise<CompanyDirectoryRow[] | null> {
  try {
    const { data, error } = await supabase.rpc(GET_JOB_FIELD_BRIEF_RPC_V1, { p_job_id: jobId });
    if (error) return null;
    const brief = parseJobFieldBrief(data);
    if (!brief) return null;
    return brief.people.map((p) => ({ userId: p.userId, displayName: p.displayName, role: "" }));
  } catch {
    return null;
  }
}

/**
 * Validate that assigneeUserId is an active member of the caller's company
 * (companyId is the session company). Null/empty assignee is Unassigned — callers
 * should not invoke this for null. With a jobId, a member outside the caller's
 * directory is also accepted when the job's Field brief names them.
 */
export async function validateLiveCompanyMember(
  supabase: SupabaseClient,
  companyId: string,
  assigneeUserId: string,
  scope?: { jobId?: string | null }
): Promise<MemberValidationResult> {
  if (!isUuidLike(companyId) || !isUuidLike(assigneeUserId)) {
    return { ok: false, code: "invalid_assignee" };
  }
  const directory = await loadCompanyDirectory(supabase);
  if (!directory.ok) return { ok: false, code: "member_unavailable" };
  let row = directory.members.find((m) => m.userId === assigneeUserId);
  if (!row && scope?.jobId && isUuidLike(scope.jobId)) {
    const people = await loadJobBriefPeople(supabase, scope.jobId);
    if (!people) return { ok: false, code: "member_unavailable" };
    row = people.find((m) => m.userId === assigneeUserId);
  }
  if (!row) return { ok: false, code: "member_not_found" };
  return {
    ok: true,
    member: {
      userId: row.userId,
      companyId,
      role: row.role,
      displayName: row.displayName,
      email: null,
    },
  };
}

/** HTTP status for a failed validation; unavailable is recoverable, never a 4xx. */
export function memberValidationStatus(
  code: Exclude<MemberValidationResult, { ok: true }>["code"]
): 400 | 503 {
  return code === "member_unavailable" ? 503 : 400;
}

export function resolveMemberDisplayLabel(input: {
  userId: string | null | undefined;
  membersById?: Map<string, LiveCompanyMember> | Record<string, LiveCompanyMember>;
  fallbackName?: string | null;
}): string {
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!userId) return "Unassigned";

  let member: LiveCompanyMember | undefined;
  if (input.membersById instanceof Map) {
    member = input.membersById.get(userId);
  } else if (input.membersById) {
    member = input.membersById[userId];
  }

  const name =
    member?.displayName?.trim() ||
    member?.email?.trim() ||
    input.fallbackName?.trim() ||
    "";
  return name || "Unassigned";
}
