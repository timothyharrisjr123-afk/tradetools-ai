/**
 * R18B1 — Pure public/customer graph DTO allowlist stub.
 *
 * Documents and enforces customer-safe fields for future R18C public read.
 * No routes, APIs, Supabase, or lifecycle mutation.
 */

import {
  readEstimatePageSettingsFromProposalPage,
  resolveCustomerPreviewEstimateDisplayPolicy,
  type ResolvedCustomerPreviewEstimateDisplayPolicy,
} from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import { getCustomerPreviewPages } from "@/app/lib/proposalPageVisibilityEditing";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "@/app/lib/proposalLineSnapshotTypes";
import { PROPOSAL_SNAPSHOT_INTERNAL_ONLY_FIELDS } from "@/app/lib/proposalSnapshotTypes";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import type {
  ProposalDraftGraph,
  ProposalInternalSummaryRow,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalPageRow,
} from "@/app/lib/proposalRecordStore";
import type {
  ProposalSendFreezeGraphLike,
  ProposalSendFreezeOptionPersistPayload,
  ProposalSendFreezePagePersistRow,
} from "@/app/lib/proposalSendFreezePersistence";

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export type ProposalPublicGraphInput =
  | ProposalDraftGraph
  | (ProposalSendFreezeGraphLike & {
      scopeDecisions?: ProposalScopeDecision[];
      internalSummaries?: ProposalInternalSummaryRow[];
    });

export type ProposalPublicGraphPageDto = {
  page_type: string;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: true;
  content_json: Record<string, unknown>;
  settings_json: Record<string, unknown>;
};

export type ProposalPublicGraphLineDto = {
  source_template_item_id: string | null;
  customer_name: string;
  description: string | null;
  quantity: number | null;
  quantity_display_label: string | null;
  unit: string | null;
  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;
  pricing_status: string;
  visible_to_customer: true;
};

export type ProposalPublicGraphOptionDto = {
  source_template_option_id: string;
  name: string;
  customer_label: string | null;
  sort_order: number;
  visible_to_customer: boolean;
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  line_items: ProposalPublicGraphLineDto[];
};

export type ProposalPublicGraphDto = {
  version_kind: "sent";
  frozen_at: string | null;
  context_echo: Record<string, unknown>;
  policy_echo: Record<string, unknown>;
  selected_template_option_id: string | null;
  pages: ProposalPublicGraphPageDto[];
  options: ProposalPublicGraphOptionDto[];
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy;
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const BUILDER_LABEL_PATTERNS = [
  /scope review/i,
  /edit option/i,
  /hide from customer/i,
  /contractor estimate/i,
  /removed from this option/i,
] as const;

function assertNoForbiddenKeys(record: Record<string, unknown>, label: string): void {
  for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
    if (key in record) {
      throw new Error(`Public DTO ${label} must not include forbidden key: ${key}`);
    }
  }
  for (const key of PROPOSAL_SNAPSHOT_INTERNAL_ONLY_FIELDS) {
    if (key in record) {
      throw new Error(`Public DTO ${label} must not include internal-only key: ${key}`);
    }
  }
}

