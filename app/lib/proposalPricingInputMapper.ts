/**
 * FieldDive Proposal Pricing Input Mapper (3I-1B / raw_plus_waste Phase 5).
 *
 * Pure mapping from template graph + catalog + quantity adapter → ProposalPricingInput.
 * No pricing math, no DB, React, stores, or legacy estimator imports.
 *
 * Quantity comes from resolveProposalLineQuantityViaAdapter (adjusted default;
 * raw_plus_waste only when policy.wasteModel selects it). Engine receives
 * already-resolved quantities and does not apply coverage/waste.
 * Economics come exclusively from CatalogItem fields — no invented costs, prices, or tax.
 */

import type { CatalogItem, CustomerVisibility } from "@/app/lib/catalogTypes";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import {
  buildCatalogItemById,
  getItemsForSection,
  getSectionsForOption,
  isLineItemsSectionKind,
} from "@/app/lib/proposalBuilderPreview";
import { resolveProposalLineQuantityViaAdapter } from "@/app/lib/proposalQuantityResolutionAdapter";
import type {
  PricingActorRole,
  PricingLineInput,
  PricingPolicy,
  ProposalPricingInput,
  UpgradeScopeRef,
} from "@/app/lib/proposalPricingTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateItemCustomerVisibility,
} from "@/app/lib/proposalTemplateTypes";
import {
  applyUpgradeTruthToPricingLines,
  buildUpgradeScopeRef,
  type UpgradeChoiceByTemplateItemId,
} from "@/app/lib/proposalUpgradeTruth";

/** Missing-catalog structural placeholder — not a pricing default. Engine blocks without catalog economics. */
const MISSING_CATALOG_UNIT: PricingLineInput["unit"] = "fixed";

export type MapProposalPricingInputParams = {
  optionId: string;
  policy: PricingPolicy;
  actorRole: PricingActorRole;
  graph: ProposalTemplateGraph;
  catalogItems: CatalogItem[] | Map<string, CatalogItem>;
  quantityContext: ProposalQuantityPreviewContext | null;
  /** Optional job-draft upgrade selections keyed by template item id. */
  upgradeChoicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null;
};

function resolveCatalogMap(catalogItems: CatalogItem[] | Map<string, CatalogItem>): Map<string, CatalogItem> {
  if (catalogItems instanceof Map) {
    return catalogItems;
  }
  return buildCatalogItemById(catalogItems);
}

function resolveCustomerVisibility(
  templateItem: ProposalTemplateItem,
  catalog: CatalogItem | null | undefined
): CustomerVisibility {
  const visibility: ProposalTemplateItemCustomerVisibility =
    templateItem.customer_visibility ?? "inherit_catalog";
  if (visibility === "inherit_catalog") {
    return catalog?.customer_visibility ?? "customer_visible";
  }
  return visibility;
}

/**
 * hiddenButInCalc is not on CatalogItem or ProposalTemplateItem today.
 * Only set when template metadata explicitly carries hidden_but_in_calc: true.
 */
function resolveHiddenButInCalc(templateItem: ProposalTemplateItem): boolean | undefined {
  const meta = templateItem.metadata;
  if (meta && typeof meta.hidden_but_in_calc === "boolean") {
    return meta.hidden_but_in_calc;
  }
  return undefined;
}

function resolveUpgradeScope(
  templateItem: ProposalTemplateItem,
  optionId: string,
  choicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null
): UpgradeScopeRef | null {
  const choice = choicesByTemplateItemId?.get(templateItem.id);
  return buildUpgradeScopeRef({
    templateItem,
    optionId,
    selectionState: choice?.selectionState ?? null,
  });
}

function mapMissingCatalogLine(
  templateItem: ProposalTemplateItem,
  optionId: string,
  choicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null
): PricingLineInput {
  const catalogId = (templateItem.catalog_item_id ?? "").trim() || null;
  return {
    templateItemId: templateItem.id,
    catalogItemId: catalogId,
    sectionId: templateItem.section_id,
    itemRole: templateItem.item_role,
    itemType: null,
    unit: MISSING_CATALOG_UNIT,
    pricingBasis: "cost_plus_margin",
    customerVisibility: resolveCustomerVisibility(templateItem, null),
    quantity: null,
    quantityUnresolved: true,
    unitCostCents: null,
    unitPriceCents: null,
    laborUnitCostCents: null,
    tax: null,
    upgradeScope: resolveUpgradeScope(templateItem, optionId, choicesByTemplateItemId),
    hiddenButInCalc: resolveHiddenButInCalc(templateItem),
  };
}

