/**
 * Wave B / Phase 6 — customers table writers.
 *
 * customers = reusable live identity (company-scoped).
 * jobs.customer_id = stable pointer when selected/created.
 * Job contact columns = job-facing snapshot (not frozen proposal history).
 *
 * Canonical supported policy (Astra G6 / FD-P1-01 cutover):
 *   EXISTING → explicit selection of customer_id
 *   NEW → explicit createCustomer
 *   POSSIBLE DUPLICATE → candidates / inspect / continue-as-new
 * No silent email-based collapse on supported paths.
 *
 * findOrCreateCustomer remains LEGACY-QUARANTINED for residual estimate shelf
 * callers only. Supported Job Card / packet paths must not call it.
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

export type FindOrCreateCustomerOutcome =
  | { status: "found"; customerId: string }
  | { status: "created"; customerId: string }
  | { status: "ambiguous"; customerId: null }
  | { status: "skipped"; customerId: null; reason: "empty_email" | "error" };

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
 * LEGACY-QUARANTINED — do not use on supported packet / Job Card identity paths.
 *
 * Exact same-company duplicate-email behavior (deterministic):
 * - empty email → skipped (null)
 * - 0 matches → createCustomer (status created)
 * - exactly 1 match → returns that id (status found) — silent email collapse
 * - 2+ matches → ambiguous → null (does NOT pick, does NOT create, does NOT wrong-attach)
 * - query/insert error → skipped null
 *
 * Supported flows must use explicit select or createCustomer instead.
 */
export async function findOrCreateCustomer({
  supabase,
  companyId,
  name,
  email,
  phone,
  address,
}: CustomerWriteParams & { email: string }): Promise<string | null> {
  const outcome = await findOrCreateCustomerDetailed({
    supabase,
    companyId,
    name,
    email,
    phone,
    address,
  });
  return outcome.customerId;
}

/** Detailed legacy outcome for tests / quarantine diagnostics. */
export async function findOrCreateCustomerDetailed({
  supabase,
  companyId,
  name,
  email,
  phone,
  address,
}: CustomerWriteParams & { email: string }): Promise<FindOrCreateCustomerOutcome> {
  try {
    const emailNorm = normalizeCustomerEmail(email);
    if (!emailNorm) return { status: "skipped", customerId: null, reason: "empty_email" };

    const { data: matches, error: selectError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .ilike("email", emailNorm)
      .limit(2);

    if (selectError) {
      return { status: "skipped", customerId: null, reason: "error" };
    }

    const rows = Array.isArray(matches) ? matches : [];
    if (rows.length > 1) {
      // Duplicate-email ambiguity: return null — no merge, no create, no wrong attach.
      return { status: "ambiguous", customerId: null };
    }
    if (rows.length === 1 && rows[0]?.id) {
      return { status: "found", customerId: rows[0].id as string };
    }

    const created = await createCustomer({
      supabase,
      companyId,
      name,
      email: emailNorm,
      phone,
      address,
    });
    if (!created) return { status: "skipped", customerId: null, reason: "error" };
    return { status: "created", customerId: created };
  } catch {
    return { status: "skipped", customerId: null, reason: "error" };
  }
}
