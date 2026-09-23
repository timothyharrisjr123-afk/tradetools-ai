/**
 * Commercial Wedge Group 2 — first-proposal preparation helpers (pure).
 * Structure bootstrap decisions + focused pricing queue over canonical Catalog truth.
 * Contextual company pricing-rules draft for Prepare (canonical policy upsert).
 * Astra G5: direct selling price vs cost-based paths; no invented economics.
 * No React, Supabase, or alternate pricing authority.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { catalogUnitLabel } from "@/app/lib/catalogTypes";
import {
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
} from "@/app/lib/companyPricingPolicy";
import {
  ASTRA_G5_NO_INVENTED_PRICES,
  type AstraG5PricingMethod,
} from "@/app/lib/astraG5Activation";
import { DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY } from "@/app/lib/defaultRoofingProposalTemplates";
import type { PricingPolicy, ProfitabilityType } from "@/app/lib/proposalPricingTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import {
  LOCKED_QUANTITY_ROUNDING,
  LOCKED_WASTE_MODEL,
} from "@/app/tools/settings/pricing/pricingPolicyFormUtils";

export const FIRST_PROPOSAL_PRICING_TITLE = "Price this proposal" as const;
export const FIRST_PROPOSAL_PRICING_HINT =
  `Enter what you charge for these offered-package items. ${ASTRA_G5_NO_INVENTED_PRICES}` as const;
export const FIRST_PROPOSAL_PRICE_THIS_ITEM = "Price this item" as const;
export const FIRST_PROPOSAL_PREPARING = "Preparing proposal…" as const;
export const FIRST_PROPOSAL_STRUCTURE_FAILED =
  "Could not prepare proposal setup. Try again." as const;
export const FIRST_PROPOSAL_PRICE_SAVE_FAILED =
  "Could not save price. Check the amount and try again." as const;
export const FIRST_PROPOSAL_PRICES_REQUIRED =
  "Price every offered item below, or remove it from the package, before creating this proposal." as const;

export const FIRST_PROPOSAL_RULES_TITLE = "How do you usually price?" as const;
export const FIRST_PROPOSAL_RULES_HINT =
  "Ask only what this proposal needs. Nothing is assumed until you save." as const;
export const FIRST_PROPOSAL_RULES_SAVE_FAILED =
  "Could not save pricing. Check the values and try again." as const;
export const FIRST_PROPOSAL_RULES_REQUIRED =
  "Save your pricing before creating this proposal." as const;

/** Direct path: catalog unit prices are the selling prices; policy holds tax only. */
export const FIRST_PROPOSAL_DIRECT_PRICE_HINT =
  "You will enter selling prices on the package items. Margin and markup are not asked." as const;
/** Cost path: margin/markup apply when items are priced from cost. */
export const FIRST_PROPOSAL_COST_BASED_HINT =
  "Enter your target rate for cost-based items. Items with a set unit price still use that price." as const;

export type FirstProposalPricingLine = {
  catalogItemId: string;
  name: string;
  unitLabel: string;
  unitPriceCents: number | null;
  needsPrice: boolean;
};

export type FirstProposalStructureNeed = {
  needsCatalogStructure: boolean;
  needsTemplateStructure: boolean;
  /** True when blank/starter path may install — never when custom preferred template exists. */
  mayBootstrapStarterStructure: boolean;
};

/** Contractor-edited fields for contextual company pricing policy. */
export type FirstProposalPricingRulesDraft = {
  /** Astra G5: direct selling prices vs price-from-cost. */
  pricingMethod: AstraG5PricingMethod;
  profitabilityType: ProfitabilityType;
  /** Target margin or markup % — contractor judgment (cost-based path only). */
  defaultProfitabilityPct: string;
  /** Sales tax % — contractor judgment (0 is explicit). */
  salesTaxRatePct: string;
};

export type FirstProposalPricingRulesBuildResult =
  | { ok: true; policy: PricingPolicy }
  | { ok: false; reason: string };

function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isCatalogItemPriced(item: CatalogItem): boolean {
  return item.unit_price_cents != null && Number.isFinite(item.unit_price_cents);
}

export function findTemplateBySeedKey(
  templates: readonly ProposalTemplate[],
  seedKey: string
): ProposalTemplate | null {
  for (const row of templates) {
    if (extractSeedKey(row.metadata ?? null) === seedKey) return row;
  }
  return null;
}

export function resolveFirstProposalStructureNeed(input: {
  activeCatalogItems: readonly CatalogItem[];
  templates: readonly ProposalTemplate[];
  preferredTemplateId: string | null;
  starterTemplateId: string | null;
}): FirstProposalStructureNeed {
  const needsCatalogStructure = input.activeCatalogItems.length === 0;
  const starter =
    input.starterTemplateId != null
      ? input.templates.find((row) => row.id === input.starterTemplateId) ?? null
      : findTemplateBySeedKey(input.templates, DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY);
  const needsTemplateStructure = starter == null;

  const preferred = (input.preferredTemplateId ?? "").trim();
  const preferredIsCustom =
    preferred.length > 0 &&
    (!starter || preferred !== starter.id) &&
    input.templates.some((row) => row.id === preferred);

  // Custom preferred template → never install starter over contractor intent.
  const mayBootstrapStarterStructure =
    !preferredIsCustom && (needsCatalogStructure || needsTemplateStructure);

  return {
    needsCatalogStructure,
    needsTemplateStructure,
    mayBootstrapStarterStructure,
  };
}

