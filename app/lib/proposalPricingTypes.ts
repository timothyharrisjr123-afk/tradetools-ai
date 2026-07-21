/**
 * FieldDive Proposal Pricing — type contract (3I-0).
 *
 * Pure pricing architecture contract for the new proposal spine. Consumes
 * resolved quantities from proposalQuantityResolver.ts (3H-3); does not
 * recompute measurement geometry or apply waste/coverage when wasteModel is
 * "adjusted_measurement".
 *
 * This file is types and pure label helpers only. No pricing math, no DB,
 * no React, no proposal records, no snapshots, no send/PDF/payment/status.
 *
 * Approved policy defaults (3I-0 decision sheet):
 *   wasteModel = "adjusted_measurement"
 *   profitabilityType default = "margin"
 *   cost-plus is the RoofrExact default pricing path; unit_price is override
 *   quantityRounding: "whole" exists in contract only — only "exact" honored
 *     until a later approved rounding phase
 *   discount/tax ordering — open for 3I-1 approval
 *   guardrails — typed only, not enforced
 *
 * Architecture (later stages):
 *   ProposalQuantityPreview (3H-3) → ProposalPricingInput → ResolveProposalPricing (3I-1)
 *   → ProposalPricingResult → snapshot persistence (3J) → PDF/send adapters (3K)
 *
 * Do not import RoofingClient, estimateStore, paymentsTable, or legacy pricing.
 */

import type {
  CatalogItemType,
  CatalogUnit,
  CustomerVisibility,
  PricingBasis,
} from "@/app/lib/catalogTypes";
import type { ProposalTemplateItemRole } from "@/app/lib/proposalTemplateTypes";

// ---------------------------------------------------------------------------
// Approved defaults (policy literals — not computed)
// ---------------------------------------------------------------------------

/** Locked for 3I-0 / 3I-1: quantities already include waste via adjusted_roof_squares. */
export const DEFAULT_WASTE_MODEL: WasteModel = "adjusted_measurement";

/** Matches legacy FieldDive margin formula and Roofr default profitability type. */
export const DEFAULT_PROFITABILITY_TYPE: ProfitabilityType = "margin";

/** Only mode honored until a later approved rounding phase. */
export const DEFAULT_QUANTITY_ROUNDING: QuantityRoundingMode = "exact";

// ---------------------------------------------------------------------------
// Enums / unions — policy
// ---------------------------------------------------------------------------

/** Roofr: company-level profitability type. Formulas deferred to 3I-1. */
export type ProfitabilityType = "margin" | "markup";

/**
 * Roofr "adjustable quantities" toggle.
 * "whole" is contract-only until a later approved rounding phase — not implemented in 3I-0 or 3I-1.
 */
export type QuantityRoundingMode = "exact" | "whole";

/**
 * Prevents double-counting waste when quantity layer already applies adjustment.
 *
 * - "adjusted_measurement": 3H-3 path (adjusted_roof_squares). Pricing engine MUST NOT
 *   re-apply item/proposal waste or coverage_rate.
 * - "raw_plus_waste": Roofr-exact migration target — owned by quantity layer, not 3I-0/3I-1.
 */
export type WasteModel = "adjusted_measurement" | "raw_plus_waste";

export type DiscountKind = "percent" | "fixed";

/** Actor requesting or viewing pricing — guardrail role policy is typed only in 3I-0. */
export type PricingActorRole = "rep" | "manager";

/**
 * Discount configuration shape. Manual subtotal override is a separate deferred field on PricingPolicy.
 * Discount vs tax ordering is open for 3I-1 approval.
 */
export type PricingDiscountPolicy = {
  kind: DiscountKind;
  /** percent: 0–100; fixed: integer cents. Interpretation per kind. */
  value: number;
  customerLabel?: string | null;
};

/**
 * Two-tax model (types only in 3I-0).
 * - salesTaxRatePct: customer-facing tax added to price.
 * - materialPurchaseTaxRatePct: internal-only; folds into effective cost (materials only).
 * Ordering vs discount is open for 3I-1.
 */
export type SalesTaxPolicy = {
  salesTaxRatePct: number;
  materialPurchaseTaxRatePct?: number | null;
};

