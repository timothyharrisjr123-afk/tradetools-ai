/**
 * V2G review fixtures — one canonical realistic roofing graph.
 *
 * Line prices + selected upgrades + tax = customer_total_cents per package.
 * Harness-only settlement — not a production pricing path.
 */

import type { ProposalDraftGraph, ProposalLineItemRow, ProposalOptionRow, ProposalPageRow } from "./proposalRecordStore";
import type { ProposalPublicGraphDto } from "./proposalPublicGraphDto";
import { buildProposalPublicGraphDto } from "./proposalPublicGraphDto";
import type { ProposalPageSettings } from "./proposalPageTypes";

export const V2G_COMPANY_ID = "11111111-1111-4111-8111-111111111111";
export const V2G_PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
export const V2G_VERSION_ID = "55555555-5555-4555-8555-555555555555";
export const V2G_TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
export const V2G_TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
export const V2G_TEMPLATE_OPT_C = "99999999-9999-4999-8999-999999999999";
export const V2G_TEMPLATE_OPT_ESSENTIAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const V2G_TEMPLATE_OPT_SIGNATURE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const V2G_RUNTIME_OPT_A = "11111111-1111-4111-8111-111111111101";
export const V2G_RUNTIME_OPT_B = "11111111-1111-4111-8111-111111111102";
export const V2G_RUNTIME_OPT_C = "11111111-1111-4111-8111-111111111103";
export const V2G_PAGE_ESTIMATE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/** 8% sales tax used only while constructing this review fixture. */
export const V2G_REVIEW_FIXTURE_TAX_RATE = 0.08;

export const V2G_UPGRADE_NAME = "Ridge vent";
export const V2G_UPGRADE_LINE_TOTAL_CENTS = 7500;
export const V2G_HIDDEN_LINE_NAME = "Hidden internal line";

