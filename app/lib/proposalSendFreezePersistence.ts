/**
 * R18B1 — Pure send-freeze payload builder and validators.
 *
 * Prepares immutable sent snapshot persist shape for future RPC `persist_proposal_send_freeze_v1`.
 * No Supabase, RPC, routes, tokens, or DB writes.
 */

import { resolveSelectedTemplateOptionIdFromGraph } from "@/app/lib/proposalDraftGraphAdapter";
import { isUuidLike } from "@/app/lib/jobStore";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "@/app/lib/proposalLineSnapshotTypes";
import type {
  ProposalDraftGraph,
  ProposalInternalSummaryRow,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalPageRow,
} from "@/app/lib/proposalRecordStore";
import type {
  ProposalOptionUpgradeChoice,
  ProposalOptionUpgradeChoicePersistRow,
} from "@/app/lib/proposalUpgradeTruthTypes";
import type {
  ProposalVersionContextEcho,
  ProposalVersionPolicyEcho,
} from "@/app/lib/proposalVersionTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Planned append-only event type — requires migration before RPC live (R18B3). */
export const PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE = "snapshot_frozen" as const;

export const PROPOSAL_SEND_FREEZE_ATOMIC_TABLES = [
  "proposal_versions",
  "proposal_pages",
  "proposal_options",
  "proposal_line_items",
  "proposal_internal_summaries",
  "proposals",
  "proposal_events",
] as const;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalSendFreezePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSendFreezePersistenceError";
  }
}

// ---------------------------------------------------------------------------
// Payload shapes (future RPC)
// ---------------------------------------------------------------------------

export type ProposalSendFreezePagePersistRow = {
  /** Explicit sent `proposal_pages.id` for RPC insert and line → page FK mapping. */
  client_page_id: string;
  page_type: string;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;
  source_template_section_id: string | null;
  content_json: Record<string, unknown>;
  settings_json: Record<string, unknown>;
};

export type ProposalSendFreezeLinePersistRow = {
  source_template_item_id: string | null;
  catalog_item_id: string | null;
  catalog_seed_key: string | null;
  section_id: string | null;
  page_id: string | null;
  sort_order: number;
  customer_name: string;
  description: string | null;
  role: string | null;
  quantity: number | null;
  quantity_display_label: string | null;
  quantity_source_label: string | null;
  unit: string | null;
  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;
  pricing_status: string;
  visible_to_customer: boolean;
  measurement_quantity_key: string | null;
  /** Upgrade Truth line echoes copied from the draft line rows. */
  upgrade_selection_state: string | null;
  upgrade_effect: string | null;
  replaces_source_template_item_id: string | null;
};

export type ProposalSendFreezeInternalSummaryPersist = {
  /** Contractor-only — never exposed on public DTO. */
  contractor_only: true;
  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;
  policy_echo_json: Record<string, unknown>;
  computed_at: string;
};

export type ProposalSendFreezeOptionPersistPayload = {
  source_template_option_id: string;
  name: string;
  customer_label: string | null;
  /** Authored package description copied from draft option. */
  description: string | null;
  sort_order: number;
  is_default: boolean;
  visible_to_customer: boolean;
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  pricing_complete: boolean;
  blocking_line_count: number;
  guardrail_outcome: string;
  selected_at: string | null;
  line_items: ProposalSendFreezeLinePersistRow[];
  internal_summary: ProposalSendFreezeInternalSummaryPersist | null;
  /** Upgrade Truth selections copied onto the frozen sent version. */
  upgrade_choices: ProposalOptionUpgradeChoicePersistRow[];
};

export type ProposalSendFreezeEventPersist = {
  event_type: typeof PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE;
  payload_json: Record<string, unknown>;
};

export type ProposalSendFreezePersistPayload = {
  company_id: string;
  proposal_id: string;
  draft_version_id: string;
  sent_version_id: string;
  version_number: number;
  version_kind: "sent";
  frozen_at: string;
  parent_version_id: string;
  context_echo: ProposalVersionContextEcho | Record<string, unknown>;
  policy_echo: ProposalVersionPolicyEcho | Record<string, unknown>;
  selected_template_option_id: string | null;
  pages: ProposalSendFreezePagePersistRow[];
  options: ProposalSendFreezeOptionPersistPayload[];
  event: ProposalSendFreezeEventPersist;
};

export type BuildProposalSendFreezePersistPayloadOptions = {
  /** Prior version numbers on the proposal (sent/signed/draft) for monotonic increment. */
  existingVersionNumbers?: readonly number[];
  frozenAt?: string;
  sentVersionId?: string;
  idFactory?: () => string;
};

