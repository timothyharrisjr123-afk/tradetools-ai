/**
 * Job property change — dedicated RPC facade (FD-P2-PLACES-SURFACES).
 * Does not use updateJob as property/address authority.
 */

import {
  normalizePropertyAddress,
  type PropertyAddressParts,
} from "@/app/lib/propertyAddressNormalize";
import {
  findPropertiesByNormalizedKey,
  mapPropertyRow,
  resolveCompanyProperty,
  type PropertyRecord,
  type PropertyWriteParams,
} from "@/app/lib/propertyStore";

export const CHANGE_JOB_PROPERTY_RPC_V1 = "change_job_property_v1";

export type ChangeJobPropertyInput = {
  companyId: string;
  jobId: string;
  /** Select an existing same-company property (skip address resolve). */
  propertyId?: string | null;
  address?: PropertyAddressParts | null;
  placesPlaceId?: string | null;
};

export type ChangeJobPropertyResult =
  | {
      ok: true;
      jobId: string;
      companyId: string;
      propertyId: string;
      previousPropertyId: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      addressCity: string | null;
      addressState: string | null;
      addressZip: string | null;
      addressCountry: string | null;
      addressFormatted: string | null;
      resolution: string;
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "forbidden"
        | "invalid_payload"
        | "not_found"
        | "property_not_found"
        | "property_address_invalid"
        | "property_identity_conflict"
        | "resolve_failed"
        | "rpc_error";
      detail?: string;
    };

function display(value?: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function changeJobPropertyViaRpc(
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  input: ChangeJobPropertyInput
): Promise<ChangeJobPropertyResult> {
  const companyId = String(input.companyId ?? "").trim();
  const jobId = String(input.jobId ?? "").trim();
  const propertyId = display(input.propertyId);
  const address = input.address ?? null;

  if (!companyId || !jobId) {
    return { ok: false, code: "invalid_payload" };
  }
  if (!propertyId) {
    const normalized = address ? normalizePropertyAddress(address) : "";
    if (!normalized) return { ok: false, code: "property_address_invalid" };
  }

  const payload: Record<string, string | null> = {
    company_id: companyId,
    job_id: jobId,
    property_id: propertyId,
    line1: display(address?.line1) ?? display(address?.formatted),
    line2: display(address?.line2),
    city: display(address?.city),
    state: display(address?.state),
    zip: display(address?.zip),
    formatted: display(address?.formatted),
    places_place_id: display(input.placesPlaceId),
  };

  const { data, error } = await supabase.rpc(CHANGE_JOB_PROPERTY_RPC_V1, {
    p_payload: payload,
  });

  if (error) {
    return { ok: false, code: "rpc_error", detail: error.message };
  }
  if (!data || typeof data !== "object") {
    return { ok: false, code: "rpc_error", detail: "non-object result" };
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "rpc_error") as Extract<
        ChangeJobPropertyResult,
        { ok: false }
      >["code"],
      detail: typeof row.detail === "string" ? row.detail : undefined,
    };
  }

  return {
    ok: true,
    jobId: String(row.job_id ?? jobId),
    companyId: String(row.company_id ?? companyId),
    propertyId: String(row.property_id ?? ""),
    previousPropertyId:
      typeof row.previous_property_id === "string"
        ? row.previous_property_id
        : null,
    addressLine1: display(row.address_line1 as string | null),
    addressLine2: display(row.address_line2 as string | null),
    addressCity: display(row.address_city as string | null),
    addressState: display(row.address_state as string | null),
    addressZip: display(row.address_zip as string | null),
    addressCountry: display(row.address_country as string | null),
    addressFormatted: display(row.address_formatted as string | null),
    resolution: String(row.resolution ?? "resolved"),
  };
}

/** Search helpers re-exported for Job Card change UI. */
export {
  findPropertiesByNormalizedKey,
  mapPropertyRow,
  resolveCompanyProperty,
};
export type { PropertyRecord, PropertyWriteParams };
