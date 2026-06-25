/**
 * R18B1 — proposalSendFreezeReadiness tests.
 *
 * Run: npx tsx --test app/lib/proposalSendFreezeReadiness.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { deriveProposalSendFreezeReadiness } from "./proposalSendFreezeReadiness";
import type { ProposalDraftGraph, ProposalPageRow } from "./proposalRecordStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE_OVERVIEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function pageRow(overrides: Partial<ProposalPageRow> = {}): ProposalPageRow {
  return {
    id: PAGE_OVERVIEW,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    page_type: "project_overview",
    sort_order: 10,
    title: "Overview",
    customer_title: null,
    visible_to_customer: true,
    source_template_section_id: null,
    content_json: {},
    settings_json: {},
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function readyGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  return {
    proposal: {
      id: PROPOSAL_ID,
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      customer_id: "88888888-8888-4888-8888-888888888888",
      template_id: TEMPLATE_ID,
      status: "draft",
      current_draft_version_id: VERSION_ID,
      latest_sent_version_id: null,
      signed_version_id: null,
      selected_option_id: RUNTIME_OPT_A,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: "P-1",
      title: "Draft",
      created_by: null,
      updated_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: VERSION_ID,
      company_id: COMPANY_ID,
      proposal_id: PROPOSAL_ID,
      version_number: 1,
      version_kind: "draft",
      parent_version_id: null,
      frozen_at: null,
      context_echo: {
        customer_name: "Jane Smith",
        company_name: "Summit Roofing",
        address_formatted: "123 Main St",
        company_logo_url: "https://example.com/logo.png",
      },
      policy_echo: { configured: true },
      created_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    pages: [
      pageRow(),
      pageRow({
        id: PAGE_ESTIMATE,
        page_type: "estimate",
        sort_order: 15,
        title: "Estimate",
        settings_json: { show_line_prices: true },
      }),
    ],
    options: [
      {
        id: RUNTIME_OPT_A,
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Option A",
        customer_label: "Good",
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 800,
        customer_total_cents: 10800,
        pricing_complete: true,
        blocking_line_count: 0,
        guardrail_outcome: "pass",
        selected_at: "2026-06-06T00:00:00.000Z",
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    lineItems: [
      {
        id: "12121212-1212-4212-8212-121212121212",
        company_id: COMPANY_ID,
        proposal_option_id: RUNTIME_OPT_A,
        source_template_item_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        catalog_item_id: null,
        catalog_seed_key: null,
        section_id: null,
        page_id: PAGE_ESTIMATE,
        sort_order: 0,
        customer_name: "Shingles",
        description: null,
        role: null,
        quantity: 22,
        quantity_display_label: "22 SQ",
        quantity_source_label: "Measurement",
        unit: "SQ",
        customer_unit_price_cents: 50000,
        customer_line_total_cents: 1100000,
        pricing_status: "priced",
        visible_to_customer: true,
        measurement_quantity_key: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
      {
        id: "14141414-1414-4414-8414-141414141414",
        company_id: COMPANY_ID,
        proposal_option_id: RUNTIME_OPT_A,
        source_template_item_id: "15151515-1515-4515-8515-151515151515",
        catalog_item_id: null,
        catalog_seed_key: null,
        section_id: null,
        page_id: PAGE_ESTIMATE,
        sort_order: 1,
        customer_name: "Hidden line",
        description: null,
        role: null,
        quantity: 1,
        quantity_display_label: "1",
        quantity_source_label: null,
        unit: "EA",
        customer_unit_price_cents: 1000,
        customer_line_total_cents: 1000,
        pricing_status: "priced",
        visible_to_customer: false,
        measurement_quantity_key: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
      {
        id: "16161616-1616-4616-8616-161616161616",
        company_id: COMPANY_ID,
        proposal_option_id: RUNTIME_OPT_A,
        source_template_item_id: "17171717-1717-4717-8717-171717171717",
        catalog_item_id: null,
        catalog_seed_key: null,
        section_id: null,
        page_id: PAGE_ESTIMATE,
        sort_order: 2,
        customer_name: "Excluded",
        description: null,
        role: null,
        quantity: null,
        quantity_display_label: "",
        quantity_source_label: null,
        unit: null,
        customer_unit_price_cents: null,
        customer_line_total_cents: null,
        pricing_status: "omitted",
        visible_to_customer: true,
        measurement_quantity_key: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    internalSummaries: [],
    scopeDecisions: [],
    ...overrides,
  };
}

describe("deriveProposalSendFreezeReadiness", () => {
  test("ready draft passes", () => {
    const result = deriveProposalSendFreezeReadiness({ graph: readyGraph() });
    assert.equal(result.ready, true);
    assert.equal(result.blockingReasons.length, 0);
    assert.equal(result.summary.selectedTemplateOptionId, TEMPLATE_OPT_A);
    assert.equal(result.summary.displaySettingsResolvable, true);
  });

  test("missing draft version blocks", () => {
    const graph = readyGraph({
      proposal: { ...readyGraph().proposal, current_draft_version_id: null },
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /draft version/i.test(r)));
  });

  test("non-draft version blocks", () => {
    const graph = readyGraph({
      version: { ...readyGraph().version, version_kind: "sent", frozen_at: "2026-06-07T00:00:00.000Z" },
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /draft version/i.test(r)));
  });

  test("pricing incomplete blocks", () => {
    const graph = readyGraph({
      options: [
        {
          ...readyGraph().options[0]!,
          pricing_complete: false,
          blocking_line_count: 2,
        },
      ],
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /pricing is incomplete/i.test(r)));
    assert.ok(result.blockingReasons.some((r) => /blocking line/i.test(r)));
  });

  test("missing estimate page blocks", () => {
    const graph = readyGraph({
      pages: readyGraph().pages.filter((page) => page.page_type !== "estimate"),
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /estimate page/i.test(r)));
  });

  test("no customer-visible pages blocks", () => {
    const graph = readyGraph({
      pages: readyGraph().pages.map((page) => ({ ...page, visible_to_customer: false })),
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /customer-visible pages/i.test(r)));
  });

  test("missing customer identity blocks", () => {
    const graph = readyGraph({
      proposal: { ...readyGraph().proposal, customer_id: null },
      version: {
        ...readyGraph().version,
        context_echo: { company_name: "Summit Roofing", address_formatted: "123 Main" },
      },
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /customer identity/i.test(r)));
  });

  test("missing company identity blocks", () => {
    const graph = readyGraph({
      version: {
        ...readyGraph().version,
        context_echo: { customer_name: "Jane", address_formatted: "123 Main" },
      },
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, false);
    assert.ok(result.blockingReasons.some((r) => /company identity/i.test(r)));
  });

  test("missing site address warns", () => {
    const graph = readyGraph({
      version: {
        ...readyGraph().version,
        context_echo: {
          customer_name: "Jane Smith",
          company_name: "Summit Roofing",
        },
      },
    });
    const result = deriveProposalSendFreezeReadiness({ graph });
    assert.equal(result.ready, true);
    assert.ok(result.warnings.some((w) => /address/i.test(w)));
  });

  test("hidden/excluded summary computed", () => {
    const result = deriveProposalSendFreezeReadiness({ graph: readyGraph() });
    assert.equal(result.summary.scopeSummary.hiddenLineCount, 1);
    assert.equal(result.summary.scopeSummary.excludedLineCount, 1);
    assert.ok(result.warnings.some((w) => /hidden from customer/i.test(w)));
    assert.ok(result.warnings.some((w) => /excluded line/i.test(w)));
  });

  test("pricing stale warns only", () => {
    const result = deriveProposalSendFreezeReadiness({
      graph: readyGraph(),
      pricingStale: true,
    });
    assert.equal(result.ready, true);
    assert.ok(result.warnings.some((w) => /stale/i.test(w)));
  });
});

describe("R18B1 readiness guardrails", () => {
  test("module has no Supabase/RPC/legacy approve references", () => {
    const source = readFileSync(new URL("./proposalSendFreezeReadiness.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /getSupabaseClient|persist_proposal|\/approve\//);
    assert.doesNotMatch(source, /app\/lib\/kv/);
  });
});
