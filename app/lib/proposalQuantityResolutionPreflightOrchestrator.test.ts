/**
 * S3D7 — internal quantity resolution preflight orchestrator tests.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionPreflightOrchestrator.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  orchestrateDraftQuantityResolutionPreflight,
} from "./proposalQuantityResolutionPreflightOrchestrator";
import {
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
  type LineItemSnapshotInput,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-orch";
const TEMPLATE_ID = "tpl-orch";
const OPTION_ID = "opt-orch";
const SECTION_ID = "sec-orch";
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
  };
}

function templateItem(id: string, catalogItemId: string): ProposalTemplateItem {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: catalogItemId,
    item_role: "standard",
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

describe("orchestrateDraftQuantityResolutionPreflight", () => {
  test("1. returns current when loaded line echoes match live adjusted inputs", () => {
    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-a",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity: 24,
          customer_line_total_cents: 2400,
          quantity_resolution_echo: matchingEcho(24),
        },
        {
          id: "line-b",
          source_template_item_id: TI_B,
          catalog_item_id: CAT_A,
          quantity: 24,
          customer_line_total_cents: 2400,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A), templateItem(TI_B, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
      identity: {
        proposalId: "prop-1",
        jobId: "job-1",
        templateId: TEMPLATE_ID,
      },
    });

    assert.equal(result.status, "current");
    assert.equal(result.currentCount, 2);
    assert.equal(result.staleCount, 0);
    assert.equal(result.unknownCount, 0);
    assert.equal(result.identity?.proposalId, "prop-1");
  });

  test("2. returns stale when persisted echo quantity/source/mode differs", () => {
    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
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
          quantity_resolution_echo: {
            ...matchingEcho(20),
            quantity_mode: "raw_plus_waste",
          },
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A), templateItem(TI_B, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });

    assert.equal(result.status, "stale");
    assert.equal(result.staleCount, 1);
    assert.equal(result.currentCount, 1);
    assert.ok(
      result.byLineId["line-stale"]!.reasons.includes("quantity_mode_mismatch")
    );
  });

  test("3. returns unknown when required template/catalog/measurement data is missing", () => {
    const missingTemplate = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-a",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
      templateItems: null,
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(missingTemplate.status, "unknown");
    assert.ok(
      missingTemplate.byLineId["line-a"]!.reasons.includes("missing_current_echo")
    );

    const missingMeasurement = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-b",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: null,
    });
    assert.equal(missingMeasurement.status, "unknown");
    assert.ok(
      missingMeasurement.byLineId["line-b"]!.reasons.includes("current_unresolved") ||
        missingMeasurement.byLineId["line-b"]!.reasons.includes("missing_current_echo")
    );
  });

  test("4. returns unknown for historical lines without echo", () => {
    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-hist",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: null,
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });

    assert.equal(result.status, "unknown");
    assert.equal(result.unknownCount, 1);
    assert.ok(
      result.byLineId["line-hist"]!.reasons.includes("missing_persisted_echo")
    );
  });

  test("5. does not write DB rows (pure module — no supabase/store imports)", () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "app/lib/proposalQuantityResolutionPreflightOrchestrator.ts"
      ),
      "utf8"
    );
    assert.equal(src.includes("supabase"), false);
    assert.equal(src.includes("proposalRecordStore"), false);
    assert.equal(src.includes("catalogStore"), false);
    assert.equal(src.includes("from \"@/app/lib/measurement"), false);
    assert.match(src, /Does not write DB/);
    assert.match(src, /Does not fetch from stores/);
  });

  test("7. quantities/totals unchanged by orchestrator", () => {
    const lineItems = [
      {
        id: "line-a",
        source_template_item_id: TI_A,
        catalog_item_id: CAT_A,
        quantity: 24,
        customer_line_total_cents: 2400,
        quantity_resolution_echo: matchingEcho(20),
      },
    ];
    const before = {
      quantity: lineItems[0]!.quantity,
      customer_line_total_cents: lineItems[0]!.customer_line_total_cents,
    };

    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems,
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });

    assert.equal(result.status, "stale");
    assert.deepEqual(
      {
        quantity: lineItems[0]!.quantity,
        customer_line_total_cents: lineItems[0]!.customer_line_total_cents,
      },
      before
    );
  });

  test("8. raw_plus_waste and whole remain disabled (flagged stale)", () => {
    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-future",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: {
            ...matchingEcho(24),
            quantity_mode: "raw_plus_waste",
            rounding_mode_used: "whole",
            waste_pct_used: 12,
          },
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });

    assert.equal(result.status, "stale");
    const reasons = result.byLineId["line-future"]!.reasons;
    assert.ok(reasons.includes("quantity_mode_mismatch"));
    assert.ok(reasons.includes("rounding_mode_mismatch"));
    assert.ok(reasons.includes("waste_pct_used_non_null"));
  });
});

describe("S3D7 orchestrator boundaries", () => {
  test("6. does not expose orchestrator metadata to customer-safe snapshot/persist", () => {
    const result = orchestrateDraftQuantityResolutionPreflight({
      lineItems: [
        {
          id: "line-a",
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          quantity_resolution_echo: matchingEcho(22),
        },
      ],
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(22),
    });
    assert.equal(result.status, "current");

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
      quantityResolutionPreflightOrchestrator: result,
      quantity_resolution_status: result.status,
    } as LineItemSnapshotInput & {
      quantityResolutionPreflightOrchestrator?: unknown;
      quantity_resolution_status?: string;
    };

    const rows = buildLineItemSnapshots({
      company_id: CREATE_COMPANY_ID,
      proposal_option_id: TEMPLATE_OPT,
      lines: [pollutedLine],
    });
    assert.equal(rows[0]!.quantity, 22);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        rows[0],
        "quantityResolutionPreflightOrchestrator"
      ),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_echo"),
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
    assert.ok(line.quantity_resolution_echo);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        line,
        "quantityResolutionPreflightOrchestrator"
      ),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(line, "quantity_resolution_status"),
      false
    );
  });

  test("9. no UI route/components referenced by orchestrator module", () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "app/lib/proposalQuantityResolutionPreflightOrchestrator.ts"
      ),
      "utf8"
    );
    assert.equal(src.includes("app/tools/"), false);
    assert.equal(src.includes("ProposalBuilderClient"), false);
    assert.equal(src.includes('from "react"'), false);
    assert.equal(src.includes("from 'react'"), false);
  });
});
