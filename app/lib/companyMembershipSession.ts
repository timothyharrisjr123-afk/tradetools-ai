/**
 * Live membership resolution for the authenticated user.
 * A failed read is `unavailable`, never "no membership".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasCompanyCapability,
  resolveCompanyMembershipRole,
  type CompanyCapability,
  type CompanyMembershipRoleValue,
} from "@/app/lib/companyMembershipRoles";

export type LiveMembershipSession = {
  userId: string;
  companyId: string;
  role: CompanyMembershipRoleValue;
};

export type LiveMembershipResolution =
  | { status: "active"; session: LiveMembershipSession }
  | { status: "invalid_role"; userId: string; companyId: string }
  | { status: "removed" }
  | { status: "none" }
  | { status: "unavailable" };

export function mapLiveMembershipRow(input: {
  userId: string;
  data: unknown;
  error: unknown;
}): LiveMembershipResolution {
  if (input.error) return { status: "unavailable" };
  const row = input.data as
    | { company_id?: unknown; role?: unknown; removed_at?: unknown }
    | null
    | undefined;
  if (!row) return { status: "none" };
  if (typeof row.company_id !== "string" || !row.company_id) {
    return { status: "unavailable" };
  }
  if (row.removed_at) return { status: "removed" };
  const role = resolveCompanyMembershipRole(row.role);
  if (role === "invalid_role") {
    return { status: "invalid_role", userId: input.userId, companyId: row.company_id };
  }
  return {
    status: "active",
    session: { userId: input.userId, companyId: row.company_id, role },
  };
}

export async function resolveLiveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<LiveMembershipResolution> {
  try {
    const { data, error } = await supabase
      .from("company_memberships")
      .select("company_id, role, removed_at")
      .eq("user_id", userId)
      .maybeSingle();
    return mapLiveMembershipRow({ userId, data, error });
  } catch {
    return { status: "unavailable" };
  }
}

export function sessionHasCapability(
  session: LiveMembershipSession | null | undefined,
  capability: CompanyCapability
): boolean {
  if (!session) return false;
  return hasCompanyCapability(session.role, capability);
}
