/**
 * FieldDive Company Pricing Policy resolver (3I-3B1).
 *
 * Pure policy-resolution contract — no Supabase, localStorage, React, Builder UI,
 * persistence, snapshots, or engine/mapper calls.
 *
 * Guardrails (§6L):
 * - Real stored company policy → configured.
 * - Missing/invalid policy → not configured (never silently use starter as real policy).
 * - DEFAULT_STARTER_PRICING_POLICY is settings-form seed only — not production Builder policy.
 */

import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
  type ProfitabilityType,
} from "@/app/lib/proposalPricingTypes";

// ---------------------------------------------------------------------------
// Starter default — settings-form seed only, NOT configured company policy
// ---------------------------------------------------------------------------

/**
 * Unsaved starter default for settings UI pre-fill (3I-3B3).
 * NOT persisted, NOT snapshotted, NOT sendable, NOT a customer quote.
 * Do NOT pass to resolveCompanyPricingPolicy as stored company policy.
 */
export const DEFAULT_STARTER_PRICING_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 50,
  minimumProfitabilityPct: 20,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: {
    salesTaxRatePct: 0,
    materialPurchaseTaxRatePct: null,
  },
  subtotalOverrideCents: null,
};

// ---------------------------------------------------------------------------
// Source / resolution types
// ---------------------------------------------------------------------------

/** Where the resolved policy came from. */
export type CompanyPricingPolicySourceLabel = "company" | "starter_default" | "missing";

/**
 * Input to resolveCompanyPricingPolicy.
 * In 3I-3B2+, storedPolicy will be populated from company_pricing_policies store.
 */
export type CompanyPricingPolicySource = {
  /** Stored company policy row. Null/undefined/absent = not configured. */
  storedPolicy?: PricingPolicy | null;
};

export type CompanyPricingPolicyResolution = {
  /** True only when a valid stored company policy was supplied. */
  configured: boolean;
  source: CompanyPricingPolicySourceLabel;
  /** Resolved PricingPolicy when configured; null when missing or invalid. */
  policy: PricingPolicy | null;
  /** Human-readable reason when not configured. */
  reason: string | null;
};

// ---------------------------------------------------------------------------
// Validation (internal)
// ---------------------------------------------------------------------------

const SUPPORTED_PROFITABILITY_TYPES: readonly ProfitabilityType[] = ["margin", "markup"];

function isFinitePct(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

export type ValidateCompanyPricingPolicyResult =
  | { valid: true; policy: PricingPolicy }
  | { valid: false; reason: string };

/**
 * Validate and normalize a candidate company pricing policy.
 * Exported for tests and future store-layer validation (3I-3B2).
 */
export function validateCompanyPricingPolicy(
  candidate: PricingPolicy | null | undefined
): ValidateCompanyPricingPolicyResult {
  if (candidate == null) {
    return { valid: false, reason: "Company pricing policy is not configured." };
  }

  const { profitabilityType, defaultProfitabilityPct, minimumProfitabilityPct } = candidate;

  if (!SUPPORTED_PROFITABILITY_TYPES.includes(profitabilityType)) {
    return { valid: false, reason: "Invalid profitability type." };
  }

  if (!isFinitePct(defaultProfitabilityPct)) {
    return { valid: false, reason: "Invalid default profitability percentage." };
  }

  if (!isFinitePct(minimumProfitabilityPct)) {
    return { valid: false, reason: "Invalid minimum profitability percentage." };
  }

  if (minimumProfitabilityPct > defaultProfitabilityPct) {
    return {
      valid: false,
      reason: "Minimum profitability cannot exceed default profitability.",
    };
  }

  if (candidate.quantityRounding !== "exact") {
    return {
      valid: false,
      reason: 'Only quantityRounding "exact" is supported in this phase.',
    };
  }

  if (candidate.wasteModel !== "adjusted_measurement") {
    return {
      valid: false,
      reason: 'Only wasteModel "adjusted_measurement" is supported in this phase.',
    };
  }

  const tax = candidate.tax;
  if (tax == null || typeof tax !== "object") {
    return { valid: false, reason: "Tax policy is required." };
  }

  if (!isFinitePct(tax.salesTaxRatePct)) {
    return { valid: false, reason: "Invalid sales tax rate." };
  }

  const materialTax = tax.materialPurchaseTaxRatePct;
  if (
    materialTax != null &&
    (typeof materialTax !== "number" || !Number.isFinite(materialTax) || materialTax < 0)
  ) {
    return { valid: false, reason: "Invalid material purchase tax rate." };
  }

  if (candidate.discount != null) {
    return { valid: false, reason: "Discount policy is not supported in this phase." };
  }

  if (candidate.subtotalOverrideCents != null) {
    return { valid: false, reason: "Subtotal override is not supported in this phase." };
  }

  const policy: PricingPolicy = {
    profitabilityType,
    defaultProfitabilityPct,
    minimumProfitabilityPct,
    quantityRounding: "exact",
    wasteModel: "adjusted_measurement",
    discount: null,
    tax: {
      salesTaxRatePct: tax.salesTaxRatePct,
      materialPurchaseTaxRatePct: materialTax ?? null,
    },
    subtotalOverrideCents: null,
  };

  return { valid: true, policy };
}

// ---------------------------------------------------------------------------
// Public resolver
// ---------------------------------------------------------------------------

/**
 * Resolve company pricing policy from a stored source.
 * Pure — no I/O. Does NOT fall back to DEFAULT_STARTER_PRICING_POLICY.
 */
export function resolveCompanyPricingPolicy(
  source: CompanyPricingPolicySource = {}
): CompanyPricingPolicyResolution {
  const validation = validateCompanyPricingPolicy(source.storedPolicy);

  if (!validation.valid) {
    return {
      configured: false,
      source: "missing",
      policy: null,
      reason: validation.reason,
    };
  }

  return {
    configured: true,
    source: "company",
    policy: validation.policy,
    reason: null,
  };
}

/**
 * Explicit starter seed resolution for settings UI only (3I-3B3).
 * Never configured — always source "starter_default".
 */
export function resolveStarterPricingPolicySeed(): CompanyPricingPolicyResolution {
  return {
    configured: false,
    source: "starter_default",
    policy: { ...DEFAULT_STARTER_PRICING_POLICY },
    reason: "Starter default is not configured company policy.",
  };
}
