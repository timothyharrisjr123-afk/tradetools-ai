/**
 * S3D8 — injectable draft quantity resolution preflight loader tests.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionPreflightLoad.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementRecord } from "./measurementTypes";
import { buildDraftProposalCreatePersistPayload } from "./proposalDraftCreatePersistence";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import type {
  ProposalDraftGraph,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalRecord,
  ProposalVersionRow,
} from "./proposalRecordStore";
import {
  buildProposalQuantityPreviewContextFromPersistedMeasurement,
  runDraftQuantityResolutionPreflight,
  type LoadDraftQuantityResolutionPreflightDeps,
} from "./proposalQuantityResolutionPreflightLoad";
import {
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
  type LineItemSnapshotInput,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT = "99999999-9999-4999-8999-999999999999";
const TI_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const LINE_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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
    option_id: TEMPLATE_OPT,
    section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    catalog_item_id: catalogItemId,
    item_role: "standard",
  };
}

function measurement(squares: number): MeasurementRecord {
  // Must be estimate-ready so buildMeasurementProposalHandoff sets proposalReady
  // (resolver treats non-ready handoff as unresolved → unknown).
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    status: "verified",
    is_selected: true,
    source_type: "manual",
    is_verified: true,
    adjusted_roof_squares: squares,
    roof_squares: squares,
    roof_area_sqft: squares * 100,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
  };
}

function proposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: TEMPLATE_ID,
    status: "draft",
    current_draft_version_id: VERSION_ID,
    latest_sent_version_id: null,
    signed_version_id: null,
    selected_option_id: RUNTIME_OPT,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: null,
    title: "Draft",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    draft_content_changed_at: "2026-06-06T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function lineRow(overrides: Partial<ProposalLineItemRow> = {}): ProposalLineItemRow {
  return {
    id: LINE_A,
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT,
    source_template_item_id: TI_A,
    catalog_item_id: CAT_A,
    catalog_seed_key: null,
    section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    page_id: null,
    sort_order: 0,
    customer_name: "Shingles",
    description: null,
    role: null,
    quantity: 24,
    quantity_display_label: "24 SQ",
    quantity_source_label: "Measurement",
    unit: "SQ",
    customer_unit_price_cents: 500,
    customer_line_total_cents: 12000,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    quantity_resolution_echo: matchingEcho(24),
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function draftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  const version: ProposalVersionRow = {
    id: VERSION_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    version_number: 1,
    version_kind: "draft",
    parent_version_id: null,
    frozen_at: null,
    context_echo: {},
    policy_echo: {},
    created_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
  };
  const option: ProposalOptionRow = {
    id: RUNTIME_OPT,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    source_template_option_id: TEMPLATE_OPT,
    name: "Standard",
    customer_label: "Standard",
    description: null,
    sort_order: 0,
    is_default: true,
    visible_to_customer: true,
    customer_subtotal_cents: 12000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 12000,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
  };
  return {
    proposal: proposal(),
    version,
    pages: [],
    options: [option],
    lineItems: [lineRow()],
    internalSummaries: [],
    scopeDecisions: [],
    ...overrides,
  };
}

function deps(overrides: Partial<LoadDraftQuantityResolutionPreflightDeps> = {}): LoadDraftQuantityResolutionPreflightDeps {
  const graph = draftGraph();
  return {
    getDraftGraph: async () => graph,
    getTemplateItems: async () => [templateItem(TI_A, CAT_A)],
    getCatalogItems: async () => [catalog(CAT_A)],
    getSelectedMeasurement: async () => measurement(24),
    ...overrides,
  };
}

describe("buildProposalQuantityPreviewContextFromPersistedMeasurement", () => {
  test("returns null when measurement missing", () => {
    assert.equal(buildProposalQuantityPreviewContextFromPersistedMeasurement(null), null);
  });

  test("builds handoff + quantity map from persisted measurement", () => {
    const ctx = buildProposalQuantityPreviewContextFromPersistedMeasurement(measurement(24));
    assert.ok(ctx);
    assert.equal(ctx!.measurementHandoff?.quantities.adjusted_roof_squares, 24);
    assert.ok(ctx!.quantityMap);
  });
});

describe("runDraftQuantityResolutionPreflight", () => {
  test("1. returns current when loaded data matches live adjusted inputs", async () => {
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      deps()
    );
    assert.ok(result);
    assert.equal(result!.status, "current");
    assert.equal(result!.currentCount, 1);
    assert.equal(result!.staleCount, 0);
    assert.equal(result!.identity?.proposalId, PROPOSAL_ID);
    assert.equal(result!.identity?.templateId, TEMPLATE_ID);
  });

  test("2. returns stale when persisted echo mismatches current adjusted input", async () => {
    const graph = draftGraph({
      lineItems: [lineRow({ quantity_resolution_echo: matchingEcho(20) })],
    });
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      deps({
        getDraftGraph: async () => {
          throw new Error("should use draftGraph override");
        },
      })
    );
    assert.ok(result);
    assert.equal(result!.status, "stale");
    assert.equal(result!.staleCount, 1);
    assert.ok(
      result!.byLineId[LINE_A]!.reasons.includes("resolved_purchase_quantity_mismatch")
    );
  });

  test("3. returns unknown when measurement/template/catalog data is missing", async () => {
    const missingTemplate = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      deps({ getTemplateItems: async () => null })
    );
    assert.ok(missingTemplate);
    assert.equal(missingTemplate!.status, "unknown");
    assert.ok(
      missingTemplate!.byLineId[LINE_A]!.reasons.includes("missing_current_echo")
    );

    const missingMeasurement = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      deps({ getSelectedMeasurement: async () => null })
    );
    assert.ok(missingMeasurement);
    assert.equal(missingMeasurement!.status, "unknown");

    const historical = await runDraftQuantityResolutionPreflight(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        draftGraph: draftGraph({
          lineItems: [lineRow({ quantity_resolution_echo: null })],
        }),
      },
      deps()
    );
    assert.ok(historical);
    assert.equal(historical!.status, "unknown");
    assert.ok(
      historical!.byLineId[LINE_A]!.reasons.includes("missing_persisted_echo")
    );
  });

  test("returns null when draft graph missing or not draft", async () => {
    const missing = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      deps({ getDraftGraph: async () => null })
    );
    assert.equal(missing, null);

    const sent = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      deps({
        getDraftGraph: async () =>
          draftGraph({ proposal: proposal({ status: "sent" }) }),
      })
    );
    assert.equal(sent, null);
  });

  test("4. does not write rows (loader module is read-assembly only)", () => {
    const src = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionPreflightLoad.ts"),
      "utf8"
    );
    assert.match(src, /no DB writes/i);
    assert.equal(src.includes(".insert("), false);
    assert.equal(src.includes(".upsert("), false);
    assert.equal(src.includes("refreshDraftPricing"), false);
    assert.equal(src.includes("from \"@/app/lib/supabase/server\""), false);
  });

  test("6. quantities/totals unchanged by loader/orchestrator", async () => {
    const line = lineRow({
      quantity: 24,
      customer_line_total_cents: 12000,
      quantity_resolution_echo: matchingEcho(20),
    });
    const graph = draftGraph({ lineItems: [line] });
    const before = {
      quantity: line.quantity,
      customer_line_total_cents: line.customer_line_total_cents,
    };
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      deps()
    );
    assert.equal(result!.status, "stale");
    assert.deepEqual(
      {
        quantity: line.quantity,
        customer_line_total_cents: line.customer_line_total_cents,
      },
      before
    );
  });

  test("7. raw/whole echo under default adjusted policy is flagged stale", async () => {
    const result = await runDraftQuantityResolutionPreflight(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        draftGraph: draftGraph({
          lineItems: [
            lineRow({
              quantity_resolution_echo: {
                ...matchingEcho(24),
                quantity_mode: "raw_plus_waste",
                rounding_mode_used: "whole",
                waste_pct_used: 10,
              },
            }),
          ],
        }),
      },
      deps()
    );
    assert.equal(result!.status, "stale");
    const reasons = result!.byLineId[LINE_A]!.reasons;
    assert.ok(reasons.includes("quantity_mode_mismatch"));
    assert.ok(reasons.includes("rounding_mode_mismatch"));
    assert.ok(reasons.includes("waste_pct_used_non_null"));
  });
});

describe("S3D8 loader boundaries", () => {
  test("5. does not expose preflight metadata to customer-safe snapshot/persist", async () => {
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      deps()
    );
    assert.equal(result!.status, "current");

    const SECTION = "88888888-8888-4888-8888-888888888888";
    const POLICY_ID = "55555555-5555-4555-8555-555555555555";
    const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";

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
      catalog_item_id: CAT_A,
      catalog_seed_key: null,
      section_id: SECTION,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: "standard" as const,
      quantity: 24,
      quantity_display_label: "24 SQ",
      quantity_source_label: "Measurement",
      unit: "SQ",
      customer_unit_price_cents: 500,
      customer_line_total_cents: 12000,
      engineStatus: "priced" as const,
      customerVisibility: "customer_visible" as const,
      catalogItemMissing: false,
      measurement_quantity_key: null,
      quantity_resolution_echo: matchingEcho(24),
      quantityResolutionPreflightServer: result,
      quantity_resolution_status: result!.status,
    } as LineItemSnapshotInput & {
      quantityResolutionPreflightServer?: unknown;
      quantity_resolution_status?: string;
    };

    const rows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      proposal_option_id: TEMPLATE_OPT,
      lines: [pollutedLine],
    });
    assert.equal(rows[0]!.quantity, 24);
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantityResolutionPreflightServer"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_echo"),
      false
    );

    const instantiateInput: DraftInstantiateInput = {
      company_id: COMPANY_ID,
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
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
          company_id: COMPANY_ID,
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
          company_id: COMPANY_ID,
          source_template_option_id: TEMPLATE_OPT,
          name: "Standard",
          customer_label: "Standard",
          description: null,
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 12000,
          discount_cents: 0,
          sales_tax_cents: 0,
          customer_total_cents: 12000,
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
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerId: CUSTOMER_ID,
      templateId: TEMPLATE_ID,
      measurementRecordId: null,
      pricingPolicyId: POLICY_ID,
      title: "Roof Proposal",
      createdBy: null,
      instantiatePayload,
      instantiateInput,
      policy,
    });

    const persistLine = payload.options[0]!.line_items[0]! as Record<string, unknown>;
    assert.ok(persistLine.quantity_resolution_echo);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistLine,
        "quantityResolutionPreflightServer"
      ),
      false
    );
  });

  test("8. no UI route/components referenced by loader or server wrapper modules", () => {
    const loadSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionPreflightLoad.ts"),
      "utf8"
    );
    const serverSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionPreflight.server.ts"),
      "utf8"
    );
    for (const src of [loadSrc, serverSrc]) {
      assert.equal(src.includes("app/tools/"), false);
      assert.equal(src.includes("ProposalBuilderClient"), false);
      assert.equal(src.includes('from "react"'), false);
    }
    assert.match(serverSrc, /server-only/);
    assert.match(serverSrc, /No DB writes/);
    assert.equal(serverSrc.includes("refreshDraftPricing"), false);
  });
});
