/**
 * R4A — Draft proposal create persistence foundation tests.
 *
 * Run: npx tsx --test app/lib/proposalDraftCreatePersistence.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertDraftProposalCreateGraphInvariants,
  buildDraftProposalCreatePersistPayload,
  CREATE_DRAFT_PROPOSAL_ATOMIC_TABLES,
  CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS,
  diagnoseDraftProposalGraphCompleteness,
  isCreateDraftProposalSequentialEnabled,
  PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1,
  persistDraftProposalCreateViaRpc,
  ProposalDraftCreatePersistenceError,
  validateDraftProposalCreateGraphInvariants,
  type DraftProposalCreatePersistPayload,
} from "./proposalDraftCreatePersistence";
import type { DraftInstantiateInput, DraftInstantiatePayload } from "./proposalSnapshotBuilder";
import {
  buildDraftInstantiatePayload,
  templateItemToLineInput,
} from "./proposalSnapshotBuilder";
import type { ProposalTemplateSection } from "./proposalTemplateTypes";
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
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const TEMPLATE_ID = "44444444-4444-4444-8444-444444444444";
const POLICY_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";
const SECTION_ID = "88888888-8888-4888-8888-888888888888";

function minimalInstantiatePayload(): DraftInstantiatePayload {
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

function minimalInstantiateInput(): DraftInstantiateInput {
  return {
    company_id: COMPANY_ID,
    context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
    policy: { configured: true, policy: TEST_POLICY, pricingPolicyId: POLICY_ID, source: "company" },
    templateOptions: [],
    templateSections: [],
    optionPricing: [],
    lineItemsByTemplateOptionId: {
      [TEMPLATE_OPT]: [
        {
          source_template_item_id: "99999999-9999-4999-8999-999999999999",
          catalog_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
          quantity_resolution_echo: {
            quantity_mode: "adjusted_measurement",
            source_measurement_key: "adjusted_roof_squares",
            source_measurement_value: 22,
            coverage_rate_used: null,
            waste_pct_used: null,
            rounding_mode_used: "exact",
            resolved_purchase_quantity: 22,
          },
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

function buildHappyPayload(): DraftProposalCreatePersistPayload {
  return buildDraftProposalCreatePersistPayload({
    companyId: COMPANY_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    templateId: TEMPLATE_ID,
    measurementRecordId: null,
    pricingPolicyId: POLICY_ID,
    title: "Roof Proposal",
    createdBy: null,
    instantiatePayload: minimalInstantiatePayload(),
    instantiateInput: minimalInstantiateInput(),
    policy: TEST_POLICY,
  });
}

describe("isCreateDraftProposalSequentialEnabled escape hatch", { concurrency: 1 }, () => {
  const original = process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;

  function restoreEnv(): void {
    if (original === undefined) {
      delete process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
    } else {
      process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL = original;
    }
  }

  test("sequential off by default when escape hatch env is unset", () => {
    delete process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
    assert.equal(isCreateDraftProposalSequentialEnabled(), false);
    restoreEnv();
  });

  test("enables sequential only when USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL is exactly 1", () => {
    process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL = "1";
    assert.equal(isCreateDraftProposalSequentialEnabled(), true);
    restoreEnv();
  });
});

describe("draft proposal create persistence contract", () => {
  test("documents atomic table bundle for RPC", () => {
    assert.deepEqual(CREATE_DRAFT_PROPOSAL_ATOMIC_TABLES, [
      "proposals",
      "proposal_versions",
      "proposal_pages",
      "proposal_options",
      "proposal_line_items",
      "proposal_internal_summaries",
      "proposal_events",
      "jobs",
    ]);
  });

  test("documents sequential write order for legacy backstop path", () => {
    assert.equal(CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS.length, 9);
    assert.equal(CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS[0], "proposals.insert");
    assert.equal(
      CREATE_DRAFT_PROPOSAL_SEQUENTIAL_STEPS[8],
      "jobs.update_active_proposal"
    );
  });

  test("buildDraftProposalCreatePersistPayload happy path", () => {
    const payload = buildHappyPayload();

    assert.equal(payload.company_id, COMPANY_ID);
    assert.equal(payload.job_id, JOB_ID);
    assert.equal(payload.template_id, TEMPLATE_ID);
    assert.equal(payload.pages.length, 1);
    assert.equal(payload.options.length, 1);
    assert.equal(payload.selected_source_template_option_id, TEMPLATE_OPT);
    assert.equal(payload.set_job_active_proposal, true);
    assert.equal(payload.event.event_type, "created");
    assert.deepEqual(payload.event.payload_json, {
      template_id: TEMPLATE_ID,
      job_id: JOB_ID,
    });

    const option = payload.options[0]!;
    assert.equal(option.line_items.length, 1);
    assert.equal(option.line_items[0]!.section_id, SECTION_ID);
    assert.equal(option.line_items[0]!.page_id, undefined);
    assert.ok(option.internal_summary);

    assert.doesNotThrow(() => assertDraftProposalCreateGraphInvariants(payload));
  });

  test("S3D3 draft create persist rows include adjusted quantity_resolution_echo without changing qty/totals", () => {
    const payload = buildHappyPayload();
    const line = payload.options[0]!.line_items[0]!;
    const option = payload.options[0]!;

    assert.equal(line.quantity, 22);
    assert.equal(line.customer_unit_price_cents, 500);
    assert.equal(line.customer_line_total_cents, 10_000);
    assert.equal(option.customer_total_cents, 10_000);

    const echo = line.quantity_resolution_echo as Record<string, unknown>;
    assert.ok(echo);
    assert.equal(echo.quantity_mode, "adjusted_measurement");
    assert.equal(echo.coverage_rate_used, null);
    assert.equal(echo.waste_pct_used, null);
    assert.equal(echo.rounding_mode_used, "exact");
    assert.equal(echo.resolved_purchase_quantity, 22);
    assert.equal(echo.resolved_purchase_quantity, line.quantity);
  });

  test("payload uses section_id for RPC page mapping without pre-generated page ids", () => {
    const payload = buildHappyPayload();
    assert.equal(payload.pages[0]!.source_template_section_id, SECTION_ID);
    for (const option of payload.options) {
      for (const line of option.line_items) {
        assert.ok("section_id" in line);
        assert.equal("page_id" in line, false);
      }
    }
  });

  test("starter-like multi-option create payload passes invariants after spine section normalization", () => {
    const OPT_STANDARD = "77777777-7777-4777-8777-777777777777";
    const OPT_ENHANCED = "66666666-6666-4666-8666-666666666666";
    const SEC_STD_LINES = "88888888-8888-4888-8888-888888888888";
    const SEC_STD_TERMS = "99999999-9999-4999-8999-999999999999";
    const SEC_ENH_LINES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const SEC_ENH_UPGRADES = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    function sectionRow(
      overrides: Partial<ProposalTemplateSection> &
        Pick<ProposalTemplateSection, "id" | "option_id" | "kind" | "name">
    ): ProposalTemplateSection {
      return { template_id: TEMPLATE_ID, sort_order: 0, ...overrides };
    }

    const instantiateInput: DraftInstantiateInput = {
      company_id: COMPANY_ID,
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      policy: {
        configured: true,
        policy: TEST_POLICY,
        pricingPolicyId: POLICY_ID,
        source: "company",
      },
      templateOptions: [
        {
          id: OPT_STANDARD,
          template_id: TEMPLATE_ID,
          name: "Standard",
          is_default: true,
          visible_to_customer: true,
          sort_order: 0,
        },
        {
          id: OPT_ENHANCED,
          template_id: TEMPLATE_ID,
          name: "Enhanced",
          is_default: false,
          visible_to_customer: true,
          sort_order: 1,
        },
      ],
      templateSections: [
        sectionRow({
          id: SEC_STD_LINES,
          option_id: OPT_STANDARD,
          kind: "line_items",
          name: "Scope",
        }),
        sectionRow({
          id: SEC_STD_TERMS,
          option_id: OPT_STANDARD,
          kind: "terms",
          name: "Terms",
        }),
        sectionRow({
          id: SEC_ENH_LINES,
          option_id: OPT_ENHANCED,
          kind: "line_items",
          name: "Scope",
        }),
        sectionRow({
          id: SEC_ENH_UPGRADES,
          option_id: OPT_ENHANCED,
          kind: "upgrade_group",
          name: "Upgrades",
        }),
      ],
      optionPricing: [
        {
          source_template_option_id: OPT_STANDARD,
          name: "Standard",
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
          is_selected: true,
        },
        {
          source_template_option_id: OPT_ENHANCED,
          name: "Enhanced",
          sort_order: 1,
          is_default: false,
          visible_to_customer: true,
          customer_subtotal_cents: 12_000,
          discount_cents: 0,
          sales_tax_cents: 0,
          customer_total_cents: 12_000,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
        },
      ],
      lineItemsByTemplateOptionId: {
        [OPT_STANDARD]: [
          templateItemToLineInput(
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              template_id: TEMPLATE_ID,
              option_id: OPT_STANDARD,
              section_id: SEC_STD_LINES,
              catalog_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              item_role: "standard",
              sort_order: 0,
            },
            {
              engineStatus: "priced",
              customerVisibility: "customer_visible",
              customerLineTotalCents: 10_000,
            }
          ),
        ],
        [OPT_ENHANCED]: [
          templateItemToLineInput(
            {
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              template_id: TEMPLATE_ID,
              option_id: OPT_ENHANCED,
              section_id: SEC_ENH_LINES,
              catalog_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              item_role: "standard",
              sort_order: 0,
            },
            {
              engineStatus: "priced",
              customerVisibility: "customer_visible",
              customerLineTotalCents: 10_000,
            }
          ),
          templateItemToLineInput(
            {
              id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              template_id: TEMPLATE_ID,
              option_id: OPT_ENHANCED,
              section_id: SEC_ENH_UPGRADES,
              catalog_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              item_role: "optional_addon",
              sort_order: 1,
            },
            {
              engineStatus: "priced",
              customerVisibility: "customer_visible",
              customerLineTotalCents: 2_000,
            }
          ),
        ],
      },
      internalSummaryByTemplateOptionId: {
        [OPT_STANDARD]: {
          internal_cost_cents: 7000,
          internal_profit_cents: 3000,
          effective_margin_pct: 30,
        },
        [OPT_ENHANCED]: {
          internal_cost_cents: 8000,
          internal_profit_cents: 4000,
          effective_margin_pct: 33,
        },
      },
      selectedTemplateOptionId: OPT_STANDARD,
    };

    const instantiatePayload = buildDraftInstantiatePayload(instantiateInput);
    const persistPayload = buildDraftProposalCreatePersistPayload({
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
      policy: TEST_POLICY,
    });

    assert.doesNotThrow(() => assertDraftProposalCreateGraphInvariants(persistPayload));

    const enhanced = persistPayload.options.find((o) => o.name === "Enhanced");
    assert.ok(enhanced);
    assert.equal(enhanced!.line_items.length, 2);
    assert.ok(
      enhanced!.line_items.every((line) => line.section_id === SEC_STD_LINES),
      "upgrade_group and non-spine line_items sections map to spine estimate page"
    );
  });
});

describe("validateDraftProposalCreateGraphInvariants failures", () => {
  test("rejects no pages", () => {
    const payload = buildHappyPayload();
    payload.pages = [];
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "no_pages"));
    assert.throws(
      () => assertDraftProposalCreateGraphInvariants(payload),
      ProposalDraftCreatePersistenceError
    );
  });

  test("rejects no options", () => {
    const payload = buildHappyPayload();
    payload.options = [];
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "no_options"));
  });

  test("rejects selected option not present", () => {
    const payload = buildHappyPayload();
    payload.selected_source_template_option_id =
      "00000000-0000-4000-8000-000000000000";
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "selected_option_not_found"));
  });

  test("rejects line section reference missing page", () => {
    const payload = buildHappyPayload();
    payload.options[0]!.line_items[0]!.section_id =
      "00000000-0000-4000-8000-000000000001";
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "line_section_missing_page"));
  });

  test("rejects forbidden line keys", () => {
    const payload = buildHappyPayload();
    (payload.options[0]!.line_items[0] as unknown as Record<string, unknown>).unit_cost_cents =
      100;
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "forbidden_line_key"));
  });

  test("rejects priced complete option without lines", () => {
    const payload = buildHappyPayload();
    payload.options[0]!.line_items = [];
    payload.options[0]!.internal_summary = null;
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "option_totals_without_lines"));
    assert.ok(violations.some((v) => v.code === "pricing_complete_without_lines"));
  });

  test("rejects runtime page_id on line items", () => {
    const payload = buildHappyPayload();
    (payload.options[0]!.line_items[0] as unknown as Record<string, unknown>).page_id =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "forbidden_runtime_id"));
  });

  test("rejects template mutation payload keys", () => {
    const payload = buildHappyPayload();
    (payload as unknown as Record<string, unknown>).template_mutations = [];
    const violations = validateDraftProposalCreateGraphInvariants(payload);
    assert.ok(violations.some((v) => v.code === "template_mutation_payload"));
  });
});

describe("persistDraftProposalCreateViaRpc", () => {
  test("calls rpc with payload and returns parsed result", async () => {
    let rpcName = "";
    let rpcPayload: unknown;
    const supabase = {
      rpc: async (name: string, args: { p_payload: unknown }) => {
        rpcName = name;
        rpcPayload = args.p_payload;
        return {
          error: null,
          data: {
            ok: true,
            proposal_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            proposal_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            selected_option_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            page_count: 1,
            option_count: 1,
          },
        };
      },
    };

    const payload = buildHappyPayload();
    const result = await persistDraftProposalCreateViaRpc(supabase as never, payload);

    assert.equal(rpcName, PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1);
    assert.ok(rpcPayload);
    assert.equal(result.proposal_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(result.page_count, 1);
    assert.equal(result.option_count, 1);
  });

  test("surfaces RPC failure as persistence error without sequential fallback", async () => {
    const supabase = {
      rpc: async () => ({ error: { message: "function does not exist" }, data: null }),
    };

    await assert.rejects(
      () => persistDraftProposalCreateViaRpc(supabase as never, buildHappyPayload()),
      (error: unknown) => {
        assert.ok(error instanceof ProposalDraftCreatePersistenceError);
        assert.match(String(error), /function does not exist/);
        return true;
      }
    );
  });
});

describe("diagnoseDraftProposalGraphCompleteness", () => {
  test("detects missing pointers and incomplete graph", () => {
    const result = diagnoseDraftProposalGraphCompleteness({
      proposal: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "draft",
        current_draft_version_id: null,
        selected_option_id: null,
        job_id: JOB_ID,
      },
      version: null,
      pages: [],
      options: [],
      lineItems: [],
      internalSummaries: [],
      job: { active_proposal_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });

    assert.equal(result.complete, false);
    assert.ok(
      result.violations.some((v) => v.code === "missing_current_draft_version_id")
    );
    assert.ok(result.violations.some((v) => v.code === "no_pages"));
    assert.ok(result.violations.some((v) => v.code === "no_options"));
    assert.ok(result.violations.some((v) => v.code === "job_active_proposal_mismatch"));
  });

  test("reports complete graph when pointers and children align", () => {
    const optionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const versionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const proposalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const result = diagnoseDraftProposalGraphCompleteness({
      proposal: {
        id: proposalId,
        status: "draft",
        current_draft_version_id: versionId,
        selected_option_id: optionId,
        job_id: JOB_ID,
      },
      version: { id: versionId, version_kind: "draft" },
      pages: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }],
      options: [{ id: optionId, source_template_option_id: TEMPLATE_OPT }],
      lineItems: [{ proposal_option_id: optionId, pricing_status: "priced" }],
      internalSummaries: [{ proposal_option_id: optionId }],
      job: { active_proposal_id: proposalId },
    });

    assert.equal(result.complete, true);
    assert.equal(result.violations.length, 0);
  });
});
