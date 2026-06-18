/**
 * DB-truth customer identity for proposal context_echo stamping (R12).
 *
 * Read-only — no find-or-create, no legacy estimate paths, no localStorage.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";

export type ProposalContextEchoCustomerFields = {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

export type ProposalCustomerRow = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

function echoNullableString(value: unknown): string | null {
  const trimmed = (value ?? "").toString().trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Maps a customers row to proposal `context_echo` customer identity slice. */
export function mapCustomerToProposalContextEcho(
  row: Partial<ProposalCustomerRow> | null | undefined
): ProposalContextEchoCustomerFields {
  if (!row) {
    return {
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      customer_address: null,
    };
  }

  return {
    customer_name: echoNullableString(row.name),
    customer_email: echoNullableString(row.email),
    customer_phone: echoNullableString(row.phone),
    customer_address: echoNullableString(row.address),
  };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Loads company-scoped customer identity from `customers` for draft create stamping. */
export async function loadProposalCustomerContextFromDatabase(
  companyId: string,
  customerId: string | null | undefined,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>
): Promise<ProposalContextEchoCustomerFields> {
  const cid = (companyId ?? "").trim();
  const id = (customerId ?? "").trim();
  if (!cid || !id || !isUuidLike(id)) {
    return mapCustomerToProposalContextEcho(null);
  }

  const { data, error } = await supabase
    .from("customers")
    .select("name, email, phone, address")
    .eq("id", id)
    .eq("company_id", cid)
    .maybeSingle();

  if (error || !data) {
    return mapCustomerToProposalContextEcho(null);
  }

  return mapCustomerToProposalContextEcho(data as ProposalCustomerRow);
}
