/**
 * Optional Upgrade Truth — pure contribution / replacement tests.
 *
 * Run: npx tsx --test app/lib/proposalUpgradeTruth.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveProposalPricing } from "./proposalPricingEngine";
import type { PricingLineInput, PricingPolicy } from "./proposalPricingTypes";
import { DEFAULT_WASTE_MODEL } from "./proposalPricingTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";
import {
  applyUpgradeTruthToPricingLines,
  buildInitialUpgradeChoicePersistRows,
  mergeUpgradeChoicePersistRowsWithTemplateDefaults,
  upgradeChoicesToMap,
} from "./proposalUpgradeTruth";
import type { ProposalOptionUpgradeChoicePersistRow } from "./proposalUpgradeTruthTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const OPTION_ID = "opt-1";
const SECTION_ID = "sec-1";

function basePolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 50,
    minimumProfitabilityPct: 20,
    quantityRounding: "exact",
    wasteModel: DEFAULT_WASTE_MODEL,
    tax: {
      salesTaxRatePct: 0,
      materialPurchaseTaxRatePct: 0,
    },
    ...overrides,
  };
}

function templateItem(
  overrides: Partial<ProposalTemplateItem> & Pick<ProposalTemplateItem, "id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: "cat-default",
    item_role: "standard",
    ...overrides,
  };
}

function graphForItems(items: ProposalTemplateItem[]): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Test template",
      status: "active",
      active: true,
    },
    options: [
      {
        id: OPTION_ID,
        template_id: TEMPLATE_ID,
        name: "Good",
        is_default: true,
        sort_order: 0,
      },
    ],
    sections: [
      {
        id: SECTION_ID,
        template_id: TEMPLATE_ID,
        option_id: OPTION_ID,
        section_type: "line_items",
        name: "Scope",
        sort_order: 0,
      },
    ],
    items,
  };
}

function line(
  overrides: Partial<PricingLineInput> & Pick<PricingLineInput, "templateItemId">
): PricingLineInput {
  return {
    catalogItemId: "cat-1",
    itemRole: "standard",
    itemType: "material",
    unit: "square",
    pricingBasis: "cost_plus_margin",
    quantity: 1,
    quantityUnresolved: false,
    unitCostCents: 10_000,
    unitPriceCents: null,
    laborUnitCostCents: null,
    tax: null,
    customerVisibility: "customer_visible",
    ...overrides,
  };
}

describe("applyUpgradeTruthToPricingLines", () => {
  test("unselected additive upgrade does not suppress and stays not_selected", () => {
    const base = templateItem({ id: "base-1", item_role: "standard", catalog_item_id: "cat-base" });
    const upgrade = templateItem({
      id: "upg-1",
      item_role: "upgrade",
      catalog_item_id: "cat-upg",
      upgrade_effect: "additive",
      default_selected: false,
    });
    const graph = graphForItems([base, upgrade]);
    const choices = upgradeChoicesToMap([
      {
        source_template_item_id: "upg-1",
        selection_state: "not_selected",
        upgrade_effect: "additive",
        replaces_source_template_item_id: null,
      },
    ]);

    const { lines, suppressedTemplateItemIds } = applyUpgradeTruthToPricingLines({
      optionId: OPTION_ID,
      graph,
      choicesByTemplateItemId: choices,
      lines: [
        line({ templateItemId: "base-1", catalogItemId: "cat-base" }),
        line({ templateItemId: "upg-1", catalogItemId: "cat-upg" }),
      ],
    });

    assert.equal(suppressedTemplateItemIds.size, 0);
    assert.equal(lines.find((l) => l.templateItemId === "upg-1")?.upgradeScope?.selectionState, "not_selected");
    assert.equal(lines.find((l) => l.templateItemId === "base-1")?.suppressedByReplacement, false);
  });

  test("selected additive upgrade is selected and does not suppress base", () => {
    const base = templateItem({ id: "base-1", item_role: "standard", catalog_item_id: "cat-base" });
    const upgrade = templateItem({
      id: "upg-1",
      item_role: "upgrade",
      catalog_item_id: "cat-upg",
      upgrade_effect: "additive",
      default_selected: false,
    });
    const graph = graphForItems([base, upgrade]);
    const choices = upgradeChoicesToMap([
      {
        source_template_item_id: "upg-1",
        selection_state: "selected",
        upgrade_effect: "additive",
        replaces_source_template_item_id: null,
      },
    ]);

    const { lines, suppressedTemplateItemIds } = applyUpgradeTruthToPricingLines({
      optionId: OPTION_ID,
      graph,
      choicesByTemplateItemId: choices,
      lines: [
        line({ templateItemId: "base-1", catalogItemId: "cat-base" }),
        line({ templateItemId: "upg-1", catalogItemId: "cat-upg" }),
      ],
    });

    assert.equal(suppressedTemplateItemIds.size, 0);
    assert.equal(lines.find((l) => l.templateItemId === "upg-1")?.upgradeScope?.selectionState, "selected");
    assert.equal(lines.find((l) => l.templateItemId === "base-1")?.suppressedByReplacement, false);
  });

  test("selected replacement upgrade suppresses the replaced base line", () => {
    const base = templateItem({ id: "base-1", item_role: "standard", catalog_item_id: "cat-base" });
    const upgrade = templateItem({
      id: "upg-1",
      item_role: "upgrade",
      catalog_item_id: "cat-upg",
      upgrade_effect: "replacement",
      replaces_template_item_id: "base-1",
      default_selected: false,
    });
    const graph = graphForItems([base, upgrade]);
    const choices = upgradeChoicesToMap([
      {
        source_template_item_id: "upg-1",
        selection_state: "selected",
        upgrade_effect: "replacement",
        replaces_source_template_item_id: "base-1",
      },
    ]);

    const { lines, suppressedTemplateItemIds } = applyUpgradeTruthToPricingLines({
      optionId: OPTION_ID,
      graph,
      choicesByTemplateItemId: choices,
      lines: [
        line({ templateItemId: "base-1", catalogItemId: "cat-base" }),
        line({ templateItemId: "upg-1", catalogItemId: "cat-upg" }),
      ],
    });

    assert.ok(suppressedTemplateItemIds.has("base-1"));
    assert.equal(lines.find((l) => l.templateItemId === "base-1")?.suppressedByReplacement, true);
    assert.equal(lines.find((l) => l.templateItemId === "upg-1")?.upgradeScope?.selectionState, "selected");
  });

  test("deselecting a replacement upgrade restores the base line", () => {
    const base = templateItem({ id: "base-1", item_role: "standard", catalog_item_id: "cat-base" });
    const upgrade = templateItem({
      id: "upg-1",
      item_role: "upgrade",
      catalog_item_id: "cat-upg",
      upgrade_effect: "replacement",
      replaces_template_item_id: "base-1",
      default_selected: true,
    });
    const graph = graphForItems([base, upgrade]);
    const choices = upgradeChoicesToMap([
      {
        source_template_item_id: "upg-1",
        selection_state: "not_selected",
        upgrade_effect: "replacement",
        replaces_source_template_item_id: "base-1",
      },
    ]);

    const { lines, suppressedTemplateItemIds } = applyUpgradeTruthToPricingLines({
      optionId: OPTION_ID,
      graph,
      choicesByTemplateItemId: choices,
      lines: [
        line({ templateItemId: "base-1", catalogItemId: "cat-base" }),
        line({ templateItemId: "upg-1", catalogItemId: "cat-upg" }),
      ],
    });

    assert.equal(suppressedTemplateItemIds.size, 0);
    assert.equal(lines.find((l) => l.templateItemId === "base-1")?.suppressedByReplacement, false);
    assert.equal(lines.find((l) => l.templateItemId === "upg-1")?.upgradeScope?.selectionState, "not_selected");
  });
});

describe("upgrade contribution via pricing engine", () => {
  function pricedLines(params: {
    baseSelected?: boolean;
    upgradeSelection: "selected" | "not_selected";
    effect: "additive" | "replacement";
  }): PricingLineInput[] {
    const baseCost = 10_000;
    const upgradeCost = params.effect === "replacement" ? 20_000 : 5_000;
    const baseItem = templateItem({
      id: "base-1",
      item_role: "standard",
      catalog_item_id: "cat-base",
    });
    const upgradeItem = templateItem({
      id: "upg-1",
      item_role: "upgrade",
      catalog_item_id: "cat-upg",
      upgrade_effect: params.effect,
      replaces_template_item_id: params.effect === "replacement" ? "base-1" : null,
      default_selected: false,
    });
    const graph = graphForItems([baseItem, upgradeItem]);
    const { lines } = applyUpgradeTruthToPricingLines({
      optionId: OPTION_ID,
      graph,
      choicesByTemplateItemId: upgradeChoicesToMap([
        {
          source_template_item_id: "upg-1",
          selection_state: params.upgradeSelection,
          upgrade_effect: params.effect,
          replaces_source_template_item_id:
            params.effect === "replacement" ? "base-1" : null,
        },
      ]),
      lines: [
        line({
          templateItemId: "base-1",
          catalogItemId: "cat-base",
          itemRole: "standard",
          unitCostCents: baseCost,
        }),
        line({
          templateItemId: "upg-1",
          catalogItemId: "cat-upg",
          itemRole: "upgrade",
          unitCostCents: upgradeCost,
        }),
      ],
    });
    return lines;
  }

  test("unselected additive upgrade is excluded from customer subtotal", () => {
    const unselected = resolveProposalPricing({
      policy: basePolicy(),
      actorRole: "rep",
      optionId: OPTION_ID,
      lines: pricedLines({ upgradeSelection: "not_selected", effect: "additive" }),
    });
    const selected = resolveProposalPricing({
      policy: basePolicy(),
      actorRole: "rep",
      optionId: OPTION_ID,
      lines: pricedLines({ upgradeSelection: "selected", effect: "additive" }),
    });

    assert.ok((unselected.options[0]?.customerSubtotalCents ?? 0) > 0);
    assert.ok(
      (selected.options[0]?.customerSubtotalCents ?? 0) >
        (unselected.options[0]?.customerSubtotalCents ?? 0),
      "selecting additive upgrade must increase customer subtotal"
    );
  });

  test("selected replacement suppresses base contribution; deselect restores it", () => {
    const baseline = resolveProposalPricing({
      policy: basePolicy(),
      actorRole: "rep",
      optionId: OPTION_ID,
      lines: pricedLines({ upgradeSelection: "not_selected", effect: "replacement" }),
    });
    const replaced = resolveProposalPricing({
      policy: basePolicy(),
      actorRole: "rep",
      optionId: OPTION_ID,
      lines: pricedLines({ upgradeSelection: "selected", effect: "replacement" }),
    });
    const restored = resolveProposalPricing({
      policy: basePolicy(),
      actorRole: "rep",
      optionId: OPTION_ID,
      lines: pricedLines({ upgradeSelection: "not_selected", effect: "replacement" }),
    });

    assert.notEqual(
      baseline.options[0]?.customerSubtotalCents,
      replaced.options[0]?.customerSubtotalCents
    );
    assert.equal(
      baseline.options[0]?.customerSubtotalCents,
      restored.options[0]?.customerSubtotalCents
    );
  });
});

describe("buildInitialUpgradeChoicePersistRows / merge", () => {
  test("initial rows use template default_selected", () => {
    const items = [
      templateItem({
        id: "upg-off",
        item_role: "upgrade",
        default_selected: false,
        upgrade_effect: "additive",
      }),
      templateItem({
        id: "upg-on",
        item_role: "optional_addon",
        default_selected: true,
        upgrade_effect: "additive",
      }),
      templateItem({ id: "std", item_role: "standard" }),
    ];
    const rows = buildInitialUpgradeChoicePersistRows({
      graph: graphForItems(items),
      optionId: OPTION_ID,
    });
    assert.deepEqual(
      rows.map((r) => [r.source_template_item_id, r.selection_state]),
      [
        ["upg-off", "not_selected"],
        ["upg-on", "selected"],
      ]
    );
  });

  test("merge preserves persisted selection and re-derives effect from template", () => {
    const items = [
      templateItem({
        id: "upg-1",
        item_role: "upgrade",
        default_selected: false,
        upgrade_effect: "replacement",
        replaces_template_item_id: "base-1",
      }),
      templateItem({ id: "base-1", item_role: "standard" }),
    ];
    const existing: ProposalOptionUpgradeChoicePersistRow[] = [
      {
        source_template_item_id: "upg-1",
        selection_state: "selected",
        upgrade_effect: "additive",
        replaces_source_template_item_id: null,
      },
    ];
    const merged = mergeUpgradeChoicePersistRowsWithTemplateDefaults({
      graph: graphForItems(items),
      optionId: OPTION_ID,
      existing,
    });
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.selection_state, "selected");
    assert.equal(merged[0]!.upgrade_effect, "replacement");
    assert.equal(merged[0]!.replaces_source_template_item_id, "base-1");
  });
});