/**
 * Map one template line + catalog + quantity adapter preview to PricingLineInput.
 */
export function mapTemplateItemToPricingLineInput(
  templateItem: ProposalTemplateItem,
  catalog: CatalogItem | null | undefined,
  quantityContext: ProposalQuantityPreviewContext | null,
  optionId: string,
  wasteModel?: PricingPolicy["wasteModel"] | null,
  choicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null
): PricingLineInput {
  const catalogId = (templateItem.catalog_item_id ?? "").trim();
  const hasCatalogId = Boolean(catalogId);

  if (hasCatalogId && !catalog) {
    return mapMissingCatalogLine(templateItem, optionId, choicesByTemplateItemId);
  }

  if (!catalog) {
    return mapMissingCatalogLine(templateItem, optionId, choicesByTemplateItemId);
  }

  const quantityPreview = resolveProposalLineQuantityViaAdapter(
    {
      measurementHandoff: quantityContext?.measurementHandoff ?? null,
      quantityMap: quantityContext?.quantityMap ?? null,
      catalogItem: catalog,
      templateItem,
    },
    { wasteModel: wasteModel ?? "adjusted_measurement" }
  ).preview;

  return {
    templateItemId: templateItem.id,
    catalogItemId: catalog.id,
    sectionId: templateItem.section_id,
    itemRole: templateItem.item_role,
    itemType: catalog.item_type,
    unit: catalog.unit,
    pricingBasis: catalog.pricing_basis,
    customerVisibility: resolveCustomerVisibility(templateItem, catalog),
    quantity: quantityPreview.quantity,
    quantityUnresolved: quantityPreview.unresolved,
    unitCostCents: catalog.unit_cost_cents ?? null,
    unitPriceCents: catalog.unit_price_cents ?? null,
    laborUnitCostCents: catalog.labor_unit_cost_cents ?? null,
    tax: null,
    upgradeScope: resolveUpgradeScope(templateItem, optionId, choicesByTemplateItemId),
    hiddenButInCalc: resolveHiddenButInCalc(templateItem),
  };
}

/**
 * Collect priced line-item rows for one template option (line_items + upgrade_group sections only).
 */
export function mapPricingLineInputsForOption(
  graph: ProposalTemplateGraph,
  optionId: string,
  catalogById: Map<string, CatalogItem>,
  quantityContext: ProposalQuantityPreviewContext | null,
  wasteModel?: PricingPolicy["wasteModel"] | null,
  choicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null
): PricingLineInput[] {
  const sections = getSectionsForOption(graph, optionId).filter((section) =>
    isLineItemsSectionKind(section.kind)
  );

  const lines: PricingLineInput[] = [];
  for (const section of sections) {
    for (const templateItem of getItemsForSection(graph, section.id)) {
      const catalogId = (templateItem.catalog_item_id ?? "").trim();
      const catalog = catalogId ? catalogById.get(catalogId) : undefined;
      lines.push(
        mapTemplateItemToPricingLineInput(
          templateItem,
          catalog,
          quantityContext,
          optionId,
          wasteModel,
          choicesByTemplateItemId
        )
      );
    }
  }

  return applyUpgradeTruthToPricingLines({
    optionId,
    lines,
    graph,
    choicesByTemplateItemId,
  }).lines;
}

/**
 * Build ProposalPricingInput for one template option — ready for resolveProposalPricing.
 */
export function mapProposalPricingInput(params: MapProposalPricingInputParams): ProposalPricingInput {
  const catalogById = resolveCatalogMap(params.catalogItems);
  const lines = mapPricingLineInputsForOption(
    params.graph,
    params.optionId,
    catalogById,
    params.quantityContext,
    params.policy.wasteModel,
    params.upgradeChoicesByTemplateItemId
  );

  return {
    policy: params.policy,
    actorRole: params.actorRole,
    optionId: params.optionId,
    lines,
  };
}
