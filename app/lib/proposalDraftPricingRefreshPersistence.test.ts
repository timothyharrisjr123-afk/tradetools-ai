/**
 * R2A — Draft pricing refresh persistence foundation tests.
 *
 * Run: npx tsx --test app/lib/proposalDraftPricingRefreshPersistence.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildDraftPricingRefreshGraphSnapshotFromTables,
  buildDraftPricingRefreshPersistPayload,
  DRAFT_PRICING_REFRESH_ATOMIC_TABLES,
  PERSIST_DRAFT_PRICING_REFRESH_RPC_V1,
  persistDraftPricingRefreshSequential,
  persistDraftPricingRefreshViaRpc,
  ProposalDraftPricingRefreshPersistenceError,
  REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION,
  validateDraftPricingRefreshGraphIntegrity,
} from "./proposalDraftPricingRefreshPersistence";
import type { DraftInstantiateInput, DraftInstantiatePayload } from "./proposalSnapshotBuilder";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";

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

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const OPTION_ID = "44444444-4444-4444-8444-444444444444";
const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";

function minimalInstantiatePayload(): DraftInstantiatePayload {
  return {
    contextEcho: {},
    policyEcho: { configured: true },
    pages: [],
    options: [
      {
        company_id: COMPANY_ID,
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
    events: [],
  };
}

function minimalInstantiateInput(): DraftInstantiateInput {
  return {
    companyId: COMPANY_ID,
    graph: {
      template: {
        id: "tpl",
        company_id: COMPANY_ID,
        name: "T",
        status: "active",
      },
      options: [],
      sections: [],
      items: [],
    },
    catalogItems: [],
    quantityContext: null,
    preview: {
      selectedOptionId: TEMPLATE_OPT,
      byOptionId: {},
      options: [],
    },
    policy: TEST_POLICY,
    pricingPolicyId: "policy-1",
    context: { job_id: "job", template_id: "tpl" },
    selectedTemplateOptionId: TEMPLATE_OPT,
    lineItemsByTemplateOptionId: {
      [TEMPLATE_OPT]: [
        {
          source_template_item_id: "item-1",
          catalog_item_id: "cat-1",
          catalog_seed_key: null,
          section_id: "sec-1",
          page_id: null,
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
    computedAt: "2026-06-24T00:00:00.000Z",
  };
}

describe("draft pricing refresh persistence contract", () => {
  test("documents atomic table bundle for RPC", () => {
    assert.deepEqual(DRAFT_PRICING_REFRESH_ATOMIC_TABLES, [
      "proposal_options",
      "proposal_line_items",
      "proposal_internal_summaries",
      "proposal_versions",
      "proposals",
      "proposal_events",
    ]);
  });

  test("documents sequential per-option write order before RPC is live", () => {
    assert.equal(REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION.length, 5);
    assert.equal(REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION[0], "proposal_options.update");
    assert.equal(
      REFRESH_DRAFT_PRICING_SEQUENTIAL_STEPS_PER_OPTION[1],
      "proposal_line_items.delete"
    );
  });

  test("buildDraftPricingRefreshPersistPayload maps option lines and internal summary", () => {
    const payload = buildDraftPricingRefreshPersistPayload({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      proposalVersionId: VERSION_ID,
      instantiatePayload: minimalInstantiatePayload(),
      instantiateInput: minimalInstantiateInput(),
      existingOptions: [
        { id: OPTION_ID, source_template_option_id: TEMPLATE_OPT },
      ],
      pageIdBySection: new Map([["sec-1", "page-1"]]),
      policy: TEST_POLICY,
      pricingPolicyId: "policy-1",
      measurementStamp: null,
    });

    assert.equal(payload.company_id, COMPANY_ID);
    assert.equal(payload.options.length, 1);
    assert.equal(payload.options[0]!.proposal_option_id, OPTION_ID);
    assert.equal(payload.options[0]!.line_items.length, 1);
    assert.equal(payload.options[0]!.line_items[0]!.page_id, "page-1");
    assert.ok(payload.options[0]!.internal_summary);
    assert.equal(payload.event.event_type, "draft_saved");
  });

  test("graph integrity detects option totals without lines corruption", () => {
    const violations = validateDraftPricingRefreshGraphIntegrity([
      {
        proposal_option_id: OPTION_ID,
        pricing_complete: true,
        blocking_line_count: 0,
        customer_subtotal_cents: 10_000,
        customer_total_cents: 10_000,
        line_count: 0,
        priced_line_count: 0,
        has_internal_summary: false,
      },
    ]);

    assert.ok(violations.length >= 2);
    assert.ok(violations.some((v) => v.code === "option_totals_without_lines"));
    assert.ok(violations.some((v) => v.code === "priced_subtotal_without_priced_lines"));
  });

  test("buildDraftPricingRefreshGraphSnapshotFromTables reads table rows", () => {
    const snapshot = buildDraftPricingRefreshGraphSnapshotFromTables({
      options: [
        {
          id: OPTION_ID,
          pricing_complete: true,
          blocking_line_count: 0,
          customer_subtotal_cents: 5000,
          customer_total_cents: 5000,
        },
      ],
      lineItems: [
        {
          proposal_option_id: OPTION_ID,
          pricing_status: "priced",
          customer_line_total_cents: 5000,
        },
      ],
      internalSummaries: [{ proposal_option_id: OPTION_ID }],
    });

    assert.equal(snapshot[0]!.line_count, 1);
    assert.equal(snapshot[0]!.priced_line_count, 1);
    assert.equal(snapshot[0]!.has_internal_summary, true);
    assert.equal(validateDraftPricingRefreshGraphIntegrity(snapshot).length, 0);
  });
});

describe("persistDraftPricingRefreshViaRpc", () => {
  test("calls rpc with payload and throws on error", async () => {
    let rpcPayload: unknown;
    const supabase = {
      rpc: async (name: string, args: { p_payload: unknown }) => {
        assert.equal(name, PERSIST_DRAFT_PRICING_REFRESH_RPC_V1);
        rpcPayload = args.p_payload;
        return { error: null };
      },
    };

    const payload = buildDraftPricingRefreshPersistPayload({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      proposalVersionId: VERSION_ID,
      instantiatePayload: minimalInstantiatePayload(),
      instantiateInput: minimalInstantiateInput(),
      existingOptions: [{ id: OPTION_ID, source_template_option_id: TEMPLATE_OPT }],
      pageIdBySection: new Map(),
      policy: TEST_POLICY,
      pricingPolicyId: "policy-1",
      measurementStamp: null,
    });

    await persistDraftPricingRefreshViaRpc(supabase as never, payload);
    assert.ok(rpcPayload);
  });

  test("surfaces RPC failure as persistence error", async () => {
    const supabase = {
      rpc: async () => ({ error: { message: "function does not exist" } }),
    };

    await assert.rejects(
      () =>
        persistDraftPricingRefreshViaRpc(
          supabase as never,
          buildDraftPricingRefreshPersistPayload({
            companyId: COMPANY_ID,
            proposalId: PROPOSAL_ID,
            proposalVersionId: VERSION_ID,
            instantiatePayload: minimalInstantiatePayload(),
            instantiateInput: minimalInstantiateInput(),
            existingOptions: [{ id: OPTION_ID, source_template_option_id: TEMPLATE_OPT }],
            pageIdBySection: new Map(),
            policy: TEST_POLICY,
            pricingPolicyId: "policy-1",
            measurementStamp: null,
          })
        ),
      ProposalDraftPricingRefreshPersistenceError
    );
  });
});

describe("persistDraftPricingRefreshSequential failure contract", () => {
  test("line insert failure after delete leaves corrupt graph snapshot", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      proposal_options: [
        {
          id: OPTION_ID,
          company_id: COMPANY_ID,
          customer_subtotal_cents: 1000,
          customer_total_cents: 1000,
          pricing_complete: true,
          blocking_line_count: 0,
        },
      ],
      proposal_line_items: [
        {
          id: "line-old",
          company_id: COMPANY_ID,
          proposal_option_id: OPTION_ID,
          pricing_status: "priced",
          customer_line_total_cents: 1000,
        },
      ],
      proposal_internal_summaries: [
        { id: "sum-old", company_id: COMPANY_ID, proposal_option_id: OPTION_ID },
      ],
      proposal_versions: [],
      proposals: [],
      proposal_events: [],
    };

    const supabase = {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        let pendingUpdate: Record<string, unknown> | null = null;
        let pendingDelete = false;
        let pendingInsert: Record<string, unknown> | null = null;

        const chain = {
          update(data: Record<string, unknown>) {
            pendingUpdate = data;
            return chain;
          },
          delete() {
            pendingDelete = true;
            return chain;
          },
          insert(data: Record<string, unknown>) {
            if (table === "proposal_line_items") {
              throw new ProposalDraftPricingRefreshPersistenceError(
                "simulated line insert failure"
              );
            }
            pendingInsert = data;
            return chain;
          },
          eq(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          then(
            onFulfilled: (value: { error: null }) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) {
            try {
              if (pendingUpdate) {
                tables[table] = (tables[table] ?? []).map((row) => {
                  const record = row as Record<string, unknown>;
                  if (Object.entries(filters).every(([k, v]) => record[k] === v)) {
                    return { ...record, ...pendingUpdate! };
                  }
                  return record;
                });
              }
              if (pendingDelete) {
                tables[table] = (tables[table] ?? []).filter((row) => {
                  const record = row as Record<string, unknown>;
                  return !Object.entries(filters).every(([k, v]) => record[k] === v);
                });
              }
              if (pendingInsert) {
                tables[table] = [...(tables[table] ?? []), pendingInsert];
              }
              return Promise.resolve(onFulfilled({ error: null }));
            } catch (error) {
              return Promise.reject(error).then(undefined, onRejected);
            }
          },
        };

        return chain;
      },
    };

    const payload = buildDraftPricingRefreshPersistPayload({
      companyId: COMPANY_ID,
      proposalId: PROPOSAL_ID,
      proposalVersionId: VERSION_ID,
      instantiatePayload: minimalInstantiatePayload(),
      instantiateInput: minimalInstantiateInput(),
      existingOptions: [{ id: OPTION_ID, source_template_option_id: TEMPLATE_OPT }],
      pageIdBySection: new Map([["sec-1", "page-1"]]),
      policy: TEST_POLICY,
      pricingPolicyId: "policy-1",
      measurementStamp: null,
    });

    await assert.rejects(
      () => persistDraftPricingRefreshSequential(supabase as never, payload),
      /simulated line insert failure/
    );

    const snapshot = buildDraftPricingRefreshGraphSnapshotFromTables({
      options: tables.proposal_options!,
      lineItems: tables.proposal_line_items!,
      internalSummaries: tables.proposal_internal_summaries!,
    });

    const violations = validateDraftPricingRefreshGraphIntegrity(snapshot);
    assert.ok(violations.some((v) => v.code === "option_totals_without_lines"));
    assert.equal(tables.proposal_line_items!.length, 0);
  });
});
