/**
 * 3I-1B — Programmatic tests for proposalPricingInputMapper.ts (pure, no DB/UI).
 *
 * Run: npx tsx --test app/lib/proposalPricingInputMapper.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import {
  mapProposalPricingInput,
  mapTemplateItemToPricingLineInput,
} from "./proposalPricingInputMapper";
import { resolveProposalPricing } from "./proposalPricingEngine";
import type { PricingPolicy } from "./proposalPricingTypes";
import { DEFAULT_WASTE_MODEL } from "./proposalPricingTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const OPTION_ID = "opt-1";
const SECTION_ID = "sec-1";

function basePolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 50,
    minimumProfitabilityPct: 20,
    quantityRounding: "exact",
    wasteModel: DEFAULT_WASTE_MODEL,
    tax: {
      salesTaxRatePct: 8.25,
      materialPurchaseTaxRatePct: 6,
    },
    ...overrides,
  };
}

function catalog(overrides: Partial<CatalogItem> & Pick<CatalogItem, "id">): CatalogItem {
  return {
    company_id: COMPANY_ID,
    name: overrides.name ?? overrides.id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    ...overrides,
  };
}

function templateItem(overrides: Partial<ProposalTemplateItem> & Pick<ProposalTemplateItem, "id">): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: "cat-default",
    item_role: "standard",
    ...overrides,
  };
}

function graphForItems(items: ProposalTemplateItem[]): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Test template",
      status: "active",
      active: true,
    },
    options: [
      {
        id: OPTION_ID,
        template_id: TEMPLATE_ID,
        name: "Good",
        selection_mode: "single",
        is_default: true,
        visible_to_customer: true,
      },
    ],
    sections: [
      {
        id: SECTION_ID,
        template_id: TEMPLATE_ID,
        option_id: OPTION_ID,
        kind: "line_items",
        name: "Materials",
      },
    ],
    items,
  };
}

function readyHandoff(): MeasurementProposalHandoff {
  return {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Job #1",
    quantities: {
      roof_squares: 20,
      adjusted_roof_squares: 22,
      roof_area_sqft: 2200,
      waste_percent: 10,
      eaves_lf: null,
      rakes_lf: null,
      ridges_lf: null,
      hips_lf: null,
      valleys_lf: null,
      wall_flashing_lf: null,
      step_flashing_lf: null,
      transitions_lf: null,
      parapet_wall_lf: null,
      drip_edge_lf: null,
      starter_lf: null,
      ridge_cap_lf: null,
      pipe_boots_count: null,
      vents_count: null,
      skylights_count: null,
      chimneys_count: null,
      satellite_dishes_count: null,
    },
    estimateReady: true,
    productionReady: false,
  };
}

function quantityContext(
  overrides: Partial<ProposalQuantityPreviewContext> = {}
): ProposalQuantityPreviewContext {
  const quantityMap: MeasurementQuantityMap = {
    shingles_squares: 22,
  };
  return {
    measurementHandoff: readyHandoff(),
    quantityMap,
    ...overrides,
  };
}

function mapOne(
  item: ProposalTemplateItem,
  catalogItem: CatalogItem | null,
  ctx: ProposalQuantityPreviewContext | null = quantityContext()
) {
  return mapTemplateItemToPricingLineInput(item, catalogItem, ctx, OPTION_ID);
}

describe("proposalPricingInputMapper", () => {
  test("material cost_plus_margin line maps catalog economics and quantity", () => {
    const cat = catalog({
      id: "mat-1",
      item_type: "material",
      pricing_basis: "cost_plus_margin",
      unit_cost_cents: 12_000,
    });
    const item = templateItem({
      id: "line-mat",
      catalog_item_id: "mat-1",
      quantity_rule: { mode: "inherit_catalog" },
    });

    const line = mapOne(item, cat);
    assert.equal(line.itemType, "material");
    assert.equal(line.pricingBasis, "cost_plus_margin");
    assert.equal(line.unitCostCents, 12_000);
    assert.equal(line.quantity, 22);
    assert.equal(line.quantityUnresolved, false);
    assert.equal(line.sectionId, SECTION_ID);
    assert.equal(line.tax, null);
  });

  test("labor line uses laborUnitCostCents from catalog", () => {
    const cat = catalog({
      id: "labor-1",
      item_type: "labor",
      unit: "square",
      pricing_basis: "cost_plus_margin",
      unit_cost_cents: 5_000,
      labor_unit_cost_cents: 8_000,
    });
    const item = templateItem({
      id: "line-labor",
      catalog_item_id: "labor-1",
    });

    const line = mapOne(item, cat);
    assert.equal(line.itemType, "labor");
    assert.equal(line.laborUnitCostCents, 8_000);
    assert.equal(line.unitCostCents, 5_000);
  });

  test("unit_price override line passes catalog unit price", () => {
    const cat = catalog({
      id: "override-1",
      pricing_basis: "unit_price",
      unit_cost_cents: 10_000,
      unit_price_cents: 18_500,
    });
    const item = templateItem({ id: "line-up", catalog_item_id: "override-1" });

    const line = mapOne(item, cat);
    assert.equal(line.pricingBasis, "unit_price");
    assert.equal(line.unitPriceCents, 18_500);
  });

  test("fixed price line maps fixed basis and unit", () => {
    const cat = catalog({
      id: "fixed-1",
      unit: "fixed",
      pricing_basis: "fixed_price",
      unit_price_cents: 75_000,
      quantity_source: "fixed",
      default_quantity: 1,
    });
    const item = templateItem({
      id: "line-fixed",
      catalog_item_id: "fixed-1",
      quantity_rule: { mode: "fixed", fixed_quantity: 1 },
    });

    const line = mapOne(item, cat);
    assert.equal(line.pricingBasis, "fixed_price");
    assert.equal(line.unit, "fixed");
    assert.equal(line.unitPriceCents, 75_000);
    assert.equal(line.quantity, 1);
  });

  test("included line maps included pricing basis", () => {
    const cat = catalog({
      id: "inc-1",
      pricing_basis: "included",
      unit_price_cents: null,
      unit_cost_cents: 2_000,
    });
    const item = templateItem({
      id: "line-inc",
      catalog_item_id: "inc-1",
      item_role: "included",
    });

    const line = mapOne(item, cat);
    assert.equal(line.pricingBasis, "included");
    assert.equal(line.itemRole, "included");
  });

  test("internal_only visibility resolves from catalog", () => {
    const cat = catalog({
      id: "int-1",
      customer_visibility: "internal_only",
    });
    const item = templateItem({ id: "line-int", catalog_item_id: "int-1" });

    const line = mapOne(item, cat);
    assert.equal(line.customerVisibility, "internal_only");
  });

  test("missing catalog item blocks quantity and omits fake economics", () => {
    const item = templateItem({
      id: "line-missing",
      catalog_item_id: "gone-1",
    });

    const line = mapOne(item, null);
    assert.equal(line.catalogItemId, "gone-1");
    assert.equal(line.itemType, null);
    assert.equal(line.quantity, null);
    assert.equal(line.quantityUnresolved, true);
    assert.equal(line.unitCostCents, null);
    assert.equal(line.unitPriceCents, null);
    assert.equal(line.laborUnitCostCents, null);
    assert.equal(line.tax, null);
  });

  test("unresolved quantity line preserves 3H-3 unresolved flag", () => {
    const cat = catalog({ id: "qty-1", quantity_source: "adjusted_roof_squares" });
    const item = templateItem({
      id: "line-unresolved",
      catalog_item_id: "qty-1",
      quantity_rule: { mode: "measurement" },
    });

    const line = mapOne(item, cat, { measurementHandoff: null, quantityMap: null });
    assert.equal(line.quantity, null);
    assert.equal(line.quantityUnresolved, true);
  });

  test("itemType populated for material vs labor when catalog exists", () => {
    const material = mapOne(
      templateItem({ id: "m", catalog_item_id: "mat" }),
      catalog({ id: "mat", item_type: "material" })
    );
    const labor = mapOne(
      templateItem({ id: "l", catalog_item_id: "lab" }),
      catalog({ id: "lab", item_type: "labor" })
    );
    assert.equal(material.itemType, "material");
    assert.equal(labor.itemType, "labor");
  });

  test("mapper does not invent line tax", () => {
    const cat = catalog({ id: "tax-none", unit_cost_cents: 1_000 });
    const item = templateItem({ id: "line-tax", catalog_item_id: "tax-none" });
    const input = mapProposalPricingInput({
      optionId: OPTION_ID,
      policy: basePolicy(),
      actorRole: "rep",
      graph: graphForItems([item]),
      catalogItems: [cat],
      quantityContext: quantityContext(),
    });
    for (const line of input.lines) {
      assert.equal(line.tax, null);
    }
  });

  test("mapper does not calculate totals — output is input shape only", () => {
    const cat = catalog({ id: "tot-1", unit_cost_cents: 9_000 });
    const item = templateItem({ id: "line-tot", catalog_item_id: "tot-1" });
    const input = mapProposalPricingInput({
      optionId: OPTION_ID,
      policy: basePolicy(),
      actorRole: "rep",
      graph: graphForItems([item]),
      catalogItems: [cat],
      quantityContext: quantityContext(),
    });
    assert.ok("lines" in input);
    assert.ok(!("customerSubtotalCents" in input));
    assert.ok(!("options" in input));
  });

  test("inherit_catalog visibility falls back to catalog row", () => {
    const cat = catalog({ id: "vis-1", customer_visibility: "grouped" });
    const item = templateItem({
      id: "line-vis",
      catalog_item_id: "vis-1",
      customer_visibility: "inherit_catalog",
    });
    const line = mapOne(item, cat);
    assert.equal(line.customerVisibility, "grouped");
  });

  test("upgrade scope set only for upgrade role on parent option", () => {
    const cat = catalog({ id: "up-1" });
    const upgrade = templateItem({
      id: "line-upg",
      catalog_item_id: "up-1",
      item_role: "upgrade",
    });
    const standard = templateItem({
      id: "line-std",
      catalog_item_id: "up-1",
      item_role: "standard",
    });

    assert.deepEqual(mapOne(upgrade, cat).upgradeScope, {
      parentOptionId: OPTION_ID,
      isSelectedByDefault: false,
      selectionState: "not_selected",
      effect: "additive",
      replacesTemplateItemId: null,
    });
    assert.equal(mapOne(standard, cat).upgradeScope, null);
  });

  test("hiddenButInCalc only when template metadata explicitly sets flag", () => {
    const cat = catalog({ id: "hid-1" });
    const withFlag = templateItem({
      id: "line-hid-y",
      catalog_item_id: "hid-1",
      metadata: { hidden_but_in_calc: true },
    });
    const withoutFlag = templateItem({
      id: "line-hid-n",
      catalog_item_id: "hid-1",
    });
    assert.equal(mapOne(withFlag, cat).hiddenButInCalc, true);
    assert.equal(mapOne(withoutFlag, cat).hiddenButInCalc, undefined);
  });

  test("mapped input is compatible with resolveProposalPricing", () => {
    const cat = catalog({
      id: "eng-1",
      item_type: "material",
      unit_cost_cents: 10_000,
    });
    const item = templateItem({ id: "line-eng", catalog_item_id: "eng-1" });
    const input = mapProposalPricingInput({
      optionId: OPTION_ID,
      policy: basePolicy({ tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null } }),
      actorRole: "rep",
      graph: graphForItems([item]),
      catalogItems: [cat],
      quantityContext: quantityContext(),
    });

    const result = resolveProposalPricing(input);
    assert.equal(result.options[0]?.hasBlockingIssues, false);
    assert.equal(result.generatedFrom.allLinesPriced, true);
    assert.ok((result.options[0]?.customerSubtotalCents ?? 0) > 0);
  });

  test("mapped missing catalog blocks engine totals", () => {
    const item = templateItem({ id: "line-block", catalog_item_id: "missing" });
    const input = mapProposalPricingInput({
      optionId: OPTION_ID,
      policy: basePolicy(),
      actorRole: "rep",
      graph: graphForItems([item]),
      catalogItems: [],
      quantityContext: quantityContext(),
    });

    const result = resolveProposalPricing(input);
    assert.equal(result.options[0]?.hasBlockingIssues, true);
    assert.equal(result.options[0]?.customerSubtotalCents, null);
  });
});
