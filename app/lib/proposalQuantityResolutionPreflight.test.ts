/**
 * S3D6 — internal quantity resolution preflight tests.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionPreflight.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type {
  MeasurementProposalHandoff,
  ProposalQuantitySummary,
} from "./measurementProposalHandoff";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import { buildDraftProposalCreatePersistPayload } from "./proposalDraftCreatePersistence";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import {
  buildProposalQuantityResolverInputForLoadedDraftLine,
  summarizeLoadedDraftQuantityResolutionPreflight,
} from "./proposalQuantityResolutionPreflight";
import {
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
  type LineItemSnapshotInput,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-preflight";
const TEMPLATE_ID = "tpl-preflight";
const OPTION_ID = "opt-preflight";
const SECTION_ID = "sec-preflight";
const TI_A = "ti-shingles-a";
const TI_B = "ti-shingles-b";
const CAT_A = "cat-shingles-a";

function emptyQuantities(): ProposalQuantitySummary {
  return {
    roof_squares: null,
    adjusted_roof_squares: null,
    roof_area_sqft: null,
    waste_percent: null,
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
  };
}

function readyHandoff(
  quantities: Partial<ProposalQuantitySummary> = {}
): MeasurementProposalHandoff {
  return {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Job #1",
    quantities: { ...emptyQuantities(), ...quantities },
    estimateReady: true,
    productionReady: false,
  };
}

function quantityContext(squares: number): ProposalQuantityPreviewContext {
  return {
    measurementHandoff: readyHandoff({ adjusted_roof_squares: squares }),
    quantityMap: null,
  };
}

function catalog(id: string, overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    company_id: COMPANY_ID,
    id,
    name: overrides.name ?? id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    ...overrides,
  };
}

function templateItem(
  id: string,
  catalogItemId: string,
  overrides: Partial<ProposalTemplateItem> = {}
): ProposalTemplateItem {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: catalogItemId,
    item_role: "standard",
    ...overrides,
  };
}

function matchingEcho(squares: number): Record<string, unknown> {
  return {
    quantity_mode: "adjusted_measurement",
    source_measurement_key: "adjusted_roof_squares",
    source_measurement_value: squares,
    coverage_rate_used: null,
    waste_pct_used: null,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: squares,
  };
}

describe("buildProposalQuantityResolverInputForLoadedDraftLine", () => {
  test("4. returns null when template item cannot be resolved honestly", () => {
    const built = buildProposalQuantityResolverInputForLoadedDraftLine({
      line: {
        id: "line-1",
        source_template_item_id: "missing-ti",
        catalog_item_id: CAT_A,
      },
      templateItemsById: new Map([[TI_A, templateItem(TI_A, CAT_A)]]),
      catalogItemsById: new Map([[CAT_A, catalog(CAT_A)]]),
      quantityContext: quantityContext(24),
    });
    assert.equal(built, null);
  });

  test("builds honest resolver input when template + catalog + measurement present", () => {
    const built = buildProposalQuantityResolverInputForLoadedDraftLine({
      line: {
        id: "line-1",
        source_template_item_id: TI_A,
        catalog_item_id: CAT_A,
      },
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });
    assert.ok(built);
    assert.equal(built!.templateItem.id, TI_A);
    assert.equal(built!.catalogItem?.id, CAT_A);
    assert.equal(built!.measurementHandoff?.quantities.adjusted_roof_squares, 24);
  });
});

describe("summarizeLoadedDraftQuantityResolutionPreflight", () => {
  test("1. reports current when all line echoes match", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-a",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
        {
          id: "line-b",
          source_template_item_id: TI_B,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
      templateItemsById: new Map([
        [TI_A, templateItem(TI_A, CAT_A)],
        [TI_B, templateItem(TI_B, CAT_A)],
      ]),
      catalogItemsById: new Map([[CAT_A, catalog(CAT_A)]]),
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "current");
    assert.equal(summary.currentCount, 2);
    assert.equal(summary.staleCount, 0);
    assert.equal(summary.unknownCount, 0);
    assert.equal(summary.byLineId["line-a"]!.status, "current");
    assert.equal(summary.byLineId["line-b"]!.status, "current");
  });

  test("2. reports stale count when one line has mismatched quantity/source/mode", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-ok",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
        {
          id: "line-stale",
          source_template_item_id: TI_B,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(20),
        },
      ],
      templateItemsById: {
        [TI_A]: templateItem(TI_A, CAT_A),
        [TI_B]: templateItem(TI_B, CAT_A),
      },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "stale");
    assert.equal(summary.staleCount, 1);
    assert.equal(summary.currentCount, 1);
    assert.equal(summary.unknownCount, 0);
    assert.equal(summary.byLineId["line-stale"]!.status, "stale");
    assert.ok(
      summary.byLineId["line-stale"]!.reasons.includes(
        "resolved_purchase_quantity_mismatch"
      )
    );
  });

  test("3. reports unknown for missing historical echo", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-hist",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: null,
        },
      ],
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "unknown");
    assert.equal(summary.unknownCount, 1);
    assert.equal(summary.staleCount, 0);
    assert.ok(
      summary.byLineId["line-hist"]!.reasons.includes("missing_persisted_echo")
    );
  });

  test("4. reports unknown when resolver input cannot be built honestly", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-orphan",
          source_template_item_id: "ti-missing",
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "unknown");
    assert.equal(summary.unknownCount, 1);
    assert.ok(
      summary.byLineId["line-orphan"]!.reasons.includes("missing_current_echo")
    );
  });

  test("8. raw/whole echo under default adjusted policy is flagged stale", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-future",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: {
            ...matchingEcho(24),
            quantity_mode: "raw_plus_waste",
            rounding_mode_used: "whole",
            waste_pct_used: 10,
          },
        },
      ],
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "stale");
    assert.equal(summary.staleCount, 1);
    const reasons = summary.byLineId["line-future"]!.reasons;
    assert.ok(reasons.includes("quantity_mode_mismatch"));
    assert.ok(reasons.includes("rounding_mode_mismatch"));
    assert.ok(reasons.includes("waste_pct_used_non_null"));
  });

  test("7. quantities/totals unchanged by preflight", () => {
    const lines = [
      {
        id: "line-a",
        source_template_item_id: TI_A,
        catalog_item_id: CAT_A,
        quantity: 24,
        line_total_cents: 2400,
        quantity_resolution_echo: matchingEcho(20),
      },
    ];
    const before = {
      quantity: lines[0]!.quantity,
      line_total_cents: lines[0]!.line_total_cents,
    };

    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines,
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(24),
    });

    assert.equal(summary.status, "stale");
    assert.deepEqual(
      { quantity: lines[0]!.quantity, line_total_cents: lines[0]!.line_total_cents },
      before
    );
  });
});

describe("S3D6 preflight boundaries", () => {
  test("5/6. does not persist or expose preflight metadata on create/customer snapshot", () => {
    const summary = summarizeLoadedDraftQuantityResolutionPreflight({
      lines: [
        {
          id: "line-a",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(22),
        },
      ],
      templateItemsById: { [TI_A]: templateItem(TI_A, CAT_A) },
      catalogItemsById: { [CAT_A]: catalog(CAT_A) },
      quantityContext: quantityContext(22),
    });
    assert.equal(summary.status, "current");

    const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";
    const SECTION = "88888888-8888-4888-8888-888888888888";
    const JOB_ID = "22222222-2222-4222-8222-222222222222";
    const POLICY_ID = "55555555-5555-4555-8555-555555555555";
    const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
    const CREATE_TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
    const CREATE_COMPANY_ID = "11111111-1111-4111-8111-111111111111";

    const policy: PricingPolicy = {
      profitabilityType: DEFAULT_PROFITABILITY_TYPE,
      defaultProfitabilityPct: 35,
      minimumProfitabilityPct: 25,
      quantityRounding: DEFAULT_QUANTITY_ROUNDING,
      wasteModel: DEFAULT_WASTE_MODEL,
      discount: null,
      tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
      subtotalOverrideCents: null,
    };

    const pollutedLine = {
      source_template_item_id: "99999999-9999-4999-8999-999999999999",
      catalog_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      catalog_seed_key: null,
      section_id: SECTION,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: "standard" as const,
      quantity: 22,
      quantity_display_label: "22 SQ",
      quantity_source_label: "Measurement",
      unit: "SQ",
      customer_unit_price_cents: 500,
      customer_line_total_cents: 10_000,
      engineStatus: "priced" as const,
      customerVisibility: "customer_visible" as const,
      catalogItemMissing: false,
      measurement_quantity_key: null,
      quantity_resolution_echo: matchingEcho(22),
      quantity_resolution_status: summary.status,
      quantityResolutionPreflight: summary,
    } as LineItemSnapshotInput & {
      quantity_resolution_status?: string;
      quantityResolutionPreflight?: unknown;
    };

    const rows = buildLineItemSnapshots({
      company_id: CREATE_COMPANY_ID,
      proposal_option_id: TEMPLATE_OPT,
      lines: [pollutedLine],
    });
    assert.equal(rows[0]!.quantity, 22);
    assert.equal(rows[0]!.customer_line_total_cents, 10_000);
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_echo"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_status"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantityResolutionPreflight"),
      false
    );

    const instantiateInput: DraftInstantiateInput = {
      company_id: CREATE_COMPANY_ID,
      context: { job_id: JOB_ID, template_id: CREATE_TEMPLATE_ID },
      policy: {
        configured: true,
        policy,
        pricingPolicyId: POLICY_ID,
        source: "company",
      },
      templateOptions: [],
      templateSections: [],
      optionPricing: [],
      lineItemsByTemplateOptionId: {
        [TEMPLATE_OPT]: [pollutedLine],
      },
      internalSummaryByTemplateOptionId: {
        [TEMPLATE_OPT]: {
          internal_cost_cents: 7000,
          internal_profit_cents: 3000,
          effective_margin_pct: 30,
        },
      },
      selectedTemplateOptionId: TEMPLATE_OPT,
      computedAt: "2026-06-25T00:00:00.000Z",
    };

    const instantiatePayload: DraftInstantiatePayload = {
      contextEcho: { job_id: JOB_ID },
      policyEcho: { configured: true },
      pages: [
        {
          company_id: CREATE_COMPANY_ID,
          page_type: "cover",
          sort_order: 0,
          title: "Cover",
          customer_title: "Cover",
          visible_to_customer: true,
          source_template_section_id: SECTION,
          content_json: {},
          settings_json: {},
        },
      ],
      options: [
        {
          company_id: CREATE_COMPANY_ID,
          source_template_option_id: TEMPLATE_OPT,
          name: "Standard",
          customer_label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 10_000,
          discount_cents: 0,
          sales_tax_cents: 0,
          customer_total_cents: 10_000,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
          selected_at: null,
        },
      ],
      lineItems: [],
      internalSummaries: [],
      selectedTemplateOptionId: TEMPLATE_OPT,
      events: [{ event_type: "created", payload_json: {} }],
    };

    const payload = buildDraftProposalCreatePersistPayload({
      companyId: CREATE_COMPANY_ID,
      jobId: JOB_ID,
      customerId: CUSTOMER_ID,
      templateId: CREATE_TEMPLATE_ID,
      measurementRecordId: null,
      pricingPolicyId: POLICY_ID,
      title: "Roof Proposal",
      createdBy: null,
      instantiatePayload,
      instantiateInput,
      policy,
    });

    const line = payload.options[0]!.line_items[0]! as Record<string, unknown>;
    assert.equal(line.quantity, 22);
    assert.ok(line.quantity_resolution_echo);
    assert.equal(
      Object.prototype.hasOwnProperty.call(line, "quantityResolutionPreflight"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(line, "quantity_resolution_status"),
      false
    );
  });
});
