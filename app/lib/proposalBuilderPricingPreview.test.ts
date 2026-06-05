/**
 * 3I-2A — Programmatic tests for proposalBuilderPricingPreview.ts (pure, no DB/UI).
 *
 * Run: npx tsx --test app/lib/proposalBuilderPricingPreview.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import {
  BUILDER_PREVIEW_ACTOR_ROLE,
  BUILDER_PREVIEW_PRICING_POLICY,
  buildProposalBuilderPricingPreview,
  type ProposalBuilderLineCustomerView,
  type ProposalBuilderOptionCustomerView,
} from "./proposalBuilderPricingPreview";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";

const INTERNAL_DOLLAR_KEYS = [
  "profitCents",
  "marginPct",
  "markupPct",
  "lineCostCents",
  "internalCostCents",
  "internalProfitCents",
  "effectiveUnitCostCents",
  "unitCostCents",
];

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

function option(id: string, sortOrder: number, isDefault = false): ProposalTemplateOption {
  return {
    id,
    template_id: TEMPLATE_ID,
    name: id,
    selection_mode: "single",
    is_default: isDefault,
    visible_to_customer: true,
    sort_order: sortOrder,
  };
}

function section(id: string, optionId: string): ProposalTemplateSection {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: optionId,
    kind: "line_items",
    name: "Materials",
  };
}

function item(
  overrides: Partial<ProposalTemplateItem> &
    Pick<ProposalTemplateItem, "id" | "option_id" | "section_id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    catalog_item_id: "cat-default",
    item_role: "standard",
    ...overrides,
  };
}

function graph(
  options: ProposalTemplateOption[],
  sections: ProposalTemplateSection[],
  items: ProposalTemplateItem[]
): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Test template",
      status: "active",
      active: true,
    },
    options,
    sections,
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

function readyContext(): ProposalQuantityPreviewContext {
  const quantityMap: MeasurementQuantityMap = { shingles_squares: 22 };
  return { measurementHandoff: readyHandoff(), quantityMap };
}

function singleOptionGraph(items: ProposalTemplateItem[]): ProposalTemplateGraph {
  return graph([option("opt-1", 0, true)], [section("sec-1", "opt-1")], items);
}

function assertNoInternalDollarKeys(
  customer: ProposalBuilderOptionCustomerView,
  lines: ProposalBuilderLineCustomerView[]
) {
  for (const key of INTERNAL_DOLLAR_KEYS) {
    assert.ok(!(key in customer), `customer option view leaked internal key: ${key}`);
    for (const line of lines) {
      assert.ok(!(key in line), `customer line view leaked internal key: ${key}`);
    }
  }
}

describe("proposalBuilderPricingPreview", () => {
  test("complete option returns finite customer total and priced line", () => {
    const cat = catalog({ id: "mat-1", item_type: "material", unit_cost_cents: 10_000 });
    const g = singleOptionGraph([
      item({ id: "line-1", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "mat-1" }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [cat],
      quantityContext: readyContext(),
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    assert.equal(opt.customer.pricingComplete, true);
    assert.equal(typeof opt.customer.customerTotalCents, "number");
    assert.ok((opt.customer.customerTotalCents ?? 0) > 0);
    const line = opt.customer.lineByTemplateItemId["line-1"];
    assert.equal(line.displayStatus, "priced");
    assert.equal(line.showPrice, true);
    assert.equal(typeof line.customerLinePriceCents, "number");
    assert.equal(opt.status.blockingLineCount, 0);
    assert.equal(opt.status.guardrailOutcome, "pass");
  });

  test("missing catalog blocks option and nulls customer totals", () => {
    const g = singleOptionGraph([
      item({ id: "line-x", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "gone" }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [],
      quantityContext: readyContext(),
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    assert.equal(opt.customer.pricingComplete, false);
    assert.equal(opt.customer.customerSubtotalCents, null);
    assert.equal(opt.customer.customerTotalCents, null);
    assert.ok(opt.status.blockingLineCount >= 1);
    const line = opt.customer.lineByTemplateItemId["line-x"];
    assert.equal(line.displayStatus, "not_priced");
    assert.equal(line.customerLinePriceCents, null);
  });

  test("included + unresolved quantity remains blocking", () => {
    const cat = catalog({
      id: "inc-1",
      pricing_basis: "included",
      quantity_source: "adjusted_roof_squares",
      unit_cost_cents: 2_000,
    });
    const g = singleOptionGraph([
      item({
        id: "line-inc",
        option_id: "opt-1",
        section_id: "sec-1",
        catalog_item_id: "inc-1",
        item_role: "included",
        quantity_rule: { mode: "measurement" },
      }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [cat],
      quantityContext: { measurementHandoff: null, quantityMap: null },
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    assert.equal(opt.customer.pricingComplete, false);
    assert.equal(opt.customer.customerTotalCents, null);
    assert.ok(opt.status.blockingLineCount >= 1);
    assert.equal(opt.customer.lineByTemplateItemId["line-inc"].displayStatus, "needs_quantity");
  });

  test("mixed customer_visible + internal_only + included", () => {
    const visible = catalog({
      id: "vis",
      pricing_basis: "unit_price",
      unit_price_cents: 10_000,
      customer_visibility: "customer_visible",
    });
    const internal = catalog({
      id: "int",
      pricing_basis: "unit_price",
      unit_price_cents: 4_000,
      customer_visibility: "internal_only",
    });
    const inc = catalog({
      id: "inc",
      pricing_basis: "included",
      unit_cost_cents: 1_000,
    });
    const g = singleOptionGraph([
      item({ id: "l-vis", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "vis" }),
      item({ id: "l-int", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "int" }),
      item({
        id: "l-inc",
        option_id: "opt-1",
        section_id: "sec-1",
        catalog_item_id: "inc",
        item_role: "included",
      }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [visible, internal, inc],
      quantityContext: readyContext(),
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    assert.equal(opt.customer.pricingComplete, true);
    // Only the customer_visible line contributes to subtotal.
    assert.equal(opt.customer.customerSubtotalCents, 10_000 * 22);
    assert.equal(opt.customer.lineByTemplateItemId["l-vis"].displayStatus, "priced");
    assert.equal(opt.customer.lineByTemplateItemId["l-int"].displayStatus, "omitted");
    assert.equal(opt.customer.lineByTemplateItemId["l-int"].showPrice, false);
    assert.equal(opt.customer.lineByTemplateItemId["l-inc"].displayStatus, "included");
  });

  test("grouped + customer_visible: grouped shows no price but rolls into subtotal", () => {
    const groupedItem = catalog({
      id: "grp",
      pricing_basis: "unit_price",
      unit_price_cents: 3_000,
      customer_visibility: "grouped",
    });
    const visible = catalog({
      id: "vis2",
      pricing_basis: "unit_price",
      unit_price_cents: 5_000,
      customer_visibility: "customer_visible",
    });
    const g = singleOptionGraph([
      item({ id: "l-grp", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "grp" }),
      item({ id: "l-vis2", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "vis2" }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [groupedItem, visible],
      quantityContext: readyContext(),
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    const grp = opt.customer.lineByTemplateItemId["l-grp"];
    assert.equal(grp.displayStatus, "grouped");
    assert.equal(grp.showPrice, false);
    assert.equal(grp.customerLinePriceCents, null);
    // grouped (3000*22) + visible (5000*22) both roll into subtotal.
    assert.equal(opt.customer.customerSubtotalCents, (3_000 + 5_000) * 22);
  });

  test("all options computed independently; blocked option does not null sibling", () => {
    const cat = catalog({ id: "ok", pricing_basis: "unit_price", unit_price_cents: 6_000 });
    const g = graph(
      [option("opt-good", 0, true), option("opt-bad", 1)],
      [section("sec-good", "opt-good"), section("sec-bad", "opt-bad")],
      [
        item({ id: "g1", option_id: "opt-good", section_id: "sec-good", catalog_item_id: "ok" }),
        item({ id: "b1", option_id: "opt-bad", section_id: "sec-bad", catalog_item_id: "missing" }),
      ]
    );

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [cat],
      quantityContext: readyContext(),
    });

    assert.deepEqual(preview.optionIds, ["opt-good", "opt-bad"]);
    assert.equal(preview.byOptionId["opt-good"].customer.pricingComplete, true);
    assert.ok((preview.byOptionId["opt-good"].customer.customerTotalCents ?? 0) > 0);
    assert.equal(preview.byOptionId["opt-bad"].customer.pricingComplete, false);
    assert.equal(preview.byOptionId["opt-bad"].customer.customerTotalCents, null);
    assert.equal(preview.selectedOptionId, "opt-good");
  });

  test("customer DTO excludes internal dollar fields", () => {
    const cat = catalog({ id: "mat", item_type: "material", unit_cost_cents: 10_000 });
    const g = singleOptionGraph([
      item({ id: "l", option_id: "opt-1", section_id: "sec-1", catalog_item_id: "mat" }),
    ]);

    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [cat],
      quantityContext: readyContext(),
    });

    const opt = preview.byOptionId["opt-1"];
    assert.ok(opt);
    assertNoInternalDollarKeys(opt.customer, opt.customer.lines);
    // Status slice also carries no dollar values.
    assert.deepEqual(Object.keys(opt.status).sort(), [
      "blockingLineCount",
      "guardrailOutcome",
      "optionId",
      "pricingComplete",
    ]);
  });

  test("preview policy constant shape", () => {
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.profitabilityType, "margin");
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.defaultProfitabilityPct, 50);
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.minimumProfitabilityPct, 20);
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.quantityRounding, "exact");
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.wasteModel, "adjusted_measurement");
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.discount, null);
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.tax.salesTaxRatePct, 0);
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.tax.materialPurchaseTaxRatePct, null);
    assert.equal(BUILDER_PREVIEW_PRICING_POLICY.subtotalOverrideCents, null);
    assert.equal(BUILDER_PREVIEW_ACTOR_ROLE, "rep");
  });

  test("missing/empty graph does not throw", () => {
    const nullPreview = buildProposalBuilderPricingPreview({
      graph: null,
      catalogItems: [],
      quantityContext: null,
    });
    assert.deepEqual(nullPreview.optionIds, []);
    assert.deepEqual(nullPreview.byOptionId, {});
    assert.equal(nullPreview.selectedOptionId, null);

    const emptyGraph = graph([], [], []);
    const emptyPreview = buildProposalBuilderPricingPreview({
      graph: emptyGraph,
      catalogItems: [],
      quantityContext: readyContext(),
    });
    assert.deepEqual(emptyPreview.optionIds, []);
    assert.equal(emptyPreview.selectedOptionId, null);
  });
});