export type ProposalSendFreezeGraphIntegrityViolation = {
  code:
    | "option_totals_without_lines"
    | "pricing_complete_without_lines"
    | "sent_version_not_frozen"
    | "wrong_version_kind";
  source_template_option_id: string;
  message: string;
};

// ---------------------------------------------------------------------------
// ID factory
// ---------------------------------------------------------------------------

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

function resolveNextVersionNumber(
  graph: ProposalDraftGraph,
  existingVersionNumbers: readonly number[] | undefined
): number {
  const candidates = [
    graph.version.version_number,
    ...(existingVersionNumbers ?? []),
  ];
  const max = candidates.reduce((acc, n) => (Number.isFinite(n) && n > acc ? n : acc), 0);
  return max + 1;
}

// ---------------------------------------------------------------------------
// Row mappers (deep copy — no mutation of source graph)
// ---------------------------------------------------------------------------

function copyPageRow(
  page: ProposalPageRow,
  clientPageId: string
): ProposalSendFreezePagePersistRow {
  return {
    client_page_id: clientPageId,
    page_type: page.page_type,
    sort_order: page.sort_order,
    title: page.title,
    customer_title: page.customer_title,
    visible_to_customer: page.visible_to_customer,
    source_template_section_id: page.source_template_section_id,
    content_json: structuredClone(page.content_json),
    settings_json: structuredClone(page.settings_json),
  };
}

function assertLineRowCustomerSafe(row: Record<string, unknown>): void {
  for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
    if (key in row) {
      throw new ProposalSendFreezePersistenceError(
        `Forbidden internal key on customer line row: ${key}`
      );
    }
  }
}

function copyLineRow(
  line: ProposalLineItemRow,
  draftToSentPageIds: Map<string, string>
): ProposalSendFreezeLinePersistRow {
  const row: ProposalSendFreezeLinePersistRow = {
    source_template_item_id: line.source_template_item_id,
    catalog_item_id: line.catalog_item_id,
    catalog_seed_key: line.catalog_seed_key,
    section_id: line.section_id,
    page_id:
      line.page_id != null && draftToSentPageIds.has(line.page_id)
        ? draftToSentPageIds.get(line.page_id)!
        : line.page_id,
    sort_order: line.sort_order,
    customer_name: line.customer_name,
    description: line.description,
    role: line.role,
    quantity: line.quantity,
    quantity_display_label: line.quantity_display_label,
    quantity_source_label: line.quantity_source_label,
    unit: line.unit,
    customer_unit_price_cents: line.customer_unit_price_cents,
    customer_line_total_cents: line.customer_line_total_cents,
    pricing_status: line.pricing_status,
    visible_to_customer: line.visible_to_customer,
    measurement_quantity_key: line.measurement_quantity_key,
    upgrade_selection_state: line.upgrade_selection_state ?? null,
    upgrade_effect: line.upgrade_effect ?? null,
    replaces_source_template_item_id: line.replaces_source_template_item_id ?? null,
  };
  assertLineRowCustomerSafe(row as unknown as Record<string, unknown>);
  return row;
}

function copyInternalSummary(
  summary: ProposalInternalSummaryRow
): ProposalSendFreezeInternalSummaryPersist {
  return {
    contractor_only: true,
    internal_cost_cents: summary.internal_cost_cents,
    internal_profit_cents: summary.internal_profit_cents,
    effective_margin_pct: summary.effective_margin_pct,
    policy_echo_json: structuredClone(summary.policy_echo_json),
    computed_at: summary.computed_at,
  };
}

function copyUpgradeChoiceRow(
  choice: ProposalOptionUpgradeChoice
): ProposalOptionUpgradeChoicePersistRow {
  return {
    source_template_item_id: choice.sourceTemplateItemId,
    selection_state: choice.selectionState,
    upgrade_effect: choice.upgradeEffect,
    replaces_source_template_item_id: choice.replacesSourceTemplateItemId,
  };
}

