/**
 * Wave B — customers table writers.
 *
 * customers = reusable live identity (company-scoped).
 * jobs.customer_id = stable pointer when selected/created.
 * Job contact columns = job-facing snapshot (not frozen proposal history).
 *
 * findOrCreateCustomer: legacy estimate / Job Card auto-link path (email required).
 * createCustomer: always inserts — used when contractor explicitly continues as new.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeCustomerEmail,
  normalizePersonName,
} from "@/app/lib/customerIdentityNormalize";

export type CustomerWriteParams = {
  supabase: SupabaseClient;
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

function displayPhone(phone?: string | null): string | null {
  const trimmed = String(phone ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function displayAddress(address?: string | null): string | null {
  const trimmed = String(address ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Always create a new customer row. Does not search by email.
 * Returns customer id or null on failure. Email optional for intake without email.
 */
export async function createCustomer({
  supabase,
  companyId,
  name,
  email,
  phone,
  address,
}: CustomerWriteParams): Promise<string | null> {
  try {
    const company = String(companyId ?? "").trim();
    if (!company) return null;

    const emailNorm = normalizeCustomerEmail(email);
    const { data: inserted, error: insertError } = await supabase
      .from("customers")
      .insert({
        company_id: company,
        name: normalizePersonName(name) || "Customer",
        email: emailNorm,
        phone: displayPhone(phone),
        address: displayAddress(address),
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) return null;
    return inserted.id as string;
  } catch {
    return null;
  }
}

/**
 * Find a customer by company_id + normalized email, or create one.
 * Never throws; returns null if email is empty or on any error.
 *
 * Do not use this for New Job "continue as new" — that must call createCustomer
 * so exact-email cannot silently collapse contractor intent onto an existing human.
 */
export async function findOrCreateCustomer({
  supabase,
  companyId,
  name,
  email,
  phone,
  address,
}: CustomerWriteParams & { email: string }): Promise<string | null> {
  try {
    const emailNorm = normalizeCustomerEmail(email);
    if (!emailNorm) return null;

    const { data: existing, error: selectError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .ilike("email", emailNorm)
      .maybeSingle();

    if (!selectError && existing?.id) return existing.id as string;

    return createCustomer({
      supabase,
      companyId,
      name,
      email: emailNorm,
      phone,
      address,
    });
  } catch {
    return null;
  }
}
