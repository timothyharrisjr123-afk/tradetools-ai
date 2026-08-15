/**
 * V2E1 — Template → draft isolation goldens (pure fixtures + mocked store).
 *
 * Run: npx tsx --test app/lib/proposalTemplateDraftIsolation.v2e1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import {
  scopeTemplateGraphToDraftPackageOptions,
} from "./proposalBuilderDraftPackageOptions";
import {
  buildCustomerPreviewEstimatePresentationFromDraft,
} from "./proposalCustomerEstimatePresenter";
import {
  buildDraftInstantiateInputFromDraftStructure,
  synthesizeDraftOwnedQuantityRule,
} from "./proposalDraftStructurePricing";
import type {
  ProposalDraftGraph,
  ProposalLineItemRow,
  ProposalOptionRow,
} from "./proposalRecordStore";
import type { PricingPolicy } from "./proposalPricingTypes";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
} from "./proposalPricingTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";
import type { ProposalOptionUpgradeChoicePersistRow } from "./proposalUpgradeTruthTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const POLICY_ID = "44444444-4444-4444-8444-444444444444";
const OPT_ID = "77777777-7777-4777-8777-777777777777";
const SEC_ID = "88888888-8888-4888-8888-888888888888";
const ITEM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_UPGRADE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CAT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RUNTIME_OPT = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "99999999-9999-4999-8999-999999999999";

function policy(): PricingPolicy {
  return {
    defaultProfitabilityPct: 40,
    minimumProfitabilityPct: 20,
    profitabilityType: DEFAULT_PROFITABILITY_TYPE,
    wasteModel: DEFAULT_WASTE_MODEL,
    quantityRounding: DEFAULT_QUANTITY_ROUNDING,
    tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
  };
}

function catalog(id: string, overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id,
    company_id: COMPANY_ID,
    name: overrides.name ?? id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    unit_price_cents: null,
    labor_unit_cost_cents: null,
    ...overrides,
  };
}

function draftOption(overrides: Partial<ProposalOptionRow> = {}): ProposalOptionRow {
  return {
    id: RUNTIME_OPT,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    source_template_option_id: OPT_ID,
    name: "Standard",
    customer_label: "Standard",
    description: "Copied draft package description",
    sort_order: 0,
    is_default: true,
    visible_to_customer: true,
    customer_subtotal_cents: 100_000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 100_000,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function draftLine(
  overrides: Partial<ProposalLineItemRow> & { id: string; source_template_item_id: string }
): ProposalLineItemRow {
  return {
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT,
    catalog_item_id: CAT_A,
    catalog_seed_key: null,
    section_id: SEC_ID,
    page_id: null,
    sort_order: 0,
    customer_name: "Draft line label",
    description: "Draft line description",
    role: "standard",
    quantity: 22,
    quantity_display_label: "22 SQ",
    quantity_source_label: "Adjusted roof squares",
    unit: "square",
    customer_unit_price_cents: 16_667,
    customer_line_total_cents: 366_674,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: "adjusted_roof_squares",
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function liveGraph(items: ProposalTemplateItem[], optionName = "Essential"): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Roof replacement",
      status: "active",
      active: true,
    },
    options: [
      {
        id: OPT_ID,
        template_id: TEMPLATE_ID,
        name: optionName,
        customer_label: optionName,
        description: "Live template description after edit",
        selection_mode: "single",
        is_default: false,
        visible_to_customer: true,
        sort_order: 99,
        metadata: null,
      },
    ],
    sections: [
      {
        id: SEC_ID,
        template_id: TEMPLATE_ID,
        option_id: OPT_ID,
        kind: "line_items",
        name: "Estimate",
        customer_title: null,
        sort_order: 0,
        customer_visibility: "customer_visible",
        content: null,
        metadata: null,
      },
    ],
    items,
  };
}

function baseDraftGraph(lines: ProposalLineItemRow[]): ProposalDraftGraph {
  return {
    proposal: {
      id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      template_id: TEMPLATE_ID,
      status: "draft",
      current_draft_version_id: VERSION_ID,
      selected_option_id: RUNTIME_OPT,
      pricing_policy_id: POLICY_ID,
      latest_sent_version_id: null,
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
    } as ProposalDraftGraph["proposal"],
    version: {
      id: VERSION_ID,
      company_id: COMPANY_ID,
      proposal_id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
      version_kind: "draft",
      version_number: 1,
      frozen_at: null,
      context_echo: {},
      policy_echo: {},
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
    } as ProposalDraftGraph["version"],
    pages: [
      {
        id: "page-terms",
        company_id: COMPANY_ID,
        proposal_version_id: VERSION_ID,
        page_type: "terms",
        title: "Job-specific terms",
        customer_title: "Job-specific terms",
        sort_order: 1,
        visible_to_customer: true,
        source_template_section_id: "99999999-9999-4999-8999-999999999999",
        content_json: { body_markdown: "Do not change me" },
        settings_json: {},
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
      } as ProposalDraftGraph["pages"][number],
    ],
    options: [draftOption()],
    lineItems: lines,
    internalSummaries: [],
    scopeDecisions: [],
    upgradeChoices: [],
  };
}

describe("V2E1 Template → draft isolation", () => {
  test("1–3. Builder/Preview draft presentation wins over later Template rename/description", () => {
    const draft = baseDraftGraph([
      draftLine({ id: "line-a", source_template_item_id: ITEM_A }),
    ]);
    const live = liveGraph(
      [
        {
          id: ITEM_A,
          template_id: TEMPLATE_ID,
          option_id: OPT_ID,
          section_id: SEC_ID,
          catalog_item_id: CAT_A,
          item_role: "standard",
          sort_order: 0,
          customer_name_override: "Live renamed line",
          description_override: "Live description",
        },
      ],
      "Essential"
    );

    const scoped = scopeTemplateGraphToDraftPackageOptions(live, draft);
    assert.equal(scoped?.options[0]?.name, "Standard");
    assert.equal(scoped?.options[0]?.description, "Copied draft package description");
    assert.equal(scoped?.options[0]?.sort_order, 0);
    assert.equal(scoped?.options[0]?.is_default, true);

    const preview = buildCustomerPreviewEstimatePresentationFromDraft({
      draftLines: [
        {
          sourceTemplateItemId: ITEM_A,
          customerName: "Draft line label",
          role: "standard",
          sortOrder: 0,
        },
      ],
      optionCustomerView: {
        optionId: OPT_ID,
        pricingComplete: true,
        customerSubtotalCents: 100_000,
        discountCents: 0,
        salesTaxCents: 0,
        customerTotalCents: 100_000,
        lines: [],
        lineByTemplateItemId: {
          [ITEM_A]: {
            templateItemId: ITEM_A,
            sectionId: SEC_ID,
            displayStatus: "priced",
            showPrice: true,
            customerLinePriceCents: 100_000,
            showOnCustomerDocument: true,
            customerVisibility: "customer_visible",
          },
        },
      },
      selectedOptionLabel: "Standard",
      packageMeta: {
        description: "Copied draft package description",
        bullets: ["a", "b"],
      },
    });

    assert.equal(preview.packageHero.description, "Copied draft package description");
    assert.equal(preview.scopeSections[0]?.lines[0]?.name, "Draft line label");
    assert.notEqual(preview.scopeSections[0]?.lines[0]?.name, "Live renamed line");
  });

  test("4–7. Refresh preserves membership/labels/upgrades when Template adds/removes/relabels", () => {
    const draftLines = [
      draftLine({
        id: "line-a",
        source_template_item_id: ITEM_A,
        customer_name: "Original draft label",
        sort_order: 0,
      }),
      draftLine({
        id: "line-up",
        source_template_item_id: ITEM_UPGRADE,
        catalog_item_id: CAT_B,
        customer_name: "Draft upgrade",
        role: "upgrade",
        sort_order: 1,
        upgrade_selection_state: "selected",
        upgrade_effect: "additive",
        quantity: 1,
      }),
    ];
    const draft = baseDraftGraph(draftLines);

    // Live Template removed ITEM_A, renamed upgrade, added ITEM_B, changed option copy.
    const live = liveGraph([
      {
        id: ITEM_B,
        template_id: TEMPLATE_ID,
        option_id: OPT_ID,
        section_id: SEC_ID,
        catalog_item_id: CAT_B,
        item_role: "standard",
        sort_order: 0,
        customer_name_override: "Brand new template item",
      },
      {
        id: ITEM_UPGRADE,
        template_id: TEMPLATE_ID,
        option_id: OPT_ID,
        section_id: SEC_ID,
        catalog_item_id: CAT_B,
        item_role: "upgrade",
        sort_order: 1,
        customer_name_override: "Template renamed upgrade",
        default_selected: false,
        upgrade_effect: "additive",
      },
    ]);

    const upgradeChoices: ProposalOptionUpgradeChoicePersistRow[] = [
      {
        source_template_item_id: ITEM_UPGRADE,
        selection_state: "selected",
        upgrade_effect: "additive",
        replaces_source_template_item_id: null,
      },
    ];

    const { input, report } = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [catalog(CAT_A), catalog(CAT_B)],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: live,
      upgradeChoicesByTemplateOptionId: { [OPT_ID]: upgradeChoices },
    });

    const lines = input.lineItemsByTemplateOptionId[OPT_ID] ?? [];
    const ids = lines.map((line) => line.source_template_item_id).sort();
    assert.deepEqual(ids, [ITEM_A, ITEM_UPGRADE].sort());
    assert.equal(
      lines.some((line) => line.source_template_item_id === ITEM_B),
      false,
      "Template add must not import into old draft"
    );
    assert.equal(
      lines.find((line) => line.source_template_item_id === ITEM_A)?.customer_name,
      "Original draft label"
    );
    assert.equal(
      lines.find((line) => line.source_template_item_id === ITEM_UPGRADE)?.customer_name,
      "Draft upgrade"
    );
    assert.equal(
      input.upgradeChoicesByTemplateOptionId?.[OPT_ID]?.length,
      1
    );
    assert.equal(
      input.upgradeChoicesByTemplateOptionId?.[OPT_ID]?.[0]?.selection_state,
      "selected"
    );
    assert.equal(report.quantityRuleLiveLookups, 0);
    assert.ok(report.draftOwnedQuantityResolves >= 1);
  });

  test("composition role/slot survive refresh and ignore live Template + Catalog role", () => {
    const draft = baseDraftGraph([
      draftLine({
        id: "line-a",
        source_template_item_id: ITEM_A,
        composition_role: "roof_covering",
        composition_slot_key: "roof_covering",
        catalog_seed_key: "roofing.architectural_shingles",
      }),
    ]);
    const live = liveGraph([
      {
        id: ITEM_A,
        template_id: TEMPLATE_ID,
        option_id: OPT_ID,
        section_id: SEC_ID,
        catalog_item_id: CAT_A,
        item_role: "standard",
        sort_order: 0,
        composition_role: "underlayment",
        composition_slot_key: "underlayment",
        customer_name_override: "Live template covering",
      },
    ]);
    const { input } = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [
        catalog(CAT_A, { composition_role: "ice_water" }),
      ],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: live,
    });
    const line = input.lineItemsByTemplateOptionId[OPT_ID]?.[0];
    assert.equal(line?.composition_role, "roof_covering");
    assert.equal(line?.composition_slot_key, "roof_covering");
    assert.notEqual(line?.composition_role, "underlayment");
    assert.notEqual(line?.composition_role, "ice_water");
  });

  test("quantity R1→R2: later Template quantity_rule must not affect existing draft refresh", () => {
    const draft = baseDraftGraph([
      draftLine({
        id: "line-a",
        source_template_item_id: ITEM_A,
        quantity: 22,
        measurement_quantity_key: null,
        quantity_source_label: "Adjusted roof squares",
      }),
    ]);

    const catalogItem = catalog(CAT_A, { quantity_source: "adjusted_roof_squares" });
    const handoffQuantities = {
      roof_squares: 22,
      adjusted_roof_squares: 22,
      roof_area_sqft: 2200,
      waste_percent: 10,
      eaves_lf: 999,
      rakes_lf: null,
      ridges_lf: null,
      hips_lf: null,
      valleys_lf: null,
      wall_flashing_lf: null,
      step_flashing_lf: null,
      transitions_lf: null,
      parapet_wall_lf: null,
      drip_edge_lf: null,
      starter_lf: null,
      ridge_cap_lf: null,
      pipe_boots_count: null,
      vents_count: null,
      skylights_count: null,
      chimneys_count: null,
      satellite_dishes_count: null,
    };

    const quantityContext = {
      measurementHandoff: {
        proposalReady: true,
        blockers: [],
        selectedLabel: "Job",
        quantities: handoffQuantities,
        estimateReady: true,
        productionReady: false,
      },
      quantityMap: { shingles_squares: 22 },
    };

    // Even if a caller still passes a mutated live Template with R2, Refresh must ignore it.
    const liveR2 = liveGraph([
      {
        id: ITEM_A,
        template_id: TEMPLATE_ID,
        option_id: OPT_ID,
        section_id: SEC_ID,
        catalog_item_id: CAT_A,
        item_role: "standard",
        sort_order: 0,
        quantity_rule: {
          mode: "multiplier",
          quantity_source: "adjusted_roof_squares",
          quantity_multiplier: 10,
        },
      },
    ]);

    const { input, report } = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [catalogItem],
      quantityContext,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: liveR2,
    });

    const line = input.lineItemsByTemplateOptionId[OPT_ID]?.[0];
    assert.equal(line?.quantity, 22, "R2 multiplier must not apply to existing draft");
    assert.notEqual(line?.quantity, 220);
    assert.equal(report.quantityRuleLiveLookups, 0);

    const synthesized = synthesizeDraftOwnedQuantityRule(
      draft.lineItems[0]!,
      catalogItem
    );
    assert.equal(synthesized.mode, "inherit_catalog");
    assert.equal(synthesized.quantity_multiplier ?? null, null);

    // Measurement change still re-resolves via Catalog (chosen Refresh semantics B).
    const qty30 = {
      ...quantityContext,
      measurementHandoff: {
        ...quantityContext.measurementHandoff,
        quantities: { ...handoffQuantities, adjusted_roof_squares: 30, roof_squares: 30 },
      },
      quantityMap: { shingles_squares: 30 },
    };
    const afterMeasurement = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [catalogItem],
      quantityContext: qty30,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: liveR2,
    });
    assert.equal(
      afterMeasurement.input.lineItemsByTemplateOptionId[OPT_ID]?.[0]?.quantity,
      30
    );
  });

  test("synthesizeDraftOwnedQuantityRule keeps Fixed draft qty without Template", () => {
    const line = draftLine({
      id: "line-fixed",
      source_template_item_id: ITEM_UPGRADE,
      quantity: 1,
      quantity_source_label: "Fixed",
      catalog_item_id: CAT_B,
    });
    const cat = catalog(CAT_B, { quantity_source: "vents_count" });
    const rule = synthesizeDraftOwnedQuantityRule(line, cat);
    assert.equal(rule.mode, "fixed");
    assert.equal(rule.fixed_quantity, 1);
  });

  test("8–12. Selected upgrade, hide, package selection, and pages stay draft-owned", () => {
    const draft = baseDraftGraph([
      draftLine({
        id: "line-a",
        source_template_item_id: ITEM_A,
        visible_to_customer: false,
      }),
      draftLine({
        id: "line-up",
        source_template_item_id: ITEM_UPGRADE,
        catalog_item_id: CAT_B,
        role: "upgrade",
        customer_name: "Selected upgrade",
        upgrade_selection_state: "selected",
        upgrade_effect: "additive",
        quantity: 1,
        sort_order: 1,
      }),
    ]);
    draft.options[0]!.name = "Builder-selected package wording";

    const { input } = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [catalog(CAT_A), catalog(CAT_B)],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: liveGraph([
        {
          id: ITEM_A,
          template_id: TEMPLATE_ID,
          option_id: OPT_ID,
          section_id: SEC_ID,
          catalog_item_id: CAT_A,
          item_role: "standard",
          sort_order: 0,
        },
        {
          id: ITEM_UPGRADE,
          template_id: TEMPLATE_ID,
          option_id: OPT_ID,
          section_id: SEC_ID,
          catalog_item_id: CAT_B,
          item_role: "upgrade",
          sort_order: 1,
          upgrade_effect: "additive",
          default_selected: false,
        },
      ]),
      upgradeChoicesByTemplateOptionId: {
        [OPT_ID]: [
          {
            source_template_item_id: ITEM_UPGRADE,
            selection_state: "selected",
            upgrade_effect: "additive",
            replaces_source_template_item_id: null,
          },
        ],
      },
      scopeDecisionsByTemplateOptionId: {
        [OPT_ID]: [
          {
            id: "dec-hide",
            companyId: COMPANY_ID,
            proposalId: draft.proposal.id,
            proposalVersionId: VERSION_ID,
            proposalOptionId: RUNTIME_OPT,
            decisionType: "visibility_override",
            sourceTemplateItemId: ITEM_A,
            instanceLineKey: null,
            payload: { visible_to_customer: false },
            active: true,
            createdBy: null,
            updatedBy: null,
            createdAt: "2026-06-06T00:00:00.000Z",
            updatedAt: "2026-06-06T00:00:00.000Z",
          },
        ],
      },
    });

    assert.equal(input.selectedTemplateOptionId, OPT_ID);
    assert.equal(input.optionPricing[0]?.name, "Builder-selected package wording");
    assert.equal(input.optionPricing[0]?.is_selected, true);
    assert.equal(input.templateSections.length, 0, "refresh must not rebuild pages from Template");
    const hidden = input.lineItemsByTemplateOptionId[OPT_ID]?.find(
      (line) => line.source_template_item_id === ITEM_A
    );
    assert.equal(hidden?.hiddenButInCalc, true);
    assert.equal(
      input.upgradeChoicesByTemplateOptionId?.[OPT_ID]?.[0]?.selection_state,
      "selected"
    );
  });

  test("9–10. Manual quantity and exclude survive structure refresh", () => {
    const draft = baseDraftGraph([
      draftLine({ id: "line-a", source_template_item_id: ITEM_A, quantity: 22 }),
      draftLine({
        id: "line-b",
        source_template_item_id: ITEM_B,
        catalog_item_id: CAT_B,
        customer_name: "Excluded later",
        sort_order: 1,
      }),
    ]);

    const { input } = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [catalog(CAT_A), catalog(CAT_B)],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
      liveTemplateGraph: liveGraph([
        {
          id: ITEM_A,
          template_id: TEMPLATE_ID,
          option_id: OPT_ID,
          section_id: SEC_ID,
          catalog_item_id: CAT_A,
          item_role: "standard",
          sort_order: 0,
          quantity_rule: { mode: "inherit_catalog" },
        },
        {
          id: ITEM_B,
          template_id: TEMPLATE_ID,
          option_id: OPT_ID,
          section_id: SEC_ID,
          catalog_item_id: CAT_B,
          item_role: "standard",
          sort_order: 1,
        },
      ]),
      scopeDecisionsByTemplateOptionId: {
        [OPT_ID]: [
          {
            id: "dec-qty",
            companyId: COMPANY_ID,
            proposalId: draft.proposal.id,
            proposalVersionId: VERSION_ID,
            proposalOptionId: RUNTIME_OPT,
            decisionType: "manual_quantity",
            sourceTemplateItemId: ITEM_A,
            instanceLineKey: null,
            payload: { quantity: 18, quantity_display_label: "18 SQ" },
            active: true,
            createdBy: null,
            updatedBy: null,
            createdAt: "2026-06-06T00:00:00.000Z",
            updatedAt: "2026-06-06T00:00:00.000Z",
          },
          {
            id: "dec-ex",
            companyId: COMPANY_ID,
            proposalId: draft.proposal.id,
            proposalVersionId: VERSION_ID,
            proposalOptionId: RUNTIME_OPT,
            decisionType: "excluded",
            sourceTemplateItemId: ITEM_B,
            instanceLineKey: null,
            payload: {},
            active: true,
            createdBy: null,
            updatedBy: null,
            createdAt: "2026-06-06T00:00:00.000Z",
            updatedAt: "2026-06-06T00:00:00.000Z",
          },
        ],
      },
    });

    const lines = input.lineItemsByTemplateOptionId[OPT_ID] ?? [];
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.source_template_item_id, ITEM_A);
    assert.equal(lines[0]?.quantity, 18);
    assert.equal(lines[0]?.quantity_source_label, "Manual");
  });

  test("13. Catalog price change updates draft economics without membership change", () => {
    const draft = baseDraftGraph([
      draftLine({
        id: "line-a",
        source_template_item_id: ITEM_A,
        quantity: 10,
        quantity_source_label: "Fixed",
      }),
    ]);
    const cheap = catalog(CAT_A, {
      unit_cost_cents: 5_000,
      quantity_source: "fixed",
      default_quantity: 10,
    });
    const expensive = catalog(CAT_A, {
      unit_cost_cents: 20_000,
      quantity_source: "fixed",
      default_quantity: 10,
    });

    const before = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [cheap],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
    });
    const after = buildDraftInstantiateInputFromDraftStructure({
      companyId: COMPANY_ID,
      draftGraph: draft,
      catalogItems: [expensive],
      quantityContext: null,
      policy: policy(),
      pricingPolicyId: POLICY_ID,
      actorRole: "contractor",
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
      selectedTemplateOptionId: OPT_ID,
    });

    const beforeLine = before.input.lineItemsByTemplateOptionId[OPT_ID]?.[0];
    const afterLine = after.input.lineItemsByTemplateOptionId[OPT_ID]?.[0];
    assert.equal(beforeLine?.source_template_item_id, ITEM_A);
    assert.equal(afterLine?.source_template_item_id, ITEM_A);
    assert.equal(beforeLine?.customer_name, afterLine?.customer_name);
    assert.equal(beforeLine?.quantity, 10);
    assert.equal(afterLine?.quantity, 10);
    assert.ok(
      (afterLine?.customer_line_total_cents ?? 0) > (beforeLine?.customer_line_total_cents ?? 0)
    );
  });

  test("14–15. Protected systems + no live Template quantity dependency in refresh", () => {
    const root = process.cwd();
    const refreshSrc = readFileSync(
      path.join(root, "app/lib/proposalRecordStore.ts"),
      "utf8"
    );
    const refreshStart = refreshSrc.indexOf("export async function refreshDraftPricing");
    const refreshEnd = refreshSrc.indexOf("function resolveSelectedTemplateOptionIdFromDraft");
    assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
    const refreshFn = refreshSrc.slice(refreshStart, refreshEnd);
    assert.match(refreshFn, /buildDraftInstantiateInputFromDraftStructure/);
    assert.match(refreshFn, /resolveSelectedTemplateOptionIdFromDraft/);
    assert.doesNotMatch(refreshFn, /getTemplateGraph/);
    assert.match(refreshSrc, /buildDraftInstantiateInputFromPreview/);
    assert.doesNotMatch(refreshSrc, /V2E2/);

    const structureSrc = readFileSync(
      path.join(root, "app/lib/proposalDraftStructurePricing.ts"),
      "utf8"
    );
    assert.match(structureSrc, /synthesizeDraftOwnedQuantityRule/);
    assert.doesNotMatch(structureSrc, /liveItemsById/);
    assert.match(structureSrc, /Never reads live Template quantity_rule/);
    assert.match(structureSrc, /Live Template quantity_rule is never read/);

    const previewDoc = readFileSync(
      path.join(root, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx"),
      "utf8"
    );
    assert.match(previewDoc, /buildCustomerPreviewEstimatePresentationFromDraft/);
    assert.doesNotMatch(previewDoc, /getSectionsForOption\(templateGraph/);
    assert.doesNotMatch(previewDoc, /templateGraph\.options\.find/);

    const publicEstimate = readFileSync(
      path.join(root, "app/lib/proposalPublicEstimatePresentation.ts"),
      "utf8"
    );
    assert.doesNotMatch(publicEstimate, /buildDraftInstantiateInputFromDraftStructure/);
    assert.doesNotMatch(publicEstimate, /scopeTemplateGraphToDraftPackageOptions/);

    const packagePresentation = readFileSync(
      path.join(root, "app/lib/proposalPackagePresentation.ts"),
      "utf8"
    );
    assert.doesNotMatch(packagePresentation, /PACKAGE_META_BY_LABEL/);
    assert.doesNotMatch(packagePresentation, /Architectural shingles/);
  });
});