/**
 * Unique catalog items linked on the selected template graph, sorted by name.
 * This is the exact pricing set required for trustworthy package totals.
 */
export function collectLinkedCatalogPricingLines(
  graph: ProposalTemplateGraph | null,
  catalogItems: readonly CatalogItem[]
): FirstProposalPricingLine[] {
  if (!graph) return [];
  const byId = new Map(catalogItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const lines: FirstProposalPricingLine[] = [];

  for (const row of graph.items) {
    const catalogId =
      row.catalog_item_id != null ? String(row.catalog_item_id).trim() : "";
    if (!catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const item = byId.get(catalogId);
    if (!item) continue;
    const priced = isCatalogItemPriced(item);
    lines.push({
      catalogItemId: item.id,
      name: (item.name ?? "").trim() || "Catalog item",
      unitLabel: catalogUnitLabel(item.unit),
      unitPriceCents: priced ? (item.unit_price_cents as number) : null,
      needsPrice: !priced,
    });
  }

  lines.sort((a, b) => a.name.localeCompare(b.name));
  return lines;
}

export function resolveShowFirstProposalPricing(input: {
  preferredTemplateId: string | null;
  starterTemplateId: string | null;
  selectedTemplateId: string | null;
  pricingLines: readonly FirstProposalPricingLine[];
}): boolean {
  const selected = (input.selectedTemplateId ?? "").trim();
  const starter = (input.starterTemplateId ?? "").trim();
  if (!selected || !starter || selected !== starter) return false;

  const preferred = (input.preferredTemplateId ?? "").trim();
  if (preferred && preferred !== starter) return false;

  return input.pricingLines.some((line) => line.needsPrice);
}

export function firstProposalPricingComplete(
  lines: readonly FirstProposalPricingLine[]
): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => !line.needsPrice);
}

export function formatCentsAsDollarInput(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

/** Show contextual pricing-rules ask only when company policy is not configured. */
export function resolveShowFirstProposalPricingRules(
  resolution: CompanyPricingPolicyResolution | null
): boolean {
  if (resolution == null) return false;
  return resolution.configured !== true;
}

/**
 * Empty draft for contextual entry — no prefilled margin/tax assumptions.
 * Structural locks (exact rounding, adjusted measurement) apply only on build/save.
 * Default mental model: direct selling prices (Astra usual contractor path).
 */
export function emptyFirstProposalPricingRulesDraft(): FirstProposalPricingRulesDraft {
  return {
    pricingMethod: "direct_price",
    profitabilityType: "margin",
    defaultProfitabilityPct: "",
    salesTaxRatePct: "",
  };
}

/** Whether margin/markup inputs are required for the chosen pricing method. */
export function firstProposalPricingMethodNeedsRate(
  method: AstraG5PricingMethod
): boolean {
  return method === "cost_based";
}

function parseRequiredPct(raw: string, label: string): { value: number | null; error: string | null } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { value: null, error: `${label} is required.` };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { value: null, error: `${label} must be a valid number.` };
  }
  if (n < 0 || n > 100) {
    return { value: null, error: `${label} must be between 0 and 100.` };
  }
  return { value: n, error: null };
}

/**
 * Build a canonical PricingPolicy from contractor answers + locked structural fields.
 * Direct-price path: sales tax only; profitability stored as 0% margin so catalog
 * unit prices remain the selling authority (not invented sample economics).
 * Cost-based path: requires explicit margin/markup target from the contractor.
 * Does NOT invent catalog prices or sample percentages beyond the stated path.
 */
export function buildFirstProposalPricingPolicyFromDraft(
  draft: FirstProposalPricingRulesDraft
): FirstProposalPricingRulesBuildResult {
  const salesTax = parseRequiredPct(draft.salesTaxRatePct, "Sales tax");
  if (salesTax.error || salesTax.value == null) {
    return { ok: false, reason: salesTax.error ?? "Sales tax is required." };
  }

  let profitabilityType: ProfitabilityType = draft.profitabilityType;
  let defaultPctValue: number;

  if (draft.pricingMethod === "direct_price") {
    // Explicit contractor choice: selling prices live on catalog unit_price_cents.
    // 0% margin is structural policy fill — not a fabricated mark-up on work.
    profitabilityType = "margin";
    defaultPctValue = 0;
  } else {
    const defaultPct = parseRequiredPct(draft.defaultProfitabilityPct, "Target rate");
    if (defaultPct.error || defaultPct.value == null) {
      return { ok: false, reason: defaultPct.error ?? "Target rate is required." };
    }
    defaultPctValue = defaultPct.value;
  }

  const candidate: PricingPolicy = {
    profitabilityType,
    defaultProfitabilityPct: defaultPctValue,
    minimumProfitabilityPct: defaultPctValue,
    quantityRounding: LOCKED_QUANTITY_ROUNDING,
    wasteModel: LOCKED_WASTE_MODEL,
    discount: null,
    tax: {
      salesTaxRatePct: salesTax.value,
      materialPurchaseTaxRatePct: null,
    },
    subtotalOverrideCents: null,
  };

  const validation = validateCompanyPricingPolicy(candidate);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason };
  }
  return { ok: true, policy: validation.policy };
}
