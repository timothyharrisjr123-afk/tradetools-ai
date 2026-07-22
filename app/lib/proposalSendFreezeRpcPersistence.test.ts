/**
 * R18B4A — proposalSendFreezeRpcPersistence tests.
 *
 * Run: npx tsx --test app/lib/proposalSendFreezeRpcPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { buildProposalSendFreezePersistPayload } from "./proposalSendFreezePersistence";
import type { ProposalDraftGraph, ProposalPageRow } from "./proposalRecordStore";
import {
  isProposalSendFreezeRpcEnabled,
  parseProposalSendFreezeRpcResult,
  PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1,
  persistProposalSendFreezeViaRpc,
  ProposalSendFreezeRpcPersistenceError,
} from "./proposalSendFreezeRpcPersistence";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const SENT_VERSION_ID = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FROZEN_AT = "2026-06-18T12:00:00.000Z";

function draftGraph(): ProposalDraftGraph {
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
        id: PAGE_ESTIMATE,
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        page_type: "estimate",
        sort_order: 0,
        title: "Estimate",
        customer_title: null,
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: {},
        settings_json: { show_line_prices: true, show_option_totals: true },
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
        description: null,
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
    ],
    internalSummaries: [],
    scopeDecisions: [],
  };
}

function rpcSuccessData(payload: ReturnType<typeof buildProposalSendFreezePersistPayload>) {
  return {
    ok: true,
    proposal_id: payload.proposal_id,
    draft_version_id: payload.draft_version_id,
    sent_version_id: payload.sent_version_id,
    version_number: payload.version_number,
    page_count: payload.pages.length,
    option_count: payload.options.length,
    latest_sent_version_id: payload.sent_version_id,
  };
}

describe("isProposalSendFreezeRpcEnabled", () => {
  const original = process.env.USE_PROPOSAL_SEND_FREEZE_RPC;

  test("default OFF unless USE_PROPOSAL_SEND_FREEZE_RPC is exactly 1", () => {
    delete process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
    assert.equal(isProposalSendFreezeRpcEnabled(), false);
    process.env.USE_PROPOSAL_SEND_FREEZE_RPC = "true";
    assert.equal(isProposalSendFreezeRpcEnabled(), false);
    process.env.USE_PROPOSAL_SEND_FREEZE_RPC = "1";
    assert.equal(isProposalSendFreezeRpcEnabled(), true);
  });

  test.after(() => {
    if (original === undefined) {
      delete process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
    } else {
      process.env.USE_PROPOSAL_SEND_FREEZE_RPC = original;
    }
  });
});

describe("parseProposalSendFreezeRpcResult", () => {
  test("parses valid response matching payload", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const parsed = parseProposalSendFreezeRpcResult(rpcSuccessData(payload), payload);
    assert.equal(parsed.sent_version_id, SENT_VERSION_ID);
    assert.equal(parsed.version_number, payload.version_number);
  });

  test("rejects missing data", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.throws(
      () => parseProposalSendFreezeRpcResult(null, payload),
      /returned no result/
    );
  });

  test("rejects ok !== true", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    assert.throws(
      () => parseProposalSendFreezeRpcResult({ ok: false }, payload),
      /ok !== true/
    );
  });

  test("rejects mismatched sent_version_id", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const data = rpcSuccessData(payload);
    data.sent_version_id = "f9999999-9999-4999-8999-999999999999";
    assert.throws(
      () => parseProposalSendFreezeRpcResult(data, payload),
      /sent_version_id mismatch/
    );
  });
});

describe("persistProposalSendFreezeViaRpc", () => {
  test("calls rpc with exact p_payload", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | undefined;
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });

    const supabase = {
      rpc: async (name: string, args: { p_payload: unknown }) => {
        rpcName = name;
        rpcArgs = args as Record<string, unknown>;
        return { data: rpcSuccessData(payload), error: null };
      },
    };

    await persistProposalSendFreezeViaRpc(supabase as never, payload);
    assert.equal(rpcName, PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1);
    assert.deepEqual(rpcArgs?.p_payload, payload);
    assert.ok(
      (rpcArgs?.p_payload as { pages: { client_page_id: string }[] }).pages[0]?.client_page_id
    );
    assert.ok(!("scope_decisions" in (rpcArgs?.p_payload as object)));
    assert.ok(!("public_token" in (rpcArgs?.p_payload as object)));
  });

  test("surfaces RPC failure as persistence error", async () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "permission denied" } }),
    };

    await assert.rejects(
      () => persistProposalSendFreezeViaRpc(supabase as never, payload),
      ProposalSendFreezeRpcPersistenceError
    );
  });

  test("rejects malformed RPC response", async () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: FROZEN_AT,
      sentVersionId: SENT_VERSION_ID,
    });
    const supabase = {
      rpc: async () => ({ data: { ok: true, proposal_id: "not-a-uuid" }, error: null }),
    };

    await assert.rejects(
      () => persistProposalSendFreezeViaRpc(supabase as never, payload),
      ProposalSendFreezeRpcPersistenceError
    );
  });
});

describe("R18B4A RPC guardrails", () => {
  test("module has no route/token/legacy approve references", () => {
    const source = readFileSync(
      new URL("./proposalSendFreezeRpcPersistence.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /\/approve\/|app\/lib\/kv/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_/);
    assert.doesNotMatch(source, /persistProposalSendFreezeSequential/);
    assert.doesNotMatch(source, /public_token|send_email|payment/);
  });
});
