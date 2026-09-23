/**
 * Astra G7 — load live membership + role for the authenticated user.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasCompanyCapability,
  presetFromMembershipRole,
  type CompanyCapability,
  type CompanyMembershipPreset,
} from "@/app/lib/companyMembershipRoles";

export type LiveMembershipSession = {
  userId: string;
  companyId: string;
  role: string;
  preset: CompanyMembershipPreset;
  removed: boolean;
};

export async function loadLiveMembershipSession(
  supabase: SupabaseClient,
  userId: string
): Promise<LiveMembershipSession | null> {
  const { data, error } = await supabase
    .from("company_memberships")
    .select("company_id, role, removed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.company_id) return null;
  const removed = Boolean((data as { removed_at?: string | null }).removed_at);
  if (removed) return null;

  const role = String((data as { role?: string }).role ?? "owner");
  return {
    userId,
    companyId: String(data.company_id),
    role,
    preset: presetFromMembershipRole(role),
    removed: false,
  };
}

export function sessionHasCapability(
  session: LiveMembershipSession | null | undefined,
  capability: CompanyCapability
): boolean {
  if (!session || session.removed) return false;
  return hasCompanyCapability(session.role, capability);
}
