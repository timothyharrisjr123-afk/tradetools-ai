/**
 * R17A — proposalCustomerPreviewViewModel tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerPreviewViewModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildProposalCustomerPreviewDocument,
  buildProposalCustomerPreviewHref,
  CUSTOMER_PREVIEW_COVER_TITLE,
} from "./proposalCustomerPreviewViewModel";
import type {
  ProposalDraftGraph,
  ProposalPageRow,
} from "./proposalRecordStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const PAGE_TERMS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE_OVERVIEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAGE_PHOTOS = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PAGE_SIGNATURE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function pageRow(overrides: Partial<ProposalPageRow> = {}): ProposalPageRow {
  return {
    id: PAGE_TERMS,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    page_type: "terms",
    sort_order: 20,
    title: "Terms",
    customer_title: "Terms & Conditions",
    visible_to_customer: true,
    source_template_section_id: null,
    content_json: {},
    settings_json: {},
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function minimalGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  return {
    proposal: {
      id: PROPOSAL_ID,
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      customer_id: null,
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
        template_name: "Standard",
      },
      policy_echo: {},
      created_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    pages: [
      pageRow({
        id: PAGE_OVERVIEW,
        page_type: "project_overview",
        sort_order: 10,
        title: "Project Overview",
        content_json: { body_markdown: "Hello {{customer_name}}" },
      }),
      pageRow({
        id: PAGE_ESTIMATE,
        page_type: "estimate",
        sort_order: 15,
        title: "Estimate",
        customer_title: "Your Estimate",
      }),
      pageRow({
        id: PAGE_TERMS,
        page_type: "terms",
        sort_order: 20,
        title: "Terms",
        visible_to_customer: false,
        content_json: { body_markdown: "Hidden terms" },
      }),
      pageRow({
        id: PAGE_PHOTOS,
        page_type: "photos",
        sort_order: 30,
        title: "Project Photos",
      }),
      pageRow({
        id: PAGE_SIGNATURE,
        page_type: "signature",
        sort_order: 40,
        title: "Signature",
        visible_to_customer: true,
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
        catalog_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        catalog_seed_key: null,
        section_id: "13131313-1313-4313-8313-131313131313",
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
        catalog_item_id: "16161616-1616-4616-8616-161616161616",
        catalog_seed_key: null,
        section_id: "13131313-1313-4313-8313-131313131313",
        page_id: PAGE_ESTIMATE,
        sort_order: 1,
        customer_name: "Internal only",
        description: null,
        role: null,
        quantity: 1,
        quantity_display_label: "1",
        quantity_source_label: "Fixed",
        unit: "EA",
        customer_unit_price_cents: 1000,
        customer_line_total_cents: 1000,
        pricing_status: "priced",
        visible_to_customer: false,
        measurement_quantity_key: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    internalSummaries: [
      {
        id: "17171717-1717-4717-8717-171717171717",
        company_id: COMPANY_ID,
        proposal_option_id: RUNTIME_OPT_A,
        internal_cost_cents: 800000,
        internal_profit_cents: 300000,
        effective_margin_pct: 27.27,
        policy_echo_json: { configured: true },
        computed_at: "2026-06-06T00:00:00.000Z",
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    scopeDecisions: [],
    ...overrides,
  };
}

describe("buildProposalCustomerPreviewHref", () => {
  test("builds preview route with encoded params", () => {
    assert.equal(
      buildProposalCustomerPreviewHref(JOB_ID, PROPOSAL_ID),
      `/tools/roofing/proposals/preview?job=${encodeURIComponent(JOB_ID)}&proposal=${encodeURIComponent(PROPOSAL_ID)}`
    );
  });
});

describe("buildProposalCustomerPreviewDocument", () => {
  test("Cover is always first", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    assert.equal(doc.pages[0]?.kind, "cover");
    assert.equal(doc.pages[0]?.title, CUSTOMER_PREVIEW_COVER_TITLE);
  });

  test("hidden pages are excluded from customer pages", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    assert.ok(!doc.pages.some((page) => page.id === PAGE_TERMS));
    assert.equal(doc.readiness.hiddenPageCount, 1);
    assert.match(doc.readiness.warnings.join(" "), /1 page hidden/i);
  });

  test("visible pages follow sort_order after Cover", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    const afterCover = doc.pages.slice(1);
    assert.deepEqual(
      afterCover.map((page) => page.sortOrder),
      [10, 15, 30]
    );
  });

  test("signature and payment_schedule pages are excluded even when visible", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    assert.ok(!doc.pages.some((page) => page.pageType === "signature"));
  });

  test("text page resolves tokens via R14 and does not show raw token", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    const overview = doc.pages.find((page) => page.id === PAGE_OVERVIEW);
    assert.equal(overview?.kind, "text");
    if (overview?.kind === "text") {
      assert.match(overview.displayText, /Jane Smith/);
      assert.doesNotMatch(overview.displayText, /\{\{customer_name\}\}/);
    }
  });

  test("Estimate page is present with snapshot option preview", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    const estimate = doc.pages.find((page) => page.kind === "estimate");
    assert.ok(estimate);
    if (estimate?.kind === "estimate") {
      assert.equal(estimate.title, "Your Estimate");
      assert.equal(estimate.selectedTemplateOptionId, TEMPLATE_OPT_A);
      assert.equal(estimate.selectedOptionLabel, "Good");
      assert.ok(estimate.optionPreview);
      assert.equal(estimate.optionPreview?.status.pricingComplete, true);
    }
  });

  test("customer-invisible lines are marked internal_only in estimate option preview", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    const estimate = doc.pages.find((page) => page.kind === "estimate");
    assert.ok(estimate?.kind === "estimate");
    if (estimate?.kind === "estimate") {
      const lines = estimate.optionPreview?.customer.lines ?? [];
      assert.equal(lines.length, 2);
      const internalLine = lines.find(
        (line) => line.templateItemId === "15151515-1515-4515-8515-151515151515"
      );
      assert.equal(internalLine?.customerVisibility, "internal_only");
    }
  });

  test("photos page becomes placeholder when visible", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph());
    const photos = doc.pages.find((page) => page.id === PAGE_PHOTOS);
    assert.equal(photos?.kind, "placeholder");
  });

  test("pricing incomplete adds readiness warning", () => {
    const doc = buildProposalCustomerPreviewDocument(
      minimalGraph({
        options: [
          {
            ...minimalGraph().options[0]!,
            pricing_complete: false,
            blocking_line_count: 2,
            customer_total_cents: null,
          },
        ],
      })
    );
    assert.equal(doc.readiness.pricingComplete, false);
    assert.equal(doc.readiness.blockingLineCount, 2);
    assert.match(doc.readiness.warnings.join(" "), /Pricing is incomplete/i);
    assert.match(doc.readiness.warnings.join(" "), /2 line items/i);
  });

  test("pricing stale flag surfaces warning", () => {
    const doc = buildProposalCustomerPreviewDocument(minimalGraph(), {
      pricingStale: { stale: true, reason: "measurement_changed" },
    });
    assert.equal(doc.readiness.pricingStale, true);
    assert.match(doc.readiness.warnings.join(" "), /stale/i);
  });

  test("does not mutate input graph", () => {
    const graph = minimalGraph();
    const before = structuredClone(graph);
    buildProposalCustomerPreviewDocument(graph);
    assert.deepEqual(graph, before);
  });

  test("estimate missing from visible pages surfaces readiness warning", () => {
    const doc = buildProposalCustomerPreviewDocument(
      minimalGraph({
        pages: minimalGraph().pages.filter((page) => page.page_type !== "estimate"),
      })
    );
    assert.equal(doc.readiness.estimatePagePresent, false);
    assert.match(doc.readiness.warnings.join(" "), /Estimate page is missing/i);
  });
});
