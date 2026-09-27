/**
 * Astra G7 / Phase 13B-B / 13B-C — company Team reads and writes.
 *
 * Every read and write is DB-authorized (actor derived from auth.uid()):
 *   list_company_directory_v1      names and role labels (Field: self only)
 *   list_company_access_admin_v1   team.manage; emails, status, revision, open-work counts
 *   set_member_access_v1           role (+ packages / restrictions) at an expected
 *                                  access revision; never `owner`, never the Owner row
 *   disable_company_member_v1      revocation only
 *   handoff_member_open_work_v1    currently open work of a disabled member
 * Disable commits before handoff runs; a failed handoff never undoes or hides the
 * revocation, and a failed read or count is an error, never an empty list or zero.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadCompanyDirectory,
  type CompanyDirectoryRow,
} from "@/app/lib/companyMemberValidation";
import {
  isAssignableCompanyMembershipRole,
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import { isUuidLike } from "@/app/lib/uuid";

export const COMPANY_ACCESS_ADMIN_RPC_V1 = "list_company_access_admin_v1";
export const SET_MEMBER_ACCESS_RPC_V1 = "set_member_access_v1";
export const DISABLE_COMPANY_MEMBER_RPC_V1 = "disable_company_member_v1";
export const HANDOFF_MEMBER_OPEN_WORK_RPC_V1 = "handoff_member_open_work_v1";

export class CompanyMembershipHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

export type CompanyMemberListItem = {
  userId: string;
  role: ResolvedCompanyMembershipRole;
  displayName: string | null;
  email: string | null;
  removedAt: string | null;
  openJobLeadCount: number;
  openTaskAssigneeCount: number;
  /** Access-admin rows only; null in the ordinary directory. */
  accessRevision: number | null;
};

const TEAM_UNAVAILABLE_MESSAGE = "Team could not be loaded. Try again.";

const RPC_CODE_HTTP: Record<string, { status: number; message?: string }> = {
  unauthorized: { status: 401 },
  forbidden: { status: 403 },
  capability_denied: { status: 403 },
  invalid_payload: { status: 400 },
  not_found: { status: 404 },
  cannot_change_own_access: { status: 409, message: "You can’t change your own access." },
  stale_revision: {
    status: 409,
    message: "This member’s access changed since you opened Team. Review and try again.",
  },
  package_unavailable: { status: 409, message: "That access isn’t available." },
  package_ineligible: { status: 409, message: "That access doesn’t fit this role." },
  packages_incompatible: {
    status: 409,
    message: "This member has extra access that doesn’t fit the new role.",
  },
  package_not_delegable: {
    status: 403,
    message: "Only the company owner can change that access.",
  },
  restriction_unsupported: { status: 400, message: "That restriction isn’t supported." },
  grant_restriction_conflict: {
    status: 409,
    message: "Access can’t be both granted and restricted.",
  },
  dependency_incomplete: {
    status: 409,
    message: "That access needs other access this member doesn’t have.",
  },
  cannot_remove_self: { status: 409, message: "You can’t remove yourself." },
  member_disabled: { status: 409, message: "This member no longer has access." },
  owner_role_protected: {
    status: 409,
    message: "The company owner’s role can’t be changed here.",
  },
  owner_required: {
    status: 403,
    message: "Only the company owner can change Admin or owner-granted access.",
  },
  cannot_remove_owner: { status: 409, message: "The company owner can’t be removed." },
  member_active: { status: 409, message: "Remove access before handing off open work." },
  invalid_reassign: { status: 400, message: "Choose an active team member to take over." },
};

export function companyMembershipErrorForRpcCode(code: unknown): CompanyMembershipHttpError {
  const key = typeof code === "string" ? code : "";
  const mapped = RPC_CODE_HTTP[key];
  if (!mapped) return new CompanyMembershipHttpError(500, "internal_error");
  return new CompanyMembershipHttpError(mapped.status, key, mapped.message);
}

type RpcJson = { ok?: unknown; code?: unknown } & Record<string, unknown>;

async function callTeamRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<{ ok: true; body: RpcJson } | { ok: false; error: CompanyMembershipHttpError }> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        error: new CompanyMembershipHttpError(
          503,
          "team_unavailable",
          "Team access could not be updated. Try again."
        ),
      };
    }
    const body = data as RpcJson;
    if (body.ok !== true) return { ok: false, error: companyMembershipErrorForRpcCode(body.code) };
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      error: new CompanyMembershipHttpError(
        503,
        "team_unavailable",
        "Team access could not be updated. Try again."
      ),
    };
  }
}