function copyOptionPayload(
  option: ProposalOptionRow,
  lines: ProposalLineItemRow[],
  summary: ProposalInternalSummaryRow | undefined,
  upgradeChoices: readonly ProposalOptionUpgradeChoice[],
  draftToSentPageIds: Map<string, string>
): ProposalSendFreezeOptionPersistPayload {
  const templateOptionId = (option.source_template_option_id ?? "").trim();
  if (!templateOptionId) {
    throw new ProposalSendFreezePersistenceError(
      "Each option requires source_template_option_id for send-freeze."
    );
  }

  return {
    source_template_option_id: templateOptionId,
    name: option.name,
    customer_label: option.customer_label,
    description: option.description ?? null,
    sort_order: option.sort_order,
    is_default: option.is_default,
    visible_to_customer: option.visible_to_customer,
    customer_subtotal_cents: option.customer_subtotal_cents,
    discount_cents: option.discount_cents,
    sales_tax_cents: option.sales_tax_cents,
    customer_total_cents: option.customer_total_cents,
    pricing_complete: option.pricing_complete,
    blocking_line_count: option.blocking_line_count,
    guardrail_outcome: option.guardrail_outcome,
    selected_at: option.selected_at,
    line_items: lines
      .filter((line) => line.proposal_option_id === option.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((line) => copyLineRow(line, draftToSentPageIds)),
    internal_summary: summary ? copyInternalSummary(summary) : null,
    upgrade_choices: upgradeChoices
      .filter((choice) => choice.proposalOptionId === option.id)
      .map(copyUpgradeChoiceRow),
  };
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/**
 * Builds a deep-copied send-freeze persist payload from a draft graph.
 * Does not mutate the input graph. Scope decisions are intentionally excluded.
 */
export function buildProposalSendFreezePersistPayload(
  graph: ProposalDraftGraph,
  options: BuildProposalSendFreezePersistPayloadOptions = {}
): ProposalSendFreezePersistPayload {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const frozenAt = options.frozenAt ?? new Date().toISOString();
  const sentVersionId = options.sentVersionId ?? idFactory();
  const draftVersionId = graph.version.id;

  if (graph.version.version_kind !== "draft") {
    throw new ProposalSendFreezePersistenceError(
      `Send-freeze payload requires draft version_kind; got "${graph.version.version_kind}".`
    );
  }

  const draftToSentPageIds = new Map<string, string>();

  const pages = graph.pages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((page) => {
      const clientPageId = idFactory();
      draftToSentPageIds.set(page.id, clientPageId);
      return copyPageRow(page, clientPageId);
    });

  const summaryByOptionId = new Map(
    graph.internalSummaries.map((summary) => [summary.proposal_option_id, summary] as const)
  );

  const optionPayloads = graph.options
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((option) =>
      copyOptionPayload(
        option,
        graph.lineItems,
        summaryByOptionId.get(option.id),
        graph.upgradeChoices ?? [],
        draftToSentPageIds
      )
    );

  const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(graph);

  return {
    company_id: graph.proposal.company_id,
    proposal_id: graph.proposal.id,
    draft_version_id: draftVersionId,
    sent_version_id: sentVersionId,
    version_number: resolveNextVersionNumber(graph, options.existingVersionNumbers),
    version_kind: "sent",
    frozen_at: frozenAt,
    parent_version_id: draftVersionId,
    context_echo: structuredClone(graph.version.context_echo ?? {}),
    policy_echo: structuredClone(graph.version.policy_echo ?? {}),
    selected_template_option_id: selectedTemplateOptionId,
    pages,
    options: optionPayloads,
    event: {
      event_type: PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE,
      payload_json: {
        reason: "send_freeze_v1",
        draft_version_id: draftVersionId,
        sent_version_id: sentVersionId,
        selected_template_option_id: selectedTemplateOptionId,
        delivery: false,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const FORBIDDEN_PAYLOAD_KEYS = [
  "public_token",
  "token_hash",
  "email",
  "send",
  "scope_decisions",
  "scopeDecisions",
] as const;

export function validateProposalSendFreezePersistPayload(
  payload: ProposalSendFreezePersistPayload
): void {
  if (!(payload.company_id ?? "").trim()) {
    throw new ProposalSendFreezePersistenceError("company_id is required.");
  }
  if (!(payload.proposal_id ?? "").trim()) {
    throw new ProposalSendFreezePersistenceError("proposal_id is required.");
  }
  if (!(payload.draft_version_id ?? "").trim()) {
    throw new ProposalSendFreezePersistenceError("draft_version_id is required.");
  }
  if (!(payload.sent_version_id ?? "").trim()) {
    throw new ProposalSendFreezePersistenceError("sent_version_id is required.");
  }
  if (payload.version_kind !== "sent") {
    throw new ProposalSendFreezePersistenceError('version_kind must be "sent".');
  }
  if (!(payload.frozen_at ?? "").trim()) {
    throw new ProposalSendFreezePersistenceError("frozen_at is required.");
  }
  if (payload.parent_version_id !== payload.draft_version_id) {
    throw new ProposalSendFreezePersistenceError(
      "parent_version_id must point to the source draft version."
    );
  }
  if (!Number.isFinite(payload.version_number) || payload.version_number < 1) {
    throw new ProposalSendFreezePersistenceError("version_number must be a positive integer.");
  }
  if (payload.pages.length === 0) {
    throw new ProposalSendFreezePersistenceError("At least one page is required.");
  }
  if (payload.options.length === 0) {
    throw new ProposalSendFreezePersistenceError("At least one option is required.");
  }

  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in (payload as unknown as Record<string, unknown>)) {
      throw new ProposalSendFreezePersistenceError(`Forbidden send-freeze payload key: ${key}`);
    }
  }

  const clientPageIds = new Set<string>();
  for (const page of payload.pages) {
    const clientPageId = (page.client_page_id ?? "").trim();
    if (!clientPageId) {
      throw new ProposalSendFreezePersistenceError("Each page requires client_page_id.");
    }
    if (!isUuidLike(clientPageId)) {
      throw new ProposalSendFreezePersistenceError("client_page_id must be a UUID.");
    }
    if (clientPageIds.has(clientPageId)) {
      throw new ProposalSendFreezePersistenceError(
        "Duplicate client_page_id values are not allowed in send-freeze payload."
      );
    }
    clientPageIds.add(clientPageId);
  }

  for (const option of payload.options) {
    for (const line of option.line_items) {
      assertLineRowCustomerSafe(line as unknown as Record<string, unknown>);
      const linePageId = (line.page_id ?? "").trim();
      if (linePageId && !clientPageIds.has(linePageId)) {
        throw new ProposalSendFreezePersistenceError(
          "Each line page_id must reference a page client_page_id in the same payload."
        );
      }
    }
    if (option.internal_summary != null && option.internal_summary.contractor_only !== true) {
      throw new ProposalSendFreezePersistenceError(
        "internal_summary must be marked contractor_only."
      );
    }
  }

  if (payload.event.event_type !== PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE) {
    throw new ProposalSendFreezePersistenceError(
      `event.event_type must be "${PROPOSAL_SEND_FREEZE_PLANNED_EVENT_TYPE}".`
    );
  }
}

export function validateSendFreezeGraphIntegrity(
  payload: ProposalSendFreezePersistPayload
): ProposalSendFreezeGraphIntegrityViolation[] {
  const violations: ProposalSendFreezeGraphIntegrityViolation[] = [];

  if (payload.version_kind !== "sent") {
    violations.push({
      code: "wrong_version_kind",
      source_template_option_id: "*",
      message: `Expected version_kind sent; got ${payload.version_kind}.`,
    });
  }

  if (!(payload.frozen_at ?? "").trim()) {
    violations.push({
      code: "sent_version_not_frozen",
      source_template_option_id: "*",
      message: "Sent version missing frozen_at.",
    });
  }

  for (const option of payload.options) {
    const subtotal = option.customer_subtotal_cents ?? 0;
    const lineCount = option.line_items.length;

    if (subtotal > 0 && lineCount === 0) {
      violations.push({
        code: "option_totals_without_lines",
        source_template_option_id: option.source_template_option_id,
        message: "Option has customer subtotal but no line items.",
      });
    }

    if (option.pricing_complete && lineCount === 0 && subtotal === 0) {
      violations.push({
        code: "pricing_complete_without_lines",
        source_template_option_id: option.source_template_option_id,
        message: "Option marked pricing_complete with zero lines.",
      });
    }
  }

  return violations;
}

/** Sent page row for graph-like consumers — `id` mirrors `client_page_id`. */
export type ProposalSendFreezeGraphLikePage = ProposalSendFreezePagePersistRow & {
  id: string;
};

/** Builds an in-memory sent graph-like snapshot from payload (read-only helper for tests/public DTO). */
export type ProposalSendFreezeGraphLike = {
  version: {
    id: string;
    company_id: string;
    proposal_id: string;
    version_number: number;
    version_kind: "sent";
    parent_version_id: string;
    frozen_at: string;
    context_echo: ProposalSendFreezePersistPayload["context_echo"];
    policy_echo: ProposalSendFreezePersistPayload["policy_echo"];
  };
  pages: ProposalSendFreezeGraphLikePage[];
  options: ProposalSendFreezeOptionPersistPayload[];
};

export function buildSendFreezeGraphLikeFromPayload(
  payload: ProposalSendFreezePersistPayload
): ProposalSendFreezeGraphLike {
  return {
    version: {
      id: payload.sent_version_id,
      company_id: payload.company_id,
      proposal_id: payload.proposal_id,
      version_number: payload.version_number,
      version_kind: "sent",
      parent_version_id: payload.parent_version_id,
      frozen_at: payload.frozen_at,
      context_echo: payload.context_echo,
      policy_echo: payload.policy_echo,
    },
    pages: payload.pages.map((page) => ({
      ...page,
      id: page.client_page_id,
    })),
    options: payload.options,
  };
}
