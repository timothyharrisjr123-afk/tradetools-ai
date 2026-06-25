/**
 * R18B1 — proposalSendFreezePersistence tests.
 *
 * Run: npx tsx --test app/lib/proposalSendFreezePersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  buildProposalSendFreezePersistPayload,
  buildSendFreezeGraphLikeFromPayload,
  PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE,
  validateProposalSendFreezePersistPayload,
  validateSendFreezeGraphIntegrity,
} from "./proposalSendFreezePersistence";
import type { ProposalDraftGraph, ProposalPageRow } from "./proposalRecordStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const SENT_VERSION_ID = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE_OVERVIEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FROZEN_AT = "2026-06-18T12:00:00.000Z";

function draftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
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
      context_echo: { customer_name: "Jane", company_name: "Summit" },
      policy_echo: { configured: true },
      created_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    pages: [
      {
        id: PAGE_OVERVIEW,
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        page_type: "project_overview",
        sort_order: 10,
        title: "Overview",
        customer_title: null,
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: { body_markdown: "Hello" },
        settings_json: {},
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      } satisfies ProposalPageRow,
      {
        id: PAGE_ESTIMATE,
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        page_type: "estimate",
        sort_order: 15,
        title: "Estimate",
        customer_title: "Your Estimate",
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: {},
        settings_json: { show_line_prices: false, show_option_totals: true },
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      } satisfies ProposalPageRow,
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
        selected_at: null,
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
        customer_name: "Visible",
        description: null,
        role: null,
        quantity: 1,
        quantity_display_label: "1",
        quantity_source_label: null,
        unit: "EA",
        customer_unit_price_cents: 10000,
        customer_line_total_cents: 10000,
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
        customer_name: "Hidden",
        description: null,
        role: null,
        quantity: 1,
        quantity_display_label: "1",
        quantity_source_label: null,
        unit: "EA",
        customer_unit_price_cents: 500,
        customer_line_total_cents: 500,
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
    internalSummaries: [
      {
        id: "17171717-1717-4717-8717-171717171717",
        company_id: COMPANY_ID,
        proposal_option_id: RUNTIME_OPT_A,
        internal_cost_cents: 5000,
        internal_profit_cents: 5000,
        effective_margin_pct: 50,
        policy_echo_json: { configured: true },
        computed_at: "2026-06-06T00:00:00.000Z",
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    scopeDecisions: [
      {
        id: "18181818-1818-4818-8818-181818181818",
        company_id: COMPANY_ID,
        proposal_id: PROPOSAL_ID,
        proposal_version_id: VERSION_ID,
        proposal_option_id: RUNTIME_OPT_A,
        decision_type: "excluded",
        source_template_item_id: "17171717-1717-4717-8717-171717171717",
        instance_line_key: null,
        payload_json: {},
        active: true,
        created_by: null,
        updated_by: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("buildProposalSendFreezePersistPayload", () => {
  test("deep-copy payload does not mutate source graph", () => {
    const graph = draftGraph();
    const snapshot = structuredClone(graph);
    const payload = buildProposalSendFreezePersistPayload(graph, {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
      idFactory: () => "page-id-placeholder",
    });
    payload.pages[0]!.title = "MUTATED";
    payload.options[0]!.customer_total_cents = 1;
    assert.deepEqual(graph, snapshot);
    assert.notEqual(graph.pages[0]!.title, "MUTATED");
  });

  test("version number increments from existing versions", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      existingVersionNumbers: [1, 3, 5],
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.version_number, 6);
  });

  test("sent version uses sent kind and frozen_at", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.version_kind, "sent");
    assert.equal(payload.frozen_at, FROZEN_AT);
    assert.equal(payload.parent_version_id, VERSION_ID);
    assert.equal(payload.draft_version_id, VERSION_ID);
  });

  test("pages copied with settings_json and visibility", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const estimate = payload.pages.find((page) => page.page_type === "estimate");
    assert.ok(estimate);
    assert.deepEqual(estimate!.settings_json, {
      show_line_prices: false,
      show_option_totals: true,
    });
    assert.equal(estimate!.visible_to_customer, true);
  });

  test("options copied with totals exactly", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.options[0]!.customer_subtotal_cents, 10000);
    assert.equal(payload.options[0]!.customer_total_cents, 10800);
    assert.equal(payload.options[0]!.sales_tax_cents, 800);
  });

  test("lines copied with visible_to_customer and omitted state preserved", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const lines = payload.options[0]!.line_items;
    assert.equal(lines.length, 3);
    const hidden = lines.find((line) => line.customer_name === "Hidden");
    const excluded = lines.find((line) => line.customer_name === "Excluded");
    assert.equal(hidden?.visible_to_customer, false);
    assert.equal(excluded?.pricing_status, "omitted");
  });

  test("internal summaries copied as contractor-only", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.options[0]!.internal_summary?.contractor_only, true);
    assert.equal(payload.options[0]!.internal_summary?.internal_cost_cents, 5000);
  });

  test("scope decision rows are not copied to payload", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.ok(!("scope_decisions" in payload));
    assert.ok(!("scopeDecisions" in payload));
  });

  test("selected_template_option_id preserved", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.selected_template_option_id, TEMPLATE_OPT_A);
    assert.equal(payload.event.payload_json.selected_template_option_id, TEMPLATE_OPT_A);
  });

  test("event payload prepared for snapshot_frozen", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.equal(payload.event.event_type, PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE);
    assert.equal(payload.event.payload_json.reason, "send_freeze_v1");
    assert.equal(payload.event.payload_json.delivery, false);
  });

  test("validateProposalSendFreezePersistPayload accepts valid payload", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.doesNotThrow(() => validateProposalSendFreezePersistPayload(payload));
    assert.equal(validateSendFreezeGraphIntegrity(payload).length, 0);
  });

  test("buildSendFreezeGraphLikeFromPayload preserves sent metadata", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const like = buildSendFreezeGraphLikeFromPayload(payload);
    assert.equal(like.version.version_kind, "sent");
    assert.equal(like.version.frozen_at, FROZEN_AT);
    assert.equal(like.options.length, 1);
  });
});

describe("R18B1 persistence guardrails", () => {
  test("module has no RPC/Supabase/legacy approve references", () => {
    const source = readFileSync(new URL("./proposalSendFreezePersistence.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /getSupabaseClient|persistDraft|persist_proposal_send_freeze_v1\s*\(/);
    assert.doesNotMatch(source, /\/approve\/|app\/lib\/kv/);
    assert.doesNotMatch(source, /\/tools\/roofing\/proposals\/preview|\/p\/\[|generatePublicToken/);
  });
});
