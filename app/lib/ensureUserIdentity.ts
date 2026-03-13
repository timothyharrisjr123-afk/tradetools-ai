import type { SupabaseClient } from "@supabase/supabase-js";

/** Auth user shape needed for identity setup. */
type AuthUser = { id: string; email?: string | null };

/**
 * Ensures the authenticated user has profile, company, and company_membership records.
 * Call after getUser() on protected pages. Idempotent — safe to call every time.
 */
export async function ensureUserIdentity(
  supabase: SupabaseClient,
  user: AuthUser
): Promise<void> {
  if (!user?.id) return;

  // A) Ensure profile exists (upsert for reliability)
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        full_name: "",
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[ensureUserIdentity] Profile upsert failed:", profileError.message, { userId: user.id });
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
 * Returns the current user's company_id from company_memberships, or null.
 */
export async function getUserCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getUserCompanyId]", error.message, { userId });
    return null;
  }
  return data?.company_id ?? null;
}
