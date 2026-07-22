/**
 * S3D9 — quantity_resolution_echo read-back verification (unit tests).
 *
 * Stitches: create/refresh persist payload → simulated loaded line rows →
 * preflight orchestration (current / stale / unknown).
 *
 * No live DB. No production SQL. No UI.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionEchoReadBack.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementRecord } from "./measurementTypes";
import {
  buildDraftProposalCreatePersistPayload,
  type DraftProposalCreateLinePersistRow,
} from "./proposalDraftCreatePersistence";
import {
  buildDraftPricingRefreshPersistPayload,
  type DraftPricingRefreshLinePersistRow,
} from "./proposalDraftPricingRefreshPersistence";
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
  runDraftQuantityResolutionPreflight,
  type LoadDraftQuantityResolutionPreflightDeps,
} from "./proposalQuantityResolutionPreflightLoad";
import {
  buildLineItemSnapshots,
  type DraftInstantiateInput,
  type DraftInstantiatePayload,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
const POLICY_ID = "55555555-5555-4555-8555-555555555555";
const PROPOSAL_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";
const SECTION_ID = "88888888-8888-4888-8888-888888888888";
const RUNTIME_OPT = "99999999-9999-4999-8999-999999999991";
const TI_A = "99999999-9999-4999-8999-999999999999";
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OPTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const TEST_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
  subtotalOverrideCents: null,
};

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
    name: "Shingles",
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
    section_id: SECTION_ID,
    catalog_item_id: catalogItemId,
    item_role: "standard",
  };
}

function measurement(squares: number): MeasurementRecord {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
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

function instantiatePayload(): DraftInstantiatePayload {
  return {
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
        source_template_section_id: SECTION_ID,
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
}

function instantiateInput(echo: Record<string, unknown> | null): DraftInstantiateInput {
  return {
    company_id: COMPANY_ID,
    context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
    policy: {
      configured: true,
      policy: TEST_POLICY,
      pricingPolicyId: POLICY_ID,
      source: "company",
    },
    templateOptions: [],
    templateSections: [],
    optionPricing: [],
    lineItemsByTemplateOptionId: {
      [TEMPLATE_OPT]: [
        {
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          catalog_seed_key: null,
          section_id: SECTION_ID,
          sort_order: 0,
          customer_name: "Shingles",
          description: null,
          role: null,
          quantity: 22,
          quantity_display_label: "22 SQ",
          quantity_source_label: "Measurement",
          unit: "SQ",
          customer_unit_price_cents: 500,
          customer_line_total_cents: 10_000,
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          catalogItemMissing: false,
          measurement_quantity_key: null,
          quantity_resolution_echo: echo,
        },
      ],
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
}

/** Test-only: map persist row → loaded ProposalLineItemRow shape (simulates select *). */
function persistLineToLoadedRow(
  line: DraftProposalCreateLinePersistRow | DraftPricingRefreshLinePersistRow,
  overrides: Partial<ProposalLineItemRow> = {}
): ProposalLineItemRow {
  return {
    id: LINE_ID,
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT,
    source_template_item_id: line.source_template_item_id,
    catalog_item_id: line.catalog_item_id,
    catalog_seed_key: line.catalog_seed_key,
    section_id: line.section_id,
    page_id: "page_id" in line ? line.page_id ?? null : null,
    sort_order: line.sort_order,
    customer_name: line.customer_name,
    description: line.description,
    role: line.role,
    quantity: line.quantity,
    quantity_display_label: line.quantity_display_label,
    quantity_source_label: line.quantity_source_label,
    unit: line.unit,
    customer_unit_price_cents: line.customer_unit_price_cents,
    customer_line_total_cents: line.customer_line_total_cents,
    pricing_status: line.pricing_status,
    visible_to_customer: line.visible_to_customer,
    measurement_quantity_key: line.measurement_quantity_key,
    quantity_resolution_echo: line.quantity_resolution_echo ?? null,
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
    ...overrides,
  };
}

function draftGraphFromLoadedLine(line: ProposalLineItemRow): ProposalDraftGraph {
  const proposal: ProposalRecord = {
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
    pricing_policy_id: POLICY_ID,
    proposal_number: null,
    title: "Read-back draft",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
  };
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
    created_at: "2026-06-25T00:00:00.000Z",
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
    customer_subtotal_cents: 10_000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 10_000,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
  };
  return {
    proposal,
    version,
    pages: [],
    options: [option],
    lineItems: [line],
    internalSummaries: [],
    scopeDecisions: [],
  };
}

function preflightDeps(
  squares: number,
  graph: ProposalDraftGraph
): LoadDraftQuantityResolutionPreflightDeps {
  return {
    getDraftGraph: async () => graph,
    getTemplateItems: async () => [templateItem(TI_A, CAT_A)],
    getCatalogItems: async () => [catalog(CAT_A)],
    getSelectedMeasurement: async () => measurement(squares),
  };
}

