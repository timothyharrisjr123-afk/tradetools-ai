import type { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Ensures the authenticated user has profile, company, and company_membership records.
 * Call after getUser() on protected pages. Idempotent — safe to call every time.
 * Never clears an existing profiles.full_name (display-name authority).
 */
export async function ensureUserIdentity(
  supabase: SupabaseClient,
  user: AuthUser
): Promise<void> {
  if (!user?.id) return;

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

  // B) Ensure company_membership exists (and company if needed)
  const { data: existingMembership, error: membershipSelectError } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipSelectError) {
    console.error("[ensureUserIdentity] Membership lookup failed:", membershipSelectError.message, { userId: user.id });
    return;
  }

  if (!existingMembership) {
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: "My Company",
        owner_user_id: user.id,
      })
      .select("id")
      .single();

    if (companyError || !newCompany?.id) {
      console.error("[ensureUserIdentity] Company creation failed:", companyError?.message ?? "no company id", { userId: user.id });
      return;
    }

    const { error: membershipInsertError } = await supabase
      .from("company_memberships")
      .insert({
        user_id: user.id,
        company_id: newCompany.id,
        role: "owner",
      });

    if (membershipInsertError) {
      console.error("[ensureUserIdentity] Membership creation failed:", membershipInsertError.message, { userId: user.id, companyId: newCompany.id });
    }
  }
}

/**
 * Returns the current user's company_id from a live (non-removed) membership, or null.
 * Removed members must not regain company access via this helper.
 */
export async function getUserCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("company_memberships")
    .select("company_id, removed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getUserCompanyId]", error.message, { userId });
    return null;
  }
  if (!data?.company_id) return null;
  if ((data as { removed_at?: string | null }).removed_at) return null;
  return data.company_id;
}
