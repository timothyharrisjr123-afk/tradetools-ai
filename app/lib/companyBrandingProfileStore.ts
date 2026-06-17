/**
 * FieldDive Company Branding Profile Store — client-side data layer for
 * public.company_branding_profiles (R11b).
 *
 * Company-scoped read/upsert for extended branding fields (address, website,
 * brand colors, CLN-on-cover). Core identity remains on public.companies via
 * companyProfile.ts — this store does not read or write companies rows.
 *
 * Boundaries:
 * - No localStorage cache.
 * - No companyProfile writes, no pricing/template/proposal store imports.
 * - No Builder/UI hooks in this phase.
 * - Migration is NOT applied by this module; reads/writes succeed only after apply.
 */

import {
  normalizeCompanyBrandingProfile,
  type CompanyBrandingDeferredFieldKey,
  type CompanyBrandingProfile,
} from "@/app/lib/companyBrandingProfile";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

// ---------------------------------------------------------------------------
// DB row shape (public.company_branding_profiles)
// ---------------------------------------------------------------------------

export type CompanyBrandingProfileRow = {
  id: string;
  company_id: string;
  address: string | null;
  website: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  show_license_on_cover: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CompanyBrandingExtendedFields = Pick<
  CompanyBrandingProfile,
  CompanyBrandingDeferredFieldKey
>;

export type CompanyBrandingProfileUpsertRow = {
  company_id: string;
  address: string | null;
  website: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  show_license_on_cover: boolean;
  metadata: Record<string, unknown>;
};

export const COMPANY_BRANDING_PROFILE_TABLE = "company_branding_profiles";

export const COMPANY_BRANDING_PROFILE_SELECT_COLUMNS =
  "id, company_id, address, website, brand_primary_color, brand_secondary_color, show_license_on_cover, metadata, created_at, updated_at";

const TABLE = COMPANY_BRANDING_PROFILE_TABLE;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function normalizeCompanyId(companyId: string): string | null {
  if (typeof companyId !== "string") return null;
  const id = companyId.trim();
  if (!id || !isUuidLike(id)) return null;
  return id;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function emptyStringToNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

/** Preserve flat branding-row metadata; typed columns are not duplicated here. */
export function normalizeBrandingRowMetadata(metadata: unknown): Record<string, unknown> {
  if (!isPlainObject(metadata)) return {};
  return { ...metadata };
}

export function mergeBrandingRowMetadata(
  existingMetadata: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...normalizeBrandingRowMetadata(existingMetadata),
    ...patch,
  };
}

/**
 * Map a DB row to extended branding fields (normalized). Does not include core
 * company identity from public.companies.
 */
export function rowToCompanyBrandingProfileFields(
  row: CompanyBrandingProfileRow
): CompanyBrandingExtendedFields {
  const normalized = normalizeCompanyBrandingProfile({
    address: row.address ?? "",
    website: row.website ?? "",
    brandPrimaryColor: row.brand_primary_color ?? "",
    brandSecondaryColor: row.brand_secondary_color ?? "",
    showLicenseOnCover: row.show_license_on_cover,
  });

  return {
    address: normalized.address,
    website: normalized.website,
    brandPrimaryColor: normalized.brandPrimaryColor,
    brandSecondaryColor: normalized.brandSecondaryColor,
    showLicenseOnCover: normalized.showLicenseOnCover,
  };
}

/** Default upsert payload for ensure/bootstrap (empty extended branding). */
export function buildDefaultCompanyBrandingProfileUpsertPayload(
  companyId: string
): CompanyBrandingProfileUpsertRow {
  return companyBrandingProfileToUpsertPayload(companyId, {}, {});
}

/**
 * Map normalized extended branding fields to DB upsert columns.
 * Never emits core company identity fields (name, email, phone, license, logo).
 */
export function companyBrandingProfileToUpsertPayload(
  companyId: string,
  extended: Partial<CompanyBrandingExtendedFields>,
  existingMetadata: unknown = {}
): CompanyBrandingProfileUpsertRow {
  const normalized = normalizeCompanyBrandingProfile(extended);

  return {
    company_id: companyId,
    address: emptyStringToNull(normalized.address),
    website: emptyStringToNull(normalized.website),
    brand_primary_color: emptyStringToNull(normalized.brandPrimaryColor),
    brand_secondary_color: emptyStringToNull(normalized.brandSecondaryColor),
    show_license_on_cover: normalized.showLicenseOnCover,
    metadata: normalizeBrandingRowMetadata(existingMetadata),
  };
}

// ---------------------------------------------------------------------------
// Supabase reads
// ---------------------------------------------------------------------------

export type CompanyBrandingProfileLoadStatus =
  | "success"
  | "missing_row"
  | "read_error"
  | "client_unavailable"
  | "invalid_company_id";

export type CompanyBrandingProfileLoadResult = {
  status: CompanyBrandingProfileLoadStatus;
  fields: CompanyBrandingExtendedFields | null;
  /** True only when read succeeded but no row exists — safe to bootstrap empty row. */
  canEnsureEmptyRow: boolean;
};

export async function getCompanyBrandingProfileResult(
  companyId: string
): Promise<CompanyBrandingProfileLoadResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[companyBrandingProfileStore] getCompanyBrandingProfile: Supabase client unavailable");
    return {
      status: "client_unavailable",
      fields: null,
      canEnsureEmptyRow: false,
    };
  }
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyBrandingProfileStore] getCompanyBrandingProfile: invalid company id");
    return {
      status: "invalid_company_id",
      fields: null,
      canEnsureEmptyRow: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS)
      .eq("company_id", scopedCompanyId)
      .maybeSingle();

    if (error) {
      console.error("[companyBrandingProfileStore] getCompanyBrandingProfile failed:", error.message, {
        companyId: scopedCompanyId,
      });
      return {
        status: "read_error",
        fields: null,
        canEnsureEmptyRow: false,
      };
    }
    if (!data) {
      return {
        status: "missing_row",
        fields: null,
        canEnsureEmptyRow: true,
      };
    }
    return {
      status: "success",
      fields: rowToCompanyBrandingProfileFields(data as CompanyBrandingProfileRow),
      canEnsureEmptyRow: false,
    };
  } catch (err) {
    console.error("[companyBrandingProfileStore] getCompanyBrandingProfile error:", err);
    return {
      status: "read_error",
      fields: null,
      canEnsureEmptyRow: false,
    };
  }
}

