/**
 * R18E — proposalCustomerPacketPresenter tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerPacketPresenter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCustomerPacketFromPublicDto } from "./proposalCustomerPacketPresenter";
import {
  PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY,
} from "./proposalCustomerPacketViewModel";
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
            upgrade_selection_state: null,
            upgrade_effect: null,
          },
        ],
      },
      {
        source_template_option_id: TEMPLATE_OPT_B,
        name: "Premium",
        customer_label: "Premium",
        description: null,
        sort_order: 2,
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
            upgrade_selection_state: null,
            upgrade_effect: null,
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
            upgrade_selection_state: "selected",
            upgrade_effect: "additive",
          },
        ],
      },
      {
        source_template_option_id: TEMPLATE_OPT_C,
        name: "Enhanced",
        customer_label: "Enhanced",
        description: null,
        sort_order: 1,
        visible_to_customer: true,
        customer_subtotal_cents: 19000,
        discount_cents: 0,
        sales_tax_cents: 1428,
        customer_total_cents: 20428,
        line_items: [
          {
            source_template_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            customer_name: "roofing.architectural_shingles",
            description: null,
            quantity: 25,
            quantity_display_label: "25",
            unit: "SQ",
            customer_unit_price_cents: 760,
            customer_line_total_cents: 19000,
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

describe("buildCustomerPacketFromPublicDto", () => {
  test("packet has cover and estimate", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.ok(packet.cover.headline);
    assert.ok(packet.estimate);
  });

  test("current option is primary in estimate", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.estimate?.optionKey, TEMPLATE_OPT_B);
    assert.equal(packet.estimate?.label, "Premium");
  });

  test("authored option description beats package label fallback", () => {
    const authored = "Contractor-authored Premium package story.";
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        options: baseDto().options.map((option) =>
          option.source_template_option_id === TEMPLATE_OPT_B
            ? { ...option, description: authored }
            : { ...option, description: null }
        ),
      })
    );
    assert.equal(packet.estimate?.description, authored);
    const current = packet.comparison?.options.find((option) => option.isCurrent);
    assert.equal(current?.description, authored);
    const standard = packet.comparison?.options.find(
      (option) => option.optionKey === TEMPLATE_OPT_A
    );
    assert.equal(standard?.description, "Solid, complete roof replacement with quality materials and professional installation.");
  });

  test("current proposal total uses frozen package total", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.estimate?.totalInvestmentLabel, "$270.28");
    assert.equal(packet.cover.headline?.includes("$"), false);
  });

  test("comparison includes all visible packages with current marked", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.comparison?.options.length, 3);
    const current = packet.comparison?.options.find((option) => option.isCurrent);
    assert.equal(current?.optionKey, TEMPLATE_OPT_B);
    assert.equal(current?.label, "Premium");
    assert.equal(current?.totalInvestmentLabel, "$270.28");
    const standard = packet.comparison?.options.find((option) => option.optionKey === TEMPLATE_OPT_A);
    assert.equal(standard?.isCurrent, false);
    assert.equal(standard?.totalInvestmentLabel, "$108.00");
    const enhanced = packet.comparison?.options.find((option) => option.optionKey === TEMPLATE_OPT_C);
    assert.equal(enhanced?.isCurrent, false);
    assert.equal(enhanced?.totalInvestmentLabel, "$204.28");
  });

  test("standard can be primary current package", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({ selected_template_option_id: TEMPLATE_OPT_A })
    );
    assert.equal(packet.estimate?.label, "Standard");
    assert.equal(packet.estimate?.totalInvestmentLabel, "$108.00");
    const current = packet.comparison?.options.find((option) => option.isCurrent);
    assert.equal(current?.optionKey, TEMPLATE_OPT_A);
  });

  test("enhanced can be primary current package", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({ selected_template_option_id: TEMPLATE_OPT_C })
    );
    assert.equal(packet.estimate?.label, "Enhanced");
    assert.equal(packet.estimate?.totalInvestmentLabel, "$204.28");
    const current = packet.comparison?.options.find((option) => option.isCurrent);
    assert.equal(current?.optionKey, TEMPLATE_OPT_C);
  });

  test("selected upgrades render only when present", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.upgrades?.items.length, 1);
    assert.equal(packet.upgrades?.items[0]?.name, "Ridge Vent");
  });

  test("unselected upgrades are omitted from packet upgrades", () => {
    const dto = baseDto({
      options: baseDto().options.map((option) =>
        option.source_template_option_id === TEMPLATE_OPT_B
          ? {
              ...option,
              line_items: option.line_items.map((line) =>
                line.line_presentation_group === "upgrade"
                  ? { ...line, upgrade_selection_state: "not_selected" as const }
                  : line
              ),
            }
          : option
      ),
    });
    const packet = buildCustomerPacketFromPublicDto(dto);
    assert.equal(packet.upgrades, null);
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

  test("single visible package omits comparison", () => {
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

  test("customer-facing copy uses recommended package language", () => {
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL, "Recommended roofing package");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING, "Compare packages");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE, "Recommended");
    assert.equal(PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL, "Your investment");
    assert.match(PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY, /recommended package shown above/i);
  });

  test("serialized packet avoids selection/payment action language", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    const serialized = JSON.stringify(packet).toLowerCase();
    assert.doesNotMatch(serialized, /selected package/);
    assert.doesNotMatch(serialized, /\bchoose\b/);
    assert.doesNotMatch(serialized, /update total/);
    assert.doesNotMatch(serialized, /pay deposit/);
    assert.doesNotMatch(serialized, /sign \/ accept/);
    assert.doesNotMatch(serialized, /page_type|content_json/);
  });

  test("maps contractor company contact fields from context_echo", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        context_echo: {
          ...baseDto().context_echo,
          company_name: "Summit Roofing",
          company_phone: "918-555-0100",
          company_email: "ops@summit.test",
          company_website: "https://summit.test",
          company_address: "456 HQ Blvd",
          customer_phone: "555-CUSTOMER",
          customer_email: "customer@test.com",
        },
      })
    );

    assert.equal(packet.contact?.companyName, "Summit Roofing");
    assert.equal(packet.contact?.phone, "918-555-0100");
    assert.equal(packet.contact?.email, "ops@summit.test");
    assert.equal(packet.contact?.website, "https://summit.test");
    assert.equal(packet.contact?.address, "456 HQ Blvd");
    assert.notEqual(packet.contact?.phone, "555-CUSTOMER");
    assert.notEqual(packet.contact?.email, "customer@test.com");
  });

  test("omits missing contractor contact fields without placeholders", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        context_echo: {
          company_name: "Summit Roofing",
          customer_name: "Jane Homeowner",
          customer_phone: "555-CUSTOMER",
          customer_email: "customer@test.com",
          address_formatted: "123 Main St",
          template_name: "Roof Replacement",
        },
      })
    );

    assert.equal(packet.contact?.phone, null);
    assert.equal(packet.contact?.email, null);
    assert.equal(packet.contact?.website, null);
    assert.equal(packet.contact?.address, null);
    assert.equal(packet.contact?.companyName, "Summit Roofing");
  });

  test("cover media uses real url when present and omits fake stock placeholders", () => {
    const packet = buildCustomerPacketFromPublicDto(
      baseDto({
        context_echo: {
          ...baseDto().context_echo,
          job_photo_url: "https://cdn.example.com/job-front.jpg",
        },
      })
    );
    assert.equal(packet.cover.coverMediaUrl, "https://cdn.example.com/job-front.jpg");
    assert.doesNotMatch(JSON.stringify(packet.cover), /placeholder/i);
  });

  test("permit/admin fee lines stay in totals and full scope truth", () => {
    const dto = baseDto();
    const premium = dto.options.find((option) => option.source_template_option_id === TEMPLATE_OPT_B)!;
    premium.line_items = [
      ...premium.line_items,
      {
        source_template_item_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        customer_name: "Permit & admin fees",
        description: null,
        quantity: 1,
        quantity_display_label: "1",
        unit: "EA",
        customer_unit_price_cents: 25000,
        customer_line_total_cents: 25000,
        pricing_status: "priced",
        visible_to_customer: true,
        line_presentation_group: "included",
        upgrade_selection_state: null,
        upgrade_effect: null,
      },
    ];
    // Frozen total already includes the fee — do not recompute; keep snapshot truth.
    premium.customer_subtotal_cents = 50000;
    premium.sales_tax_cents = 2028;
    premium.customer_total_cents = 52028;

    const packet = buildCustomerPacketFromPublicDto(dto);
    assert.equal(packet.estimate?.totalInvestmentLabel, "$520.28");
    assert.ok(
      packet.estimate?.includedDetails.some((group) => group.title === "Permits & fees"),
      "full scope keeps Permits & fees"
    );
    assert.ok(
      packet.estimate?.scopeGroupSummaries.some((group) => group.title === "Permits & fees"),
      "presenter still emits Permits & fees summary (UI hides from main cards)"
    );
    assert.ok(packet.upgrades?.items.length === 1, "optional upgrades remain truthful");
  });

  test("cover media falls back to null without real urls", () => {
    const packet = buildCustomerPacketFromPublicDto(baseDto());
    assert.equal(packet.cover.coverMediaUrl, null);
  });
});