/**
 * Top-level pricing policy for a proposal or template option.
 * Pure configuration — no math in this module.
 */
export type PricingPolicy = {
  profitabilityType: ProfitabilityType;
  /** Default applied when building (0–100). */
  defaultProfitabilityPct: number;
  /** Floor; below minimum triggers guardrail (0–100). Should be <= defaultProfitabilityPct. */
  minimumProfitabilityPct: number;

  quantityRounding: QuantityRoundingMode;
  wasteModel: WasteModel;

  discount?: PricingDiscountPolicy | null;
  tax: SalesTaxPolicy;

  /** DEFERRED: Roofr "Manually Adjust Subtotal" — shape only, no logic in 3I-0/3I-1. */
  subtotalOverrideCents?: number | null;
};

// ---------------------------------------------------------------------------
// Engine input — consumes 3H-3 quantity output, does not recompute geometry
// ---------------------------------------------------------------------------

/** Per-line tax context. Catalog tax fields deferred — carried here for 3I-0 contract. */
export type PricingTaxInput = {
  salesTaxRatePct?: number | null;
  materialPurchaseTaxRatePct?: number | null;
};

/**
 * Upgrades scoped to a parent option (Roofr: upgrade associated with option, not global).
 * Selection and effect are first-class; absence of selection means do not contribute.
 */
export type UpgradeScopeRef = {
  parentOptionId: string;
  isSelectedByDefault?: boolean;
  selectionState?: "selected" | "not_selected" | "legacy_unknown" | null;
  effect?: "additive" | "replacement" | null;
  replacesTemplateItemId?: string | null;
};

/** Visibility for pricing display — extends catalog CustomerVisibility with calc-but-hidden flag. */
export type PricingLineVisibility = {
  visibility: CustomerVisibility;
  /** Roofr per-line eye icon: used in calculation, hidden from customer document. */
  hiddenButInCalc: boolean;
};

/**
 * One line to be priced. Quantity comes from 3H-3 — engine never recomputes geometry.
 */
export type PricingLineInput = {
  templateItemId: string;
  catalogItemId: string | null;
  itemRole: ProposalTemplateItemRole;
  /** Optional — mapper should supply from CatalogItem.item_type for labor cost + material purchase tax. */
  itemType?: CatalogItemType | null;
  /** Optional — mapper should supply from ProposalTemplateItem.section_id for section rollups. */
  sectionId?: string | null;
  unit: CatalogUnit;
  pricingBasis: PricingBasis;
  customerVisibility: CustomerVisibility;

  /** From 3H-3 resolved quantity. */
  quantity: number | null;
  quantityUnresolved: boolean;

  /** Raw catalog economics (integer cents). Effective cost derived in 3I-1. */
  unitCostCents?: number | null;
  unitPriceCents?: number | null;
  laborUnitCostCents?: number | null;

  tax?: PricingTaxInput | null;
  upgradeScope?: UpgradeScopeRef | null;
  hiddenButInCalc?: boolean;
  /** True when a selected replacement upgrade suppresses this base line's contribution. */
  suppressedByReplacement?: boolean;
};

/** Full pricing request for one template option. */
export type ProposalPricingInput = {
  policy: PricingPolicy;
  actorRole: PricingActorRole;
  optionId: string;
  lines: PricingLineInput[];
};

// ---------------------------------------------------------------------------
// Engine output — pure derived shapes (camelCase ...Cents; 3J maps to snake_case)
// ---------------------------------------------------------------------------

export type LinePricingStatus =
  | "priced"
  | "included"
  | "unpriced"
  | "unresolved_quantity"
  | "hidden"
  | "unsupported";

export type ProposalLinePricing = {
  templateItemId: string;
  status: LinePricingStatus;
  unresolved: boolean;

  quantity: number | null;
  unit: CatalogUnit;
  pricingBasis: PricingBasis;
  customerVisibility: CustomerVisibility;

  /** Internal-only cost side. */
  unitCostCents: number | null;
  effectiveUnitCostCents: number | null;
  lineCostCents: number | null;

  /** Customer-facing price side where visible. */
  unitPriceCents: number | null;
  linePriceCents: number | null;

  /** Internal-only profitability. */
  profitCents: number | null;
  marginPct: number | null;
  markupPct: number | null;

  taxable: boolean;
  salesTaxCents: number | null;

  statusLabel: string;
  notes?: string | null;
};

