/**
 * V2G — Public package comparison + pricing-truth tests.
 *
 * Run: npx tsx --test app/lib/proposalV2gPackageComparison.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  readEstimatePageSettingsFromProposalPage,
  resolveCustomerPackageComparisonVisible,
  resolveCustomerPreviewEstimateDisplayPolicy,
} from "./proposalCustomerEstimateDisplayPolicy";
import {
  buildCustomerPacketEstimateFromPublicDto,
  buildCustomerPacketFromPublicDto,
  formatCustomerPacketPriceCents,
} from "./proposalCustomerPacketPresenter";
import { buildProposalPublicGraphDto } from "./proposalPublicGraphDto";
import {
  buildProposalOwnedCustomerComparisonFromDraft,
  buildProposalOwnedCustomerFactLinesFromDraft,
} from "./proposalOwnedPackageComposition";
import type { ProposalDraftGraph, ProposalLineItemRow } from "./proposalRecordStore";
import {
  buildV2gMultiPackageDraftGraph,
  buildV2gMultiPackagePublicDto,
  isV2gFixtureLineInCustomerTotal,
  V2G_HIDDEN_LINE_NAME,
  V2G_REVIEW_FIXTURE_TAX_RATE,
  V2G_RUNTIME_OPT_A,
  V2G_RUNTIME_OPT_B,
  V2G_RUNTIME_OPT_C,
  V2G_TEMPLATE_OPT_A,
  V2G_TEMPLATE_OPT_B,
  V2G_TEMPLATE_OPT_C,
  V2G_TEMPLATE_OPT_ESSENTIAL,
  V2G_TEMPLATE_OPT_SIGNATURE,
  V2G_UPGRADE_LINE_TOTAL_CENTS,
  V2G_UPGRADE_NAME,
} from "./proposalV2gReviewFixtures";
import { mapTemplateSectionsToProposalPages } from "./proposalSnapshotBuilder";
import { readEstimatePageSettingsFromTemplate } from "./proposalTemplateEstimateSettings";
import { comparisonAttributesForPackage } from "./proposalCustomerPackageComparison";

const LIVE_STYLE_BASE_TOTAL_CENTS = 1_868_250;
const LIVE_STYLE_UPGRADE_CENTS = 7_500;
const LIVE_STYLE_ENHANCED_TOTAL_CENTS = LIVE_STYLE_BASE_TOTAL_CENTS + LIVE_STYLE_UPGRADE_CENTS;

function optionByTemplate(graph: ReturnType<typeof buildV2gMultiPackageDraftGraph>, templateId: string) {
  return graph.options.find((option) => option.source_template_option_id === templateId)!;
}

function requireCents(value: number | null | undefined): number {
  assert.equal(typeof value, "number");
  return value as number;
}

function pricedSubtotal(graph: ReturnType<typeof buildV2gMultiPackageDraftGraph>, runtimeOptionId: string): number {
  return graph.lineItems
    .filter((line) => line.proposal_option_id === runtimeOptionId && isV2gFixtureLineInCustomerTotal(line))
    .reduce((sum, line) => sum + (line.customer_line_total_cents ?? 0), 0);
}

function liveStyleLine(
  base: ProposalLineItemRow,
  overrides: Partial<ProposalLineItemRow> & {
    id: string;
    proposal_option_id: string;
    customer_name: string;
    customer_line_total_cents: number;
  }
): ProposalLineItemRow {
  return {
    ...base,
    composition_role: null,
    composition_slot_key: null,
    catalog_item_id: null,
    role: "standard",
    upgrade_selection_state: null,
    upgrade_effect: null,
    visible_to_customer: true,
    pricing_status: "priced",
    quantity: 1,
    quantity_display_label: "1",
    unit: "EA",
    customer_unit_price_cents: overrides.customer_line_total_cents,
    ...overrides,
  };
}

function liveStylePackageLines(
  base: ProposalLineItemRow,
  optionId: string,
  prefix: string,
  shingleLabel: string,
  underlaymentLabel: string,
  iceLabel: string,
  extraVentSelected: boolean | null
): ProposalLineItemRow[] {
  const lines: ProposalLineItemRow[] = [
    liveStyleLine(base, {
      id: `${prefix}-shingles`,
      proposal_option_id: optionId,
      customer_name: shingleLabel,
      catalog_seed_key: "roofing.architectural_shingles",
      customer_line_total_cents: 687_500,
      sort_order: 10,
    }),
    liveStyleLine(base, {
      id: `${prefix}-underlayment`,
      proposal_option_id: optionId,
      customer_name: underlaymentLabel,
      catalog_seed_key: "roofing.synthetic_underlayment",
      customer_line_total_cents: 96_250,
      sort_order: 20,
    }),
    liveStyleLine(base, {
      id: `${prefix}-ice`,
      proposal_option_id: optionId,
      customer_name: iceLabel,
      catalog_seed_key: "roofing.ice_water_valley",
      customer_line_total_cents: 24_000,
      sort_order: 30,
    }),
    liveStyleLine(base, {
      id: `${prefix}-vent`,
      proposal_option_id: optionId,
      customer_name: "roofing.roof_vent",
      catalog_seed_key: "roofing.roof_vent",
      customer_line_total_cents: 60_000,
      sort_order: 40,
    }),
    liveStyleLine(base, {
      id: `${prefix}-install`,
      proposal_option_id: optionId,
      customer_name: "Professional installation",
      catalog_seed_key: "roofing.install_labor",
      customer_line_total_cents: 1_000_500,
      sort_order: 50,
    }),
  ];
  if (extraVentSelected != null) {
    lines.unshift(
      liveStyleLine(base, {
        id: `${prefix}-extra-vent`,
        proposal_option_id: optionId,
        customer_name: "Additional roof ventilation",
        catalog_seed_key: "roofing.roof_vent",
        role: "optional_addon",
        customer_line_total_cents: LIVE_STYLE_UPGRADE_CENTS,
        upgrade_selection_state: extraVentSelected ? "selected" : "not_selected",
        upgrade_effect: "additive",
        sort_order: 5,
      })
    );
  }
  return lines;
}

function buildLiveStyleEqualTotalGraph(): ProposalDraftGraph {
  const graph = buildV2gMultiPackageDraftGraph({ omitComparisonKey: true });
  const base = graph.lineItems[0]!;
  graph.proposal.selected_option_id = V2G_RUNTIME_OPT_C;
  graph.lineItems = [
    ...liveStylePackageLines(
      base,
      V2G_RUNTIME_OPT_A,
      "std",
      "roofing.architectural_shingles",
      "roofing.synthetic_underlayment",
      "roofing.ice_water_valley",
      null
    ),
    ...liveStylePackageLines(
      base,
      V2G_RUNTIME_OPT_C,
      "enh",
      "roofing.architectural_shingles",
      "Enhanced underlayment",
      "Enhanced ice and water protection",
      true
    ),
    ...liveStylePackageLines(
      base,
      V2G_RUNTIME_OPT_B,
      "prem",
      "Premium shingle package",
      "Enhanced underlayment",
      "Enhanced ice and water protection",
      false
    ),
  ];
  for (const option of graph.options) {
    const total =
      option.id === V2G_RUNTIME_OPT_C ? LIVE_STYLE_ENHANCED_TOTAL_CENTS : LIVE_STYLE_BASE_TOTAL_CENTS;
    option.customer_subtotal_cents = total;
    option.sales_tax_cents = 0;
    option.customer_total_cents = total;
    option.discount_cents = 0;
    option.selected_at = option.id === V2G_RUNTIME_OPT_C ? "2026-07-21T22:59:34.309Z" : null;
  }
  return graph;
}

describe("V2G show_customer_package_comparison policy", () => {
  test("flag OFF suppresses comparison even with multiple packages", () => {
    assert.equal(
      resolveCustomerPackageComparisonVisible(
        resolveCustomerPreviewEstimateDisplayPolicy({
          show_customer_package_comparison: false,
        }),
        3
      ),
      false
    );
  });

  test("flag ON allows comparison when multiple packages exist", () => {
    assert.equal(
      resolveCustomerPackageComparisonVisible(
        resolveCustomerPreviewEstimateDisplayPolicy({
          show_customer_package_comparison: true,
        }),
        3
      ),
      true
    );
  });

  test("one visible package omits comparison regardless of flag", () => {
    assert.equal(
      resolveCustomerPackageComparisonVisible(
        resolveCustomerPreviewEstimateDisplayPolicy({
          show_customer_package_comparison: true,
        }),
        1
      ),
      false
    );
  });

  test("legacy unspecified flag preserves multi-package comparison", () => {
    assert.equal(
      resolveCustomerPackageComparisonVisible(resolveCustomerPreviewEstimateDisplayPolicy({}), 2),
      true
    );
  });

  test("frozen page settings without the key keep comparison allowed", () => {
    const settings = readEstimatePageSettingsFromProposalPage({ show_line_prices: true });
    const policy = resolveCustomerPreviewEstimateDisplayPolicy(settings);
    assert.equal(policy.showCustomerPackageComparison, undefined);
    assert.equal(resolveCustomerPackageComparisonVisible(policy, 2), true);
  });

  test("template metadata defaults comparison OFF for new setups", () => {
    const template = {
      id: "t1",
      company_id: "c1",
      name: "Roof",
      status: "active" as const,
      active: true,
      metadata: {},
    };
    assert.equal(readEstimatePageSettingsFromTemplate(template).show_customer_package_comparison, false);
  });
});

describe("V2G template → draft estimate settings copy", () => {
  test("instantiate copies show_customer_package_comparison onto estimate page", () => {
    const template = {
      id: "t1",
      company_id: "c1",
      name: "Roof",
      status: "active" as const,
      active: true,
      metadata: {
        estimate_page_settings: {
          show_customer_package_comparison: true,
        },
      },
    };
    const pages = mapTemplateSectionsToProposalPages({
      company_id: "c1",
      proposal_version_id: "v1",
      spineOptionId: "opt1",
      template,
      sections: [
        {
          id: "sec-est",
          template_id: "t1",
          option_id: "opt1",
          kind: "line_items",
          name: "Estimate",
          customer_title: null,
          sort_order: 0,
          metadata: {},
          content: {},
        },
      ],
    });
    const estimate = pages.find((page) => page.page_type === "estimate");
    assert.equal(estimate?.settings_json.show_customer_package_comparison, true);
  });
});

describe("V2G fixture pricing truth", () => {
  test("current architecture Standard → Enhanced → Premium totals stay differentiated", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const standard = optionByTemplate(graph, V2G_TEMPLATE_OPT_A);
    const enhanced = optionByTemplate(graph, V2G_TEMPLATE_OPT_C);
    const premium = optionByTemplate(graph, V2G_TEMPLATE_OPT_B);
    assert.equal(standard.customer_total_cents, 1_857_600);
    assert.equal(enhanced.customer_total_cents, 2_030_400);
    assert.equal(premium.customer_total_cents, 2_297_700);
    assert.ok(
      requireCents(standard.customer_total_cents) < requireCents(enhanced.customer_total_cents)
    );
    assert.ok(
      requireCents(enhanced.customer_total_cents) < requireCents(premium.customer_total_cents)
    );
  });

  test("line prices + selected upgrades + tax = customer_total_cents", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    for (const option of graph.options) {
      const subtotal = pricedSubtotal(graph, option.id);
      const tax = Math.round(subtotal * V2G_REVIEW_FIXTURE_TAX_RATE);
      assert.equal(option.customer_subtotal_cents, subtotal);
      assert.equal(option.sales_tax_cents, tax);
      assert.equal(option.customer_total_cents, subtotal + tax);
    }
  });

  test("selected upgrade is included only on the selected Premium option", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const premiumSubtotal = pricedSubtotal(graph, V2G_RUNTIME_OPT_B);
    const premiumWithoutUpgrade = graph.lineItems
      .filter(
        (line) =>
          line.proposal_option_id === V2G_RUNTIME_OPT_B &&
          isV2gFixtureLineInCustomerTotal(line) &&
          line.customer_name !== V2G_UPGRADE_NAME
      )
      .reduce((sum, line) => sum + (line.customer_line_total_cents ?? 0), 0);
    assert.equal(premiumSubtotal - premiumWithoutUpgrade, V2G_UPGRADE_LINE_TOTAL_CENTS);

    const standardUpgrade = graph.lineItems.find(
      (line) => line.proposal_option_id === V2G_RUNTIME_OPT_A && line.customer_name === V2G_UPGRADE_NAME
    );
    const enhancedUpgrade = graph.lineItems.find(
      (line) => line.proposal_option_id === V2G_RUNTIME_OPT_C && line.customer_name === V2G_UPGRADE_NAME
    );
    assert.equal(standardUpgrade?.upgrade_selection_state, "not_selected");
    assert.equal(enhancedUpgrade?.upgrade_selection_state, "not_selected");
    assert.ok(!graph.lineItems.some((line) =>
      line.proposal_option_id === V2G_RUNTIME_OPT_A &&
      isV2gFixtureLineInCustomerTotal(line) &&
      line.customer_name === V2G_UPGRADE_NAME
    ));
  });

  test("hidden lines do not inflate totals", () => {
    const visible = buildV2gMultiPackageDraftGraph();
    const hidden = buildV2gMultiPackageDraftGraph({ includeHiddenLine: true });
    assert.equal(
      optionByTemplate(visible, V2G_TEMPLATE_OPT_B).customer_total_cents,
      optionByTemplate(hidden, V2G_TEMPLATE_OPT_B).customer_total_cents
    );
  });
});

describe("V2G public comparison presenter", () => {
  test("flag OFF — no comparison, selected package still correct", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: false });
    const { estimate, comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    assert.equal(estimate?.optionKey, V2G_TEMPLATE_OPT_B);
    assert.equal(estimate?.label, "Premium");
    assert.equal(comparison, null);
  });

  test("flag ON — comparison uses the same dimensions across packages", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const { comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    assert.ok(comparison);
    assert.equal(comparison!.options.length, 3);
    assert.deepEqual(
      comparison!.dimensions.map((dimension) => dimension.label),
      ["Shingle system", "Underlayment", "Ice & water protection", "Ventilation"]
    );
    for (const option of comparison!.options) {
      assert.equal(option.cells.length, comparison!.dimensions.length);
    }
  });

  test("baseline package has meaningful included facts", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const { comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    const standard = comparison?.options.find((option) => option.label === "Standard");
    assert.deepEqual(
      standard?.cells.map((cell) => cell.valueLabel),
      [
        "Architectural shingles",
        "Synthetic underlayment",
        "Ice & water protection at valleys",
        "Available",
      ]
    );
  });

  test("step-up differences are obvious without Removed language", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const { comparison, estimate } = buildCustomerPacketEstimateFromPublicDto(dto);
    const enhanced = comparison?.options.find((option) => option.label === "Enhanced");
    const premium = comparison?.options.find((option) => option.label === "Premium");
    assert.equal(enhanced?.cells[0]?.valueLabel, "Architectural shingles");
    assert.equal(enhanced?.cells[1]?.valueLabel, "Premium underlayment");
    assert.equal(premium?.cells[0]?.valueLabel, "Designer shingles");
    const serialized = JSON.stringify({ comparison, estimate });
    assert.doesNotMatch(serialized, /\bAdded\b|\bRemoved\b/);
    assert.doesNotMatch(serialized, /composition_role|composition_slot_key|catalog_seed/);
  });

  test("arbitrary package names and counts are supported", () => {
    const dto = buildV2gMultiPackagePublicDto({
      comparisonEnabled: true,
      optionNames: [
        { id: V2G_TEMPLATE_OPT_ESSENTIAL, label: "Essential Care" },
        { id: V2G_TEMPLATE_OPT_SIGNATURE, label: "Signature Series" },
      ],
      selectedId: V2G_TEMPLATE_OPT_SIGNATURE,
    });
    const { estimate, comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    assert.equal(estimate?.label, "Signature Series");
    assert.equal(comparison?.options.length, 2);
    for (const option of comparison?.options ?? []) {
      assert.doesNotMatch(option.label, /^(Standard|Enhanced|Premium)$/);
    }
  });

  test("hero total equals selected frozen option total and selected comparison card", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const { estimate, comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    const frozenPremium = optionByTemplate(graph, V2G_TEMPLATE_OPT_B);
    const expected = formatCustomerPacketPriceCents(requireCents(frozenPremium.customer_total_cents));
    assert.equal(estimate?.totalInvestmentLabel, expected);
    const premium = comparison?.options.find((option) => option.isCurrent);
    assert.equal(premium?.totalInvestmentLabel, expected);
    assert.equal(premium?.totalInvestmentLabel, estimate?.totalInvestmentLabel);
  });

  test("alternate comparison totals equal corresponding frozen option totals", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const { comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    for (const option of graph.options) {
      const card = comparison?.options.find((row) => row.optionKey === option.source_template_option_id);
      assert.equal(card?.totalInvestmentLabel, formatCustomerPacketPriceCents(requireCents(option.customer_total_cents)));
    }
  });

  test("Preview and Public totals match for the same frozen option", () => {
    const graph = buildV2gMultiPackageDraftGraph({
      estimateSettings: { show_customer_package_comparison: true },
    });
    const publicDto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const previewDto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const publicPacket = buildCustomerPacketFromPublicDto(publicDto);
    const previewPacket = buildCustomerPacketFromPublicDto(previewDto);
    assert.equal(publicPacket.estimate?.totalInvestmentLabel, previewPacket.estimate?.totalInvestmentLabel);
    assert.deepEqual(
      publicPacket.comparison?.options.map((option) => option.totalInvestmentLabel),
      previewPacket.comparison?.options.map((option) => option.totalInvestmentLabel)
    );
    assert.deepEqual(publicPacket.comparison?.dimensions, previewPacket.comparison?.dimensions);
  });

  test("selected upgrades render once in upgrades, not as comparison included facts", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const packet = buildCustomerPacketFromPublicDto(dto);
    assert.equal(packet.upgrades?.items.length, 1);
    assert.match(packet.upgrades?.items[0]?.name ?? "", /Ridge vent/i);
    assert.equal(packet.estimate?.bullets.some((line) => /Ridge vent/i.test(line)), false);
    const premium = packet.comparison?.options.find((option) => option.isCurrent);
    assert.equal(premium?.cells.some((cell) => /Ridge vent/i.test(cell.valueLabel)), false);
    assert.equal(
      premium?.cells.find((cell, index) => packet.comparison?.dimensions[index]?.label === "Ventilation")
        ?.availability,
      "available"
    );
  });

  test("unselected optional upgrades are excluded from selected package scope and totals", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const packet = buildCustomerPacketFromPublicDto(dto);
    const standard = packet.comparison?.options.find((option) => option.label === "Standard");
    const standardFrozen = optionByTemplate(graph, V2G_TEMPLATE_OPT_A);
    assert.equal(standard?.totalInvestmentLabel, formatCustomerPacketPriceCents(requireCents(standardFrozen.customer_total_cents)));
    const standardDto = dto.options.find((option) => option.name === "Standard");
    assert.equal(
      standardDto?.line_items.some((line) => /Ridge vent/i.test(line.customer_name)),
      false
    );
  });
});

describe("V2G frozen composition truth", () => {
  test("Public DTO derives customer_fact_lines from draft-owned composition", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const facts = buildProposalOwnedCustomerFactLinesFromDraft(graph);
    assert.ok((facts.get(V2G_TEMPLATE_OPT_B) ?? []).length > 0);
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const premium = dto.options.find(
      (option) => option.source_template_option_id === V2G_TEMPLATE_OPT_B
    );
    assert.deepEqual(premium?.customer_fact_lines, facts.get(V2G_TEMPLATE_OPT_B));
  });

  test("Public DTO comparison attributes match owned composition matrix", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const matrix = buildProposalOwnedCustomerComparisonFromDraft(graph);
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const expected = comparisonAttributesForPackage(matrix, V2G_TEMPLATE_OPT_B);
    const premium = dto.options.find((option) => option.source_template_option_id === V2G_TEMPLATE_OPT_B);
    assert.deepEqual(premium?.comparison_attributes, expected);
  });

  test("flag OFF on frozen estimate page settings flows into displayPolicy", () => {
    const graph = buildV2gMultiPackageDraftGraph({
      estimateSettings: { show_customer_package_comparison: false },
    });
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    assert.equal(dto.displayPolicy.showCustomerPackageComparison, false);
  });

  test("Public DTO with absent comparison key keeps comparison on", () => {
    const graph = buildV2gMultiPackageDraftGraph({ omitComparisonKey: true });
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    assert.equal(dto.displayPolicy.showCustomerPackageComparison, undefined);
    const { comparison } = buildCustomerPacketEstimateFromPublicDto(dto);
    assert.ok(comparison);
    assert.equal(comparison!.options.length, 3);
  });

  test("hidden customer lines do not appear in composition facts or comparison", () => {
    const graph = buildV2gMultiPackageDraftGraph({ includeHiddenLine: true });
    const facts = buildProposalOwnedCustomerFactLinesFromDraft(graph);
    for (const lines of facts.values()) {
      for (const line of lines) {
        assert.doesNotMatch(line, /Hidden internal line/i);
      }
    }
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(V2G_HIDDEN_LINE_NAME, "i"));
  });

  test("Public DTO option totals copy frozen graph totals without recalculation", () => {
    const graph = buildV2gMultiPackageDraftGraph();
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    for (const option of graph.options) {
      const dtoOption = dto.options.find(
        (row) => row.source_template_option_id === option.source_template_option_id
      );
      assert.equal(dtoOption?.customer_total_cents, option.customer_total_cents);
      assert.equal(dtoOption?.customer_subtotal_cents, option.customer_subtotal_cents);
      assert.equal(dtoOption?.sales_tax_cents, option.sales_tax_cents);
    }
  });
});

describe("V2G live-style frozen graph", () => {
  test("equal frozen totals remain equal and do not invent a price delta", () => {
    const graph = buildLiveStyleEqualTotalGraph();
    const standard = optionByTemplate(graph, V2G_TEMPLATE_OPT_A);
    const enhanced = optionByTemplate(graph, V2G_TEMPLATE_OPT_C);
    const premium = optionByTemplate(graph, V2G_TEMPLATE_OPT_B);
    assert.equal(standard.customer_total_cents, LIVE_STYLE_BASE_TOTAL_CENTS);
    assert.equal(premium.customer_total_cents, LIVE_STYLE_BASE_TOTAL_CENTS);
    assert.equal(standard.customer_total_cents, premium.customer_total_cents);
    assert.equal(enhanced.customer_total_cents, LIVE_STYLE_ENHANCED_TOTAL_CENTS);
    assert.equal(
      requireCents(enhanced.customer_total_cents) - requireCents(standard.customer_total_cents),
      LIVE_STYLE_UPGRADE_CENTS
    );
    assert.equal(pricedSubtotal(graph, V2G_RUNTIME_OPT_A), standard.customer_subtotal_cents);
    assert.equal(pricedSubtotal(graph, V2G_RUNTIME_OPT_C), enhanced.customer_subtotal_cents);
    assert.equal(pricedSubtotal(graph, V2G_RUNTIME_OPT_B), premium.customer_subtotal_cents);
    for (const option of graph.options) {
      assert.equal(
        requireCents(option.customer_subtotal_cents) + requireCents(option.sales_tax_cents),
        option.customer_total_cents
      );
    }
  });

  test("selected additional ventilation affects only the owning Enhanced option", () => {
    const graph = buildLiveStyleEqualTotalGraph();
    const selected = graph.lineItems.filter(
      (line) =>
        line.customer_name === "Additional roof ventilation" &&
        line.upgrade_selection_state === "selected"
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.proposal_option_id, V2G_RUNTIME_OPT_C);
    const premiumUpgrade = graph.lineItems.find(
      (line) =>
        line.proposal_option_id === V2G_RUNTIME_OPT_B &&
        line.customer_name === "Additional roof ventilation"
    );
    assert.equal(premiumUpgrade?.upgrade_selection_state, "not_selected");
    assert.equal(
      graph.lineItems.some(
        (line) =>
          line.proposal_option_id === V2G_RUNTIME_OPT_A &&
          line.customer_name === "Additional roof ventilation"
      ),
      false
    );
  });

  test("hero, comparison, Preview, and Public totals all copy frozen option totals", () => {
    const graph = buildLiveStyleEqualTotalGraph();
    const publicDto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_C);
    const previewDto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_C);
    const publicPacket = buildCustomerPacketFromPublicDto(publicDto);
    const previewPacket = buildCustomerPacketFromPublicDto(previewDto);
    const frozenEnhanced = optionByTemplate(graph, V2G_TEMPLATE_OPT_C);
    const expected = formatCustomerPacketPriceCents(requireCents(frozenEnhanced.customer_total_cents));
    assert.equal(publicPacket.estimate?.totalInvestmentLabel, expected);
    assert.equal(previewPacket.estimate?.totalInvestmentLabel, expected);
    const publicSelected = publicPacket.comparison?.options.find((option) => option.isCurrent);
    const previewSelected = previewPacket.comparison?.options.find((option) => option.isCurrent);
    assert.equal(publicSelected?.totalInvestmentLabel, expected);
    assert.equal(previewSelected?.totalInvestmentLabel, expected);
    for (const option of graph.options) {
      const card = publicPacket.comparison?.options.find(
        (row) => row.optionKey === option.source_template_option_id
      );
      assert.equal(
        card?.totalInvestmentLabel,
        formatCustomerPacketPriceCents(requireCents(option.customer_total_cents))
      );
    }
    const standardCard = publicPacket.comparison?.options.find((option) => option.label === "Standard");
    const premiumCard = publicPacket.comparison?.options.find((option) => option.label === "Premium");
    assert.equal(standardCard?.totalInvestmentLabel, premiumCard?.totalInvestmentLabel);
    assert.doesNotMatch(JSON.stringify(publicPacket.comparison), /Best value|Most popular|Recommended|Save \$/);
  });

  test("included Roof Vent stays in comparison while selected additional ventilation stays in upgrades", () => {
    const graph = buildLiveStyleEqualTotalGraph();
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_C);
    const packet = buildCustomerPacketFromPublicDto(dto);
    const ventIndex = packet.comparison?.dimensions.findIndex((dimension) => dimension.label === "Ventilation") ?? -1;
    assert.ok(ventIndex >= 0);
    for (const option of packet.comparison?.options ?? []) {
      assert.equal(option.cells[ventIndex]?.valueLabel, "Roof Vent");
      assert.equal(option.cells[ventIndex]?.availability, "included");
    }
    assert.equal(packet.upgrades?.items.length, 1);
    assert.match(packet.upgrades?.items[0]?.name ?? "", /Additional roof ventilation/i);
    assert.equal(
      packet.comparison?.options.some((option) =>
        option.cells.some((cell) => /Additional roof ventilation/i.test(cell.valueLabel))
      ),
      false
    );
    const premium = dto.options.find((option) => option.name === "Premium");
    assert.equal(
      premium?.line_items.some((line) => /Additional roof ventilation/i.test(line.customer_name)),
      false
    );
  });

  test("Premium shingle package uses the frozen customer label, not a catalog fallback", () => {
    const graph = buildLiveStyleEqualTotalGraph();
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_C);
    const packet = buildCustomerPacketFromPublicDto(dto);
    const shingleIndex =
      packet.comparison?.dimensions.findIndex((dimension) => dimension.label === "Shingle system") ?? -1;
    const premium = packet.comparison?.options.find((option) => option.label === "Premium");
    assert.equal(premium?.cells[shingleIndex]?.valueLabel, "Premium shingle package");
    assert.doesNotMatch(JSON.stringify(packet.comparison), /roofing\./);
  });
});

describe("V2G negatives", () => {
  test("public packet DTO options omit composition identity fields", () => {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    for (const option of dto.options) {
      const record = option as unknown as Record<string, unknown>;
      assert.equal("composition_role" in record, false);
      assert.equal("composition_slot_key" in record, false);
    }
    assert.doesNotMatch(JSON.stringify(dto.options), /composition_role|composition_slot_key/);
  });

  test("V2G comparison path does not import production pricing engines", () => {
    const files = [
      new URL("./proposalCustomerPackageComparison.ts", import.meta.url),
      new URL("./proposalCustomerPacketPresenter.ts", import.meta.url),
      new URL("./proposalV2gReviewFixtures.ts", import.meta.url),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /proposalPricingEngine|proposalPricingInputMapper|proposalQuantityResolver/);
    }
    const presenter = readFileSync(new URL("./proposalCustomerPacketPresenter.ts", import.meta.url), "utf8");
    assert.doesNotMatch(presenter, /proposalPricingEngine|getSupabaseClient/);
    assert.doesNotMatch(presenter, /from\("catalog_items"\)/);
  });
});
