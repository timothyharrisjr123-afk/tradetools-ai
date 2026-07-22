/**
 * R18C4A — proposalPublicProposalViewModel tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicProposalViewModel.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { buildProposalPublicGraphDto } from "./proposalPublicGraphDto";
import type { ProposalPublicGraphDto } from "./proposalPublicGraphDto";
import {
  assertPublicProposalDocumentViewModelSafe,
  buildProposalPublicFutureActions,
  buildProposalPublicProposalDocumentViewModel,
  buildProposalPublicProposalErrorViewModel,
  PROPOSAL_PUBLIC_STATUS_LABEL,
} from "./proposalPublicProposalViewModel";

const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";

function baseDto(overrides: Partial<ProposalPublicGraphDto> = {}): ProposalPublicGraphDto {
  return {
    version_kind: "sent",
    frozen_at: "2026-06-26T12:00:00.000Z",
    context_echo: {
      company_name: "Summit Roofing",
      company_phone: "555-0100",
      company_website: "https://summit.example",
      company_logo_url: "https://cdn.example/logo.png",
      brand_primary_color: "#112233",
      customer_name: "Jane Homeowner",
      customer_email: "jane@example.com",
      address_formatted: "123 Main St",
      template_name: "Roof Replacement",
      show_license_on_cover: "true",
      company_license: "RC-123",
    },
    policy_echo: {},
    selected_template_option_id: TEMPLATE_OPT_A,
    pages: [
      {
        page_type: "cover",
        sort_order: 0,
        title: "Cover",
        customer_title: null,
        visible_to_customer: true,
        content_json: { body_markdown: "Welcome {{customer_name}}" },
        settings_json: {},
      },
      {
        page_type: "terms",
        sort_order: 10,
        title: "Terms",
        customer_title: "Terms & Conditions",
        visible_to_customer: true,
        content_json: { body_markdown: "Standard terms apply." },
        settings_json: {},
      },
      {
        page_type: "signature",
        sort_order: 20,
        title: "Signature",
        customer_title: null,
        visible_to_customer: true,
        content_json: {},
        settings_json: {},
      },
      {
        page_type: "estimate",
        sort_order: 30,
        title: "Estimate",
        customer_title: null,
        visible_to_customer: true,
        content_json: {},
        settings_json: { show_line_prices: true, show_option_totals: true },
      },
    ],
    options: [
      {
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Standard",
        customer_label: "Standard",
        description: null,
        sort_order: 0,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 800,
        customer_total_cents: 10800,
        line_items: [
          {
            source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            customer_name: "Architectural Shingles",
            description: null,
            quantity: 1,
            quantity_display_label: "1",
            unit: "SQ",
            customer_unit_price_cents: 10000,
            customer_line_total_cents: 10000,
            pricing_status: "priced",
            visible_to_customer: true,
            line_presentation_group: "included",
            upgrade_selection_state: null,
            upgrade_effect: null,
          },
        ],
      },
    ],
    displayPolicy: {
      showLinePrices: true,
      showOptionTotals: true,
      showSectionHeadings: true,
    },
    ...overrides,
  };
}

describe("buildProposalPublicProposalDocumentViewModel", () => {
  test("builds full document VM with header, cover, pages, estimate, futureActions, footer", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto(), { versionKind: "sent" });

    assert.equal(vm.kind, "document");
    assert.equal(vm.meta.statusLabel, PROPOSAL_PUBLIC_STATUS_LABEL);
    assert.equal(vm.header.statusLabel, PROPOSAL_PUBLIC_STATUS_LABEL);
    assert.ok(vm.header.company.companyName);
    assert.ok(vm.cover.headline);
    assert.ok(vm.pages.length >= 1);
    assert.ok(vm.packet.cover);
    assert.ok(vm.packet.estimate);
    assert.equal(vm.estimate.layout, "selected_primary");
    assert.equal(vm.futureActions.length, 3);
    assert.ok(vm.footer.company.hasAnyField);
    assertPublicProposalDocumentViewModelSafe(vm);
  });

  test("multi-option DTO produces primary package plus secondary alternates", () => {
    const dto = baseDto({
      options: [
        ...baseDto().options,
        {
          source_template_option_id: TEMPLATE_OPT_B,
          name: "Premium",
          customer_label: "Premium",
          description: null,
          sort_order: 1,
          visible_to_customer: true,
          customer_subtotal_cents: 15000,
          discount_cents: 0,
          sales_tax_cents: 1200,
          customer_total_cents: 16200,
          line_items: [
            {
              source_template_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              customer_name: "Premium Shingles",
              description: null,
              quantity: 1,
              quantity_display_label: "1",
              unit: "SQ",
              customer_unit_price_cents: 15000,
              customer_line_total_cents: 15000,
              pricing_status: "priced",
              visible_to_customer: true,
              line_presentation_group: "included",
              upgrade_selection_state: null,
              upgrade_effect: null,
            },
          ],
        },
      ],
    });

    const vm = buildProposalPublicProposalDocumentViewModel(dto);
    assert.equal(vm.estimate.primaryPackage?.optionKey, TEMPLATE_OPT_A);
    assert.equal(vm.estimate.alternateOptions.length, 1);
    assert.equal(vm.estimate.alternateOptions[0]?.optionKey, TEMPLATE_OPT_B);
  });

  test("single option DTO produces one primary package", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    assert.equal(vm.estimate.primaryPackage?.optionKey, TEMPLATE_OPT_A);
    assert.equal(vm.estimate.alternateOptions.length, 0);
  });

  test("hidden options do not appear in alternate options", () => {
    const dto = baseDto({
      options: [
        baseDto().options[0]!,
        {
          source_template_option_id: TEMPLATE_OPT_B,
          name: "Hidden",
          customer_label: null,
          description: null,
          sort_order: 1,
          visible_to_customer: false,
          customer_subtotal_cents: 5000,
          discount_cents: 0,
          sales_tax_cents: 0,
          customer_total_cents: 5000,
          line_items: [],
        },
      ],
    });

    const vm = buildProposalPublicProposalDocumentViewModel(dto);
    assert.equal(vm.estimate.alternateOptions.length, 0);
    assert.equal(vm.estimate.primaryPackage?.optionKey, TEMPLATE_OPT_A);
  });

  test("display policy hides line prices and totals when disabled", () => {
    const dto = baseDto({
      displayPolicy: {
        showLinePrices: false,
        showOptionTotals: false,
        showSectionHeadings: false,
      },
    });

    const vm = buildProposalPublicProposalDocumentViewModel(dto);
    const line = vm.estimate.primaryPackage?.scopeGroups[0]?.lines[0];
    assert.equal(line?.valueLabel, null);
    assert.equal(line?.quantityLabel, null);
    assert.equal(vm.estimate.primaryPackage?.totalInvestmentLabel, null);
  });

  test("future actions are all deferred", () => {
    const actions = buildProposalPublicFutureActions();
    assert.equal(actions.length, 3);
    for (const action of actions) {
      assert.equal(action.availability, "deferred");
      assert.equal(action.showInUi, true);
      assert.ok(action.disabledReason.length > 0);
    }
  });

  test("signature and payment page types become deferred page models", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    const deferred = vm.pages.filter((page) => page.kind === "deferred");
    assert.equal(deferred.length, 1);
    assert.equal(deferred[0]?.pageType, "signature");
  });

  test("serialized VM excludes forbidden identifiers and internal fields", () => {
    const vm = buildProposalPublicProposalDocumentViewModel(baseDto());
    const serialized = JSON.stringify(vm);

    assert.doesNotMatch(serialized, /"token_hash"\s*:/);
    assert.doesNotMatch(serialized, /"company_id"\s*:/);
    assert.doesNotMatch(serialized, /"proposal_id"\s*:/);
    assert.doesNotMatch(serialized, /blocking_line_count/);
    assert.doesNotMatch(serialized, /scope_decision/);
    assert.doesNotMatch(serialized, /pricing_stale/);
    assertPublicProposalDocumentViewModelSafe(vm);
  });

  test("error view model is customer-safe", () => {
    const error = buildProposalPublicProposalErrorViewModel("expired_token");
    assert.equal(error.kind, "error");
    assert.equal(error.code, "expired_token");
    assert.ok(error.title.length > 0);
    assert.ok(error.message.length > 0);
    assertPublicProposalDocumentViewModelSafe(error);
  });

  test("buildProposalPublicGraphDto hidden lines stay out of VM", () => {
    const graphDto = buildProposalPublicGraphDto(
      {
        proposal: {
          id: "33333333-3333-4333-8333-333333333333",
          selected_option_id: "99999999-9999-4999-8999-999999999999",
        } as never,
        version: {
          version_kind: "sent",
          frozen_at: "2026-06-26T12:00:00.000Z",
          context_echo: baseDto().context_echo,
          policy_echo: {},
        } as never,
        pages: [
          {
            page_type: "estimate",
            sort_order: 10,
            title: "Estimate",
            customer_title: null,
            visible_to_customer: true,
            content_json: {},
            settings_json: {},
          } as never,
        ],
        options: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            source_template_option_id: TEMPLATE_OPT_A,
            name: "Standard",
            customer_label: null,
            description: null,
            sort_order: 0,
            is_default: true,
            visible_to_customer: true,
            customer_subtotal_cents: 10000,
            discount_cents: 0,
            sales_tax_cents: 0,
            customer_total_cents: 10000,
          } as never,
        ],
        lineItems: [
          {
            proposal_option_id: "99999999-9999-4999-8999-999999999999",
            source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            customer_name: "Visible",
            visible_to_customer: true,
            pricing_status: "priced",
            customer_line_total_cents: 10000,
            customer_unit_price_cents: 10000,
            quantity: 1,
            quantity_display_label: "1",
            unit: "EA",
          } as never,
          {
            proposal_option_id: "99999999-9999-4999-8999-999999999999",
            source_template_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            customer_name: "Hidden",
            visible_to_customer: false,
            pricing_status: "priced",
            customer_line_total_cents: 5000,
            customer_unit_price_cents: 5000,
            quantity: 1,
            quantity_display_label: "1",
            unit: "EA",
          } as never,
        ],
      } as never,
      TEMPLATE_OPT_A
    );

    const vm = buildProposalPublicProposalDocumentViewModel(graphDto);
    const lineNames =
      vm.estimate.primaryPackage?.scopeGroups.flatMap((group) => group.lines.map((line) => line.name)) ?? [];
    assert.deepEqual(lineNames, ["Visible"]);
  });
});

describe("forbidden exposure guardrails", () => {
  test("view model source does not import draft graph or app/tools", () => {
    const source = readFileSync(new URL("./proposalPublicProposalViewModel.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /getDraftGraph\(/);
    assert.doesNotMatch(source, /app\/tools/);
    assert.doesNotMatch(source, /createAdminClient/);
  });
});