function assertNoBuilderLabels(text: string | null | undefined): void {
  if (!text) return;
  for (const pattern of BUILDER_LABEL_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Public DTO must not expose Builder label text: ${text}`);
    }
  }
}

function isPublicCustomerLine(line: {
  visible_to_customer: boolean;
  pricing_status: string;
}): boolean {
  return line.visible_to_customer === true && line.pricing_status !== "omitted";
}

function mapPublicLine(
  line: ProposalLineItemRow | ProposalSendFreezeOptionPersistPayload["line_items"][number]
): ProposalPublicGraphLineDto | null {
  if (!isPublicCustomerLine(line)) return null;

  const dto: ProposalPublicGraphLineDto = {
    source_template_item_id: line.source_template_item_id,
    customer_name: line.customer_name,
    description: line.description,
    quantity: line.quantity,
    quantity_display_label: line.quantity_display_label,
    unit: line.unit,
    customer_unit_price_cents: line.customer_unit_price_cents,
    customer_line_total_cents: line.customer_line_total_cents,
    pricing_status: line.pricing_status,
    visible_to_customer: true,
  };

  assertNoForbiddenKeys(dto as unknown as Record<string, unknown>, "line");
  assertNoBuilderLabels(line.customer_name);
  assertNoBuilderLabels(line.description);

  return dto;
}

function mapPublicPage(page: ProposalPageRow | ProposalSendFreezePagePersistRow): ProposalPublicGraphPageDto | null {
  if (page.visible_to_customer !== true) return null;

  return {
    page_type: page.page_type,
    sort_order: page.sort_order,
    title: page.title,
    customer_title: page.customer_title,
    visible_to_customer: true,
    content_json: structuredClone(page.content_json),
    settings_json: structuredClone(page.settings_json),
  };
}

function mapPublicOptionFromDraft(
  option: ProposalOptionRow,
  lines: ProposalLineItemRow[]
): ProposalPublicGraphOptionDto {
  const templateId = (option.source_template_option_id ?? "").trim();
  return {
    source_template_option_id: templateId,
    name: option.name,
    customer_label: option.customer_label,
    sort_order: option.sort_order,
    visible_to_customer: option.visible_to_customer,
    customer_subtotal_cents: option.customer_subtotal_cents,
    discount_cents: option.discount_cents,
    sales_tax_cents: option.sales_tax_cents,
    customer_total_cents: option.customer_total_cents,
    line_items: lines
      .filter((line) => line.proposal_option_id === option.id)
      .map((line) => mapPublicLine(line))
      .filter((line): line is ProposalPublicGraphLineDto => line != null),
  };
}

function mapPublicOptionFromFreeze(option: ProposalSendFreezeOptionPersistPayload): ProposalPublicGraphOptionDto {
  return {
    source_template_option_id: option.source_template_option_id,
    name: option.name,
    customer_label: option.customer_label,
    sort_order: option.sort_order,
    visible_to_customer: option.visible_to_customer,
    customer_subtotal_cents: option.customer_subtotal_cents,
    discount_cents: option.discount_cents,
    sales_tax_cents: option.sales_tax_cents,
    customer_total_cents: option.customer_total_cents,
    line_items: option.line_items
      .map((line) => mapPublicLine(line))
      .filter((line): line is ProposalPublicGraphLineDto => line != null),
  };
}

function isDraftGraphInput(input: ProposalPublicGraphInput): input is ProposalDraftGraph {
  return "proposal" in input && "lineItems" in input;
}

function resolveEstimateDisplayPolicy(
  pages: Array<ProposalPageRow | ProposalSendFreezePagePersistRow>
): ResolvedCustomerPreviewEstimateDisplayPolicy {
  const estimatePage = pages.find((page) => page.page_type === "estimate");
  if (!estimatePage) {
    return resolveCustomerPreviewEstimateDisplayPolicy(null);
  }
  const settings = readEstimatePageSettingsFromProposalPage(estimatePage.settings_json);
  return resolveCustomerPreviewEstimateDisplayPolicy(settings);
}

// ---------------------------------------------------------------------------
// Public DTO builder
// ---------------------------------------------------------------------------

/**
 * Builds a customer-safe public graph DTO stub from a sent graph-like input.
 * Never includes internal summaries, scope decisions, guardrail internals, or hidden lines.
 */
export function buildProposalPublicGraphDto(
  input: ProposalPublicGraphInput,
  selectedTemplateOptionId: string | null = null
): ProposalPublicGraphDto {
  if (isDraftGraphInput(input)) {
    if ("internalSummaries" in input && input.internalSummaries.length > 0) {
      // internal summaries present on input but never copied to output
    }
    if ("scopeDecisions" in input && input.scopeDecisions.length > 0) {
      // scope decisions present on input but never copied to output
    }

    const visiblePages = getCustomerPreviewPages(input.pages)
      .map((page) => mapPublicPage(page))
      .filter((page): page is ProposalPublicGraphPageDto => page != null);

    const options = input.options.map((option) =>
      mapPublicOptionFromDraft(option, input.lineItems)
    );

    const dto: ProposalPublicGraphDto = {
      version_kind: "sent",
      frozen_at: input.version.frozen_at,
      context_echo: structuredClone(input.version.context_echo ?? {}) as Record<string, unknown>,
      policy_echo: structuredClone(input.version.policy_echo ?? {}) as Record<string, unknown>,
      selected_template_option_id: selectedTemplateOptionId,
      pages: visiblePages,
      options,
      displayPolicy: resolveEstimateDisplayPolicy(input.pages),
    };

    assertPublicDtoShape(dto);
    return dto;
  }

  const visiblePages = input.pages
    .filter((page) => page.visible_to_customer === true)
    .map((page) => mapPublicPage(page))
    .filter((page): page is ProposalPublicGraphPageDto => page != null);

  const options = input.options.map((option) => mapPublicOptionFromFreeze(option));

  const dto: ProposalPublicGraphDto = {
    version_kind: "sent",
    frozen_at: input.version.frozen_at,
    context_echo: structuredClone(input.version.context_echo ?? {}) as Record<string, unknown>,
    policy_echo: structuredClone(input.version.policy_echo ?? {}) as Record<string, unknown>,
    selected_template_option_id: selectedTemplateOptionId,
    pages: visiblePages,
    options,
    displayPolicy: resolveEstimateDisplayPolicy(input.pages),
  };

  assertPublicDtoShape(dto);
  return dto;
}

/** Validates the public DTO contains no forbidden top-level keys. */
export function assertPublicDtoShape(dto: ProposalPublicGraphDto): void {
  const record = dto as unknown as Record<string, unknown>;
  for (const forbidden of [
    "internalSummaries",
    "internal_summaries",
    "scopeDecisions",
    "scope_decisions",
    "blocking_line_count",
    "guardrail_outcome",
    "public_token",
    "token_hash",
  ]) {
    if (forbidden in record) {
      throw new Error(`Public DTO must not include ${forbidden}.`);
    }
  }

  assertNoForbiddenKeys(record, "root");

  for (const option of dto.options) {
    assertNoForbiddenKeys(option as unknown as Record<string, unknown>, "option");
    if ("blocking_line_count" in (option as unknown as Record<string, unknown>)) {
      throw new Error("Public DTO option must not include blocking_line_count.");
    }
    if ("guardrail_outcome" in (option as unknown as Record<string, unknown>)) {
      throw new Error("Public DTO option must not include guardrail_outcome.");
    }
  }
}
