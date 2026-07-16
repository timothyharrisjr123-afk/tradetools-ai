/**
 * 3J2B2 — Programmatic tests for proposalSnapshotBuilder.ts
 *
 * Run: npx tsx --test app/lib/proposalSnapshotBuilder.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "./proposalLineSnapshotTypes";
import {
  buildContextEcho,
  buildDraftInstantiatePayload,
  buildInternalPolicyEchoJson,
  buildInternalSummarySnapshots,
  buildLineItemSnapshots,
  buildLineSectionIdToPersistedPageSectionMap,
  buildOptionSnapshots,
  buildPolicyEchoCustomerSafe,
  mapTemplateSectionsToProposalPages,
  normalizeDraftInstantiateInputLineSectionIds,
  normalizeGuardrailOutcomeForSnapshot,
  normalizeLineSectionIdsForSpinePages,
  ProposalSnapshotBuilderError,
  resolveSpineLineItemsSectionId,
  templateItemToLineInput,
  type DraftInstantiateInput,
} from "./proposalSnapshotBuilder";
import {
  assertCustomerSafeLineRow,
  ProposalSnapshotGuardError,
} from "./proposalSnapshotStatusMapper";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  ESTIMATE_PAGE_SETTINGS_METADATA_KEY,
} from "./proposalTemplateEstimateSettings";
import type {
  ProposalTemplate,
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const JOB_ID = "job-1";

const CONFIGURED_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: { kind: "percent", value: 5 },
  tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: 2.5 },
  subtotalOverrideCents: null,
};

const POLICY_INPUT = {
  configured: true as const,
  source: "company" as const,
  policy: CONFIGURED_POLICY,
  pricingPolicyId: "policy-row-1",
};

function section(
  overrides: Partial<ProposalTemplateSection> &
    Pick<ProposalTemplateSection, "id" | "option_id" | "kind" | "name">
): ProposalTemplateSection {
  return {
    template_id: TEMPLATE_ID,
    sort_order: 0,
    ...overrides,
  };
}

function templateOption(id: string, isDefault = false): ProposalTemplateOption {
  return {
    id,
    template_id: TEMPLATE_ID,
    name: id,
    is_default: isDefault,
    visible_to_customer: true,
    sort_order: 0,
  };
}

function templateRow(overrides: Partial<ProposalTemplate> = {}): ProposalTemplate {
  return {
    id: TEMPLATE_ID,
    company_id: COMPANY_ID,
    name: "Starter",
    status: "active",
    active: true,
    metadata: {},
    ...overrides,
  };
}

function templateItem(
  overrides: Partial<ProposalTemplateItem> &
    Pick<ProposalTemplateItem, "id" | "option_id" | "section_id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    catalog_item_id: "cat-1",
    item_role: "standard",
    sort_order: 0,
    ...overrides,
  };
}

describe("buildContextEcho", () => {
  test("returns customer-safe context and excludes internal metadata", () => {
    const echo = buildContextEcho({
      job_id: JOB_ID,
      job_name: "Smith roof",
      customer_name: "Smith",
      template_id: TEMPLATE_ID,
      template_name: "Standard pkg",
      measurement_quantities_display: "24 SQ",
    });

    assert.equal(echo.job_id, JOB_ID);
    assert.equal(echo.measurement_quantities_display, "24 SQ");
    assert.equal(echo.template_id, TEMPLATE_ID);
    assert.equal(echo.show_license_on_cover, false);

    const keys = Object.keys(echo);
    for (const forbidden of [
      "unit_cost",
      "internal_cost_cents",
      "profit_cents",
      "margin_pct",
      "catalog_supplier_metadata",
      "policy_echo_json",
      "notifications_email",
    ]) {
      assert.ok(!keys.includes(forbidden), `forbidden key: ${forbidden}`);
    }
  });

  test("includes company branding fields when provided", () => {
    const echo = buildContextEcho({
      job_id: JOB_ID,
      template_id: TEMPLATE_ID,
      address_formatted: "1 Main St",
      company_name: "Summit Roofing",
      company_logo_url: "data:image/png;base64,abc",
      company_phone: "918-555-0100",
      company_license: "OK-12345",
      company_address: "456 HQ Blvd",
      company_website: "https://summitroofing.com",
      brand_primary_color: "#112233",
      brand_secondary_color: "#445566",
      show_license_on_cover: true,
    });

    assert.equal(echo.company_name, "Summit Roofing");
    assert.equal(echo.company_address, "456 HQ Blvd");
    assert.equal(echo.address_formatted, "1 Main St");
    assert.equal(echo.show_license_on_cover, true);
    assert.notEqual(echo.company_address, echo.address_formatted);
  });

  test("includes customer mailing address separate from job site address", () => {
    const echo = buildContextEcho({
      job_id: JOB_ID,
      template_id: TEMPLATE_ID,
      customer_name: "Jane Smith",
      customer_email: "jane@example.com",
      customer_phone: "918-555-0200",
      customer_address: "99 Mailing Ln",
      address_formatted: "1 Main St",
    });

    assert.equal(echo.customer_address, "99 Mailing Ln");
    assert.equal(echo.address_formatted, "1 Main St");
    assert.notEqual(echo.customer_address, echo.address_formatted);
  });
});

describe("buildPolicyEchoCustomerSafe", () => {
  test("excludes full/raw internal policy fields", () => {
    const echo = buildPolicyEchoCustomerSafe(POLICY_INPUT);
    assert.equal(echo.configured, true);
    assert.equal(echo.sales_tax_rate_pct, 8);
    assert.equal(echo.pricing_policy_id, "policy-row-1");

    const keys = Object.keys(echo);
    assert.ok(!keys.includes("minimum_profitability_pct"));
    assert.ok(!keys.includes("material_purchase_tax_rate_pct"));
    assert.ok(!keys.includes("subtotal_override_cents"));
  });
});

describe("buildInternalPolicyEchoJson", () => {
  test("is separate from customer policy echo and includes cost-side fields", () => {
    const internal = buildInternalPolicyEchoJson({
      policy: CONFIGURED_POLICY,
      pricingPolicyId: "policy-row-1",
      source: "company",
    });

    const customer = buildPolicyEchoCustomerSafe(POLICY_INPUT);
    assert.equal(internal.material_purchase_tax_rate_pct, 2.5);
    assert.equal(internal.minimum_profitability_pct, 25);
    assert.notEqual(
      Object.keys(internal).sort().join(","),
      Object.keys(customer).sort().join(",")
    );
  });
});

describe("mapTemplateSectionsToProposalPages", () => {
  const base = {
    company_id: COMPANY_ID,
    sections: [] as ProposalTemplateSection[],
  };

  test("maps line_items to estimate", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
        }),
      ],
    });
    assert.equal(pages.length, 1);
    assert.equal(pages[0]!.page_type, "estimate");
    assert.equal(pages[0]!.source_template_section_id, "sec-est");
  });

  test("maps terms to terms", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({ id: "sec-t", option_id: "opt-1", kind: "terms", name: "Terms" }),
      ],
    });
    assert.equal(pages[0]!.page_type, "terms");
  });

  test("maps warranty to warranty", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({
          id: "sec-w",
          option_id: "opt-1",
          kind: "warranty",
          name: "Warranty",
        }),
      ],
    });
    assert.equal(pages[0]!.page_type, "warranty");
  });

  test("maps image to photos", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({
          id: "sec-img",
          option_id: "opt-1",
          kind: "image",
          name: "Photos",
          content: { asset_ref: "img/key-1" },
        }),
      ],
    });
    assert.equal(pages[0]!.page_type, "photos");
    assert.ok(pages[0]!.content_json.media_refs?.length);
  });

  test("signature_placeholder becomes signature hidden from customer", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({
          id: "sec-sig",
          option_id: "opt-1",
          kind: "signature_placeholder",
          name: "Signature",
        }),
      ],
    });
    assert.equal(pages[0]!.page_type, "signature");
    assert.equal(pages[0]!.visible_to_customer, false);
  });

  test("skips upgrade_group sections", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      sections: [
        section({
          id: "sec-up",
          option_id: "opt-1",
          kind: "upgrade_group",
          name: "Upgrades",
        }),
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
        }),
      ],
    });
    assert.equal(pages.length, 1);
    assert.equal(pages[0]!.page_type, "estimate");
  });

  test("estimate page gets default settings when template metadata is absent", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      template: templateRow(),
      sections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
        }),
      ],
    });

    assert.deepEqual(pages[0]!.settings_json, { ...DEFAULT_ESTIMATE_PAGE_SETTINGS });
  });

  test("estimate page inherits template metadata estimate settings", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      template: templateRow({
        metadata: {
          [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
            show_line_prices: false,
            show_option_totals: true,
            show_section_headings: false,
          },
        },
      }),
      sections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
        }),
      ],
    });

    assert.deepEqual(pages[0]!.settings_json, {
      show_line_prices: false,
      show_option_totals: true,
      show_section_headings: false,
    });
  });

  test("line_items section metadata overrides template defaults on estimate page", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      template: templateRow({
        metadata: {
          [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
            show_line_prices: true,
            show_option_totals: true,
            show_section_headings: true,
          },
        },
      }),
      sections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
              show_line_prices: false,
              show_section_headings: false,
            },
          },
        }),
      ],
    });

    assert.deepEqual(pages[0]!.settings_json, {
      show_line_prices: false,
      show_option_totals: true,
      show_section_headings: false,
    });
  });

  test("per-option estimate settings stay isolated by option_id", () => {
    const pagesStandard = mapTemplateSectionsToProposalPages({
      ...base,
      spineOptionId: "opt-standard",
      template: templateRow(),
      sections: [
        section({
          id: "sec-est-standard",
          option_id: "opt-standard",
          kind: "line_items",
          name: "Standard estimate",
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: false },
          },
        }),
        section({
          id: "sec-est-premium",
          option_id: "opt-premium",
          kind: "line_items",
          name: "Premium estimate",
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_option_totals: false },
          },
        }),
      ],
    });

    const pagesPremium = mapTemplateSectionsToProposalPages({
      ...base,
      spineOptionId: "opt-premium",
      template: templateRow(),
      sections: [
        section({
          id: "sec-est-standard",
          option_id: "opt-standard",
          kind: "line_items",
          name: "Standard estimate",
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: false },
          },
        }),
        section({
          id: "sec-est-premium",
          option_id: "opt-premium",
          kind: "line_items",
          name: "Premium estimate",
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_option_totals: false },
          },
        }),
      ],
    });

    assert.equal(pagesStandard[0]!.settings_json.show_line_prices, false);
    assert.equal(pagesStandard[0]!.settings_json.show_option_totals, true);
    assert.equal(pagesPremium[0]!.settings_json.show_option_totals, false);
    assert.equal(pagesPremium[0]!.settings_json.show_line_prices, true);
  });

  test("non-estimate pages do not receive estimate display settings", () => {
    const pages = mapTemplateSectionsToProposalPages({
      ...base,
      template: templateRow({
        metadata: {
          [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: false },
        },
      }),
      sections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
        }),
        section({
          id: "sec-terms",
          option_id: "opt-1",
          kind: "terms",
          name: "Terms",
          content: { body_markdown: "Terms body" },
        }),
      ],
    });

    assert.deepEqual(pages.find((page) => page.page_type === "estimate")!.settings_json, {
      show_line_prices: false,
      show_option_totals: true,
      show_section_headings: true,
    });
    assert.deepEqual(pages.find((page) => page.page_type === "terms")!.settings_json, {});
    assert.equal(
      pages.find((page) => page.page_type === "terms")!.content_json.body_markdown,
      "Terms body"
    );
  });

  test("does not mutate input sections array", () => {
    const sections = [
      section({
        id: "sec-est",
        option_id: "opt-1",
        kind: "line_items",
        name: "Estimate",
        metadata: { keep: true },
      }),
    ];
    const snapshot = JSON.stringify(sections);

    mapTemplateSectionsToProposalPages({
      ...base,
      template: templateRow(),
      sections,
    });

    assert.equal(JSON.stringify(sections), snapshot);
  });
});

describe("buildOptionSnapshots", () => {
  test("uses customer_subtotal_cents / sales_tax_cents / customer_total_cents", () => {
    const options = buildOptionSnapshots({
      company_id: COMPANY_ID,
      options: [
        {
          source_template_option_id: "opt-1",
          name: "Standard",
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 100_000,
          discount_cents: 5_000,
          sales_tax_cents: 7_600,
          customer_total_cents: 102_600,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
        },
      ],
    });

    assert.equal(options[0]!.customer_subtotal_cents, 100_000);
    assert.equal(options[0]!.sales_tax_cents, 7_600);
    assert.equal(options[0]!.customer_total_cents, 102_600);
  });

  test("never returns legacy subtotal_cents / tax_cents / total_cents keys", () => {
    const options = buildOptionSnapshots({
      company_id: COMPANY_ID,
      options: [
        {
          source_template_option_id: "opt-1",
          name: "Standard",
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 1,
          discount_cents: null,
          sales_tax_cents: null,
          customer_total_cents: 1,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "warn",
        },
      ],
    });

    const keys = Object.keys(options[0]!);
    assert.ok(!keys.includes("subtotal_cents"));
    assert.ok(!keys.includes("tax_cents"));
    assert.ok(!keys.includes("total_cents"));
  });

  test("guardrail pass/warn/block preserved", () => {
    for (const outcome of ["pass", "warn", "block"] as const) {
      const [row] = buildOptionSnapshots({
        company_id: COMPANY_ID,
        options: [
          {
            source_template_option_id: "opt-1",
            name: "Standard",
            sort_order: 0,
            is_default: true,
            visible_to_customer: true,
            customer_subtotal_cents: null,
            discount_cents: null,
            sales_tax_cents: null,
            customer_total_cents: null,
            pricing_complete: false,
            blocking_line_count: 1,
            guardrail_outcome: outcome,
          },
        ],
      });
      assert.equal(row!.guardrail_outcome, outcome);
    }
  });

  test("loading/checking guardrail maps to block", () => {
    for (const loading of ["checking", "loading"] as const) {
      const normalized = normalizeGuardrailOutcomeForSnapshot(loading);
      assert.equal(normalized, "block");
      const [row] = buildOptionSnapshots({
        company_id: COMPANY_ID,
        options: [
          {
            source_template_option_id: "opt-1",
            name: "Standard",
            sort_order: 0,
            is_default: true,
            visible_to_customer: true,
            customer_subtotal_cents: null,
            discount_cents: null,
            sales_tax_cents: null,
            customer_total_cents: null,
            pricing_complete: false,
            blocking_line_count: 0,
            guardrail_outcome: loading,
          },
        ],
      });
      assert.equal(row!.guardrail_outcome, "block");
    }
  });

  test("legacy warning guardrail label is rejected", () => {
    assert.throws(
      () => normalizeGuardrailOutcomeForSnapshot("warning"),
      ProposalSnapshotBuilderError
    );
  });
});

describe("buildLineItemSnapshots", () => {
  test("S3D3 does not copy quantity_resolution_echo onto customer-safe snapshot rows", () => {
    const rows = buildLineItemSnapshots({
      company_id: "c1",
      proposal_option_id: "o1",
      lines: [
        {
          source_template_item_id: "t1",
          catalog_item_id: "cat1",
          catalog_seed_key: null,
          section_id: "s1",
          sort_order: 0,
          customer_name: "Shingles",
          description: null,
          role: "standard",
          quantity: 22,
          quantity_display_label: "22 SQ",
          quantity_source_label: "Measurement",
          unit: "SQ",
          customer_unit_price_cents: 500,
          customer_line_total_cents: 11000,
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          measurement_quantity_key: "adjusted_roof_squares",
          quantity_resolution_echo: {
            quantity_mode: "adjusted_measurement",
            resolved_purchase_quantity: 22,
          },
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.quantity, 22);
    assert.equal(
      Object.prototype.hasOwnProperty.call(rows[0], "quantity_resolution_echo"),
      false
    );
  });

  test("returns customer-safe rows", () => {
    const rows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-1",
          sort_order: 0,
          customer_name: "Shingles",
          role: "standard",
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          customer_unit_price_cents: 5000,
          customer_line_total_cents: 120_000,
          quantity: 24,
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.pricing_status, "priced");
    assert.equal(rows[0]!.customer_name, "Shingles");
  });

  test("built lines pass forbidden-key guard; pollution is rejected", () => {
    const rows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-1",
          sort_order: 0,
          customer_name: "Shingles",
          role: "standard",
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          customer_unit_price_cents: 5000,
          customer_line_total_cents: 120_000,
          quantity: 1,
        },
      ],
    });

    for (const row of rows) {
      assert.doesNotThrow(() =>
        assertCustomerSafeLineRow(row as unknown as Record<string, unknown>)
      );
    }

    const polluted = { ...rows[0]!, unit_cost: 100 };
    assert.throws(
      () => assertCustomerSafeLineRow(polluted as unknown as Record<string, unknown>),
      ProposalSnapshotGuardError
    );
  });

  test("unresolved_quantity maps to needs_quantity through mapper", () => {
    const [row] = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-1",
          sort_order: 0,
          customer_name: "Labor",
          role: "standard",
          engineStatus: "unresolved_quantity",
          customerVisibility: "customer_visible",
        },
      ],
    });
    assert.equal(row!.pricing_status, "needs_quantity");
  });

  test("missing catalog unresolved maps to not_priced", () => {
    const [row] = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-1",
          sort_order: 0,
          customer_name: "Missing cat",
          role: "standard",
          engineStatus: "unresolved_quantity",
          customerVisibility: "customer_visible",
          catalogItemMissing: true,
        },
      ],
    });
    assert.equal(row!.pricing_status, "not_priced");
  });

  test("hidden/internal line maps to omitted", () => {
    const hidden = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-h",
          sort_order: 0,
          customer_name: "Hidden",
          role: "standard",
          engineStatus: "hidden",
          customerVisibility: "customer_visible",
        },
      ],
    });
    assert.equal(hidden[0]!.pricing_status, "omitted");

    const internal = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-i",
          sort_order: 0,
          customer_name: "Internal",
          role: "standard",
          engineStatus: "priced",
          customerVisibility: "internal_only",
        },
      ],
    });
    assert.equal(internal[0]!.pricing_status, "omitted");
  });

  test("line rows do not include unit_cost/internal_cost/profit/margin/markup/policy_echo_json", () => {
    const rows = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: "item-1",
          sort_order: 0,
          customer_name: "Shingles",
          role: "standard",
          engineStatus: "priced",
          customerVisibility: "customer_visible",
          customer_unit_price_cents: 1,
          customer_line_total_cents: 1,
        },
      ],
    });

    const keys = Object.keys(rows[0]!);
    for (const forbidden of [
      ...PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS,
      "policy_echo_json",
    ]) {
      assert.ok(!keys.includes(forbidden), `forbidden key: ${forbidden}`);
    }
  });
});

describe("buildInternalSummarySnapshots", () => {
  test("includes internal cost/profit/margin fields only on internal summary", () => {
    const [summary] = buildInternalSummarySnapshots({
      company_id: COMPANY_ID,
      summary: {
        internal_cost_cents: 80_000,
        internal_profit_cents: 20_000,
        effective_margin_pct: 20,
        policy_echo_json: { minimum_profitability_pct: 25 },
      },
    });

    assert.equal(summary!.internal_cost_cents, 80_000);
    assert.equal(summary!.internal_profit_cents, 20_000);
    assert.equal(summary!.effective_margin_pct, 20);
    assert.ok(summary!.policy_echo_json);
    assert.ok(!("customer_subtotal_cents" in summary!));
  });
});

describe("buildDraftInstantiatePayload", () => {
  test("rejects unconfigured/placeholder policy", () => {
    assert.throws(
      () =>
        buildDraftInstantiatePayload({
          company_id: COMPANY_ID,
          context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
          policy: {
            configured: false,
            source: "preview",
            policy: CONFIGURED_POLICY,
          },
          templateOptions: [templateOption("opt-1", true)],
          templateSections: [],
          optionPricing: [],
          lineItemsByTemplateOptionId: {},
          internalSummaryByTemplateOptionId: {},
        }),
      ProposalSnapshotGuardError
    );
  });

  test("returns pages/options/lines/internal summaries together", () => {
    const payload = buildDraftInstantiatePayload({
      company_id: COMPANY_ID,
      context: {
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        template_name: "Pkg A",
      },
      policy: POLICY_INPUT,
      templateOptions: [templateOption("opt-1", true)],
      templateSections: [
        section({
          id: "sec-est",
          option_id: "opt-1",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
          metadata: {
            [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: false },
          },
        }),
        section({
          id: "sec-terms",
          option_id: "opt-1",
          kind: "terms",
          name: "Terms",
          sort_order: 1,
        }),
      ],
      template: templateRow(),
      optionPricing: [
        {
          source_template_option_id: "opt-1",
          name: "Standard",
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 50_000,
          discount_cents: null,
          sales_tax_cents: 4_000,
          customer_total_cents: 54_000,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
          is_selected: true,
        },
      ],
      lineItemsByTemplateOptionId: {
        "opt-1": [
          templateItemToLineInput(
            templateItem({
              id: "item-1",
              option_id: "opt-1",
              section_id: "sec-est",
            }),
            {
              engineStatus: "priced",
              customerVisibility: "customer_visible",
              customerUnitPriceCents: 5000,
              customerLineTotalCents: 50_000,
              quantity: 10,
            }
          ),
        ],
      },
      internalSummaryByTemplateOptionId: {
        "opt-1": {
          internal_cost_cents: 30_000,
          internal_profit_cents: 20_000,
          effective_margin_pct: 40,
        },
      },
      selectedTemplateOptionId: "opt-1",
      computedAt: "2026-06-06T12:00:00.000Z",
    });

    assert.ok(payload.contextEcho);
    assert.ok(payload.policyEcho.configured);
    assert.equal(payload.pages.length, 2);
    assert.equal(payload.options.length, 1);
    assert.equal(payload.lineItems.length, 1);
    assert.equal(payload.internalSummaries.length, 1);
    assert.equal(payload.selectedTemplateOptionId, "opt-1");
    assert.equal(payload.events[0]!.event_type, "created");

    const estimatePage = payload.pages.find((page) => page.page_type === "estimate");
    assert.deepEqual(estimatePage?.settings_json, {
      show_line_prices: false,
      show_option_totals: true,
      show_section_headings: true,
    });
    assert.deepEqual(
      payload.pages.find((page) => page.page_type === "terms")?.settings_json,
      {}
    );
  });
});

describe("line section id spine page mapping", () => {
  const OPT_STANDARD = "opt-standard";
  const OPT_ENHANCED = "opt-enhanced";
  const SEC_STD_LINES = "sec-std-lines";
  const SEC_STD_TERMS = "sec-std-terms";
  const SEC_ENH_LINES = "sec-enh-lines";
  const SEC_ENH_UPGRADES = "sec-enh-upgrades";

  function pricedLineInput(
    itemId: string,
    sectionId: string
  ): ReturnType<typeof templateItemToLineInput> {
    return templateItemToLineInput(
      templateItem({
        id: itemId,
        option_id: OPT_ENHANCED,
        section_id: sectionId,
      }),
      {
        engineStatus: "priced",
        customerVisibility: "customer_visible",
        customerUnitPriceCents: 500,
        customerLineTotalCents: 500,
        quantity: 1,
      }
    );
  }

  function starterLikeInstantiateInput(): DraftInstantiateInput {
    return {
      company_id: COMPANY_ID,
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      policy: POLICY_INPUT,
      templateOptions: [templateOption(OPT_STANDARD, true), templateOption(OPT_ENHANCED, false)],
      templateSections: [
        section({
          id: SEC_STD_LINES,
          option_id: OPT_STANDARD,
          kind: "line_items",
          name: "Roof replacement scope",
          sort_order: 20,
        }),
        section({
          id: SEC_STD_TERMS,
          option_id: OPT_STANDARD,
          kind: "terms",
          name: "Terms",
          sort_order: 60,
        }),
        section({
          id: SEC_ENH_LINES,
          option_id: OPT_ENHANCED,
          kind: "line_items",
          name: "Roof replacement scope",
          sort_order: 20,
        }),
        section({
          id: SEC_ENH_UPGRADES,
          option_id: OPT_ENHANCED,
          kind: "upgrade_group",
          name: "Optional upgrades",
          sort_order: 30,
        }),
      ],
      template: templateRow(),
      optionPricing: [
        {
          source_template_option_id: OPT_STANDARD,
          name: "Standard",
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 50_000,
          discount_cents: null,
          sales_tax_cents: 4_000,
          customer_total_cents: 54_000,
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
          customer_subtotal_cents: 55_000,
          discount_cents: null,
          sales_tax_cents: 4_400,
          customer_total_cents: 59_400,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
        },
      ],
      lineItemsByTemplateOptionId: {
        [OPT_STANDARD]: [pricedLineInput("item-std", SEC_STD_LINES)],
        [OPT_ENHANCED]: [
          pricedLineInput("item-enh-core", SEC_ENH_LINES),
          pricedLineInput("item-enh-upgrade", SEC_ENH_UPGRADES),
        ],
      },
      internalSummaryByTemplateOptionId: {},
    };
  }

  test("resolveSpineLineItemsSectionId returns default option line_items section", () => {
    const sections = starterLikeInstantiateInput().templateSections;
    assert.equal(resolveSpineLineItemsSectionId(sections, OPT_STANDARD), SEC_STD_LINES);
  });

  test("buildLineSectionIdToPersistedPageSectionMap maps all line-bearing sections to spine estimate", () => {
    const map = buildLineSectionIdToPersistedPageSectionMap(
      starterLikeInstantiateInput().templateSections,
      OPT_STANDARD
    );
    assert.equal(map.get(SEC_STD_LINES), SEC_STD_LINES);
    assert.equal(map.get(SEC_ENH_LINES), SEC_STD_LINES);
    assert.equal(map.get(SEC_ENH_UPGRADES), SEC_STD_LINES);
    assert.equal(map.has(SEC_STD_TERMS), false);
  });

  test("normalizeLineSectionIdsForSpinePages rewrites non-spine and upgrade_group section ids", () => {
    const map = buildLineSectionIdToPersistedPageSectionMap(
      starterLikeInstantiateInput().templateSections,
      OPT_STANDARD
    );
    const normalized = normalizeLineSectionIdsForSpinePages(
      starterLikeInstantiateInput().lineItemsByTemplateOptionId[OPT_ENHANCED]!,
      map
    );
    assert.equal(normalized[0]!.section_id, SEC_STD_LINES);
    assert.equal(normalized[1]!.section_id, SEC_STD_LINES);
  });

  test("buildDraftInstantiatePayload keeps spine pages only and normalizes all line section ids", () => {
    const payload = buildDraftInstantiatePayload(starterLikeInstantiateInput());

    assert.deepEqual(
      payload.pages.map((page) => page.source_template_section_id).sort(),
      [SEC_STD_LINES, SEC_STD_TERMS]
    );
    assert.ok(
      payload.lineItems.every((line) => line.section_id === SEC_STD_LINES),
      "every line section_id must map to spine estimate page section"
    );
  });

  test("customer document IA unchanged — non-spine option sections do not become pages", () => {
    const payload = buildDraftInstantiatePayload(starterLikeInstantiateInput());
    const pageSectionIds = new Set(
      payload.pages.map((page) => page.source_template_section_id).filter(Boolean)
    );
    assert.ok(!pageSectionIds.has(SEC_ENH_LINES));
    assert.ok(!pageSectionIds.has(SEC_ENH_UPGRADES));
    assert.equal(payload.pages.filter((page) => page.page_type === "estimate").length, 1);
  });
});

describe("pure module boundary", () => {
  test("no Supabase/store/API behavior involved", () => {
    const source = `
      ${buildContextEcho.toString()}
      ${buildDraftInstantiatePayload.toString()}
    `;
    assert.ok(!source.includes("supabase"));
    assert.ok(!source.includes("localStorage"));
    assert.ok(!source.includes("fetch("));
  });
});