export type ProposalSectionPricing = {
  sectionId: string;
  customerSubtotalCents: number | null;
  internalCostCents: number | null;
  lineCount: number;
  unresolvedLineCount: number;
};

export type GuardrailOutcome = "pass" | "warn" | "block";

/**
 * Profitability guardrail result. Rep below minimum → block; manager → warn (override deferred).
 * 3I-0 types only — no UI or send enforcement.
 */
export type ProfitabilityGuardrailResult = {
  outcome: GuardrailOutcome;
  actorRole: PricingActorRole;
  profitabilityType: ProfitabilityType;
  actualPct: number | null;
  minimumPct: number;
  defaultPct: number;
  message: string;
};

export type ProposalOptionPricing = {
  optionId: string;
  sections: ProposalSectionPricing[];

  customerSubtotalCents: number | null;
  discountCents: number | null;
  salesTaxCents: number | null;
  customerTotalCents: number | null;

  internalCostCents: number | null;
  internalProfitCents: number | null;
  effectiveMarginPct: number | null;

  upgradeLineIds: string[];
  guardrail: ProfitabilityGuardrailResult;
  hasBlockingIssues: boolean;
};

/** Proposal-level totals for selected option. Deposit/financing deferred to 3K. */
export type ProposalPricingTotals = {
  selectedOptionId: string | null;
  customerTotalCents: number | null;
  depositCents: number | null;
  financingAvailable: boolean;
};

export type ProposalPricingResult = {
  options: ProposalOptionPricing[];
  totals: ProposalPricingTotals;
  policyEcho: PricingPolicy;
  generatedFrom: {
    measurementResolved: boolean;
    allLinesPriced: boolean;
  };
};

// ---------------------------------------------------------------------------
// Snapshot intent — documents freeze boundary for 3J; no persistence in 3I-0
// ---------------------------------------------------------------------------

export type SnapshotFreezeStage = "draft_live" | "freeze_on_send" | "lock_on_sign";

export type PricingSnapshotFieldClass =
  | "quantity"
  | "unit_cost"
  | "unit_price"
  | "line_totals"
  | "policy"
  | "tax"
  | "discount"
  | "option_selection"
  | "customer_copy";

/**
 * Declares when each field class freezes. Documentation-as-types for 3J snapshot design.
 */
export type PricingSnapshotIntent = {
  fieldClass: PricingSnapshotFieldClass;
  freezeStage: SnapshotFreezeStage;
  liveOnlyInDraft: boolean;
};

