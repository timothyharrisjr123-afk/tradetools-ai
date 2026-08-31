/**
 * Wave C — properties table writers/readers.
 *
 * properties = reusable place identity (company-scoped).
 * jobs.property_id = stable pointer when selected/created.
 * Job address columns remain project snapshot — not rewritten by Property edits.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatPropertyDisplayAddress,
  normalizePropertyAddress,
  type PropertyAddressParts,
} from "@/app/lib/propertyAddressNormalize";

export type PropertyRecord = {
  id: string;
  company_id: string;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  address_formatted: string | null;
  address_normalized: string;
  places_place_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PropertyWriteParams = {
  supabase: SupabaseClient;
  companyId: string;
  address: PropertyAddressParts;
  placesPlaceId?: string | null;
};

function display(value?: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapPropertyRow(row: Record<string, unknown>): PropertyRecord | null {
  const id = String(row.id ?? "").trim();
  const companyId = String(row.company_id ?? "").trim();
  const normalized = String(row.address_normalized ?? "").trim();
  if (!id || !companyId || !normalized) return null;
  return {
    id,
    company_id: companyId,
    address_line1: display(row.address_line1 as string | null),
    address_line2: display(row.address_line2 as string | null),
    address_city: display(row.address_city as string | null),
    address_state: display(row.address_state as string | null),
    address_zip: display(row.address_zip as string | null),
    address_country: display(row.address_country as string | null) ?? "US",
    address_formatted:
      display(row.address_formatted as string | null) ??
      (formatPropertyDisplayAddress({
        line1: row.address_line1 as string | null,
        city: row.address_city as string | null,
        state: row.address_state as string | null,
        zip: row.address_zip as string | null,
      }) || null),
    address_normalized: normalized,
    places_place_id: display(row.places_place_id as string | null),
    created_at: display(row.created_at as string | null) ?? undefined,
    updated_at: display(row.updated_at as string | null) ?? undefined,
  };
}

export async function createProperty({
  supabase,
  companyId,
  address,
  placesPlaceId,
}: PropertyWriteParams): Promise<string | null> {
  try {
    const company = String(companyId ?? "").trim();
    const normalized = normalizePropertyAddress(address);
    if (!company || !normalized) return null;

    const line1 = display(address.line1) ?? display(address.formatted);
    const formatted =
      display(address.formatted) ??
      (formatPropertyDisplayAddress(address) || null);

    const { data: inserted, error } = await supabase
      .from("properties")
      .insert({
        company_id: company,
        address_line1: line1,
        address_line2: display(address.line2),
        address_city: display(address.city),
        address_state: display(address.state),
        address_zip: display(address.zip),
        address_country: "US",
        address_formatted: formatted,
        address_normalized: normalized,
        places_place_id: display(placesPlaceId),
      })
      .select("id")
      .single();

    if (error || !inserted?.id) return null;
    return inserted.id as string;
  } catch {
    return null;
  }
}

export async function findPropertiesByNormalizedKey({
  supabase,
  companyId,
  address,
}: {
  supabase: SupabaseClient;
  companyId: string;
  address: PropertyAddressParts;
}): Promise<PropertyRecord[]> {
  const company = String(companyId ?? "").trim();
  const normalized = normalizePropertyAddress(address);
  if (!company || !normalized) return [];

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, company_id, address_line1, address_line2, address_city, address_state, address_zip, address_country, address_formatted, address_normalized, places_place_id, created_at, updated_at"
    )
    .eq("company_id", company)
    .eq("address_normalized", normalized)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => mapPropertyRow(row as Record<string, unknown>))
    .filter((row): row is PropertyRecord => row != null);
}

/**
 * Always insert. Never collapse onto an existing Property.
 * Used when the contractor explicitly continues as a new Property.
 */
export async function createPropertyExplicit(params: PropertyWriteParams): Promise<string | null> {
  return createProperty(params);
}