function countOrNull(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Parses access-admin rows; any malformed row or count invalidates the whole read. */
export function parseCompanyAccessAdminRows(data: unknown): CompanyMemberListItem[] | null {
  if (!Array.isArray(data)) return null;
  const items: CompanyMemberListItem[] = [];
  for (const raw of data) {
    const row = raw as Record<string, unknown>;
    if (typeof row?.user_id !== "string" || !isUuidLike(row.user_id)) return null;
    const jobs = countOrNull(row.open_job_lead_count);
    const tasks = countOrNull(row.open_task_assignee_count);
    const revision = countOrNull(row.access_revision);
    if (jobs == null || tasks == null || revision == null || revision < 1) return null;
    const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
    const email = typeof row.email === "string" ? row.email.trim() : "";
    items.push({
      userId: row.user_id,
      role: resolveCompanyMembershipRole(row.role),
      displayName: name || null,
      email: email || null,
      removedAt: typeof row.removed_at === "string" && row.removed_at ? row.removed_at : null,
      openJobLeadCount: jobs,
      openTaskAssigneeCount: tasks,
      accessRevision: revision,
    });
  }
  return items;
}

/** Access-admin projection (team.manage). Includes disabled members and open-work counts. */
export async function listCompanyAccessAdmin(
  supabase: SupabaseClient
): Promise<CompanyMemberListItem[]> {
  let data: unknown;
  let error: { code?: string } | null = null;
  try {
    const result = await supabase.rpc(COMPANY_ACCESS_ADMIN_RPC_V1);
    data = result.data;
    error = result.error as { code?: string } | null;
  } catch {
    throw new CompanyMembershipHttpError(503, "team_unavailable", TEAM_UNAVAILABLE_MESSAGE);
  }
  if (error) {
    if (error.code === "42501") throw new CompanyMembershipHttpError(403, "forbidden");
    throw new CompanyMembershipHttpError(503, "team_unavailable", TEAM_UNAVAILABLE_MESSAGE);
  }
  const items = parseCompanyAccessAdminRows(data);
  if (!items) {
    throw new CompanyMembershipHttpError(503, "team_unavailable", TEAM_UNAVAILABLE_MESSAGE);
  }
  return items;
}

/** Ordinary directory (any active member): names and role labels only. */
export async function listCompanyDirectory(
  supabase: SupabaseClient
): Promise<CompanyDirectoryRow[]> {
  const directory = await loadCompanyDirectory(supabase);
  if (!directory.ok) {
    throw new CompanyMembershipHttpError(503, "team_unavailable", TEAM_UNAVAILABLE_MESSAGE);
  }
  return directory.members;
}

/** Directory rows in the member-list shape; no email, status, or counts are exposed. */
export function directoryRowsToMemberItems(
  rows: readonly CompanyDirectoryRow[]
): CompanyMemberListItem[] {
  return rows.map((row) => ({
    userId: row.userId,
    role: resolveCompanyMembershipRole(row.role),
    displayName: row.displayName,
    email: null,
    removedAt: null,
    openJobLeadCount: 0,
    openTaskAssigneeCount: 0,
    accessRevision: null,
  }));
}

function expectedRevisionOrNull(value: unknown): number | null {
  const n = countOrNull(value);
  return n != null && n >= 1 ? n : null;
}

export type CompanyMemberRoleResult = {
  userId: string;
  role: ResolvedCompanyMembershipRole;
  changed: boolean;
  accessRevision: number | null;
};

/**
 * Role edit (set_member_access_v1) at the member's expected access revision. Existing
 * packages and restrictions are kept (p_packages / p_restrictions null); a package that
 * no longer fits the new role is refused, never silently dropped. Never writes `owner`,
 * never edits the Owner membership, no self-change; Admin targets require custody.
 */
export async function updateCompanyMemberRole(input: {
  supabase: SupabaseClient;
  targetUserId: string;
  role: unknown;
  expectedRevision: unknown;
  requestId?: string | null;
}): Promise<CompanyMemberRoleResult> {
  const expectedRevision = expectedRevisionOrNull(input.expectedRevision);
  if (
    !isUuidLike(input.targetUserId) ||
    !isAssignableCompanyMembershipRole(input.role) ||
    expectedRevision == null
  ) {
    throw new CompanyMembershipHttpError(400, "invalid_payload");
  }
  const result = await callTeamRpc(input.supabase, SET_MEMBER_ACCESS_RPC_V1, {
    p_target_user_id: input.targetUserId,
    p_role: input.role,
    p_expected_revision: expectedRevision,
    p_packages: null,
    p_restrictions: null,
    p_request_id: input.requestId ?? null,
  });
  if (!result.ok) throw result.error;
  return {
    userId: input.targetUserId,
    role: resolveCompanyMembershipRole(result.body.role),
    changed: result.body.changed === true,
    accessRevision: expectedRevisionOrNull(result.body.access_revision),
  };
}

export type MemberHandoffOutcome =
  | {
      status: "completed";
      clearedJobLeads: number;
      clearedTaskAssignees: number;
      reassignedTo: string | null;
    }
  | { status: "failed"; code: string; message: string };

export type RemoveCompanyMemberResult = {
  removedUserId: string;
  alreadyDisabled: boolean;
  handoff: MemberHandoffOutcome;
};

function normalizeReassign(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Hands off a disabled member's currently open work. Failure is returned, not thrown. */
export async function handoffMemberOpenWork(input: {
  supabase: SupabaseClient;
  targetUserId: string;
  reassignToUserId?: unknown;
}): Promise<MemberHandoffOutcome> {
  const reassignTo = normalizeReassign(input.reassignToUserId);
  if (!isUuidLike(input.targetUserId) || (reassignTo != null && !isUuidLike(reassignTo))) {
    return { status: "failed", code: "invalid_payload", message: "Open work could not be handed off." };
  }
  const result = await callTeamRpc(input.supabase, HANDOFF_MEMBER_OPEN_WORK_RPC_V1, {
    p_target_user_id: input.targetUserId,
    p_reassign_to_user_id: reassignTo,
  });
  if (!result.ok) {
    return {
      status: "failed",
      code: result.error.code,
      message:
        result.error.code === "team_unavailable" || result.error.status >= 500
          ? "Open work could not be handed off. Try again."
          : result.error.message,
    };
  }
  const jobs = countOrNull(result.body.cleared_job_leads);
  const tasks = countOrNull(result.body.cleared_task_assignees);
  if (jobs == null || tasks == null) {
    return {
      status: "failed",
      code: "team_unavailable",
      message: "Open work could not be handed off. Try again.",
    };
  }
  return {
    status: "completed",
    clearedJobLeads: jobs,
    clearedTaskAssignees: tasks,
    reassignedTo: reassignTo,
  };
}

/**
 * Remove access first (disable_company_member_v1), then hand off currently open work.
 * The revocation stands on its own; the handoff outcome is reported separately.
 */
export async function removeCompanyMember(input: {
  supabase: SupabaseClient;
  actorUserId: string;
  targetUserId: string;
  reassignToUserId?: unknown;
  expectedRevision?: unknown;
}): Promise<RemoveCompanyMemberResult> {
  if (!isUuidLike(input.targetUserId)) {
    throw new CompanyMembershipHttpError(400, "invalid_payload");
  }
  if (input.targetUserId === input.actorUserId) {
    throw new CompanyMembershipHttpError(409, "cannot_remove_self", "You can’t remove yourself.");
  }
  const reassignTo = normalizeReassign(input.reassignToUserId);
  if (reassignTo != null) {
    if (!isUuidLike(reassignTo) || reassignTo === input.targetUserId) {
      throw companyMembershipErrorForRpcCode("invalid_reassign");
    }
    const directory = await loadCompanyDirectory(input.supabase);
    if (directory.ok && !directory.members.some((m) => m.userId === reassignTo)) {
      throw companyMembershipErrorForRpcCode("invalid_reassign");
    }
  }

  const disabled = await callTeamRpc(input.supabase, DISABLE_COMPANY_MEMBER_RPC_V1, {
    p_target_user_id: input.targetUserId,
    p_expected_revision: expectedRevisionOrNull(input.expectedRevision),
    p_reason: null,
  });
  if (!disabled.ok) throw disabled.error;

  const handoff = await handoffMemberOpenWork({
    supabase: input.supabase,
    targetUserId: input.targetUserId,
    reassignToUserId: reassignTo,
  });

  return {
    removedUserId: input.targetUserId,
    alreadyDisabled: disabled.body.already_disabled === true,
    handoff,
  };
}
