/**
 * 3J3D — proposalDraftGraphAdapter tests.
 *
 * Run: npx tsx --test app/lib/proposalDraftGraphAdapter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "./proposalLineSnapshotTypes";
import type {
  ProposalDraftGraph,
  ProposalInternalSummaryRow,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalPageRow,
  ProposalVersionRow,
} from "./proposalRecordStore";
import type { ProposalRecord } from "./proposalRecordTypes";
import {
  adaptProposalDraftGraphToBuilderPreview,
  mapSnapshotPricingStatusToBuilderDisplayStatus,
  resolveSelectedTemplateOptionIdFromGraph,
  validateProposalDraftGraphForJob,
} from "./proposalDraftGraphAdapter";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_JOB_ID = "44444444-4444-4444-8444-444444444444";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const RUNTIME_OPT_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ITEM_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    selected_option_id: RUNTIME_OPT_A,
    measurement_record_id: null,
    pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    proposal_number: null,
    title: "Persisted draft",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function versionRow(): ProposalVersionRow {
  return {
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
}

function optionRow(overrides: Partial<ProposalOptionRow> = {}): ProposalOptionRow {
  return {
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
    ...overrides,
  };
}

function lineRow(overrides: Partial<ProposalLineItemRow> = {}): ProposalLineItemRow {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT_A,
    source_template_item_id: TEMPLATE_ITEM_1,
    catalog_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    catalog_seed_key: null,
    section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    page_id: null,
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
    ...overrides,
  };
}

function summaryRow(
  overrides: Partial<ProposalInternalSummaryRow> = {}
): ProposalInternalSummaryRow {
  return {
    id: "12121212-1212-4212-8212-121212121212",
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT_A,
    internal_cost_cents: 800000,
    internal_profit_cents: 300000,
    effective_margin_pct: 27.27,
    policy_echo_json: { configured: true },
    computed_at: "2026-06-06T00:00:00.000Z",
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function draftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  return {
    proposal: proposal(),
    version: versionRow(),
    pages: [] as ProposalPageRow[],
    options: [optionRow()],
    lineItems: [lineRow()],
    internalSummaries: [summaryRow()],
    ...overrides,
  };
}

describe("mapSnapshotPricingStatusToBuilderDisplayStatus", () => {
  test("maps known snapshot statuses", () => {
    assert.equal(mapSnapshotPricingStatusToBuilderDisplayStatus("priced"), "priced");
    assert.equal(mapSnapshotPricingStatusToBuilderDisplayStatus("needs_quantity"), "needs_quantity");
  });

  test("unknown status falls back to not_priced", () => {
    assert.equal(mapSnapshotPricingStatusToBuilderDisplayStatus("bogus"), "not_priced");
  });
});

describe("resolveSelectedTemplateOptionIdFromGraph", () => {
  test("maps selected_option_id runtime id to template option id", () => {
    const graph = draftGraph({
      options: [
        optionRow({ id: RUNTIME_OPT_A, source_template_option_id: TEMPLATE_OPT_A }),
        optionRow({
          id: RUNTIME_OPT_B,
          source_template_option_id: TEMPLATE_OPT_B,
          is_default: false,
          sort_order: 1,
        }),
      ],
      proposal: proposal({ selected_option_id: RUNTIME_OPT_B }),
    });
    assert.equal(resolveSelectedTemplateOptionIdFromGraph(graph), TEMPLATE_OPT_B);
  });
});

describe("validateProposalDraftGraphForJob", () => {
  test("rejects wrong job", () => {
    const result = validateProposalDraftGraphForJob(draftGraph(), OTHER_JOB_ID);
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.message, /does not belong/i);
    }
  });

  test("accepts matching job", () => {
    assert.equal(validateProposalDraftGraphForJob(draftGraph(), JOB_ID).valid, true);
  });
});

describe("adaptProposalDraftGraphToBuilderPreview", () => {
  test("maps options to Builder option list keyed by template option id", () => {
    const graph = draftGraph({
      options: [
        optionRow({ source_template_option_id: TEMPLATE_OPT_A }),
        optionRow({
          id: RUNTIME_OPT_B,
          source_template_option_id: TEMPLATE_OPT_B,
          is_default: false,
          sort_order: 1,
          name: "Option B",
        }),
      ],
      lineItems: [
        lineRow({ proposal_option_id: RUNTIME_OPT_A }),
        lineRow({
          id: "13131313-1313-4313-8313-131313131313",
          proposal_option_id: RUNTIME_OPT_B,
          source_template_item_id: "14141414-1414-4414-8414-141414141414",
        }),
      ],
      internalSummaries: [
        summaryRow(),
        summaryRow({
          id: "15151515-1515-4515-8515-151515151515",
          proposal_option_id: RUNTIME_OPT_B,
          internal_cost_cents: 100,
          internal_profit_cents: 50,
          effective_margin_pct: 33.33,
        }),
      ],
    });

    const adapted = adaptProposalDraftGraphToBuilderPreview(graph);
    assert.deepEqual(adapted.pricingPreview.optionIds.sort(), [TEMPLATE_OPT_A, TEMPLATE_OPT_B].sort());
    assert.equal(adapted.selectedTemplateOptionId, TEMPLATE_OPT_A);
    assert.equal(adapted.templateId, TEMPLATE_ID);
    assert.equal(adapted.pricingPolicyConfigured, true);
  });

  test("line items map to customer-safe lines without forbidden keys", () => {
    const adapted = adaptProposalDraftGraphToBuilderPreview(draftGraph());
    const optionPreview = adapted.pricingPreview.byOptionId[TEMPLATE_OPT_A];
    assert.ok(optionPreview);
    const line = optionPreview.customer.lineByTemplateItemId[TEMPLATE_ITEM_1];
    assert.ok(line);
    assert.equal(line.displayStatus, "priced");
    assert.equal(line.customerLinePriceCents, 1100000);

    for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
      assert.equal(key in line, false);
    }
  });

  test("internal summaries stay on option.internal only", () => {
    const adapted = adaptProposalDraftGraphToBuilderPreview(draftGraph());
    const optionPreview = adapted.pricingPreview.byOptionId[TEMPLATE_OPT_A];
    assert.equal(optionPreview.internal.internalCostCents, 800000);
    assert.equal(optionPreview.internal.internalProfitCents, 300000);
    assert.equal(optionPreview.internal.effectiveMarginPct, 27.27);

    const line = optionPreview.customer.lines[0]!;
    assert.equal("internal_cost_cents" in line, false);
    assert.equal("internal_profit_cents" in line, false);
    assert.equal("margin_pct" in line, false);
  });

  test("omitted lines map safely", () => {
    const adapted = adaptProposalDraftGraphToBuilderPreview(
      draftGraph({
        lineItems: [
          lineRow({
            pricing_status: "omitted",
            visible_to_customer: false,
            customer_line_total_cents: null,
          }),
        ],
      })
    );
    const line =
      adapted.pricingPreview.byOptionId[TEMPLATE_OPT_A]!.customer.lines[0]!;
    assert.equal(line.displayStatus, "omitted");
    assert.equal(line.showPrice, false);
  });

  test("empty graph options still returns structure without throwing", () => {
    const adapted = adaptProposalDraftGraphToBuilderPreview(
      draftGraph({ options: [], lineItems: [], internalSummaries: [] })
    );
    assert.deepEqual(adapted.pricingPreview.optionIds, []);
  });
});
