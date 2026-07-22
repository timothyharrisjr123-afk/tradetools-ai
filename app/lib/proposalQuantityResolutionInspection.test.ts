/**
 * S3D5 — internal draft quantity_resolution_echo inspection (metadata only).
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionInspection.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type {
  MeasurementProposalHandoff,
  ProposalQuantitySummary,
} from "./measurementProposalHandoff";
import {
  inspectLoadedDraftLineQuantityResolution,
  inspectLoadedDraftLinesQuantityResolution,
} from "./proposalQuantityResolutionInspection";
import type { ProposalQuantityResolverInput } from "./proposalQuantityResolver";
import { buildDraftProposalCreatePersistPayload } from "./proposalDraftCreatePersistence";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import {
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
  type LineItemSnapshotInput,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-inspect-test";
const TEMPLATE_ID = "tpl-inspect";
const OPTION_ID = "opt-inspect";
const SECTION_ID = "sec-inspect";
const LINE_ID = "line-inspect-1";

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
    ...overrides,
  };
}

function templateItem(
  overrides: Partial<ProposalTemplateItem> & Pick<ProposalTemplateItem, "id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: "cat-shingles",
    item_role: "standard",
    ...overrides,
  };
}

function resolverInput(
  squares: number,
  extras: Partial<ProposalQuantityResolverInput> = {}
): ProposalQuantityResolverInput {
  return {
    measurementHandoff: readyHandoff({ adjusted_roof_squares: squares }),
    quantityMap: null,
    catalogItem: catalog({ id: "cat-shingles" }),
    templateItem: templateItem({ id: "ti-shingles", catalog_item_id: "cat-shingles" }),
    ...extras,
  };
}

function matchingPersistedEcho(squares: number): Record<string, unknown> {
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

describe("inspectLoadedDraftLineQuantityResolution", () => {
  test("1. loaded internal draft line reports current when persisted echo matches", () => {
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      sourceTemplateItemId: "ti-shingles",
      persistedEcho: matchingPersistedEcho(24),
      resolverInput: resolverInput(24),
    });
    assert.equal(result.status, "current");
    assert.deepEqual(result.reasons, []);
    assert.equal(result.lineId, LINE_ID);
    assert.equal(result.current?.resolved_purchase_quantity, 24);
  });

  test("2. missing historical echo reports unknown", () => {
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: null,
      resolverInput: resolverInput(24),
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("missing_persisted_echo"));
  });

  test("3. malformed echo reports unknown", () => {
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: "not-an-object",
      resolverInput: resolverInput(24),
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("malformed_persisted_echo"));
  });

  test("4. mismatched quantity/source/mode reports stale", () => {
    const qtyMismatch = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: matchingPersistedEcho(20),
      resolverInput: resolverInput(24),
    });
    assert.equal(qtyMismatch.status, "stale");
    assert.ok(qtyMismatch.reasons.includes("resolved_purchase_quantity_mismatch"));

    const modeMismatch = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: {
        ...matchingPersistedEcho(24),
        quantity_mode: "raw_plus_waste",
      },
      resolverInput: resolverInput(24),
    });
    assert.equal(modeMismatch.status, "stale");
    assert.ok(modeMismatch.reasons.includes("quantity_mode_mismatch"));

    const sourceMismatch = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: {
        ...matchingPersistedEcho(24),
        source_measurement_key: "roof_squares",
      },
      resolverInput: resolverInput(24),
    });
    assert.equal(sourceMismatch.status, "stale");
    assert.ok(sourceMismatch.reasons.includes("source_measurement_key_mismatch"));
  });

  test("missing resolver inputs reports unknown (does not invent current echo)", () => {
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: matchingPersistedEcho(24),
      resolverInput: null,
    });
    assert.equal(result.status, "unknown");
    assert.ok(result.reasons.includes("missing_current_echo"));
    assert.equal(result.current, null);
  });

  test("9. raw_plus_waste under adjusted policy is flagged stale, not current", () => {
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: {
        ...matchingPersistedEcho(24),
        quantity_mode: "raw_plus_waste",
        rounding_mode_used: "whole",
        waste_pct_used: 10,
      },
      resolverInput: resolverInput(24),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("quantity_mode_mismatch"));
    assert.ok(result.reasons.includes("rounding_mode_mismatch"));
    assert.ok(result.reasons.includes("waste_pct_used_non_null"));
  });

  test("15. matching raw echo under raw policy reports current", () => {
    const input: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({
        roof_squares: 100,
        adjusted_roof_squares: 110,
      }),
      quantityMap: null,
      catalogItem: catalog({
        id: "cat-shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: 50,
        waste_applies: true,
        waste_pct: 10,
      }),
      templateItem: templateItem({ id: "ti-shingles", catalog_item_id: "cat-shingles" }),
    };
    const result = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: {
        quantity_mode: "raw_plus_waste",
        source_measurement_key: "roof_squares",
        source_measurement_value: 100,
        coverage_rate_used: 50,
        waste_pct_used: 10,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: 2.2,
      },
      resolverInput: input,
      wasteModel: "raw_plus_waste",
    });
    assert.equal(result.status, "current");
    assert.deepEqual(result.reasons, []);
    assert.equal(result.current?.resolved_purchase_quantity, 2.2);
  });

  test("16–17. raw echo mismatch / adjusted-under-raw are stale", () => {
    const input: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({
        roof_squares: 100,
        adjusted_roof_squares: 110,
      }),
      quantityMap: null,
      catalogItem: catalog({
        id: "cat-shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: 50,
        waste_applies: true,
        waste_pct: 10,
      }),
      templateItem: templateItem({ id: "ti-shingles", catalog_item_id: "cat-shingles" }),
    };

    const qtyMismatch = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: {
        quantity_mode: "raw_plus_waste",
        source_measurement_key: "roof_squares",
        source_measurement_value: 100,
        coverage_rate_used: 50,
        waste_pct_used: 10,
        rounding_mode_used: "exact",
        resolved_purchase_quantity: 9,
      },
      resolverInput: input,
      wasteModel: "raw_plus_waste",
    });
    assert.equal(qtyMismatch.status, "stale");
    assert.ok(qtyMismatch.reasons.includes("resolved_purchase_quantity_mismatch"));

    const adjustedUnderRaw = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: matchingPersistedEcho(110),
      resolverInput: input,
      wasteModel: "raw_plus_waste",
    });
    assert.equal(adjustedUnderRaw.status, "stale");
    assert.ok(adjustedUnderRaw.reasons.includes("quantity_mode_mismatch"));
  });
});

describe("inspectLoadedDraftLinesQuantityResolution", () => {
  test("batch maps inspections by line id without mutating quantities", () => {
    const lines = [
      {
        id: "line-a",
        source_template_item_id: "ti-shingles",
        quantity: 24,
        quantity_resolution_echo: matchingPersistedEcho(24),
      },
      {
        id: "line-b",
        source_template_item_id: "ti-shingles",
        quantity: 20,
        quantity_resolution_echo: matchingPersistedEcho(20),
      },
      {
        id: "line-c",
        source_template_item_id: "ti-shingles",
        quantity: 24,
        quantity_resolution_echo: null,
      },
    ];

    const map = inspectLoadedDraftLinesQuantityResolution({
      lines,
      resolveInputForLine: () => resolverInput(24),
    });

    assert.equal(map["line-a"].status, "current");
    assert.equal(map["line-b"].status, "stale");
    assert.equal(map["line-c"].status, "unknown");
    assert.equal(lines[0].quantity, 24);
    assert.equal(lines[1].quantity, 20);
  });
});

describe("S3D5 inspection boundaries", () => {
  test("5. inspection result is not persisted on draft create payload rows", () => {
    const inspection = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: matchingPersistedEcho(22),
      resolverInput: resolverInput(22),
    });
    assert.equal(inspection.status, "current");

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
      quantity_resolution_echo: matchingPersistedEcho(22),
      quantity_resolution_status: inspection.status,
      quantityResolutionInspection: inspection,
    } as LineItemSnapshotInput & {
      quantity_resolution_status?: string;
      quantityResolutionInspection?: unknown;
    };

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
    assert.equal(line.customer_line_total_cents, 10_000);
    assert.ok(line.quantity_resolution_echo);
    assert.equal(
      Object.prototype.hasOwnProperty.call(line, "quantity_resolution_status"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(line, "quantityResolutionInspection"),
      false
    );
  });

  test("6. customer-safe snapshot omits echo and inspection metadata", () => {
    const inspection = inspectLoadedDraftLineQuantityResolution({
      lineId: LINE_ID,
      persistedEcho: matchingPersistedEcho(24),
      resolverInput: resolverInput(24),
    });

    const lineInput = {
      source_template_item_id: "ti-shingles",
      catalog_item_id: "cat-shingles",
      catalog_seed_key: null,
      section_id: SECTION_ID,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: "standard" as const,
      quantity: 24,
      quantity_display_label: "24 SQ",
      quantity_source_label: "Measurement",
      unit: "SQ",
      customer_unit_price_cents: 100,
      customer_line_total_cents: 2400,
      engineStatus: "priced" as const,
      customerVisibility: "customer_visible" as const,
      quantity_resolution_echo: matchingPersistedEcho(24),
      quantity_resolution_status: inspection.status,
      quantityResolutionInspection: inspection,
    } as LineItemSnapshotInput & {
      quantity_resolution_status?: string;
      quantityResolutionInspection?: unknown;
    };

    const rows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      proposal_option_id: OPTION_ID,
      lines: [lineInput],
    });

    assert.equal(rows[0]!.quantity, 24);
    assert.equal(rows[0]!.customer_line_total_cents, 2400);
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_echo"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_status"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantityResolutionInspection"),
      false
    );
  });

  test("8. quantities/totals unchanged by inspection", () => {
    const line = {
      id: LINE_ID,
      quantity: 24,
      line_total_cents: 2400,
      quantity_resolution_echo: matchingPersistedEcho(20),
    };
    const before = { quantity: line.quantity, line_total_cents: line.line_total_cents };
    inspectLoadedDraftLineQuantityResolution({
      lineId: line.id,
      persistedEcho: line.quantity_resolution_echo,
      resolverInput: resolverInput(24),
    });
    assert.deepEqual(
      { quantity: line.quantity, line_total_cents: line.line_total_cents },
      before
    );
  });
});
