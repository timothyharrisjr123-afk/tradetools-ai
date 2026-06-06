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
  buildOptionSnapshots,
  buildPolicyEchoCustomerSafe,
  mapTemplateSectionsToProposalPages,
  normalizeGuardrailOutcomeForSnapshot,
  ProposalSnapshotBuilderError,
  templateItemToLineInput,
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
import type {
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

    const keys = Object.keys(echo);
    for (const forbidden of [
      "unit_cost",
      "internal_cost_cents",
      "profit_cents",
      "margin_pct",
      "catalog_supplier_metadata",
      "policy_echo_json",
    ]) {
      assert.ok(!keys.includes(forbidden), `forbidden key: ${forbidden}`);
    }
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
        }),
        section({
          id: "sec-terms",
          option_id: "opt-1",
          kind: "terms",
          name: "Terms",
          sort_order: 1,
        }),
      ],
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
