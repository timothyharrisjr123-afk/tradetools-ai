/**
 * Astra G7 — company membership list / role change / soft-remove.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAssignableCompanyMembershipRole,
  isCompanyCustodyOwner,
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import { isUuidLike } from "@/app/lib/uuid";

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
};

async function loadOpenAssignmentCounts(
  supabase: SupabaseClient,
  companyId: string,
  userId: string
): Promise<{ openJobLeadCount: number; openTaskAssigneeCount: number }> {
  const [jobResult, taskResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("assigned_to", userId)
      .is("deleted_at", null),
    supabase
      .from("job_tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("assigned_to", userId)
      .eq("status", "open")
      .is("deleted_at", null),
  ]);
  if (
    jobResult.error ||
    taskResult.error ||
    typeof jobResult.count !== "number" ||
    typeof taskResult.count !== "number"
  ) {
    throw new CompanyMembershipHttpError(500, "internal_error");
  }
  return {
    openJobLeadCount: jobResult.count,
    openTaskAssigneeCount: taskResult.count,
  };
}

type TargetMembership = { userId: string; role: ResolvedCompanyMembershipRole };

async function loadLiveTargetMembership(
  supabase: SupabaseClient,
  companyId: string,
  userId: string
): Promise<TargetMembership> {
  const { data, error } = await supabase
    .from("company_memberships")
    .select("user_id, role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw new CompanyMembershipHttpError(500, "internal_error");
  if (!data) throw new CompanyMembershipHttpError(404, "not_found");
  return {
    userId,
    role: resolveCompanyMembershipRole((data as { role?: unknown }).role),
  };
}

/** Owner-only operations require custody (role + companies.owner_user_id), not role text. */
async function assertActorHoldsCustody(input: {
  supabase: SupabaseClient;
  companyId: string;
  actorUserId: string;
  actorRole: ResolvedCompanyMembershipRole;
}): Promise<void> {
  const { data, error } = await input.supabase
    .from("companies")
    .select("owner_user_id")
    .eq("id", input.companyId)
    .maybeSingle();
  if (error || !data) {
    throw new CompanyMembershipHttpError(
      503,
      "authorization_unavailable",
      "Access could not be verified. Try again."
    );
  }
  const custody = isCompanyCustodyOwner({
    userId: input.actorUserId,
    role: input.actorRole,
    companyOwnerUserId: (data as { owner_user_id?: string | null }).owner_user_id,
  });
  if (!custody) {
    throw new CompanyMembershipHttpError(
      403,
      "owner_required",
      "Only the company owner can change Admin access."
    );
  }
}

export async function listCompanyMembers(input: {
  supabase: SupabaseClient;
  companyId: string;
  includeRemoved?: boolean;
}): Promise<CompanyMemberListItem[]> {
  let query = input.supabase
    .from("company_memberships")
    .select("user_id, role, removed_at, created_at")
    .eq("company_id", input.companyId)
    .order("created_at", { ascending: true });

  if (!input.includeRemoved) {
    query = query.is("removed_at", null);
  }

  const { data, error } = await query;
  if (error) throw new CompanyMembershipHttpError(500, "internal_error");
  if (!data?.length) return [];

  const userIds = data.map((row) => String((row as { user_id: string }).user_id));
  const { data: profiles, error: profilesError } = await input.supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  if (profilesError) throw new CompanyMembershipHttpError(500, "internal_error");
  const profileById = new Map(
    (profiles ?? []).map((p) => [String((p as { id: string }).id), p])
  );

  const items: CompanyMemberListItem[] = [];
  for (const row of data) {
    const userId = String((row as { user_id: string }).user_id);
    const role = resolveCompanyMembershipRole((row as { role?: unknown }).role);
    const removedAt = (row as { removed_at?: string | null }).removed_at ?? null;
    const profile = profileById.get(userId) as
      | { full_name?: string | null; email?: string | null }
      | undefined;
    const counts = removedAt
      ? { openJobLeadCount: 0, openTaskAssigneeCount: 0 }
      : await loadOpenAssignmentCounts(input.supabase, input.companyId, userId);
    const name = String(profile?.full_name ?? "").trim();
    const email = String(profile?.email ?? "").trim();
    items.push({
      userId,
      role,
      displayName: name || null,
      email: email || null,
      removedAt,
      openJobLeadCount: counts.openJobLeadCount,
      openTaskAssigneeCount: counts.openTaskAssigneeCount,
    });
  }
  return items;
}

/**
 * Ordinary role edit. Never writes `owner` and never edits the Owner membership
 * (custody moves only through ownership transfer). Admin grants/revocations
 * require custody. No self-change.
 */
