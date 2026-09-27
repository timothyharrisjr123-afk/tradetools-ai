import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyMembershipRoleValue } from "@/app/lib/companyMembershipRoles";
import {
  resolveLiveMembership,
  type LiveMembershipResolution,
} from "@/app/lib/companyMembershipSession";

/** Auth user shape needed for identity setup. */
type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
};

function initialProfileFullName(user: AuthUser): string {
  const fromMeta =
    String(user.user_metadata?.full_name ?? "").trim() ||
    String(user.user_metadata?.name ?? "").trim();
  return fromMeta;
}

export type EnsureUserIdentityResult =
  | { status: "synced" }
  | { status: "failed"; reason: "not_authenticated" };

/**
 * Syncs the authenticated user's profile row.
 * Does not create a company or a membership. Company admission is
 * resolve_current_user_access_v1 plus an explicit create-business call.
 * Never clears an existing profiles.full_name (display-name authority).
 */
export async function ensureUserIdentity(
  supabase: SupabaseClient,
  user: AuthUser
): Promise<EnsureUserIdentityResult> {
  if (!user?.id) return { status: "failed", reason: "not_authenticated" };

  // A) Ensure profile exists without wiping human-readable display names
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    console.error("[ensureUserIdentity] Profile lookup failed:", profileLookupError.message, {
      userId: user.id,
    });
  } else if (!existingProfile) {
    const { error: profileInsertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: initialProfileFullName(user),
    });
    if (profileInsertError) {
      console.error("[ensureUserIdentity] Profile insert failed:", profileInsertError.message, {
        userId: user.id,
      });
    }
  } else {
    const nextEmail = user.email ?? "";
    const currentEmail = String(
      (existingProfile as { email?: string | null }).email ?? ""
    );
    if (nextEmail && nextEmail !== currentEmail) {
      const { error: profileEmailError } = await supabase
        .from("profiles")
        .update({ email: nextEmail })
        .eq("id", user.id);
      if (profileEmailError) {
        console.error("[ensureUserIdentity] Profile email sync failed:", profileEmailError.message, {
          userId: user.id,
        });
      }
    }
  }

  return { status: "synced" };
}

export type UserCompanyAccess =
  | { status: "active"; companyId: string; role: CompanyMembershipRoleValue }
  | { status: "disabled" }
  | { status: "none" }
  | { status: "invalid_role" }
  | { status: "unavailable" };

export function userCompanyAccessFromResolution(
  resolution: LiveMembershipResolution
): UserCompanyAccess {
  switch (resolution.status) {
    case "active":
      return {
        status: "active",
        companyId: resolution.session.companyId,
        role: resolution.session.role,
      };
    case "removed":
      return { status: "disabled" };
    case "invalid_role":
      return { status: "invalid_role" };
    case "none":
      return { status: "none" };
    case "unavailable":
      return { status: "unavailable" };
  }
}

/** Typed company access for the signed-in user. A failed read is `unavailable`, never `none`. */
export async function getUserCompanyAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<UserCompanyAccess> {
  return userCompanyAccessFromResolution(await resolveLiveMembership(supabase, userId));
}

/**
 * Authorization-only shorthand: the company id for an active, valid-role membership,
 * otherwise null (disabled, none, invalid role, or unavailable all fail closed).
 * Callers that must distinguish an outage from "no access" use getUserCompanyAccess.
 */
export async function getUserCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const access = await getUserCompanyAccess(supabase, userId);
  if (access.status === "unavailable") {
    console.error("[getUserCompanyId] membership unavailable", { userId });
  }
  return access.status === "active" ? access.companyId : null;
}
