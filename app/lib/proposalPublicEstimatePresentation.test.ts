/**
 * R18C4C — proposalPublicEstimatePresentation tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicEstimatePresentation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildProposalPublicEstimateLayout } from "./proposalPublicEstimatePresentation";
import type { ProposalPublicGraphDto } from "./proposalPublicGraphDto";

const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
const TEMPLATE_OPT_C = "99999999-9999-4999-8999-999999999999";

function baseDto(overrides: Partial<ProposalPublicGraphDto> = {}): ProposalPublicGraphDto {
  return {
    version_kind: "sent",
    frozen_at: "2026-06-26T12:00:00.000Z",
    context_echo: {},
    policy_echo: {},
    selected_template_option_id: TEMPLATE_OPT_B,
    pages: [],
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
            upgrade_selection_state: null,
            upgrade_effect: null,
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
        sort_order: 2,
        visible_to_customer: true,
        customer_subtotal_cents: 15000,
        discount_cents: 0,
        sales_tax_cents: 1200,
        customer_total_cents: 16200,
        line_items: [],
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

describe("buildProposalPublicEstimateLayout", () => {
  test("selected option renders as primary package first", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());

    assert.equal(layout.layout, "selected_primary");
    assert.equal(layout.primaryPackage?.optionKey, TEMPLATE_OPT_B);
    assert.equal(layout.primaryPackage?.label, "Premium");
    assert.equal(layout.selectedOption?.selectionMode, "frozen_selected");
  });

  test("other visible options render as alternates", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());

    assert.equal(layout.alternateOptions.length, 2);
    assert.deepEqual(
      layout.alternateOptions.map((option) => option.optionKey),
      [TEMPLATE_OPT_A, TEMPLATE_OPT_C]
    );
    assert.equal(layout.alternateOptions[0]?.totalInvestmentLabel, "$108.00");
    assert.equal(layout.alternateOptions[1]?.totalInvestmentLabel, "$162.00");
  });

  test("selected upgrades come from upgrade line_presentation_group on selected option only", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());

    assert.equal(layout.optionalUpgrades.length, 1);
    assert.equal(layout.optionalUpgrades[0]?.name, "Ridge Vent");
  });

  test("unselected upgrades are omitted from public estimate layout", () => {
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
    const layout = buildProposalPublicEstimateLayout(dto);
    assert.equal(layout.optionalUpgrades.length, 0);
  });

  test("raw catalog keys are transformed in customer-facing line names", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());
    const includedNames =
      layout.primaryPackage?.scopeGroups.flatMap((group) => group.lines.map((line) => line.name)) ?? [];

    assert.ok(includedNames.includes("Synthetic Underlayment"));
    assert.ok(!includedNames.some((name) => name.includes("roofing.")));
    assert.ok(!includedNames.some((name) => name.includes("_")));
  });

  test("selected total investment comes from persisted customer_total_cents", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());
    assert.equal(layout.primaryPackage?.totalInvestmentLabel, "$270.28");
  });

  test("hidden options are excluded from alternates", () => {
    const dto = baseDto({
      options: baseDto().options.map((option) =>
        option.source_template_option_id === TEMPLATE_OPT_C
          ? { ...option, visible_to_customer: false }
          : option
      ),
    });

    const layout = buildProposalPublicEstimateLayout(dto);
    assert.equal(layout.alternateOptions.length, 1);
    assert.equal(layout.alternateOptions[0]?.optionKey, TEMPLATE_OPT_A);
  });

  test("primary package includes scope group summaries for high-level display", () => {
    const layout = buildProposalPublicEstimateLayout(baseDto());

    assert.ok((layout.primaryPackage?.scopeGroupSummaries.length ?? 0) > 0);
    for (const summary of layout.primaryPackage?.scopeGroupSummaries ?? []) {
      assert.ok(summary.title.length > 0);
      assert.ok(summary.itemCount > 0);
      assert.ok(summary.previewLabel.length > 0);
    }
  });

  test("display policy hides totals when disabled", () => {
    const layout = buildProposalPublicEstimateLayout(
      baseDto({
        displayPolicy: {
          showLinePrices: false,
          showOptionTotals: false,
          showSectionHeadings: false,
        },
      })
    );

    assert.equal(layout.primaryPackage?.totalInvestmentLabel, null);
    assert.equal(layout.alternateOptions[0]?.totalInvestmentLabel, null);
  });
});
