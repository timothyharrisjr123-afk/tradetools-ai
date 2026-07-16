/**
 * FieldDive Company Pricing Policy resolver (3I-3B1 / raw_plus_waste Phase 3).
 *
 * Pure policy-resolution contract — no Supabase, localStorage, React, Builder UI,
 * persistence, snapshots, or engine/mapper calls.
 *
 * Guardrails (§6L):
 * - Real stored company policy → configured.
 * - Missing/invalid policy → not configured (never silently use starter as real policy).
 * - DEFAULT_STARTER_PRICING_POLICY is settings-form seed only — not production Builder policy.
 * - Defaults remain adjusted_measurement + exact.
 * - Phase 3: raw_plus_waste is staged as a recognized policy waste_model literal for
 *   future storage after the review-only DB CHECK migration is explicitly applied.
 *   It does NOT enable quantity-layer production wiring, UI mode switching, or
 *   pricing-engine support (engine still rejects non-default waste models).
 */

import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
  type ProfitabilityType,
  type WasteModel,
} from "@/app/lib/proposalPricingTypes";

/** Policy waste models recognized by the app validator (Phase 3 staging). */
export const STAGED_POLICY_WASTE_MODELS: readonly WasteModel[] = [
  "adjusted_measurement",
  "raw_plus_waste",
] as const;

/**
 * True when a waste_model literal is recognized for staged policy storage/validation.
 * Does not mean production quantity resolution or pricing-engine support is enabled.
 */
export function isStagedPolicyWasteModel(value: unknown): value is WasteModel {
  return value === "adjusted_measurement" || value === "raw_plus_waste";
}

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

  // Margin math diverges at 100% (margin >= 100 is unpriced in the engine), so
  // margin policies must stay strictly below 100. Markup has no such ceiling.
  // Resolver, store, DB migration, and engine all align on this rule.
  if (profitabilityType === "margin") {
    if (defaultProfitabilityPct >= 100) {
      return { valid: false, reason: "Margin default profitability must be below 100%." };
    }
    if (minimumProfitabilityPct >= 100) {
      return { valid: false, reason: "Margin minimum profitability must be below 100%." };
    }
  }

  if (candidate.quantityRounding !== "exact") {
    return {
      valid: false,
      reason: 'Only quantityRounding "exact" is supported in this phase.',
    };
  }

  // Phase 3: raw_plus_waste is a staged recognized policy literal (not the default).
  // Production quantity adapter/resolver and pricing engine remain adjusted-only until
  // later gated phases. Live DB CHECK still rejects raw until the review-only migration
  // is explicitly applied.
  if (!isStagedPolicyWasteModel(candidate.wasteModel)) {
    return {
      valid: false,
      reason:
        'Unsupported wasteModel. Expected "adjusted_measurement" or staged "raw_plus_waste".',
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
    wasteModel: candidate.wasteModel,
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
