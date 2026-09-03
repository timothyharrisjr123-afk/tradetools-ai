/**
 * Commercial Wedge Group 2 — first-proposal preparation helpers (pure).
 * Structure bootstrap decisions + focused pricing queue over canonical Catalog truth.
 * Contextual company pricing-rules draft for Prepare (canonical policy upsert).
 * No React, Supabase, or alternate pricing authority.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { catalogUnitLabel } from "@/app/lib/catalogTypes";
import {
  validateCompanyPricingPolicy,
  type CompanyPricingPolicyResolution,
} from "@/app/lib/companyPricingPolicy";
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
  "Enter what you charge for these items. FieldDive does not invent prices." as const;
export const FIRST_PROPOSAL_PRICE_THIS_ITEM = "Price this item" as const;
export const FIRST_PROPOSAL_PREPARING = "Preparing proposal…" as const;
export const FIRST_PROPOSAL_STRUCTURE_FAILED =
  "Could not prepare proposal setup. Try again." as const;
export const FIRST_PROPOSAL_PRICE_SAVE_FAILED =
  "Could not save price. Check the amount and try again." as const;
export const FIRST_PROPOSAL_PRICES_REQUIRED =
  "Price every item below before creating this proposal." as const;

export const FIRST_PROPOSAL_RULES_TITLE = "Set your pricing" as const;
export const FIRST_PROPOSAL_RULES_HINT =
  "Tell FieldDive how you price work and what sales tax to use. Nothing is assumed until you save." as const;
export const FIRST_PROPOSAL_RULES_SAVE_FAILED =
  "Could not save pricing. Check the values and try again." as const;
export const FIRST_PROPOSAL_RULES_REQUIRED =
  "Save your pricing before creating this proposal." as const;

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
  profitabilityType: ProfitabilityType;
  /** Target margin or markup % — contractor judgment. */
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
 */
export function emptyFirstProposalPricingRulesDraft(): FirstProposalPricingRulesDraft {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: "",
    salesTaxRatePct: "",
  };
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
 * Minimum profitability matches the contractor's stated target (refine later in Settings).
 * Does NOT invent percentages — empty/invalid inputs fail closed.
 */
export function buildFirstProposalPricingPolicyFromDraft(
  draft: FirstProposalPricingRulesDraft
): FirstProposalPricingRulesBuildResult {
  const defaultPct = parseRequiredPct(draft.defaultProfitabilityPct, "Target rate");
  if (defaultPct.error || defaultPct.value == null) {
    return { ok: false, reason: defaultPct.error ?? "Target rate is required." };
  }

  const salesTax = parseRequiredPct(draft.salesTaxRatePct, "Sales tax");
  if (salesTax.error || salesTax.value == null) {
    return { ok: false, reason: salesTax.error ?? "Sales tax is required." };
  }

  const candidate: PricingPolicy = {
    profitabilityType: draft.profitabilityType,
    defaultProfitabilityPct: defaultPct.value,
    minimumProfitabilityPct: defaultPct.value,
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
