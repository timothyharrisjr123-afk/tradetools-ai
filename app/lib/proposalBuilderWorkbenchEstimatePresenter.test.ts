/**
 * R17C2 Phase 1 — Builder workbench estimate presentation mapper tests.
 *
 * Run: npx tsx --test app/lib/proposalBuilderWorkbenchEstimatePresenter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { ProposalBuilderLineCustomerView } from "./proposalBuilderPricingPreview";
import {
  WORKBENCH_CUSTOMER_PACKAGE_CHOICE_HINT,
  WORKBENCH_DISPLAY_SETTINGS_COMING_SOON_BADGE,
  WORKBENCH_DISPLAY_SETTINGS_ENTRY_LABEL,
  WORKBENCH_HIDDEN_FROM_CUSTOMER_LABEL,
  WORKBENCH_LINE_INCLUDED_LABEL,
  WORKBENCH_SCOPE_REVIEW_ROW_HELPER,
  WORKBENCH_TOTALS_INCOMPLETE_COPY,
  WORKBENCH_UPGRADES_EMPTY_COPY,
  buildProposalWorkbenchEstimatePresentation,
  type BuildProposalWorkbenchEstimatePresentationInput,
  type WorkbenchAttentionReason,
} from "./proposalBuilderWorkbenchEstimatePresenter";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const OPTION_STANDARD = "opt-standard";
const OPTION_ENHANCED = "opt-enhanced";

function catalog(overrides: Partial<CatalogItem> & Pick<CatalogItem, "id">): CatalogItem {
  return {
    company_id: COMPANY_ID,
    name: overrides.name ?? overrides.id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    unit_price_cents: 12_500,
    ...overrides,
  };
}

function option(
  id: string,
  overrides: Partial<ProposalTemplateOption> = {}
): ProposalTemplateOption {
  return {
    id,
    template_id: TEMPLATE_ID,
    name: id.replace("opt-", ""),
    customer_label: id === OPTION_STANDARD ? "Standard" : "Enhanced",
    selection_mode: "single",
    is_default: id === OPTION_STANDARD,
    visible_to_customer: true,
    sort_order: id === OPTION_STANDARD ? 0 : 1,
    ...overrides,
  };
}

function section(
  id: string,
  kind: ProposalTemplateSection["kind"],
  optionId: string,
  overrides: Partial<ProposalTemplateSection> = {}
): ProposalTemplateSection {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: optionId,
    kind,
    name: id,
    customer_title: null,
    sort_order: 0,
    customer_visibility: "customer_visible",
    content: null,
    metadata: null,
    ...overrides,
  };
}

function item(
  overrides: Partial<ProposalTemplateItem> &
    Pick<ProposalTemplateItem, "id" | "section_id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    option_id: OPTION_STANDARD,
    catalog_item_id: "cat-1",
    item_role: "standard",
    sort_order: 0,
    ...overrides,
  };
}

function graph(
  options: ProposalTemplateOption[],
  sections: ProposalTemplateSection[],
  items: ProposalTemplateItem[]
): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Test template",
      status: "active",
    },
    options,
    sections,
    items,
  };
}

function lineView(
  templateItemId: string,
  displayStatus: ProposalBuilderLineCustomerView["displayStatus"],
  overrides: Partial<ProposalBuilderLineCustomerView> = {}
): ProposalBuilderLineCustomerView {
  const showPrice = displayStatus === "priced";
  return {
    templateItemId,
    sectionId: "sec-scope",
    displayStatus,
    showPrice,
    customerLinePriceCents: showPrice ? 12_500 : null,
    customerVisibility: "customer_visible",
    ...overrides,
  };
}

function optionCustomerView(
  lineByTemplateItemId: Record<string, ProposalBuilderLineCustomerView>,
  overrides: Partial<NonNullable<BuildProposalWorkbenchEstimatePresentationInput["optionCustomerView"]>> = {}
): NonNullable<BuildProposalWorkbenchEstimatePresentationInput["optionCustomerView"]> {
  return {
    optionId: OPTION_STANDARD,
    pricingComplete: true,
    customerSubtotalCents: 12_500,
    discountCents: 0,
    salesTaxCents: 0,
    customerTotalCents: 12_500,
    lines: Object.values(lineByTemplateItemId),
    lineByTemplateItemId,
    ...overrides,
  };
}

function snapshotQty(
  templateItemId: string,
  quantityDisplayLabel: string
): Record<string, { templateItemId: string; quantityDisplayLabel: string; quantitySourceLabel: string; unitLabel: string }> {
  return {
    [templateItemId]: {
      templateItemId,
      quantityDisplayLabel,
      quantitySourceLabel: "Measurement",
      unitLabel: "square",
    },
  };
}

function buildInput(
  overrides: Partial<BuildProposalWorkbenchEstimatePresentationInput> = {}
): BuildProposalWorkbenchEstimatePresentationInput {
  const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD, {
    name: "Roofing materials",
    customer_title: "Roofing materials",
  });
  const upgradeSection = section("sec-upgrades", "upgrade_group", OPTION_STANDARD, {
    name: "Premium upgrades",
    customer_title: "Premium upgrades",
  });
  const templateGraph = graph(
    [option(OPTION_STANDARD), option(OPTION_ENHANCED)],
    [scopeSection, upgradeSection],
    [
      item({ id: "line-priced", section_id: "sec-scope" }),
      item({ id: "line-upgrade", section_id: "sec-upgrades" }),
    ]
  );

  return {
    graph: templateGraph,
    sections: [scopeSection, upgradeSection],
    catalogItems: [catalog({ id: "cat-1", name: "Shingles" })],
    optionCustomerView: optionCustomerView({
      "line-priced": lineView("line-priced", "priced"),
      "line-upgrade": lineView("line-upgrade", "priced", {
        customerLinePriceCents: 2_500,
      }),
    }),
    selectedOptionId: OPTION_STANDARD,
    effectiveOptionId: OPTION_STANDARD,
    pricingPolicyConfigured: true,
    snapshotQuantityByTemplateItemId: {
      ...snapshotQty("line-priced", "24 sq"),
      ...snapshotQty("line-upgrade", "1 ea"),
    },
    ...overrides,
  };
}

describe("buildProposalWorkbenchEstimatePresentation", () => {
  test("all-ready lines classified into readyScope", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.readyScope.sections.length, 1);
    assert.equal(result.readyScope.sections[0]?.lines.length, 1);
    assert.equal(result.readyScope.sections[0]?.lines[0]?.statusKind, "priced");
    assert.equal(result.readyScope.sections[0]?.lines[0]?.amountLabel, "$125.00");
    assert.equal(result.needsAttention.show, false);
    assert.equal(result.meta.readyLineCount, 1);
  });

  test("quantity blocker lines classified into scopeReview bucket", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-blocked", section_id: "sec-scope" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: snapshotQty("line-blocked", "24 sq"),
        optionCustomerView: optionCustomerView(
          { "line-blocked": lineView("line-blocked", "needs_quantity") },
          { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }
        ),
      })
    );

    assert.equal(result.readyScope.sections.length, 0);
    assert.equal(result.needsAttention.show, true);
    assert.equal(result.needsAttention.lines.length, 1);
    assert.deepEqual(result.needsAttention.lines[0]?.reasons, ["needs_quantity"]);
    assert.equal(result.needsAttention.lines[0]?.attentionKind, "scope_review");
    assert.equal(result.needsAttention.lines[0]?.amountLabel, "Needs quantity");
    assert.equal(result.needsAttention.lines[0]?.suggestedAction, WORKBENCH_SCOPE_REVIEW_ROW_HELPER);
    assert.equal(result.needsAttention.scopeReview.show, true);
    assert.equal(result.needsAttention.scopeReview.count, 1);
    assert.equal(result.needsAttention.hardBlockers.show, false);
    assert.equal(result.meta.attentionLineCount, 1);
    assert.equal(result.meta.scopeReviewLineCount, 1);
    assert.equal(result.meta.hardBlockerLineCount, 0);
  });

  test("not_priced classified into hardBlockers", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-not-priced", section_id: "sec-scope" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: snapshotQty("line-not-priced", "24 sq"),
        optionCustomerView: optionCustomerView(
          { "line-not-priced": lineView("line-not-priced", "not_priced") },
          { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }
        ),
      })
    );

    assert.equal(result.readyScope.sections.length, 0);
    assert.equal(result.needsAttention.lines[0]?.reasons.includes("not_priced"), true);
    assert.equal(result.needsAttention.lines[0]?.attentionKind, "hard_blocker");
    assert.equal(result.needsAttention.hardBlockers.count, 1);
    assert.equal(result.needsAttention.scopeReview.count, 0);
  });

  test("missing catalog classified into hardBlockers", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-missing", section_id: "sec-scope", catalog_item_id: "missing-cat" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        catalogItems: [],
        optionCustomerView: optionCustomerView(
          { "line-missing": lineView("line-missing", "not_priced") },
          { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }
        ),
      })
    );

    assert.equal(result.needsAttention.lines[0]?.reasons.includes("missing_catalog"), true);
    assert.equal(result.needsAttention.lines[0]?.attentionKind, "hard_blocker");
    assert.equal(result.needsAttention.lines[0]?.suggestedAction, "Link a catalog item for this line.");
    assert.equal(result.needsAttention.hardBlockers.show, true);
    assert.equal(result.meta.hardBlockerLineCount, 1);
  });

  test("hard blockers and scope review split when both exist", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [
        item({ id: "line-ready", section_id: "sec-scope" }),
        item({ id: "line-blocked", section_id: "sec-scope" }),
        item({ id: "line-missing", section_id: "sec-scope", catalog_item_id: "missing-cat" }),
      ]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        catalogItems: [catalog({ id: "cat-1" })],
        snapshotQuantityByTemplateItemId: {
          ...snapshotQty("line-ready", "24 sq"),
          ...snapshotQty("line-blocked", "24 sq"),
        },
        optionCustomerView: optionCustomerView(
          {
            "line-ready": lineView("line-ready", "priced"),
            "line-blocked": lineView("line-blocked", "needs_quantity"),
            "line-missing": lineView("line-missing", "not_priced"),
          },
          { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }
        ),
      })
    );

    assert.equal(result.needsAttention.hardBlockers.count, 1);
    assert.equal(result.needsAttention.scopeReview.count, 1);
    assert.equal(result.needsAttention.hardBlockers.lines[0]?.templateItemId, "line-missing");
    assert.equal(result.needsAttention.scopeReview.lines[0]?.templateItemId, "line-blocked");
    assert.equal(result.meta.hardBlockerLineCount, 1);
    assert.equal(result.meta.scopeReviewLineCount, 1);
    assert.equal(result.meta.attentionLineCount, 2);
  });

  test("upgrade_group sections isolated into upgradesZone", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.upgradesZone.show, true);
    assert.equal(result.upgradesZone.sections.length, 1);
    assert.equal(result.upgradesZone.sections[0]?.title, "Premium upgrades");
    assert.equal(result.upgradesZone.sections[0]?.lines[0]?.amountLabel, "$25.00");
    assert.equal(
      result.readyScope.sections.every((sec) =>
        sec.lines.every((line) => line.templateItemId !== "line-upgrade")
      ),
      true
    );
    assert.equal(result.meta.upgradeLineCount, 1);
  });

  test("no blockers mixed into readyScope", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [
        item({ id: "line-ready", section_id: "sec-scope" }),
        item({ id: "line-blocked", section_id: "sec-scope" }),
      ]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: {
          ...snapshotQty("line-ready", "24 sq"),
          ...snapshotQty("line-blocked", "24 sq"),
        },
        optionCustomerView: optionCustomerView({
          "line-ready": lineView("line-ready", "priced"),
          "line-blocked": lineView("line-blocked", "needs_quantity"),
        }, { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }),
      })
    );

    assert.equal(result.readyScope.sections[0]?.lines.length, 1);
    assert.equal(result.readyScope.sections[0]?.lines[0]?.templateItemId, "line-ready");
    assert.equal(result.needsAttention.lines.length, 1);
    assert.equal(result.needsAttention.lines[0]?.templateItemId, "line-blocked");
  });

  test("internal_only lines remain visible in workbench with hidden flag", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-internal", section_id: "sec-scope" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: snapshotQty("line-internal", "24 sq"),
        optionCustomerView: optionCustomerView({
          "line-internal": lineView("line-internal", "omitted", {
            customerVisibility: "internal_only",
            showPrice: false,
            customerLinePriceCents: 9_900,
          }),
        }),
      })
    );

    assert.equal(result.readyScope.sections[0]?.lines.length, 1);
    const line = result.readyScope.sections[0]?.lines[0];
    assert.equal(line?.hiddenFromCustomer, true);
    assert.equal(line?.amountLabel, "$99.00");
    assert.equal(result.needsAttention.show, false);
    assert.ok(WORKBENCH_HIDDEN_FROM_CUSTOMER_LABEL.length > 0);
  });

  test("totals hidden when pricingComplete is false", () => {
    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        optionCustomerView: optionCustomerView(
          { "line-priced": lineView("line-priced", "needs_quantity") },
          { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }
        ),
      })
    );

    assert.equal(result.totalsZone.pricingComplete, false);
    assert.equal(result.totalsZone.showAmounts, false);
    assert.equal(result.totalsZone.totalLabel, null);
    assert.equal(result.totalsZone.incompleteCopy, WORKBENCH_TOTALS_INCOMPLETE_COPY);
  });

  test("totals shown only when pricingComplete is true and valid", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.totalsZone.pricingComplete, true);
    assert.equal(result.totalsZone.showAmounts, true);
    assert.equal(result.totalsZone.subtotalLabel, "$125.00");
    assert.equal(result.totalsZone.totalLabel, "$125.00");
    assert.equal(result.totalsZone.incompleteCopy, null);
  });

  test("no fabricated total values when incomplete", () => {
    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        optionCustomerView: optionCustomerView(
          { "line-priced": lineView("line-priced", "needs_quantity") },
          {
            pricingComplete: false,
            customerSubtotalCents: 99_999,
            customerTotalCents: 99_999,
          }
        ),
      })
    );

    assert.equal(result.totalsZone.showAmounts, false);
    assert.equal(result.totalsZone.totalLabel, null);
    assert.equal(result.totalsZone.subtotalLabel, null);
  });

  test("displaySettingsEntry is visible but disabled/locked", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.displaySettingsEntry.visible, true);
    assert.equal(result.displaySettingsEntry.enabled, false);
    assert.equal(result.displaySettingsEntry.label, WORKBENCH_DISPLAY_SETTINGS_ENTRY_LABEL);
    assert.equal(result.displaySettingsEntry.comingSoonBadge, WORKBENCH_DISPLAY_SETTINGS_COMING_SOON_BADGE);
    assert.match(result.displaySettingsEntry.lockedCopy, /future update/i);
  });

  test("displaySettingsEntry exposes read-only settings summary when provided", () => {
    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        estimatePageSettings: {
          show_line_prices: false,
          show_option_totals: true,
          show_section_headings: true,
        },
      })
    );

    assert.equal(result.displaySettingsEntry.currentSettings?.show_line_prices, false);
    assert.match(result.displaySettingsEntry.settingsSummary ?? "", /line prices off/);
  });

  test("packageZone exposes selected option metadata", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.packageZone.selectedOptionId, OPTION_STANDARD);
    assert.equal(result.packageZone.effectiveOptionId, OPTION_STANDARD);
    assert.equal(result.packageZone.label, "Standard");
    assert.equal(result.packageZone.hasExplicitSelection, true);
    assert.ok(result.packageZone.description);
    assert.equal(result.packageZone.bullets.length, 2);
  });

  test("packageZone exposes multi-option count and future signing hint", () => {
    const result = buildProposalWorkbenchEstimatePresentation(buildInput());

    assert.equal(result.packageZone.optionCount, 2);
    assert.equal(result.packageZone.allOptions.length, 2);
    assert.equal(result.packageZone.customerSelectionMode, "future_signing");
    assert.equal(result.packageZone.customerSigningHint, WORKBENCH_CUSTOMER_PACKAGE_CHOICE_HINT);
  });

  test("empty upgrades zone when template has upgrade section but no lines", () => {
    const upgradeSection = section("sec-upgrades", "upgrade_group", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [upgradeSection],
      []
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [section("sec-scope", "line_items", OPTION_STANDARD), upgradeSection],
        optionCustomerView: optionCustomerView({}),
      })
    );

    assert.equal(result.upgradesZone.show, true);
    assert.equal(result.upgradesZone.isEmpty, true);
    assert.equal(result.upgradesZone.emptyCopy, WORKBENCH_UPGRADES_EMPTY_COPY);
    assert.equal(result.upgradesZone.sections[0]?.lines.length, 0);
  });

  test("upgrades zone hidden when template has no upgrade_group sections", () => {
    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-priced", section_id: "sec-scope" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        optionCustomerView: optionCustomerView({
          "line-priced": lineView("line-priced", "priced"),
        }),
      })
    );

    assert.equal(result.upgradesZone.show, false);
    assert.equal(result.upgradesZone.hasTemplateUpgradeSections, false);
  });

  test("included line maps to ready scope with Included label", () => {
    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        optionCustomerView: optionCustomerView({
          "line-priced": lineView("line-priced", "included"),
          "line-upgrade": lineView("line-upgrade", "priced", { customerLinePriceCents: 2_500 }),
        }),
      })
    );

    assert.equal(result.readyScope.sections[0]?.lines[0]?.amountLabel, WORKBENCH_LINE_INCLUDED_LABEL);
  });

  test("attention reasons use typed enum values", () => {
    const reasons = new Set<WorkbenchAttentionReason>([
      "missing_catalog",
      "needs_quantity",
      "not_priced",
      "missing_pricing_view",
    ]);

    const scopeSection = section("sec-scope", "line_items", OPTION_STANDARD);
    const templateGraph = graph(
      [option(OPTION_STANDARD)],
      [scopeSection],
      [item({ id: "line-no-view", section_id: "sec-scope" })]
    );

    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: snapshotQty("line-no-view", "24 sq"),
        optionCustomerView: optionCustomerView({}, {
          pricingComplete: false,
          customerSubtotalCents: null,
          customerTotalCents: null,
        }),
      })
    );

    for (const reason of result.needsAttention.lines[0]?.reasons ?? []) {
      assert.equal(reasons.has(reason), true);
    }
  });

  test("blocked upgrade lines stay in upgradesZone with attentionReasons", () => {
    const result = buildProposalWorkbenchEstimatePresentation(
      buildInput({
        optionCustomerView: optionCustomerView({
          "line-priced": lineView("line-priced", "priced"),
          "line-upgrade": lineView("line-upgrade", "needs_quantity"),
        }, { pricingComplete: false, customerSubtotalCents: null, customerTotalCents: null }),
      })
    );

    assert.equal(result.upgradesZone.sections[0]?.lines[0]?.attentionReasons.includes("needs_quantity"), true);
    assert.equal(result.needsAttention.lines.length, 0);
  });

  test("presenter does not mutate input", () => {
    const input = buildInput();
    const snapshot = structuredClone(input);

    buildProposalWorkbenchEstimatePresentation(input);

    assert.deepEqual(input, snapshot);
  });
});
