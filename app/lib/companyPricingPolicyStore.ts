/**
 * FieldDive Company Pricing Policy Store — client-side data layer for
 * public.company_pricing_policies (3I-3B2B).
 *
 * Company-scoped read/upsert for the real company pricing policy
 * (precedence layer 1 — see docs §6L/§6M). Uses getSupabaseClient() with RLS,
 * same pattern as catalogStore / jobStore / measurementStore.
 *
 * Boundaries:
 * - No pricing math (delegates validation to companyPricingPolicy resolver).
 * - No localStorage cache (a stale cached policy is exactly the "fake configured"
 *   risk the resolver was designed to prevent).
 * - No companyProfile import, no generated Supabase types, no Builder imports.
 * - No proposal/payment/PDF/send writes. No delete in this phase.
 * - Migration is NOT applied by this module; it only reads/writes when the table exists.
 */

import {
  resolveCompanyPricingPolicy,
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
  type ValidateCompanyPricingPolicyResult,
} from "@/app/lib/companyPricingPolicy";
import type { PricingPolicy, ProfitabilityType } from "@/app/lib/proposalPricingTypes";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

// ---------------------------------------------------------------------------
// DB row shape (public.company_pricing_policies)
// ---------------------------------------------------------------------------

export type CompanyPricingPolicyRow = {
  id: string;
  company_id: string;
  profitability_type: string;
  default_profitability_pct: number | string;
  minimum_profitability_pct: number | string;
  quantity_rounding: string;
  waste_model: string;
  sales_tax_rate_pct: number | string;
  material_purchase_tax_rate_pct?: number | string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyPricingPolicyInsertRow = {
  company_id: string;
  profitability_type: string;
  default_profitability_pct: number;
  minimum_profitability_pct: number;
  quantity_rounding: string;
  waste_model: string;
  sales_tax_rate_pct: number;
  material_purchase_tax_rate_pct: number | null;
};

export const COMPANY_PRICING_POLICY_SELECT_COLUMNS =
  "id, company_id, profitability_type, default_profitability_pct, minimum_profitability_pct, quantity_rounding, waste_model, sales_tax_rate_pct, material_purchase_tax_rate_pct, metadata, created_by, updated_by, created_at, updated_at";

const TABLE = "company_pricing_policies";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function normalizeRequiredNumber(value: unknown): number | null {
  const n = normalizeNullableNumber(value);
  return n;
}

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

// ---------------------------------------------------------------------------
// Storable validation — single source of truth is the resolver validator
// ---------------------------------------------------------------------------

/**
 * Validate a policy for persistence. Delegates entirely to the resolver's
 * `validateCompanyPricingPolicy` so the store cannot drift from the contract
 * (the margin < 100 rule now lives in the resolver, matching the DB migration
 * and the engine's margin >= 100 unpriced behavior). Kept as a named store
 * export so callers/tests have a clear "is this writable?" entry point and so
 * future store-only checks have a home without re-coupling to the resolver.
 */
export function validateStorableCompanyPricingPolicy(
  candidate: PricingPolicy | null | undefined
): ValidateCompanyPricingPolicyResult {
  return validateCompanyPricingPolicy(candidate);
}

// ---------------------------------------------------------------------------
// Row ↔ policy mappers
// ---------------------------------------------------------------------------

/**
 * Map a DB row to a PricingPolicy. Returns null if required numeric fields are
 * not finite (downstream resolver/validator treats null as not-configured).
 * Discount and subtotal override are always null (not stored in this phase).
 */
export function rowToPricingPolicy(row: CompanyPricingPolicyRow): PricingPolicy | null {
  const defaultPct = normalizeRequiredNumber(row.default_profitability_pct);
  const minimumPct = normalizeRequiredNumber(row.minimum_profitability_pct);
  const salesTax = normalizeRequiredNumber(row.sales_tax_rate_pct);

  if (defaultPct == null || minimumPct == null || salesTax == null) {
    return null;
  }

  return {
    profitabilityType: row.profitability_type as ProfitabilityType,
    defaultProfitabilityPct: defaultPct,
    minimumProfitabilityPct: minimumPct,
    quantityRounding: row.quantity_rounding as PricingPolicy["quantityRounding"],
    wasteModel: row.waste_model as PricingPolicy["wasteModel"],
    discount: null,
    tax: {
      salesTaxRatePct: salesTax,
      materialPurchaseTaxRatePct: normalizeNullableNumber(row.material_purchase_tax_rate_pct),
    },
    subtotalOverrideCents: null,
  };
}

/**
 * Map a validated PricingPolicy to DB insert/upsert fields (locked columns only).
 * Never emits discount or subtotal-override fields. company_id is always set so the
 * row satisfies the unique(company_id) upsert target.
 */
export function pricingPolicyToRowFields(
  companyId: string,
  policy: PricingPolicy
): CompanyPricingPolicyInsertRow {
  return {
    company_id: companyId,
    profitability_type: policy.profitabilityType,
    default_profitability_pct: policy.defaultProfitabilityPct,
    minimum_profitability_pct: policy.minimumProfitabilityPct,
    quantity_rounding: policy.quantityRounding,
    waste_model: policy.wasteModel,
    sales_tax_rate_pct: policy.tax.salesTaxRatePct,
    material_purchase_tax_rate_pct: policy.tax.materialPurchaseTaxRatePct ?? null,
  };
}

// ---------------------------------------------------------------------------
// Supabase reads
// ---------------------------------------------------------------------------

export async function getCompanyPricingPolicy(
  companyId: string
): Promise<PricingPolicy | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[companyPricingPolicyStore] getCompanyPricingPolicy: Supabase client unavailable");
    return null;
  }
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyPricingPolicyStore] getCompanyPricingPolicy: invalid company id");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COMPANY_PRICING_POLICY_SELECT_COLUMNS)
      .eq("company_id", scopedCompanyId)
      .maybeSingle();

    if (error) {
      console.error("[companyPricingPolicyStore] getCompanyPricingPolicy failed:", error.message, {
        companyId: scopedCompanyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToPricingPolicy(data as CompanyPricingPolicyRow);
  } catch (err) {
    console.error("[companyPricingPolicyStore] getCompanyPricingPolicy error:", err);
    return null;
  }
}

/**
 * Fetch the stored policy and run it through the resolver so callers receive the
 * same contract shape the Builder/settings will consume in 3I-3B3.
 * Missing row → { configured:false, source:"missing", policy:null }.
 */
export async function getResolvedCompanyPricingPolicy(
  companyId: string
): Promise<CompanyPricingPolicyResolution> {
  const storedPolicy = await getCompanyPricingPolicy(companyId);
  return resolveCompanyPricingPolicy({ storedPolicy });
}

// ---------------------------------------------------------------------------
// Supabase writes
// ---------------------------------------------------------------------------

/**
 * Validate then upsert the company pricing policy (one row per company).
 * Invalid policies are refused before any write. Starter defaults are never
 * auto-saved — callers must pass an explicit, user-edited policy.
 */
export async function upsertCompanyPricingPolicy(
  companyId: string,
  policy: PricingPolicy
): Promise<PricingPolicy | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[companyPricingPolicyStore] upsertCompanyPricingPolicy: Supabase client unavailable");
    return null;
  }
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[companyPricingPolicyStore] upsertCompanyPricingPolicy: invalid company id");
    return null;
  }

  const validation = validateStorableCompanyPricingPolicy(policy);
  if (!validation.valid) {
    console.error(
      "[companyPricingPolicyStore] upsertCompanyPricingPolicy: invalid policy:",
      validation.reason,
      { companyId: scopedCompanyId }
    );
    return null;
  }

  const row = pricingPolicyToRowFields(scopedCompanyId, validation.policy);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "company_id" })
      .select(COMPANY_PRICING_POLICY_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[companyPricingPolicyStore] upsertCompanyPricingPolicy failed:", error.message, {
        companyId: scopedCompanyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToPricingPolicy(data as CompanyPricingPolicyRow);
  } catch (err) {
    console.error("[companyPricingPolicyStore] upsertCompanyPricingPolicy error:", err);
    return null;
  }
}
