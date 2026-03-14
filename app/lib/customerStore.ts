import type { SupabaseClient } from "@supabase/supabase-js";

export type FindOrCreateCustomerParams = {
  supabase: SupabaseClient;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
};

/**
 * Find a customer by company_id + email, or create one. Returns customer id or null.
 * Never throws; returns null if email is empty or on any error.
 */
export async function findOrCreateCustomer({
  supabase,
  companyId,
  name,
  email,
  phone,
  address,
}: FindOrCreateCustomerParams): Promise<string | null> {
  try {
    const emailTrimmed = (email ?? "").toString().trim();
    if (!emailTrimmed) return null;

    const { data: existing, error: selectError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (!selectError && existing?.id) return existing.id;

    const { data: inserted, error: insertError } = await supabase
      .from("customers")
      .insert({
        company_id: companyId,
        name: (name ?? "").toString().trim(),
        email: emailTrimmed,
        phone: (phone ?? "").toString().trim() || null,
        address: (address ?? "").toString().trim() || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) return null;
    return inserted.id;
  } catch {
    return null;
  }
}