export async function getCompanyBrandingProfile(
  companyId: string
): Promise<CompanyBrandingExtendedFields | null> {
  const result = await getCompanyBrandingProfileResult(companyId);
  return result.fields;
}

// ---------------------------------------------------------------------------
// Supabase writes
// ---------------------------------------------------------------------------

/**
 * Upsert extended branding fields for a company (one row per company).
 * Preserves existing row metadata keys not represented as typed columns.
 */
export async function upsertCompanyBrandingProfile(
  companyId: string,
  extended: Partial<CompanyBrandingExtendedFields>
): Promise<CompanyBrandingExtendedFields | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[companyBrandingProfileStore] upsertCompanyBrandingProfile: Supabase client unavailable");
    return null;
  }
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyBrandingProfileStore] upsertCompanyBrandingProfile: invalid company id");
    return null;
  }

  let existingMetadata: unknown = {};
  try {
    const { data: existing, error: readError } = await supabase
      .from(TABLE)
      .select("metadata")
      .eq("company_id", scopedCompanyId)
      .maybeSingle();

    if (readError) {
      console.error(
        "[companyBrandingProfileStore] upsertCompanyBrandingProfile metadata read failed:",
        readError.message,
        { companyId: scopedCompanyId }
      );
    } else if (existing && typeof existing === "object" && "metadata" in existing) {
      existingMetadata = (existing as { metadata?: unknown }).metadata;
    }
  } catch (err) {
    console.error("[companyBrandingProfileStore] upsertCompanyBrandingProfile metadata read error:", err);
  }

  const row = companyBrandingProfileToUpsertPayload(
    scopedCompanyId,
    extended,
    existingMetadata
  );

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "company_id" })
      .select(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[companyBrandingProfileStore] upsertCompanyBrandingProfile failed:", error.message, {
        companyId: scopedCompanyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToCompanyBrandingProfileFields(data as CompanyBrandingProfileRow);
  } catch (err) {
    console.error("[companyBrandingProfileStore] upsertCompanyBrandingProfile error:", err);
    return null;
  }
}

/**
 * Ensure a branding profile row exists for the company. Creates an empty row
 * only when read succeeded and row is confirmed missing — never on read errors.
 */
export async function ensureCompanyBrandingProfile(
  companyId: string
): Promise<CompanyBrandingExtendedFields | null> {
  const result = await getCompanyBrandingProfileResult(companyId);
  if (result.status === "success" && result.fields) {
    return result.fields;
  }
  if (result.status === "missing_row" && result.canEnsureEmptyRow) {
    return upsertCompanyBrandingProfile(companyId, {});
  }
  return null;
}
