/**
 * Astra G7 — live company member validation for assignment writers.
 * Rejects foreign, stale/removed, and missing memberships.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidLike } from "@/app/lib/uuid";

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
      code:
        | "invalid_assignee"
        | "foreign_member"
        | "removed_member"
        | "member_not_found";
    };

type MembershipRow = {
  user_id: string;
  company_id: string;
  role: string;
  removed_at: string | null;
};

function displayNameFromProfile(row: {
  full_name?: string | null;
  email?: string | null;
} | null): string | null {
  const name = String(row?.full_name ?? "").trim();
  if (name) return name;
  const email = String(row?.email ?? "").trim();
  return email || null;
}

/**
 * Validate that assigneeUserId is a live (non-removed) member of companyId.
 * Null/empty assignee is Unassigned — caller should not invoke this for null.
 */
export async function validateLiveCompanyMember(
  supabase: SupabaseClient,
  companyId: string,
  assigneeUserId: string
): Promise<MemberValidationResult> {
  if (!isUuidLike(companyId) || !isUuidLike(assigneeUserId)) {
    return { ok: false, code: "invalid_assignee" };
  }

  const { data, error } = await supabase
    .from("company_memberships")
    .select("user_id, company_id, role, removed_at")
    .eq("user_id", assigneeUserId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "member_not_found" };
  }
  if (!data) {
    return { ok: false, code: "member_not_found" };
  }

  const row = data as MembershipRow;
  if (row.company_id !== companyId) {
    return { ok: false, code: "foreign_member" };
  }
  if (row.removed_at) {
    return { ok: false, code: "removed_member" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", assigneeUserId)
    .maybeSingle();

  return {
    ok: true,
    member: {
      userId: row.user_id,
      companyId: row.company_id,
      role: row.role,
      displayName: displayNameFromProfile(profile),
      email: profile?.email ? String(profile.email) : null,
    },
  };
}

export async function listLiveCompanyMembers(
  supabase: SupabaseClient,
  companyId: string
): Promise<LiveCompanyMember[]> {
  if (!isUuidLike(companyId)) return [];

  const { data, error } = await supabase
    .from("company_memberships")
    .select("user_id, company_id, role, removed_at")
    .eq("company_id", companyId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (error || !data?.length) return [];

  const userIds = (data as MembershipRow[]).map((row) => row.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [String((p as { id: string }).id), p])
  );

  return (data as MembershipRow[]).map((row) => {
    const profile = profileById.get(row.user_id) as
      | { full_name?: string | null; email?: string | null }
      | undefined;
    return {
      userId: row.user_id,
      companyId: row.company_id,
      role: row.role,
      displayName: displayNameFromProfile(profile ?? null),
      email: profile?.email ? String(profile.email) : null,
    };
  });
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
