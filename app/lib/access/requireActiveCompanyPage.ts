import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ensureUserIdentity } from "@/app/lib/ensureUserIdentity";
import { resolveCurrentUserAccess } from "@/app/lib/access/resolveAccess";

type PageUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
};

/**
 * Protected page entry. Syncs the profile, resolves access, and continues only
 * for an active membership. Every other state goes to /start, which renders it.
 * This never creates a company.
 */
export async function requireActiveCompanyPage(
  supabase: SupabaseClient,
  user: PageUser
): Promise<{ companyId: string }> {
  const synced = await ensureUserIdentity(supabase, user);
  if (synced.status !== "synced") redirect("/login");

  const access = await resolveCurrentUserAccess(supabase);
  if (access.state === "active" && access.companyId) {
    return { companyId: access.companyId };
  }
  redirect("/start");
}