function baseGraphShell(): ProposalDraftGraph {
  return {
    proposal: {
      id: V2G_PROPOSAL_ID,
      company_id: V2G_COMPANY_ID,
      job_id: "22222222-2222-4222-8222-222222222222",
      customer_id: null,
      template_id: "66666666-6666-4666-8666-666666666666",
      status: "draft",
      current_draft_version_id: V2G_VERSION_ID,
      latest_sent_version_id: null,
      signed_version_id: null,
      selected_option_id: V2G_RUNTIME_OPT_B,
      measurement_record_id: null,
      pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_number: null,
      title: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: V2G_VERSION_ID,
      company_id: V2G_COMPANY_ID,
      proposal_id: V2G_PROPOSAL_ID,
      version_number: 1,
      version_kind: "sent",
      parent_version_id: null,
      frozen_at: "2026-06-26T12:00:00.000Z",
      context_echo: {
        company_name: "Summit Roofing",
        customer_name: "Jane Homeowner",
        address_formatted: "123 Main St",
      },
      policy_echo: {},
      created_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    pages: [],
    options: [],
    lineItems: [],
    internalSummaries: [],
    scopeDecisions: [],
  };
}

function estimatePage(settings: ProposalPageSettings): ProposalPageRow {
  return {
    id: V2G_PAGE_ESTIMATE,
    company_id: V2G_COMPANY_ID,
    proposal_version_id: V2G_VERSION_ID,
    page_type: "estimate",
    sort_order: 10,
    title: "Estimate",
    customer_title: null,
    visible_to_customer: true,
    source_template_section_id: null,
    content_json: {},
    settings_json: settings,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
  };
}

function optionRow(
  overrides: Partial<ProposalOptionRow> & Pick<ProposalOptionRow, "id" | "source_template_option_id" | "name">
): ProposalOptionRow {
  return {
    company_id: V2G_COMPANY_ID,
    proposal_version_id: V2G_VERSION_ID,
    customer_label: overrides.name,
    description: null,
    sort_order: 0,
    is_default: false,
    visible_to_customer: true,
    customer_subtotal_cents: 0,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 0,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function lineRow(
  overrides: Partial<ProposalLineItemRow> & Pick<ProposalLineItemRow, "id" | "proposal_option_id" | "customer_name">
): ProposalLineItemRow {
  return {
    company_id: V2G_COMPANY_ID,
    source_template_item_id: overrides.id,
    catalog_item_id: null,
    catalog_seed_key: null,
    section_id: null,
    page_id: V2G_PAGE_ESTIMATE,
    sort_order: 0,
    description: null,
    role: "included",
    quantity: 25,
    quantity_display_label: "25",
    quantity_source_label: null,
    unit: "SQ",
    customer_unit_price_cents: 0,
    customer_line_total_cents: 0,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    upgrade_selection_state: null,
    upgrade_effect: null,
    replaces_source_template_item_id: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function pricedLine(
  input: Partial<ProposalLineItemRow> & {
    id: string;
    proposal_option_id: string;
    customer_name: string;
    customer_line_total_cents: number;
  }
): ProposalLineItemRow {
  const quantity = input.quantity ?? 1;
  const unitPrice =
    input.customer_unit_price_cents ??
    (quantity > 0 ? Math.round(input.customer_line_total_cents / quantity) : input.customer_line_total_cents);
  return lineRow({
    quantity,
    quantity_display_label: String(quantity),
    unit: input.unit ?? "EA",
    customer_unit_price_cents: unitPrice,
    ...input,
  });
}

function sharedScopeLines(optionId: string, prefix: string): ProposalLineItemRow[] {
  return [
    pricedLine({
      id: `${prefix}-tearoff`,
      proposal_option_id: optionId,
      customer_name: "Tear-off and haul-off",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 150000,
      sort_order: 40,
    }),
    pricedLine({
      id: `${prefix}-install`,
      proposal_option_id: optionId,
      customer_name: "Professional installation",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 250000,
      sort_order: 41,
    }),
    pricedLine({
      id: `${prefix}-disposal`,
      proposal_option_id: optionId,
      customer_name: "Disposal and dump fees",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 75000,
      sort_order: 42,
    }),
    pricedLine({
      id: `${prefix}-ridge-cap`,
      proposal_option_id: optionId,
      customer_name: "Ridge cap shingles",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 100000,
      sort_order: 43,
    }),
    pricedLine({
      id: `${prefix}-boots`,
      proposal_option_id: optionId,
      customer_name: "Pipe boots and flashing",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 40000,
      sort_order: 44,
    }),
  ];
}

function ventilationUpgradeLine(optionId: string, prefix: string, selected: boolean): ProposalLineItemRow {
  return pricedLine({
    id: `${prefix}-vent`,
    proposal_option_id: optionId,
    customer_name: V2G_UPGRADE_NAME,
    role: "upgrade",
    composition_role: "ventilation",
    composition_slot_key: "ventilation.ridge",
    quantity: 1,
    unit: "EA",
    customer_line_total_cents: V2G_UPGRADE_LINE_TOTAL_CENTS,
    upgrade_selection_state: selected ? "selected" : "not_selected",
    upgrade_effect: "additive",
    sort_order: 50,
  });
}

export function isV2gFixtureLineInCustomerTotal(line: ProposalLineItemRow): boolean {
  if (line.visible_to_customer === false) return false;
  if ((line.pricing_status ?? "").trim().toLowerCase() === "omitted") return false;
  const role = (line.role ?? "").trim().toLowerCase();
  if (role === "upgrade" || role === "optional_addon") {
    return line.upgrade_selection_state === "selected";
  }
  return true;
}

/**
 * Fixture-only settlement so review totals stay coherent with line items.
 * Do not reuse from production Public/Preview presenters.
 */
export function settleV2gReviewFixtureOptionPricing(
  option: ProposalOptionRow,
  lines: readonly ProposalLineItemRow[]
): ProposalOptionRow {
  const subtotal = lines
    .filter((line) => line.proposal_option_id === option.id && isV2gFixtureLineInCustomerTotal(line))
    .reduce((sum, line) => sum + (line.customer_line_total_cents ?? 0), 0);
  const salesTaxCents = Math.round(subtotal * V2G_REVIEW_FIXTURE_TAX_RATE);
  return {
    ...option,
    customer_subtotal_cents: subtotal,
    discount_cents: 0,
    sales_tax_cents: salesTaxCents,
    customer_total_cents: subtotal + salesTaxCents,
  };
}

function settleGraph(graph: ProposalDraftGraph): ProposalDraftGraph {
  graph.options = graph.options.map((option) => settleV2gReviewFixtureOptionPricing(option, graph.lineItems));
  return graph;
}

export function buildV2gMultiPackageDraftGraph(input?: {
  estimateSettings?: ProposalPageSettings;
  includeHiddenLine?: boolean;
  omitComparisonKey?: boolean;
}): ProposalDraftGraph {
  const graph = baseGraphShell();
  const estimateSettings: ProposalPageSettings = input?.omitComparisonKey
    ? { ...input.estimateSettings }
    : {
        show_customer_package_comparison: true,
        ...input?.estimateSettings,
      };
  graph.pages = [estimatePage(estimateSettings)];
  graph.options = [
    optionRow({
      id: V2G_RUNTIME_OPT_A,
      source_template_option_id: V2G_TEMPLATE_OPT_A,
      name: "Standard",
      sort_order: 0,
    }),
    optionRow({
      id: V2G_RUNTIME_OPT_C,
      source_template_option_id: V2G_TEMPLATE_OPT_C,
      name: "Enhanced",
      sort_order: 1,
    }),
    optionRow({
      id: V2G_RUNTIME_OPT_B,
      source_template_option_id: V2G_TEMPLATE_OPT_B,
      name: "Premium",
      sort_order: 2,
      is_default: true,
    }),
  ];
  graph.lineItems = [
    pricedLine({
      id: "std-shingles",
      proposal_option_id: V2G_RUNTIME_OPT_A,
      customer_name: "Architectural shingles",
      composition_role: "roof_covering",
      composition_slot_key: "roof_covering",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 880000,
      sort_order: 0,
    }),
    pricedLine({
      id: "std-underlayment",
      proposal_option_id: V2G_RUNTIME_OPT_A,
      customer_name: "Synthetic underlayment",
      composition_role: "underlayment",
      composition_slot_key: "underlayment",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 160000,
      sort_order: 1,
    }),
    pricedLine({
      id: "std-ice",
      proposal_option_id: V2G_RUNTIME_OPT_A,
      customer_name: "Ice & water protection at valleys",
      composition_role: "ice_water",
      composition_slot_key: "ice_water.valleys",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 65000,
      sort_order: 2,
    }),
    ...sharedScopeLines(V2G_RUNTIME_OPT_A, "std"),
    ventilationUpgradeLine(V2G_RUNTIME_OPT_A, "std", false),

    pricedLine({
      id: "enh-shingles",
      proposal_option_id: V2G_RUNTIME_OPT_C,
      customer_name: "Architectural shingles",
      composition_role: "roof_covering",
      composition_slot_key: "roof_covering",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 880000,
      sort_order: 0,
    }),
    pricedLine({
      id: "enh-underlayment",
      proposal_option_id: V2G_RUNTIME_OPT_C,
      customer_name: "Premium underlayment",
      composition_role: "underlayment",
      composition_slot_key: "underlayment",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 240000,
      sort_order: 1,
    }),
    pricedLine({
      id: "enh-ice",
      proposal_option_id: V2G_RUNTIME_OPT_C,
      customer_name: "Ice & water protection at eaves and valleys",
      composition_role: "ice_water",
      composition_slot_key: "ice_water.eaves_valleys",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 145000,
      sort_order: 2,
    }),
    ...sharedScopeLines(V2G_RUNTIME_OPT_C, "enh"),
    ventilationUpgradeLine(V2G_RUNTIME_OPT_C, "enh", false),

    pricedLine({
      id: "prem-shingles",
      proposal_option_id: V2G_RUNTIME_OPT_B,
      customer_name: "Designer shingles",
      composition_role: "roof_covering",
      composition_slot_key: "roof_covering",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 1120000,
      sort_order: 0,
    }),
    pricedLine({
      id: "prem-underlayment",
      proposal_option_id: V2G_RUNTIME_OPT_B,
      customer_name: "Premium underlayment",
      composition_role: "underlayment",
      composition_slot_key: "underlayment",
      quantity: 25,
      unit: "SQ",
      customer_line_total_cents: 240000,
      sort_order: 1,
    }),
    pricedLine({
      id: "prem-ice",
      proposal_option_id: V2G_RUNTIME_OPT_B,
      customer_name: "Ice & water protection at eaves and valleys",
      composition_role: "ice_water",
      composition_slot_key: "ice_water.eaves_valleys",
      quantity: 1,
      unit: "EA",
      customer_line_total_cents: 145000,
      sort_order: 2,
    }),
    ...sharedScopeLines(V2G_RUNTIME_OPT_B, "prem"),
    ventilationUpgradeLine(V2G_RUNTIME_OPT_B, "prem", true),
  ];

  if (input?.includeHiddenLine) {
    graph.lineItems.push(
      pricedLine({
        id: "line-hidden",
        proposal_option_id: V2G_RUNTIME_OPT_B,
        customer_name: V2G_HIDDEN_LINE_NAME,
        visible_to_customer: false,
        composition_role: "hidden_scope",
        composition_slot_key: "hidden.scope",
        customer_line_total_cents: 50000,
        sort_order: 90,
      })
    );
  }

  return settleGraph(graph);
}

export function buildV2gMultiPackagePublicDto(input?: {
  comparisonEnabled?: boolean;
  optionNames?: Array<{ id: string; label: string }>;
  selectedId?: string;
}): ProposalPublicGraphDto {
  const graph = buildV2gMultiPackageDraftGraph({
    estimateSettings: {
      show_customer_package_comparison: input?.comparisonEnabled !== false,
    },
  });

  if (input?.optionNames) {
    const canonical = [...graph.options].sort((a, b) => a.sort_order - b.sort_order);
    graph.options = input.optionNames.map((entry, index) => {
      const source = canonical[Math.min(index, canonical.length - 1)]!;
      return {
        ...source,
        source_template_option_id: entry.id,
        name: entry.label,
        customer_label: entry.label,
        sort_order: index,
        is_default: index === input.optionNames!.length - 1,
      };
    });
    const keepIds = new Set(graph.options.map((option) => option.id));
    graph.lineItems = graph.lineItems.filter((line) => keepIds.has(line.proposal_option_id));
    const selectedRuntime =
      graph.options.find((option) => option.source_template_option_id === input.selectedId)?.id ??
      graph.options[graph.options.length - 1]?.id ??
      null;
    graph.proposal.selected_option_id = selectedRuntime;
  }

  const selectedId = input?.selectedId ?? V2G_TEMPLATE_OPT_B;
  return buildProposalPublicGraphDto(graph, selectedId);
}