export async function updateCompanyMemberRole(input: {
  supabase: SupabaseClient;
  companyId: string;
  actorUserId: string;
  actorRole: ResolvedCompanyMembershipRole;
  targetUserId: string;
  role: unknown;
}): Promise<CompanyMemberListItem> {
  if (!isUuidLike(input.targetUserId) || !isAssignableCompanyMembershipRole(input.role)) {
    throw new CompanyMembershipHttpError(400, "invalid_payload");
  }
  if (input.targetUserId === input.actorUserId) {
    throw new CompanyMembershipHttpError(
      409,
      "cannot_change_own_role",
      "You can’t change your own role."
    );
  }
  const role = input.role;
  const target = await loadLiveTargetMembership(
    input.supabase,
    input.companyId,
    input.targetUserId
  );
  if (target.role === "owner") {
    throw new CompanyMembershipHttpError(
      409,
      "owner_role_protected",
      "The company owner’s role can’t be changed here."
    );
  }
  if (target.role === "admin" || role === "admin") {
    await assertActorHoldsCustody({
      supabase: input.supabase,
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
    });
  }

  const { data, error } = await input.supabase
    .from("company_memberships")
    .update({ role })
    .eq("company_id", input.companyId)
    .eq("user_id", input.targetUserId)
    .is("removed_at", null)
    .select("user_id, role, removed_at")
    .maybeSingle();

  if (error) throw new CompanyMembershipHttpError(500, "internal_error");
  if (!data) throw new CompanyMembershipHttpError(404, "not_found");

  const members = await listCompanyMembers({
    supabase: input.supabase,
    companyId: input.companyId,
    includeRemoved: true,
  });
  const found = members.find((m) => m.userId === input.targetUserId);
  if (!found) throw new CompanyMembershipHttpError(404, "not_found");
  return found;
}

/**
 * Soft-remove member. Clears open job/task responsibility to Unassigned unless
 * reassignToUserId is provided (must be live same-company member).
 * Does not rewrite historical actors.
 */
export async function removeCompanyMember(input: {
  supabase: SupabaseClient;
  companyId: string;
  actorUserId: string;
  actorRole: ResolvedCompanyMembershipRole;
  targetUserId: string;
  reassignToUserId?: string | null;
}): Promise<{
  removedUserId: string;
  clearedJobLeads: number;
  clearedTaskAssignees: number;
  reassignedTo: string | null;
}> {
  if (!isUuidLike(input.targetUserId)) {
    throw new CompanyMembershipHttpError(400, "invalid_payload");
  }
  if (input.targetUserId === input.actorUserId) {
    throw new CompanyMembershipHttpError(409, "cannot_remove_self");
  }

  const reassignTo =
    input.reassignToUserId == null ||
    String(input.reassignToUserId).trim() === ""
      ? null
      : String(input.reassignToUserId).trim();

  const target = await loadLiveTargetMembership(
    input.supabase,
    input.companyId,
    input.targetUserId
  );
  if (target.role === "owner") {
    throw new CompanyMembershipHttpError(
      409,
      "cannot_remove_owner",
      "The company owner can’t be removed."
    );
  }
  if (target.role === "admin") {
    await assertActorHoldsCustody({
      supabase: input.supabase,
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
    });
  }

  if (reassignTo) {
    if (!isUuidLike(reassignTo) || reassignTo === input.targetUserId) {
      throw new CompanyMembershipHttpError(400, "invalid_reassign");
    }
    const { data: live, error: liveError } = await input.supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", input.companyId)
      .eq("user_id", reassignTo)
      .is("removed_at", null)
      .maybeSingle();
    if (liveError) {
      throw new CompanyMembershipHttpError(500, "internal_error");
    }
    if (!live) {
      throw new CompanyMembershipHttpError(400, "invalid_reassign");
    }
  }

  const { data: membership, error: membershipError } = await input.supabase
    .from("company_memberships")
    .update({ removed_at: new Date().toISOString() })
    .eq("company_id", input.companyId)
    .eq("user_id", input.targetUserId)
    .is("removed_at", null)
    .select("user_id")
    .maybeSingle();

  if (membershipError) {
    throw new CompanyMembershipHttpError(500, "internal_error");
  }
  if (!membership) {
    throw new CompanyMembershipHttpError(404, "not_found");
  }

  const jobUpdate = await input.supabase
    .from("jobs")
    .update({ assigned_to: reassignTo })
    .eq("company_id", input.companyId)
    .eq("assigned_to", input.targetUserId)
    .is("deleted_at", null)
    .select("id");

  const taskUpdate = await input.supabase
    .from("job_tasks")
    .update({ assigned_to: reassignTo })
    .eq("company_id", input.companyId)
    .eq("assigned_to", input.targetUserId)
    .eq("status", "open")
    .is("deleted_at", null)
    .select("id");

  return {
    removedUserId: input.targetUserId,
    clearedJobLeads: jobUpdate.data?.length ?? 0,
    clearedTaskAssignees: taskUpdate.data?.length ?? 0,
    reassignedTo: reassignTo,
  };
}