describe("S3D9 quantity_resolution_echo read-back chain", () => {
  test("1. create persist → loaded row → preflight current when echo matches", async () => {
    const payload = buildDraftProposalCreatePersistPayload({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerId: CUSTOMER_ID,
      templateId: TEMPLATE_ID,
      measurementRecordId: null,
      pricingPolicyId: POLICY_ID,
      title: "Roof Proposal",
      createdBy: null,
      instantiatePayload: instantiatePayload(),
      instantiateInput: instantiateInput(matchingEcho(22)),
      policy: TEST_POLICY,
    });

    const persistLine = payload.options[0]!.line_items[0]!;
    assert.ok(persistLine.quantity_resolution_echo);
    assert.equal(persistLine.quantity, 22);
    assert.equal(persistLine.customer_line_total_cents, 10_000);

    const loaded = persistLineToLoadedRow(persistLine);
    assert.deepEqual(loaded.quantity_resolution_echo, persistLine.quantity_resolution_echo);

    const graph = draftGraphFromLoadedLine(loaded);
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      preflightDeps(22, graph)
    );

    assert.ok(result);
    assert.equal(result!.status, "current");
    assert.equal(result!.currentCount, 1);
    assert.equal(result!.staleCount, 0);
    assert.equal(result!.unknownCount, 0);
    assert.equal(loaded.quantity, 22);
    assert.equal(loaded.customer_line_total_cents, 10_000);
  });

  test("2. refresh persist → loaded row → preflight current when echo matches", async () => {
    const payload = buildDraftPricingRefreshPersistPayload({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      proposalVersionId: VERSION_ID,
      instantiatePayload: instantiatePayload(),
      instantiateInput: instantiateInput(matchingEcho(22)),
      existingOptions: [
        { id: OPTION_ID, source_template_option_id: TEMPLATE_OPT },
      ],
      pageIdBySection: new Map([[SECTION_ID, "page-1"]]),
      policy: TEST_POLICY,
      pricingPolicyId: POLICY_ID,
      measurementStamp: null,
    });

    const persistLine = payload.options[0]!.line_items[0]!;
    assert.ok(persistLine.quantity_resolution_echo);
    assert.equal(persistLine.quantity, 22);

    const loaded = persistLineToLoadedRow(persistLine, {
      proposal_option_id: OPTION_ID,
    });
    const graph = draftGraphFromLoadedLine(loaded);
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      preflightDeps(22, graph)
    );

    assert.ok(result);
    assert.equal(result!.status, "current");
    assert.deepEqual(
      loaded.quantity_resolution_echo,
      persistLine.quantity_resolution_echo
    );
  });

  test("3. create persist → loaded row → preflight stale on qty mismatch", async () => {
    const payload = buildDraftProposalCreatePersistPayload({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerId: CUSTOMER_ID,
      templateId: TEMPLATE_ID,
      measurementRecordId: null,
      pricingPolicyId: POLICY_ID,
      title: "Roof Proposal",
      createdBy: null,
      instantiatePayload: instantiatePayload(),
      instantiateInput: instantiateInput(matchingEcho(22)),
      policy: TEST_POLICY,
    });

    const loaded = persistLineToLoadedRow(payload.options[0]!.line_items[0]!);
    const beforeQty = loaded.quantity;
    const beforeTotal = loaded.customer_line_total_cents;
    const graph = draftGraphFromLoadedLine(loaded);

    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      preflightDeps(24, graph)
    );

    assert.ok(result);
    assert.equal(result!.status, "stale");
    assert.ok(
      result!.byLineId[LINE_ID]!.reasons.includes(
        "resolved_purchase_quantity_mismatch"
      )
    );
    assert.equal(loaded.quantity, beforeQty);
    assert.equal(loaded.customer_line_total_cents, beforeTotal);
  });

  test("4. historical missing echo → preflight unknown; customer snapshot still omits echo", async () => {
    const payload = buildDraftProposalCreatePersistPayload({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerId: CUSTOMER_ID,
      templateId: TEMPLATE_ID,
      measurementRecordId: null,
      pricingPolicyId: POLICY_ID,
      title: "Roof Proposal",
      createdBy: null,
      instantiatePayload: instantiatePayload(),
      instantiateInput: instantiateInput(null),
      policy: TEST_POLICY,
    });

    const persistLine = payload.options[0]!.line_items[0]!;
    assert.equal(persistLine.quantity_resolution_echo ?? null, null);

    const loaded = persistLineToLoadedRow(persistLine);
    const graph = draftGraphFromLoadedLine(loaded);
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      preflightDeps(22, graph)
    );

    assert.ok(result);
    assert.equal(result!.status, "unknown");
    assert.ok(
      result!.byLineId[LINE_ID]!.reasons.includes("missing_persisted_echo")
    );

    const customerRows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      proposal_option_id: RUNTIME_OPT,
      lines: [
        {
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          catalog_seed_key: null,
          section_id: SECTION_ID,
          sort_order: 0,
          customer_name: "Shingles",
          description: null,
          role: "standard",
          quantity: 22,
          quantity_display_label: "22 SQ",
          quantity_source_label: "Measurement",
          unit: "SQ",
          customer_unit_price_cents: 500,
          customer_line_total_cents: 10_000,
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          quantity_resolution_echo: matchingEcho(22),
        },
      ],
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        customerRows[0],
        "quantity_resolution_echo"
      ),
      false
    );
    assert.equal(customerRows[0]!.quantity, 22);
  });

  test("5. ProposalLineItemRow / load path can carry echo (select *); default path stays adjusted", async () => {
    const storeSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalRecordStore.ts"),
      "utf8"
    );
    assert.match(storeSrc, /from\("proposal_line_items"\)[\s\S]{0,80}\.select\("\*"\)/);
    assert.match(storeSrc, /quantity_resolution_echo\?:/);

    const row: ProposalLineItemRow = persistLineToLoadedRow({
      source_template_item_id: TI_A,
      catalog_item_id: CAT_A,
      catalog_seed_key: null,
      section_id: SECTION_ID,
      sort_order: 0,
      customer_name: "Shingles",
      description: null,
      role: null,
      quantity: 22,
      quantity_display_label: "22 SQ",
      quantity_source_label: "Measurement",
      unit: "SQ",
      customer_unit_price_cents: 500,
      customer_line_total_cents: 10_000,
      pricing_status: "priced",
      visible_to_customer: true,
      measurement_quantity_key: null,
      quantity_resolution_echo: {
        ...matchingEcho(22),
        quantity_mode: "raw_plus_waste",
        rounding_mode_used: "whole",
        waste_pct_used: 10,
      },
    });

    const graph = draftGraphFromLoadedLine(row);
    const result = await runDraftQuantityResolutionPreflight(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, draftGraph: graph },
      preflightDeps(22, graph)
    );
    assert.equal(result!.status, "stale");
    const reasons = result!.byLineId[LINE_ID]!.reasons;
    assert.ok(reasons.includes("quantity_mode_mismatch"));
    assert.ok(reasons.includes("rounding_mode_mismatch"));
  });

  test("6. S3D10 RPC migration includes quantity_resolution_echo on create/refresh line INSERTs", () => {
    // Read-only SQL text proof — does not run/apply SQL.
    const legacyCreateRpc = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260625_011_create_draft_proposal_create_rpc.sql"
      ),
      "utf8"
    );
    const legacyRefreshRpc = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260624_010_create_refresh_draft_pricing_rpc.sql"
      ),
      "utf8"
    );
    assert.equal(legacyCreateRpc.includes("quantity_resolution_echo"), false);
    assert.equal(legacyRefreshRpc.includes("quantity_resolution_echo"), false);

    const alignedRpc = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260716_022_include_quantity_resolution_echo_in_draft_rpcs.sql"
      ),
      "utf8"
    );
    assert.match(alignedRpc, /persist_draft_proposal_create_v1/);
    assert.match(alignedRpc, /persist_draft_pricing_refresh_v1/);
    assert.match(
      alignedRpc,
      /measurement_quantity_key,\s*quantity_resolution_echo/
    );
    assert.match(
      alignedRpc,
      /jsonb_typeof\(line->'quantity_resolution_echo'\) = 'object'/
    );
    // Both create + refresh line INSERTs must include the column.
    assert.equal(
      (alignedRpc.match(/quantity_resolution_echo/g) || []).length >= 4,
      true
    );

    const columnMigration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260716_021_add_quantity_resolution_fields.sql"
      ),
      "utf8"
    );
    assert.match(columnMigration, /quantity_resolution_echo jsonb null/);
  });

  test("7. S3D9 adds no production modules (test file only; no UI/store writers)", () => {
    // S3D9 is verification-only: no new production .ts beside this test.
    const prodCandidates = [
      "app/lib/proposalQuantityResolutionEchoReadBack.ts",
      "app/lib/proposalQuantityResolutionEchoReadBack.server.ts",
    ];
    for (const rel of prodCandidates) {
      try {
        readFileSync(path.join(process.cwd(), rel), "utf8");
        assert.fail(`unexpected production file: ${rel}`);
      } catch (err) {
        assert.equal((err as NodeJS.ErrnoException).code, "ENOENT");
      }
    }
  });
});
