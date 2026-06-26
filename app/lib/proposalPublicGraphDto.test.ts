/**
 * R18B1 — proposalPublicGraphDto tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicGraphDto.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  buildProposalPublicGraphDto,
  assertPublicDtoShape,
} from "./proposalPublicGraphDto";
import {
  buildProposalSendFreezePersistPayload,
  buildSendFreezeGraphLikeFromPayload,
} from "./proposalSendFreezePersistence";
import type { ProposalDraftGraph, ProposalPageRow, ProposalVersionGraph } from "./proposalRecordStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const PAGE_ESTIMATE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function draftGraph(): ProposalDraftGraph {
  return {
    proposal: {
      id: PROPOSAL_ID,
      company_id: COMPANY_ID,
      job_id: "22222222-2222-4222-8222-222222222222",
      customer_id: null,
      template_id: "66666666-6666-4666-8666-666666666666",
      status: "draft",
      current_draft_version_id: VERSION_ID,
      latest_sent_version_id: null,
      signed_version_id: null,
      selected_option_id: RUNTIME_OPT_A,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: null,
      title: null,
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
        sort_order: 10,
        title: "Estimate",
        customer_title: null,
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: {},
        settings_json: { show_line_prices: false },
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      } satisfies ProposalPageRow,
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        page_type: "terms",
        sort_order: 20,
        title: "Terms",
        customer_title: null,
        visible_to_customer: false,
        source_template_section_id: null,
        content_json: {},
        settings_json: {},
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
        customer_label: null,
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 0,
        customer_total_cents: 10000,
        pricing_complete: true,
        blocking_line_count: 3,
        guardrail_outcome: "block",
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
        customer_name: "Hidden from customer",
        description: null,
        role: null,
        quantity: 1,
        quantity_display_label: "1",
        quantity_source_label: null,
        unit: "EA",
        customer_unit_price_cents: 100,
        customer_line_total_cents: 100,
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
        internal_cost_cents: 1,
        internal_profit_cents: 1,
        effective_margin_pct: 1,
        policy_echo_json: {},
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
  };
}

describe("buildProposalPublicGraphDto", () => {
  test("public DTO excludes internal summaries and scope decisions", () => {
    const dto = buildProposalPublicGraphDto(draftGraph(), TEMPLATE_OPT_A);
    assert.ok(!("internalSummaries" in dto));
    assert.ok(!("scopeDecisions" in dto));
    assert.ok(!("internal_summaries" in dto));
    assert.doesNotThrow(() => assertPublicDtoShape(dto));
  });

  test("public DTO excludes guardrail internals from options", () => {
    const dto = buildProposalPublicGraphDto(draftGraph(), TEMPLATE_OPT_A);
    const option = dto.options[0]!;
    assert.ok(!("blocking_line_count" in option));
    assert.ok(!("guardrail_outcome" in option));
    assert.equal(option.customer_total_cents, 10000);
  });

  test("public DTO omits customer-hidden and omitted lines", () => {
    const dto = buildProposalPublicGraphDto(draftGraph(), TEMPLATE_OPT_A);
    const names = dto.options[0]!.line_items.map((line) => line.customer_name);
    assert.deepEqual(names, ["Visible"]);
  });

  test("public DTO respects display settings from estimate page", () => {
    const dto = buildProposalPublicGraphDto(draftGraph(), TEMPLATE_OPT_A);
    assert.equal(dto.displayPolicy.showLinePrices, false);
    assert.equal(dto.displayPolicy.showOptionTotals, true);
  });

  test("public DTO does not expose Builder labels in line names", () => {
    assert.throws(
      () =>
        buildProposalPublicGraphDto({
          ...draftGraph(),
          lineItems: [
            {
              ...draftGraph().lineItems[0]!,
              customer_name: "Scope Review item",
              visible_to_customer: true,
              pricing_status: "priced",
            },
          ],
        }),
      /Builder label/
    );
  });

  test("public DTO maps line role to line_presentation_group", () => {
    const graph = draftGraph();
    const dto = buildProposalPublicGraphDto(
      {
        ...graph,
        lineItems: [
          {
            ...graph.lineItems[0]!,
            customer_name: "Included item",
            role: null,
          },
          {
            ...graph.lineItems[0]!,
            id: "20202020-2020-4202-8202-202020202020",
            source_template_item_id: "21212121-2121-4212-8212-212121212121",
            customer_name: "Optional vent",
            role: "optional_addon",
            sort_order: 3,
          },
        ],
      },
      TEMPLATE_OPT_A
    );

    const groups = dto.options[0]!.line_items.map((line) => line.line_presentation_group);
    assert.deepEqual(groups, ["included", "upgrade"]);
  });

  test("works from send-freeze graph-like payload", () => {
    const payload = buildProposalSendFreezePersistPayload(draftGraph(), {
      frozenAt: "2026-06-18T12:00:00.000Z",
      sentVersionId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const like = buildSendFreezeGraphLikeFromPayload(payload);
    const dto = buildProposalPublicGraphDto(like, TEMPLATE_OPT_A);
    assert.equal(dto.version_kind, "sent");
    assert.equal(dto.frozen_at, "2026-06-18T12:00:00.000Z");
    assert.equal(dto.options[0]!.line_items.length, 1);
  });

  test("consumes explicit sent ProposalVersionGraph shape without scope decisions", () => {
    const draft = draftGraph();
    const versionGraph: ProposalVersionGraph = {
      proposal: { ...draft.proposal, latest_sent_version_id: VERSION_ID },
      version: {
        ...draft.version,
        version_kind: "sent",
        frozen_at: "2026-06-18T12:00:00.000Z",
        parent_version_id: draft.version.id,
        version_number: 2,
      },
      pages: draft.pages,
      options: draft.options,
      lineItems: draft.lineItems,
      internalSummaries: draft.internalSummaries,
    };

    const like = {
      version: versionGraph.version,
      pages: versionGraph.pages,
      options: versionGraph.options.map((option) => ({
        source_template_option_id: option.source_template_option_id!,
        name: option.name,
        customer_label: option.customer_label,
        sort_order: option.sort_order,
        visible_to_customer: option.visible_to_customer,
        customer_subtotal_cents: option.customer_subtotal_cents,
        discount_cents: option.discount_cents,
        sales_tax_cents: option.sales_tax_cents,
        customer_total_cents: option.customer_total_cents,
        line_items: versionGraph.lineItems
          .filter((line) => line.proposal_option_id === option.id)
          .map((line) => ({
            source_template_item_id: line.source_template_item_id,
            customer_name: line.customer_name,
            description: line.description,
            quantity: line.quantity,
            quantity_display_label: line.quantity_display_label,
            unit: line.unit,
            customer_unit_price_cents: line.customer_unit_price_cents,
            customer_line_total_cents: line.customer_line_total_cents,
            pricing_status: line.pricing_status,
            visible_to_customer: line.visible_to_customer,
            page_id: line.page_id,
            sort_order: line.sort_order,
          })),
      })),
    };

    const dto = buildProposalPublicGraphDto(like, TEMPLATE_OPT_A);
    assert.equal(dto.version_kind, "sent");
    assert.ok(!("internalSummaries" in dto));
    assert.ok(!("scopeDecisions" in dto));
    assert.doesNotThrow(() => assertPublicDtoShape(dto));
  });
});

describe("R18B1 public DTO guardrails", () => {
  test("module has no route/token/legacy approve references", () => {
    const source = readFileSync(new URL("./proposalPublicGraphDto.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /getSupabaseClient|persistDraft|persist_proposal/);
    assert.doesNotMatch(source, /\/approve\/|app\/lib\/kv/);
    assert.doesNotMatch(source, /\/tools\/roofing\/proposals\/preview|\/p\/\[|generatePublicToken/);
  });
});
