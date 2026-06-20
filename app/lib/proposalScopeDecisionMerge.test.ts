/**
 * R17D Phase 1 — proposalScopeDecisionMerge tests.
 *
 * Run: npx tsx --test app/lib/proposalScopeDecisionMerge.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import { buildProposalBuilderPricingPreview } from "./proposalBuilderPricingPreview";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import { buildDraftInstantiateInputFromPreview } from "./proposalRecordStore";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import {
  buildDraftInstantiateInputWithScopeDecisions,
  createEmptyScopeDecisionMergeReport,
  groupScopeDecisionsByTemplateOptionId,
  hasAnyActiveScopeDecisions,
  mergeScopeDecisionsIntoPricingLines,
} from "./proposalScopeDecisionMerge";
import type { ProposalScopeDecision } from "./proposalScopeDecisionTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const STANDARD_OPTION_ID = "77777777-7777-4777-8777-777777777777";
const ENHANCED_OPTION_ID = "88888888-8888-4888-8888-888888888888";
const STANDARD_SECTION_ID = "99999999-9999-4999-8999-999999999999";
const ENHANCED_SECTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STANDARD_ITEM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ENHANCED_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CATALOG_STANDARD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CATALOG_ENHANCED_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
  subtotalOverrideCents: null,
};

function catalog(id: string): CatalogItem {
  return {
    company_id: COMPANY_ID,
    id,
    name: id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
  };
}

function quantityContext(squares: number): ProposalQuantityPreviewContext {
  const handoff: MeasurementProposalHandoff = {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Job",
    quantities: {
      roof_squares: squares,
      adjusted_roof_squares: squares,
      roof_area_sqft: squares * 100,
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
  const quantityMap: MeasurementQuantityMap = { shingles_squares: squares };
  return { measurementHandoff: handoff, quantityMap };
}

function twoOptionGraph(): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Two-tier",
      status: "active",
      active: true,
    },
    options: [
      {
        id: STANDARD_OPTION_ID,
        template_id: TEMPLATE_ID,
        name: "Standard",
        is_default: true,
        visible_to_customer: true,
        sort_order: 0,
      },
      {
        id: ENHANCED_OPTION_ID,
        template_id: TEMPLATE_ID,
        name: "Enhanced",
        is_default: false,
        visible_to_customer: true,
        sort_order: 1,
      },
    ],
    sections: [
      {
        id: STANDARD_SECTION_ID,
        template_id: TEMPLATE_ID,
        option_id: STANDARD_OPTION_ID,
        kind: "line_items",
        name: "Standard Estimate",
        sort_order: 0,
      },
      {
        id: ENHANCED_SECTION_ID,
        template_id: TEMPLATE_ID,
        option_id: ENHANCED_OPTION_ID,
        kind: "line_items",
        name: "Enhanced Estimate",
        sort_order: 0,
      },
    ],
    items: [
      {
        id: STANDARD_ITEM_ID,
        template_id: TEMPLATE_ID,
        option_id: STANDARD_OPTION_ID,
        section_id: STANDARD_SECTION_ID,
        catalog_item_id: CATALOG_STANDARD_ID,
        item_role: "standard",
        sort_order: 0,
      },
      {
        id: ENHANCED_ITEM_ID,
        template_id: TEMPLATE_ID,
        option_id: ENHANCED_OPTION_ID,
        section_id: ENHANCED_SECTION_ID,
        catalog_item_id: CATALOG_ENHANCED_ID,
        item_role: "standard",
        sort_order: 0,
      },
    ],
  };
}

function decision(
  overrides: Partial<ProposalScopeDecision> & Pick<ProposalScopeDecision, "decisionType">
): ProposalScopeDecision {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-000000000001",
    companyId: COMPANY_ID,
    proposalId: "22222222-2222-4222-8222-222222222222",
    proposalVersionId: "33333333-3333-4333-8333-000000000003",
    proposalOptionId: overrides.proposalOptionId ?? "44444444-4444-4444-8444-000000000004",
    decisionType: overrides.decisionType,
    sourceTemplateItemId: overrides.sourceTemplateItemId ?? STANDARD_ITEM_ID,
    instanceLineKey: overrides.instanceLineKey ?? null,
    payload: overrides.payload ?? { quantity: 18 },
    active: overrides.active ?? true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-06-18T00:00:00Z",
    updatedAt: "2026-06-18T00:00:00Z",
  };
}

describe("proposalScopeDecisionMerge", () => {
  test("zero active decisions — hasAnyActiveScopeDecisions is false", () => {
    assert.equal(hasAnyActiveScopeDecisions({}), false);
    assert.equal(
      hasAnyActiveScopeDecisions({
        [STANDARD_OPTION_ID]: [decision({ decisionType: "manual_quantity", active: false })],
      }),
      false
    );
  });

  test("zero-decision instantiate path matches buildDraftInstantiateInputFromPreview", () => {
    const graph = twoOptionGraph();
    const catalogItems = [catalog(CATALOG_STANDARD_ID), catalog(CATALOG_ENHANCED_ID)];
    const ctx = quantityContext(22);
    const preview = buildProposalBuilderPricingPreview({
      graph,
      catalogItems,
      quantityContext: ctx,
      policy: POLICY,
    });

    const baseParams = {
      companyId: COMPANY_ID,
      graph,
      catalogItems,
      quantityContext: ctx,
      preview,
      policy: POLICY,
      pricingPolicyId: "policy-id",
      context: { job_id: "job", template_id: TEMPLATE_ID },
    };

    const baseline = buildDraftInstantiateInputFromPreview(baseParams);
    const grouped = groupScopeDecisionsByTemplateOptionId([], new Map());
    assert.equal(hasAnyActiveScopeDecisions(grouped), false);

    assert.deepEqual(
      baseline.lineItemsByTemplateOptionId[STANDARD_OPTION_ID],
      buildDraftInstantiateInputFromPreview(baseParams).lineItemsByTemplateOptionId[STANDARD_OPTION_ID]
    );
    assert.equal(
      baseline.optionPricing[0]?.customer_total_cents,
      buildDraftInstantiateInputFromPreview(baseParams).optionPricing[0]?.customer_total_cents
    );
  });

  test("manual_quantity overrides template line quantity in merge", () => {
    const graph = twoOptionGraph();
    const catalogItems = [catalog(CATALOG_STANDARD_ID), catalog(CATALOG_ENHANCED_ID)];
    const ctx = quantityContext(22);
    const preview = buildProposalBuilderPricingPreview({
      graph,
      catalogItems,
      quantityContext: ctx,
      policy: POLICY,
    });

    const { input, mergeReport } = buildDraftInstantiateInputWithScopeDecisions({
      companyId: COMPANY_ID,
      graph,
      catalogItems,
      quantityContext: ctx,
      preview,
      policy: POLICY,
      pricingPolicyId: "policy-id",
      context: { job_id: "job", template_id: TEMPLATE_ID },
      scopeDecisionsByTemplateOptionId: {
        [STANDARD_OPTION_ID]: [
          decision({
            decisionType: "manual_quantity",
            payload: { quantity: 18 },
          }),
        ],
      },
    });

    assert.equal(mergeReport.applied.length, 1);
    assert.equal(mergeReport.unsupported.length, 0);

    const standardLine = input.lineItemsByTemplateOptionId[STANDARD_OPTION_ID]![0]!;
    assert.equal(standardLine.quantity, 18);
    assert.equal(standardLine.quantity_source_label, "Manual");

    const baseline = buildDraftInstantiateInputFromPreview({
      companyId: COMPANY_ID,
      graph,
      catalogItems,
      quantityContext: ctx,
      preview,
      policy: POLICY,
      pricingPolicyId: "policy-id",
      context: { job_id: "job", template_id: TEMPLATE_ID },
    });
    const baselineLine = baseline.lineItemsByTemplateOptionId[STANDARD_OPTION_ID]![0]!;
    assert.equal(baselineLine.quantity, 22);
    assert.notEqual(standardLine.customer_line_total_cents, baselineLine.customer_line_total_cents);
  });

  test("manual_quantity is option-scoped and does not leak to Enhanced", () => {
    const graph = twoOptionGraph();
    const catalogItems = [catalog(CATALOG_STANDARD_ID), catalog(CATALOG_ENHANCED_ID)];
    const ctx = quantityContext(22);
    const preview = buildProposalBuilderPricingPreview({
      graph,
      catalogItems,
      quantityContext: ctx,
      policy: POLICY,
    });

    const { input } = buildDraftInstantiateInputWithScopeDecisions({
      companyId: COMPANY_ID,
      graph,
      catalogItems,
      quantityContext: ctx,
      preview,
      policy: POLICY,
      pricingPolicyId: "policy-id",
      context: { job_id: "job", template_id: TEMPLATE_ID },
      scopeDecisionsByTemplateOptionId: {
        [STANDARD_OPTION_ID]: [
          decision({
            decisionType: "manual_quantity",
            payload: { quantity: 15 },
          }),
        ],
      },
    });

    assert.equal(input.lineItemsByTemplateOptionId[STANDARD_OPTION_ID]![0]!.quantity, 15);
    assert.equal(input.lineItemsByTemplateOptionId[ENHANCED_OPTION_ID]![0]!.quantity, 22);
  });

  test("stale source_template_item_id is reported and does not corrupt totals", () => {
    const graph = twoOptionGraph();
    const catalogItems = [catalog(CATALOG_STANDARD_ID), catalog(CATALOG_ENHANCED_ID)];
    const ctx = quantityContext(22);
    const preview = buildProposalBuilderPricingPreview({
      graph,
      catalogItems,
      quantityContext: ctx,
      policy: POLICY,
    });

    const staleItemId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const { input, mergeReport } = buildDraftInstantiateInputWithScopeDecisions({
      companyId: COMPANY_ID,
      graph,
      catalogItems,
      quantityContext: ctx,
      preview,
      policy: POLICY,
      pricingPolicyId: "policy-id",
      context: { job_id: "job", template_id: TEMPLATE_ID },
      scopeDecisionsByTemplateOptionId: {
        [STANDARD_OPTION_ID]: [
          decision({
            decisionType: "manual_quantity",
            sourceTemplateItemId: staleItemId,
            payload: { quantity: 5 },
          }),
        ],
      },
    });

    assert.equal(mergeReport.stale.length, 1);
    assert.equal(input.lineItemsByTemplateOptionId[STANDARD_OPTION_ID]![0]!.quantity, 22);
  });

  test("unsupported decision types produce warnings", () => {
    const graph = twoOptionGraph();
    const catalogItems = [catalog(CATALOG_STANDARD_ID)];
    const ctx = quantityContext(22);
    const preview = buildProposalBuilderPricingPreview({
      graph,
      catalogItems,
      quantityContext: ctx,
      policy: POLICY,
    });

    const report = createEmptyScopeDecisionMergeReport();
    const mapped = mergeScopeDecisionsIntoPricingLines({
      graph,
      templateOptionId: STANDARD_OPTION_ID,
      lines: [],
      decisions: [
        decision({
          decisionType: "excluded",
          sourceTemplateItemId: STANDARD_ITEM_ID,
          payload: {},
        }),
      ],
      report,
    });

    assert.equal(mapped.length, 0);
    assert.equal(report.unsupported.length, 1);
    assert.ok(report.warnings.length > 0);
  });
});
