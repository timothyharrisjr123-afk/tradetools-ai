/**
 * R18E — proposalCustomerPacketPresenter tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerPacketPresenter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCustomerPacketFromPublicDto } from "./proposalCustomerPacketPresenter";
import type { ProposalPublicGraphDto } from "./proposalPublicGraphDto";

const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
const TEMPLATE_OPT_C = "99999999-9999-4999-8999-999999999999";

function baseDto(overrides: Partial<ProposalPublicGraphDto> = {}): ProposalPublicGraphDto {
  return {
    version_kind: "sent",
    frozen_at: "2026-06-26T12:00:00.000Z",
    context_echo: {
      company_name: "Summit Roofing",
      customer_name: "Jane Homeowner",
      address_formatted: "123 Main St",
      template_name: "Roof Replacement",
    },
    policy_echo: {},
    selected_template_option_id: TEMPLATE_OPT_B,
    pages: [
      {
        page_type: "project_overview",
        sort_order: 10,
        title: "Project overview",
        customer_title: null,
        visible_to_customer: true,
        content_json: { body_markdown: "Overview content." },
        settings_json: {},
      },
      {
        page_type: "terms",
        sort_order: 20,
        title: "Terms",
        customer_title: null,
        visible_to_customer: true,
        content_json: { body_markdown: "Terms content." },
        settings_json: {},
      },
    ],
    options: [
      {
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Standard",
        customer_label: "Standard",
        sort_order: 0,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 800,
        customer_total_cents: 10800,
        line_items: [
          {
            source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            customer_name: "roofing.architectural_shingles",
            description: null,
            quantity: 25,
            quantity_display_label: "25",
            unit: "SQ",
            customer_unit_price_cents: 400,
            customer_line_total_cents: 10000,
            pricing_status: "priced",
            visible_to_customer: true,
            line_presentation_group: "included",
          },
        ],
      },
      {
        source_template_option_id: TEMPLATE_OPT_B,
        name: "Premium",
        customer_label: "Premium",
        sort_order: 1,
        visible_to_customer: true,
        customer_subtotal_cents: 25000,
        discount_cents: 0,
        sales_tax_cents: 2028,
        customer_total_cents: 27028,
        line_items: [
          {
            source_template_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            customer_name: "roofing.synthetic_underlayment",
            description: null,
            quantity: 25,
            quantity_display_label: "25",
            unit: "SQ",
            customer_unit_price_cents: 800,
            customer_line_total_cents: 20000,
            pricing_status: "priced",
            visible_to_customer: true,
            line_presentation_group: "included",
          },
          {
            source_template_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            customer_name: "roofing.ridge_vent",
            description: null,
            quantity: 1,
            quantity_display_label: "1",
            unit: "EA",
            customer_unit_price_cents: 5000,
            customer_line_total_cents: 5000,
            pricing_status: "priced",
            visible_to_customer: true,
            line_presentation_group: "upgrade",
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

describe("buildCustomerPacketFromPublicDto", () => {
  test("packet has cover and estimate", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.ok(packet.cover.headline);
    assert.ok(packet.estimate);
  });

  test("selected option is primary in estimate", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.estimate?.optionKey, TEMPLATE_OPT_B);
    assert.equal(packet.estimate?.label, "Premium");
  });

  test("total investment appears once as primary money moment on estimate", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.estimate?.totalInvestmentLabel, "$270.28");
    assert.equal(packet.cover.headline?.includes("$"), false);
  });

  test("alternate options are secondary comparison only", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.comparison?.options.length, 1);
    assert.equal(packet.comparison?.options[0]?.optionKey, TEMPLATE_OPT_A);
    assert.equal(packet.comparison?.options[0]?.totalInvestmentLabel, "$108.00");
  });

  test("optional upgrades render only when present", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.upgrades?.items.length, 1);
    assert.equal(packet.upgrades?.items[0]?.name, "Ridge Vent");
  });

  test("missing upgrades are omitted", () => {
    const dto = baseDto({
      options: baseDto().options.map((option) =>
        option.source_template_option_id === TEMPLATE_OPT_B
          ? {
              ...option,
              line_items: option.line_items.filter((line) => line.line_presentation_group !== "upgrade"),
            }
          : option
      ),
    });
    const packet = buildCustomerPacketFromPublicDto(dto);
    assert.equal(packet.upgrades, null);
  });

  test("missing alternates omits comparison", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        options: baseDto().options.filter((option) => option.source_template_option_id === TEMPLATE_OPT_B),
      })
    );
    assert.equal(packet.comparison, null);
  });

  test("empty detail pages are omitted", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        pages: [
          {
            page_type: "warranty",
            sort_order: 10,
            title: "Warranty",
            customer_title: null,
            visible_to_customer: true,
            content_json: {},
            settings_json: {},
          },
        ],
      })
    );
    assert.equal(packet.details, null);
  });

  test("raw catalog keys are humanized in customer-facing line names", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    const lineNames =
      packet.estimate?.includedDetails.flatMap((group) => group.lines.map((line) => line.name)) ?? [];
    assert.ok(lineNames.includes("Synthetic Underlayment"));
    assert.ok(!lineNames.some((name) => name.includes("roofing.")));
    assert.ok(!lineNames.some((name) => name.includes("_")));
  });

  test("serialized packet excludes forbidden internal fields", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    const serialized = JSON.stringify(packet);
    assert.doesNotMatch(serialized, /token_hash/);
    assert.doesNotMatch(serialized, /proposal_id/);
    assert.doesNotMatch(serialized, /internal_cost/);
    assert.doesNotMatch(serialized, /margin/);
  });

  test("placeholder contractor-review detail tabs are omitted", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        pages: [
          {
            page_type: "project_overview",
            sort_order: 10,
            title: "Project overview",
            customer_title: null,
            visible_to_customer: true,
            content_json: {
              body_markdown:
                "This proposal outlines a roof replacement scope based on field measurements, selected options, and the contractor's catalog setup. Yes",
            },
            settings_json: {},
          },
          {
            page_type: "warranty",
            sort_order: 20,
            title: "Warranty",
            customer_title: null,
            visible_to_customer: true,
            content_json: {
              body_markdown:
                "Warranty details should be reviewed and completed by the contractor before sending the proposal.",
            },
            settings_json: {},
          },
          {
            page_type: "terms",
            sort_order: 30,
            title: "Terms",
            customer_title: null,
            visible_to_customer: true,
            content_json: { body_markdown: "Net 30 upon completion." },
            settings_json: {},
          },
        ],
      })
    );
    assert.equal(packet.details?.tabs.length, 2);
    assert.equal(packet.details?.tabs[0]?.title, "Project overview");
    assert.equal(packet.details?.tabs[1]?.title, "Terms");
  });

  test("honors selected_template_option_id without falling back to first visible option", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        selected_template_option_id: "00000000-0000-4000-8000-000000000099",
      })
    );
    assert.equal(packet.estimate, null);
  });

  test("no Sign/PDF/Payment active language in packet", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    const serialized = JSON.stringify(packet).toLowerCase();
    assert.doesNotMatch(serialized, /sign \/ accept/);
    assert.doesNotMatch(serialized, /pay deposit/);
    assert.doesNotMatch(serialized, /download pdf/);
  });
});
