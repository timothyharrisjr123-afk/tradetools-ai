/**
 * 3I-3B3b — Pure form utilities for the company pricing policy settings UI.
 *
 * No React, no Supabase, no I/O. Parsing/formatting/validation live here so the
 * client component stays thin. Validation delegates to the resolver contract
 * (`validateCompanyPricingPolicy`) — the single source of truth shared with the
 * store and DB migration (margin < 100, markup <= 100, etc.).
 */

import {
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
} from "@/app/lib/companyPricingPolicy";
import type { PricingPolicy, ProfitabilityType } from "@/app/lib/proposalPricingTypes";

// ---------------------------------------------------------------------------
// Locked assumptions (display-only this phase)
// ---------------------------------------------------------------------------

export const LOCKED_QUANTITY_ROUNDING: PricingPolicy["quantityRounding"] = "exact";
export const LOCKED_WASTE_MODEL: PricingPolicy["wasteModel"] = "adjusted_measurement";

// ---------------------------------------------------------------------------
// Form state — string-backed inputs (what the React form binds to)
// ---------------------------------------------------------------------------

export type PricingPolicyFormState = {
  profitabilityType: ProfitabilityType;
  defaultProfitabilityPct: string;
  minimumProfitabilityPct: string;
  salesTaxRatePct: string;
  /** Empty string maps to null (internal material purchase tax is optional). */
  materialPurchaseTaxRatePct: string;
};

export type PricingPolicyFormField = keyof PricingPolicyFormState;

export type ValidatePricingPolicyFormStateResult =
  | { valid: true; policy: PricingPolicy }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

/** Required numeric input → number; empty/invalid → NaN (validator rejects). */
function parseRequiredNumber(raw: string): number {
  const s = (raw ?? "").trim();
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Optional numeric input → null when empty; NaN when present-but-invalid. */
function parseOptionalNumber(raw: string): number | null {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function numberToInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

// ---------------------------------------------------------------------------
// Policy ↔ form-state mappers
// ---------------------------------------------------------------------------

/** Map a resolved/stored PricingPolicy into editable form state. */
export function policyToPricingPolicyFormState(policy: PricingPolicy): PricingPolicyFormState {
  return {
    profitabilityType: policy.profitabilityType,
    defaultProfitabilityPct: numberToInput(policy.defaultProfitabilityPct),
    minimumProfitabilityPct: numberToInput(policy.minimumProfitabilityPct),
    salesTaxRatePct: numberToInput(policy.tax?.salesTaxRatePct),
    materialPurchaseTaxRatePct: numberToInput(policy.tax?.materialPurchaseTaxRatePct ?? null),
  };
}

/**
 * Map a resolution (typically from resolveStarterPricingPolicySeed) into form
 * state for pre-fill. Does NOT mark the form configured — that is the caller's
 * concern, driven by the resolution's `configured` flag, not by this mapping.
 */
export function starterSeedToPricingPolicyFormState(
  resolution: CompanyPricingPolicyResolution
): PricingPolicyFormState {
  if (resolution.policy) {
    return policyToPricingPolicyFormState(resolution.policy);
  }
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: "",
    minimumProfitabilityPct: "",
    salesTaxRatePct: "",
    materialPurchaseTaxRatePct: "",
  };
}

/**
 * Build a PricingPolicy from form state. Locked fields are forced; discount and
 * subtotal override are always null. Unparseable required numbers become NaN so
 * downstream validation rejects them.
 */
export function pricingPolicyFormStateToPolicy(formState: PricingPolicyFormState): PricingPolicy {
  return {
    profitabilityType: formState.profitabilityType,
    defaultProfitabilityPct: parseRequiredNumber(formState.defaultProfitabilityPct),
    minimumProfitabilityPct: parseRequiredNumber(formState.minimumProfitabilityPct),
    quantityRounding: LOCKED_QUANTITY_ROUNDING,
    wasteModel: LOCKED_WASTE_MODEL,
    discount: null,
    tax: {
      salesTaxRatePct: parseRequiredNumber(formState.salesTaxRatePct),
      materialPurchaseTaxRatePct: parseOptionalNumber(formState.materialPurchaseTaxRatePct),
    },
    subtotalOverrideCents: null,
  };
}

/**
 * Validate form state for save. Delegates to the resolver contract so the UI,
 * store, and DB stay aligned. Returns the normalized policy when valid.
 */
export function validatePricingPolicyFormState(
  formState: PricingPolicyFormState
): ValidatePricingPolicyFormStateResult {
  const candidate = pricingPolicyFormStateToPolicy(formState);
  const result = validateCompanyPricingPolicy(candidate);
  if (!result.valid) {
    return { valid: false, reason: result.reason };
  }
  return { valid: true, policy: result.policy };
}
