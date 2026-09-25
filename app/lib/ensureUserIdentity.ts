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

export const COMPANY_BOOTSTRAP_RPC = "bootstrap_current_user_company_v1";

export type EnsureUserIdentityResult =
  | { status: "ready"; companyId: string; created: boolean }
  | { status: "removed" }
  | { status: "failed"; reason: "not_authenticated" | "bootstrap_failed" | "invalid_response" };

/** Maps the bootstrap RPC row onto the identity contract. Unknown shapes fail closed. */
export function parseCompanyBootstrapResult(data: unknown): EnsureUserIdentityResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { status: "failed", reason: "invalid_response" };
  }
  const status = (row as { status?: unknown }).status;
  const companyId = (row as { company_id?: unknown }).company_id;
  if (status === "removed") return { status: "removed" };
  if ((status === "created" || status === "existing") && typeof companyId === "string" && companyId) {
    return { status: "ready", companyId, created: status === "created" };
  }
  return { status: "failed", reason: "invalid_response" };
}

/**
 * Ensures the authenticated user has a profile and a company membership.
 * Company + owner membership are created only by the bootstrap RPC (atomic, per-user
 * serialized, idempotent); this helper never inserts companies or memberships directly.
 * Call after getUser() on protected pages. Safe to call every time.
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

  // B) Ensure company + owner membership through the bootstrap authority
  const { data, error } = await supabase.rpc(COMPANY_BOOTSTRAP_RPC);
  if (error) {
    console.error("[ensureUserIdentity] Company bootstrap failed:", error.message, {
      userId: user.id,
    });
    return { status: "failed", reason: "bootstrap_failed" };
  }
  const result = parseCompanyBootstrapResult(data);
  if (result.status === "failed") {
    console.error("[ensureUserIdentity] Company bootstrap returned an unexpected result", {
      userId: user.id,
    });
  }
  return result;
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
