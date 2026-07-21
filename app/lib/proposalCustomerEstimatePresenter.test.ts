/**
 * R17C1 — Document estimate presentation mapper tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerEstimatePresenter.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { ProposalBuilderLineCustomerView } from "./proposalBuilderPricingPreview";
import {
  CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY,
  CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL,
  CUSTOMER_PREVIEW_LINE_IN_PACKAGE_LABEL,
  buildCustomerPreviewEstimatePresentation,
  type BuildCustomerPreviewEstimatePresentationInput,
} from "./proposalCustomerEstimatePresenter";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const OPTION_ID = "opt-standard";

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
    ...overrides,
  };
}

function option(id: string, sortOrder = 0): ProposalTemplateOption {
  return {
    id,
    template_id: TEMPLATE_ID,
    name: id,
    selection_mode: "single",
    is_default: true,
    visible_to_customer: true,
    sort_order: sortOrder,
  };
}

function section(
  id: string,
  kind: ProposalTemplateSection["kind"],
  overrides: Partial<ProposalTemplateSection> = {}
): ProposalTemplateSection {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
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
    option_id: OPTION_ID,
    catalog_item_id: "cat-1",
    item_role: "standard",
    sort_order: 0,
    ...overrides,
  };
}

function graph(
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
    options: [option(OPTION_ID)],
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
    showOnCustomerDocument: displayStatus !== "omitted",
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<BuildCustomerPreviewEstimatePresentationInput> = {}
): BuildCustomerPreviewEstimatePresentationInput {
  const scopeSection = section("sec-scope", "line_items", {
    name: "Roofing materials",
    customer_title: "Roofing materials",
  });
  const upgradeSection = section("sec-upgrades", "upgrade_group", {
    name: "Premium upgrades",
    customer_title: "Premium upgrades",
  });
  const templateGraph = graph(
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
    optionCustomerView: {
      optionId: OPTION_ID,
      pricingComplete: true,
      customerSubtotalCents: 12_500,
      discountCents: 0,
      salesTaxCents: 0,
      customerTotalCents: 12_500,
      lines: [],
      lineByTemplateItemId: {
        "line-priced": lineView("line-priced", "priced"),
        "line-upgrade": lineView("line-upgrade", "priced", {
          customerLinePriceCents: 2_500,
        }),
      },
    },
    selectedOptionLabel: "Standard",
    packageMeta: {
      description: "Reliable protection with quality materials.",
      bullets: ["25 Year Shingles", "Standard Underlayment"],
    },
    ...overrides,
  };
}

function presentationJson(input: BuildCustomerPreviewEstimatePresentationInput): string {
  return JSON.stringify(buildCustomerPreviewEstimatePresentation(input));
}

describe("buildCustomerPreviewEstimatePresentation", () => {
  test("priced line maps to document-safe line with price label", () => {
    const input = buildInput();
    const result = buildCustomerPreviewEstimatePresentation(input);

    assert.equal(result.scopeSections.length, 1);
    assert.equal(result.scopeSections[0]?.lines.length, 1);
    assert.equal(result.scopeSections[0]?.lines[0]?.kind, "priced");
    assert.equal(result.scopeSections[0]?.lines[0]?.valueLabel, "$125.00");
    assert.equal(result.scopeSections[0]?.lines[0]?.qtyLabel, null);
  });

  test("Block 5B — snapshot quantity maps to customer qtyLabel without manual badge", () => {
    const input = buildInput({
      snapshotQuantityByTemplateItemId: {
        "line-priced": {
          templateItemId: "line-priced",
          quantityDisplayLabel: "27.5 square",
          quantitySourceLabel: "manual",
          unitLabel: "square",
        },
      },
    });
    const line = buildCustomerPreviewEstimatePresentation(input).scopeSections[0]?.lines[0];
    assert.equal(line?.qtyLabel, "27.5 SQ");
    assert.doesNotMatch(`${line?.qtyLabel}`, /manual/i);
  });

  test("included line maps to Included", () => {
    const input = buildInput({
      optionCustomerView: {
        ...buildInput().optionCustomerView!,
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "included"),
        },
      },
    });
    const line = buildCustomerPreviewEstimatePresentation(input).scopeSections[0]?.lines[0];
    assert.equal(line?.kind, "included");
    assert.equal(line?.valueLabel, CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL);
  });

  test("grouped line maps to In package", () => {
    const input = buildInput({
      optionCustomerView: {
        ...buildInput().optionCustomerView!,
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "grouped"),
        },
      },
    });
    const line = buildCustomerPreviewEstimatePresentation(input).scopeSections[0]?.lines[0];
    assert.equal(line?.kind, "grouped");
    assert.equal(line?.valueLabel, CUSTOMER_PREVIEW_LINE_IN_PACKAGE_LABEL);
  });

  test("needs_quantity excluded and counted", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
    ]);
    const input = buildInput({
      graph: templateGraph,
      sections: [scopeSection],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: false,
        customerSubtotalCents: null,
        discountCents: null,
        salesTaxCents: null,
        customerTotalCents: null,
        lines: [],
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "needs_quantity"),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections.length, 0);
    assert.equal(result.suppressedBlockerCount, 1);
  });

  test("not_priced excluded and counted", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
    ]);
    const input = buildInput({
      graph: templateGraph,
      sections: [scopeSection],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: false,
        customerSubtotalCents: null,
        discountCents: null,
        salesTaxCents: null,
        customerTotalCents: null,
        lines: [],
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "not_priced"),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections.length, 0);
    assert.equal(result.suppressedBlockerCount, 1);
  });

  test("omitted excluded", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
    ]);
    const input = buildInput({
      graph: templateGraph,
      sections: [scopeSection],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: true,
        customerSubtotalCents: null,
        discountCents: null,
        salesTaxCents: null,
        customerTotalCents: null,
        lines: [],
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "omitted"),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections.length, 0);
    assert.equal(result.suppressedBlockerCount, 0);
  });

  test("line_items and upgrade_group sections split correctly", () => {
    const result = buildCustomerPreviewEstimatePresentation(buildInput());
    assert.equal(result.scopeSections.length, 1);
    assert.equal(result.scopeSections[0]?.title, "Roofing materials");
    assert.equal(result.upgradeSections.length, 1);
    assert.equal(result.upgradeSections[0]?.title, "Premium upgrades");
    assert.equal(result.upgradeSections[0]?.lines[0]?.valueLabel, "$25.00");
  });

  test("totals shown only when pricingComplete", () => {
    const result = buildCustomerPreviewEstimatePresentation(buildInput());
    assert.equal(result.totals.show, true);
    assert.equal(result.totals.subtotalLabel, "$125.00");
    assert.equal(result.totals.totalLabel, "$125.00");
  });

  test("totals hidden when pricing incomplete", () => {
    const input = buildInput({
      optionCustomerView: {
        ...buildInput().optionCustomerView!,
        pricingComplete: false,
        customerSubtotalCents: null,
        customerTotalCents: null,
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.totals.show, false);
    assert.equal(result.totals.totalLabel, null);
  });

  test("empty scope returns package hero + calm empty state", () => {
    const input = buildInput({
      optionCustomerView: {
        ...buildInput().optionCustomerView!,
        pricingComplete: false,
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "needs_quantity"),
          "line-upgrade": lineView("line-upgrade", "not_priced"),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.packageHero.label, "Standard");
    assert.equal(result.packageHero.description, "Reliable protection with quality materials.");
    assert.equal(result.showFinalizingMessage, true);
    assert.equal(result.scopeSections.length, 0);
    assert.equal(result.upgradeSections.length, 0);
  });

  test("presenter does not mutate input", () => {
    const input = buildInput();
    const sectionsSnapshot = structuredClone(input.sections);
    const graphSnapshot = structuredClone(input.graph);
    const catalogSnapshot = structuredClone(input.catalogItems);
    const optionSnapshot = structuredClone(input.optionCustomerView);

    buildCustomerPreviewEstimatePresentation(input);

    assert.deepEqual(input.sections, sectionsSnapshot);
    assert.deepEqual(input.graph, graphSnapshot);
    assert.deepEqual(input.catalogItems, catalogSnapshot);
    assert.deepEqual(input.optionCustomerView, optionSnapshot);
  });

  test("output does not contain contractor blocker labels", () => {
    const json = presentationJson(buildInput());
    assert.doesNotMatch(json, /Needs quantity/i);
    assert.doesNotMatch(json, /Qty Not resolved/i);
    assert.doesNotMatch(json, /Customer price/i);
    assert.doesNotMatch(json, /Line details/i);
  });

  test("Block 5 — output never contains contractor-only actions", () => {
    const json = presentationJson(buildInput());
    assert.doesNotMatch(json, /Edit quantity/i);
    assert.doesNotMatch(json, /Set quantity/i);
    assert.doesNotMatch(json, /Remove from proposal/i);
    assert.doesNotMatch(json, /\bRestore\b/i);
    assert.doesNotMatch(json, /Hide from customer/i);
    assert.doesNotMatch(json, /Manual qty/i);
  });

  test("Block 5 — output never contains send/sign/payment or backend wording", () => {
    const json = presentationJson(buildInput());
    assert.doesNotMatch(json, /guardrail/i);
    assert.doesNotMatch(json, /snapshot/i);
    assert.doesNotMatch(json, /money token/i);
    assert.doesNotMatch(json, /workbench/i);
    assert.doesNotMatch(json, /not editable/i);
    assert.doesNotMatch(json, /\blocked\b/i);
  });

  test("Block 5 — manual quantity line renders as a plain priced line with resolved price only", () => {
    // A manual-quantity override still resolves to a normal priced customer line;
    // the customer document shows its resolved price with no "manual" labeling.
    const scopeSection = section("sec-scope", "line_items", {
      name: "Roofing materials",
      customer_title: "Roofing materials",
    });
    const templateGraph = graph(
      [scopeSection],
      [item({ id: "line-manual", section_id: "sec-scope" })]
    );

    const result = buildCustomerPreviewEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        snapshotQuantityByTemplateItemId: {
          "line-manual": {
            templateItemId: "line-manual",
            quantityDisplayLabel: "8 linear foot",
            quantitySourceLabel: "manual",
            unitLabel: "linear_foot",
          },
        },
        optionCustomerView: {
          optionId: OPTION_ID,
          pricingComplete: true,
          customerSubtotalCents: 600,
          discountCents: 0,
          salesTaxCents: 0,
          customerTotalCents: 600,
          lines: [],
          lineByTemplateItemId: {
            "line-manual": lineView("line-manual", "priced", {
              customerLinePriceCents: 600,
            }),
          },
        },
      })
    );

    const line = result.scopeSections[0]?.lines[0];
    assert.ok(line);
    assert.equal(line?.kind, "priced");
    assert.equal(line?.valueLabel, "$6.00");
    assert.equal(line?.qtyLabel, "8 linear ft");
    // No "manual" labeling in customer-visible display fields.
    assert.doesNotMatch(
      `${line?.name} ${line?.valueLabel} ${line?.qtyLabel}`,
      /manual/i
    );
  });

  test("Block 5 — selected package label is shown with no builder current/available chrome", () => {
    const result = buildCustomerPreviewEstimatePresentation(buildInput());
    assert.equal(result.packageHero.label, "Standard");
    const json = JSON.stringify(result.packageHero);
    assert.doesNotMatch(json, /\bCurrent\b/);
    assert.doesNotMatch(json, /\bAvailable\b/);
    assert.doesNotMatch(json, /Choose starting package/i);
  });

  test("Block 5 corrective — Preview UI renders selected upgrades in estimate; no optional-choice chrome", () => {
    const estimateDoc = readFileSync(
      path.join(
        process.cwd(),
        "app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx"
      ),
      "utf8"
    );
    assert.match(estimateDoc, /upgradeSections/);
    assert.doesNotMatch(estimateDoc, /CUSTOMER_PREVIEW_ESTIMATE_UPGRADES/);
    assert.doesNotMatch(estimateDoc, /CUSTOMER_PREVIEW_ESTIMATE_PARTIAL_PRICING_NOTE/);
    assert.doesNotMatch(estimateDoc, /Additional line items may appear/);
    assert.doesNotMatch(estimateDoc, /available during the approval/i);
    assert.doesNotMatch(estimateDoc, /Optional add-ons/i);
  });

  test("unselected upgrades (showOnCustomerDocument false) are excluded from upgradeSections", () => {
    const input = buildInput({
      optionCustomerView: {
        ...buildInput().optionCustomerView!,
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "priced"),
          "line-upgrade": lineView("line-upgrade", "priced", {
            customerLinePriceCents: 2_500,
            showOnCustomerDocument: false,
          }),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.upgradeSections.length, 0);
    assert.equal(result.scopeSections.length, 1);
  });

  test("missing catalog row excluded and counted", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-missing", section_id: "sec-scope", catalog_item_id: "missing-cat" }),
    ]);

    const input = buildInput({
      graph: templateGraph,
      sections: [scopeSection],
      catalogItems: [],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: false,
        customerSubtotalCents: null,
        discountCents: null,
        salesTaxCents: null,
        customerTotalCents: null,
        lines: [],
        lineByTemplateItemId: {
          "line-missing": lineView("line-missing", "not_priced"),
        },
      },
    });

    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections.length, 0);
    assert.equal(result.suppressedBlockerCount, 1);
    assert.equal(result.showFinalizingMessage, true);
    assert.equal(CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY.length > 0, true);
  });

  test("priced line hidden from customer document is omitted from scope list", () => {
    const scopeSection = section("sec-scope", "line_items", {
      name: "Roofing materials",
      customer_title: "Roofing materials",
    });
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
      item({ id: "line-visible", section_id: "sec-scope" }),
    ]);
    const input: BuildCustomerPreviewEstimatePresentationInput = {
      ...buildInput(),
      graph: templateGraph,
      sections: [scopeSection],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: true,
        customerSubtotalCents: 15_000,
        discountCents: 0,
        salesTaxCents: 0,
        customerTotalCents: 15_000,
        lines: [],
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "priced", {
            showOnCustomerDocument: false,
            customerLinePriceCents: 2_500,
          }),
          "line-visible": lineView("line-visible", "priced", {
            customerLinePriceCents: 12_500,
          }),
        },
      },
    };

    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections.length, 1);
    assert.equal(result.scopeSections[0]?.lines.length, 1);
    assert.equal(result.scopeSections[0]?.lines[0]?.templateItemId, "line-visible");
    assert.equal(result.totals.show, true);
    assert.equal(result.totals.totalLabel, "$150.00");
    assert.equal(result.suppressedBlockerCount, 0);
  });

  test("internal_only line is omitted and does not affect hidden-but-in-calc totals path", () => {
    const scopeSection = section("sec-scope", "line_items", {
      name: "Roofing materials",
      customer_title: "Roofing materials",
    });
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
      item({ id: "line-visible", section_id: "sec-scope" }),
    ]);
    const input: BuildCustomerPreviewEstimatePresentationInput = {
      ...buildInput(),
      graph: templateGraph,
      sections: [scopeSection],
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: true,
        customerSubtotalCents: 12_500,
        discountCents: 0,
        salesTaxCents: 0,
        customerTotalCents: 12_500,
        lines: [],
        lineByTemplateItemId: {
          "line-priced": lineView("line-priced", "omitted", {
            customerVisibility: "internal_only",
            showOnCustomerDocument: false,
            showPrice: false,
            customerLinePriceCents: null,
          }),
          "line-visible": lineView("line-visible", "priced"),
        },
      },
    };

    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections[0]?.lines.length, 1);
    assert.equal(result.scopeSections[0]?.lines[0]?.templateItemId, "line-visible");
  });

  test("show_line_prices false keeps priced lines visible without dollar amounts", () => {
    const result = buildCustomerPreviewEstimatePresentation(
      buildInput({
        estimatePageSettings: { show_line_prices: false },
      })
    );
    const line = result.scopeSections[0]?.lines[0];
    assert.equal(line?.kind, "priced");
    assert.equal(line?.name.length > 0, true);
    assert.equal(line?.valueLabel, null);
    assert.equal(result.displayPolicy.showLinePrices, false);
  });

  test("show_option_totals false hides totals panel while source totals remain", () => {
    const input = buildInput({
      estimatePageSettings: { show_option_totals: false },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.totals.show, false);
    assert.equal(result.totals.totalLabel, "$125.00");
    assert.equal(input.optionCustomerView?.customerTotalCents, 12_500);
  });

  test("show_section_headings false hides section heading display", () => {
    const result = buildCustomerPreviewEstimatePresentation(
      buildInput({
        estimatePageSettings: { show_section_headings: false },
      })
    );
    assert.equal(result.scopeSections[0]?.showHeading, false);
    assert.equal(result.scopeSections[0]?.lines.length, 1);
  });

  test("hidden line omitted regardless of display settings", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-hidden", section_id: "sec-scope" }),
      item({ id: "line-visible", section_id: "sec-scope" }),
    ]);
    const input = buildInput({
      graph: templateGraph,
      sections: [scopeSection],
      estimatePageSettings: {
        show_line_prices: true,
        show_option_totals: true,
        show_section_headings: true,
      },
      optionCustomerView: {
        optionId: OPTION_ID,
        pricingComplete: true,
        customerSubtotalCents: 15_000,
        discountCents: 0,
        salesTaxCents: 0,
        customerTotalCents: 15_000,
        lines: [],
        lineByTemplateItemId: {
          "line-hidden": lineView("line-hidden", "priced", {
            showOnCustomerDocument: false,
          }),
          "line-visible": lineView("line-visible", "priced"),
        },
      },
    });
    const result = buildCustomerPreviewEstimatePresentation(input);
    assert.equal(result.scopeSections[0]?.lines.length, 1);
    assert.equal(result.totals.show, true);
    assert.equal(result.totals.totalLabel, "$150.00");
  });

  test("excluded omitted line stays omitted with display settings on", () => {
    const scopeSection = section("sec-scope", "line_items");
    const templateGraph = graph([scopeSection], [
      item({ id: "line-priced", section_id: "sec-scope" }),
    ]);
    const result = buildCustomerPreviewEstimatePresentation(
      buildInput({
        graph: templateGraph,
        sections: [scopeSection],
        estimatePageSettings: {
          show_line_prices: false,
          show_option_totals: false,
          show_section_headings: false,
        },
        optionCustomerView: {
          optionId: OPTION_ID,
          pricingComplete: true,
          customerSubtotalCents: 12_500,
          discountCents: 0,
          salesTaxCents: 0,
          customerTotalCents: 12_500,
          lines: [],
          lineByTemplateItemId: {
            "line-priced": lineView("line-priced", "omitted"),
          },
        },
      })
    );
    assert.equal(result.scopeSections.length, 0);
  });

  test("pricing incomplete with display settings does not fabricate totals", () => {
    const result = buildCustomerPreviewEstimatePresentation(
      buildInput({
        estimatePageSettings: {
          show_line_prices: true,
          show_option_totals: true,
        },
        optionCustomerView: {
          ...buildInput().optionCustomerView!,
          pricingComplete: false,
          customerSubtotalCents: null,
          customerTotalCents: null,
        },
      })
    );
    assert.equal(result.totals.show, false);
    assert.equal(result.totals.totalLabel, null);
  });
});