/** Canonical snapshot freeze intent — consumed by 3J persistence design. */
export const PRICING_SNAPSHOT_INTENTS: readonly PricingSnapshotIntent[] = [
  { fieldClass: "quantity", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "unit_cost", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "unit_price", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "line_totals", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "policy", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "tax", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "discount", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "option_selection", freezeStage: "lock_on_sign", liveOnlyInDraft: true },
  { fieldClass: "customer_copy", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
] as const;

// ---------------------------------------------------------------------------
// Engine signatures — declared only; implementation is 3I-1
// ---------------------------------------------------------------------------

/** Pure function signature only. No implementation in 3I-0. */
export type ResolveProposalPricing = (
  input: ProposalPricingInput
) => ProposalPricingResult;

/** Pure function signature only. No implementation in 3I-0. */
export type EvaluateProfitabilityGuardrail = (
  policy: PricingPolicy,
  actorRole: PricingActorRole,
  actualPct: number | null
) => ProfitabilityGuardrailResult;

// ---------------------------------------------------------------------------
// Const arrays (for forms / validation later)
// ---------------------------------------------------------------------------

export const PROFITABILITY_TYPES: readonly ProfitabilityType[] = ["margin", "markup"] as const;

export const QUANTITY_ROUNDING_MODES: readonly QuantityRoundingMode[] = [
  "exact",
  "whole",
] as const;

export const WASTE_MODELS: readonly WasteModel[] = [
  "adjusted_measurement",
  "raw_plus_waste",
] as const;

export const DISCOUNT_KINDS: readonly DiscountKind[] = ["percent", "fixed"] as const;

export const PRICING_ACTOR_ROLES: readonly PricingActorRole[] = ["rep", "manager"] as const;

export const LINE_PRICING_STATUSES: readonly LinePricingStatus[] = [
  "priced",
  "included",
  "unpriced",
  "unresolved_quantity",
  "hidden",
  "unsupported",
] as const;

export const GUARDRAIL_OUTCOMES: readonly GuardrailOutcome[] = [
  "pass",
  "warn",
  "block",
] as const;

export const SNAPSHOT_FREEZE_STAGES: readonly SnapshotFreezeStage[] = [
  "draft_live",
  "freeze_on_send",
  "lock_on_sign",
] as const;

// ---------------------------------------------------------------------------
// Label helpers (pure)
// ---------------------------------------------------------------------------

const PROFITABILITY_TYPE_LABELS: Record<ProfitabilityType, string> = {
  margin: "Margin",
  markup: "Markup",
};

const QUANTITY_ROUNDING_MODE_LABELS: Record<QuantityRoundingMode, string> = {
  exact: "Exact",
  whole: "Whole",
};

const WASTE_MODEL_LABELS: Record<WasteModel, string> = {
  adjusted_measurement: "Adjusted measurement",
  raw_plus_waste: "Raw plus waste",
};

const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  percent: "Percent",
  fixed: "Fixed amount",
};

const PRICING_ACTOR_ROLE_LABELS: Record<PricingActorRole, string> = {
  rep: "Rep",
  manager: "Manager",
};

const LINE_PRICING_STATUS_LABELS: Record<LinePricingStatus, string> = {
  priced: "Priced",
  included: "Included",
  unpriced: "Unpriced",
  unresolved_quantity: "Unresolved quantity",
  hidden: "Hidden",
  unsupported: "Unsupported",
};

const GUARDRAIL_OUTCOME_LABELS: Record<GuardrailOutcome, string> = {
  pass: "Pass",
  warn: "Warning",
  block: "Blocked",
};

const SNAPSHOT_FREEZE_STAGE_LABELS: Record<SnapshotFreezeStage, string> = {
  draft_live: "Draft (live)",
  freeze_on_send: "Freeze on send",
  lock_on_sign: "Lock on sign",
};

const PRICING_SNAPSHOT_FIELD_CLASS_LABELS: Record<PricingSnapshotFieldClass, string> = {
  quantity: "Quantity",
  unit_cost: "Unit cost",
  unit_price: "Unit price",
  line_totals: "Line totals",
  policy: "Pricing policy",
  tax: "Tax",
  discount: "Discount",
  option_selection: "Option selection",
  customer_copy: "Customer copy",
};

export function profitabilityTypeLabel(value: ProfitabilityType): string {
  return PROFITABILITY_TYPE_LABELS[value];
}

export function quantityRoundingModeLabel(value: QuantityRoundingMode): string {
  return QUANTITY_ROUNDING_MODE_LABELS[value];
}

export function wasteModelLabel(value: WasteModel): string {
  return WASTE_MODEL_LABELS[value];
}

export function discountKindLabel(value: DiscountKind): string {
  return DISCOUNT_KIND_LABELS[value];
}

export function pricingActorRoleLabel(value: PricingActorRole): string {
  return PRICING_ACTOR_ROLE_LABELS[value];
}

export function linePricingStatusLabel(value: LinePricingStatus): string {
  return LINE_PRICING_STATUS_LABELS[value];
}

export function guardrailOutcomeLabel(value: GuardrailOutcome): string {
  return GUARDRAIL_OUTCOME_LABELS[value];
}

export function snapshotFreezeStageLabel(value: SnapshotFreezeStage): string {
  return SNAPSHOT_FREEZE_STAGE_LABELS[value];
}

export function pricingSnapshotFieldClassLabel(value: PricingSnapshotFieldClass): string {
  return PRICING_SNAPSHOT_FIELD_CLASS_LABELS[value];
}
