/**
 * Phase 13B-C route authorization. Every capability decision is made by the database
 * evaluator (public.check_my_access_v1 -> private.evaluate_access_v1); this module only
 * maps the result to HTTP. A failed or malformed check is `authorization_unavailable`
 * (503), never a denial and never a grant.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveCapabilityKey } from "@/app/lib/access/registry";
import {
  resolveCompanyMembershipRole,
  type CompanyMembershipRoleValue,
} from "@/app/lib/companyMembershipRoles";
import { isUuidLike } from "@/app/lib/uuid";

export const CHECK_MY_ACCESS_RPC_V1 = "check_my_access_v1";

export type AccessSession = {
  userId: string;
  companyId: string;
  role: CompanyMembershipRoleValue;
};

export type AccessDenial = {
  status: 403 | 503;
  code: "forbidden" | "invalid_role" | "capability_denied" | "authorization_unavailable";
};

export type AccessScope = { jobId?: string | null; taskId?: string | null };

export type AccessCheckResult =
  | { ok: true; session: AccessSession }
  | { ok: false; denial: AccessDenial; reason: string | null };

const UNAVAILABLE_DENIAL: AccessDenial = { status: 503, code: "authorization_unavailable" };
const UNAVAILABLE: AccessCheckResult = { ok: false, denial: UNAVAILABLE_DENIAL, reason: null };

/** Maps a check_my_access_v1 response. Pure; exported for tests. */
export function mapAccessCheck(input: {
  userId: string;
  data: unknown;
  error: unknown;
}): AccessCheckResult {
  if (input.error) return UNAVAILABLE;
  const body = input.data as
    | { allowed?: unknown; reason?: unknown; company_id?: unknown; role?: unknown }
    | null
    | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) return UNAVAILABLE;
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (!reason) return UNAVAILABLE;

  if (body.allowed === true && reason === "allowed") {
    const role = resolveCompanyMembershipRole(body.role);
    if (typeof body.company_id !== "string" || !isUuidLike(body.company_id) || role === "invalid_role") {
      return UNAVAILABLE;
    }
    return { ok: true, session: { userId: input.userId, companyId: body.company_id, role } };
  }

  switch (reason) {
    case "not_member":
    case "membership_disabled":
      return { ok: false, denial: { status: 403, code: "forbidden" }, reason };
    case "invalid_role":
      return { ok: false, denial: { status: 403, code: "invalid_role" }, reason };
    case "authorization_unavailable":
      return { ok: false, denial: UNAVAILABLE_DENIAL, reason };
    case "capability_missing":
    case "scope_missing":
    case "restricted":
    case "dependency_missing":
    case "domain_prerequisite_unmet":
      return { ok: false, denial: { status: 403, code: "capability_denied" }, reason };
    default:
      return UNAVAILABLE;
  }
}

export async function checkAccess(
  supabase: SupabaseClient,
  userId: string,
  capability: ActiveCapabilityKey,
  scope: AccessScope = {}
): Promise<AccessCheckResult> {
  // A malformed id is checked unscoped (company scope only); the route's own
  // payload validation then answers invalid_payload.
  const jobId = isUuidLike(scope.jobId ?? "") ? scope.jobId! : null;
  const taskId = isUuidLike(scope.taskId ?? "") ? scope.taskId! : null;
  try {
    const { data, error } = await supabase.rpc(CHECK_MY_ACCESS_RPC_V1, {
      p_capability: capability,
      p_job_id: jobId,
      p_task_id: taskId,
    });
    return mapAccessCheck({ userId, data, error });
  } catch {
    return UNAVAILABLE;
  }
}

export function accessDenialResponse(denial: AccessDenial): NextResponse {
  const error =
    denial.code === "authorization_unavailable"
      ? "Access could not be verified. Try again."
      : "Forbidden.";
  return NextResponse.json({ ok: false, code: denial.code, error }, { status: denial.status });
}

/** Route gate: live membership + capability (+ job/task scope when given). */
export async function requireAccess(
  supabase: SupabaseClient,
  userId: string,
  capability: ActiveCapabilityKey,
  scope: AccessScope = {}
): Promise<{ ok: true; session: AccessSession } | { ok: false; response: NextResponse }> {
  const result = await checkAccess(supabase, userId, capability, scope);
  if (result.ok) return result;
  return { ok: false, response: accessDenialResponse(result.denial) };
}
