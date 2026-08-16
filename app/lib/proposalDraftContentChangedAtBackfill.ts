/**
 * 041 backfill classifier — TypeScript mirror of
 * proposal_draft_vs_sent_graph_outcome_v1 /
 * proposal_draft_content_changed_at_backfill_stamp_v1.
 *
 * Compares persisted draft vs latest frozen sent. No live Catalog/Templates.
 * Never reads proposals.updated_at.
 */

import { PROPOSAL_IDENTITY_ECHO_KEYS } from "@/app/lib/proposalIdentityEcho";

export const DRAFT_CONTENT_CHANGED_AT_BACKFILL_OUTCOMES = [
  "unsent",
  "clean",
  "dirty",
  "unknown",
] as const;

export type DraftContentChangedAtBackfillOutcome =
  (typeof DRAFT_CONTENT_CHANGED_AT_BACKFILL_OUTCOMES)[number];

export type DraftContentBackfillPackage = {
  id: string;
  source_template_option_id: string | null;
  sort_order: number;
  name: string;
  customer_label: string | null;
  description: string | null;
  visible_to_customer: boolean;
  is_default: boolean;
  selected_at: string | null;
  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
  pricing_complete: boolean;
  blocking_line_count: number;
};

export type DraftContentBackfillPage = {
  page_type: string;
  source_template_section_id: string | null;
  sort_order: number;
  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;
  content_json: unknown;
  settings_json: unknown;
};

export type DraftContentBackfillLine = {
  optionId: string;
  source_template_item_id: string | null;
  catalog_seed_key: string | null;
  composition_slot_key: string | null;
  composition_role: string | null;
  sort_order: number;
  customer_name: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;
  visible_to_customer: boolean;
  upgrade_selection_state: string | null;
  upgrade_effect: string | null;
  replaces_source_template_item_id: string | null;
  quantity_resolution_echo: unknown;
};

export type DraftContentBackfillUpgrade = {
  optionId: string;
  source_template_item_id: string;
  selection_state: string;
  upgrade_effect: string;
  replaces_source_template_item_id: string | null;
};

export type DraftContentBackfillGraph = {
  versionKind: string;
  frozenAt: string | null;
  contextEcho: Record<string, unknown> | null;
  policyEcho: unknown;
  packages: DraftContentBackfillPackage[];
  pages: DraftContentBackfillPage[];
  lines: DraftContentBackfillLine[];
  upgrades: DraftContentBackfillUpgrade[];
};

export type DraftContentBackfillInput = {
  createdAt: string;
  selectedOptionId: string | null;
  currentDraftVersionId: string | null;
  latestSentVersionId: string | null;
  draft: DraftContentBackfillGraph | null;
  sent: DraftContentBackfillGraph | null;
  /** ISO timestamps of draft_saved events. */
  draftSavedAt: string[];
  /** ISO timestamp of snapshot_frozen for latest sent, if any. */
  snapshotFrozenAt: string | null;
  /** ISO timestamps of draft scope-decision updated_at. */
  draftScopeDecisionUpdatedAt: string[];
  /** Migration detection clock for dirty/unknown without a post-freeze event. */
  now: string;
};

export type DraftContentBackfillPlan = {
  outcome: DraftContentChangedAtBackfillOutcome;
  stamp: string;
};

function packageKey(pkg: Pick<DraftContentBackfillPackage, "source_template_option_id" | "sort_order">): string {
  const source = (pkg.source_template_option_id ?? "").trim();
  if (source) return `src:${source}`;
  return `sort:${pkg.sort_order}`;
}

function hasDuplicateKeys(keys: string[]): boolean {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function identitySlice(echo: Record<string, unknown> | null): Record<string, string> {
  const slice: Record<string, string> = {};
  if (!echo || typeof echo !== "object") return slice;
  for (const key of PROPOSAL_IDENTITY_ECHO_KEYS) {
    const raw = echo[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed) slice[key] = trimmed;
  }
  return slice;
}

function restEcho(echo: Record<string, unknown> | null): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  if (!echo || typeof echo !== "object") return rest;
  const identity = new Set<string>(PROPOSAL_IDENTITY_ECHO_KEYS);
  for (const [key, value] of Object.entries(echo)) {
    if (!identity.has(key)) rest[key] = value;
  }
  return rest;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function selectedPackageKey(
  graph: DraftContentBackfillGraph,
  headerSelectedOptionId: string | null
): string | null {
  const selected =
    graph.packages.find((pkg) => pkg.id === headerSelectedOptionId) ??
    graph.packages
      .filter((pkg) => (pkg.selected_at ?? "").trim().length > 0)
      .sort((a, b) => String(b.selected_at).localeCompare(String(a.selected_at)))[0] ??
    graph.packages.find((pkg) => pkg.is_default) ??
    null;
  return selected ? packageKey(selected) : null;
}

function sentSelectedPackageKey(graph: DraftContentBackfillGraph): string | null {
  const marked = graph.packages
    .filter((pkg) => (pkg.selected_at ?? "").trim().length > 0)
    .sort((a, b) => String(b.selected_at).localeCompare(String(a.selected_at)))[0];
  if (marked) return packageKey(marked);
  const fallback = graph.packages.find((pkg) => pkg.is_default) ?? null;
  return fallback ? packageKey(fallback) : null;
}

function pageKey(page: DraftContentBackfillPage): string {
  return `${page.page_type}|${page.source_template_section_id ?? ""}|${page.sort_order}`;
}

function lineKey(
  line: DraftContentBackfillLine,
  packages: DraftContentBackfillPackage[]
): string {
  const pkg = packages.find((item) => item.id === line.optionId);
  const pkgKey = pkg ? packageKey(pkg) : `missing:${line.optionId}`;
  return [
    pkgKey,
    line.source_template_item_id ?? "",
    line.catalog_seed_key ?? "",
    line.composition_slot_key ?? "",
    String(line.sort_order),
  ].join("|");
}

function upgradeKey(
  choice: DraftContentBackfillUpgrade,
  packages: DraftContentBackfillPackage[]
): string {
  const pkg = packages.find((item) => item.id === choice.optionId);
  const pkgKey = pkg ? packageKey(pkg) : `missing:${choice.optionId}`;
  return `${pkgKey}|${choice.source_template_item_id}`;
}

function mapByKey<T>(items: T[], keyOf: (item: T) => string): Map<string, T> | "unknown" {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (map.has(key)) return "unknown";
    map.set(key, item);
  }
  return map;
}

function compareMapped<T>(
  draftItems: T[],
  sentItems: T[],
  draftKeyOf: (item: T) => string,
  sentKeyOf: (item: T) => string,
  equal: (draft: T, sent: T) => boolean
): "clean" | "dirty" | "unknown" {
  const draftMap = mapByKey(draftItems, draftKeyOf);
  const sentMap = mapByKey(sentItems, sentKeyOf);
  if (draftMap === "unknown" || sentMap === "unknown") return "unknown";
  if (draftMap.size !== sentMap.size) return "dirty";
  for (const [key, draftItem] of draftMap) {
    const sentItem = sentMap.get(key);
    if (!sentItem) return "dirty";
    if (!equal(draftItem, sentItem)) return "dirty";
  }
  return "clean";
}

export function classifyDraftVsSentGraphOutcome(
  input: Pick<
    DraftContentBackfillInput,
    | "currentDraftVersionId"
    | "latestSentVersionId"
    | "selectedOptionId"
    | "draft"
    | "sent"
    | "draftSavedAt"
    | "snapshotFrozenAt"
    | "draftScopeDecisionUpdatedAt"
  >
): DraftContentChangedAtBackfillOutcome {
  if (!input.latestSentVersionId) return "unsent";
  if (!input.currentDraftVersionId || !input.draft || !input.sent) return "unknown";
  if (input.draft.versionKind !== "draft") return "unknown";
  if (
    (input.sent.versionKind !== "sent" && input.sent.versionKind !== "signed") ||
    !(input.sent.frozenAt ?? "").trim()
  ) {
    return "unknown";
  }

  if (
    !jsonEqual(identitySlice(input.draft.contextEcho), identitySlice(input.sent.contextEcho)) ||
    !jsonEqual(input.draft.policyEcho ?? {}, input.sent.policyEcho ?? {}) ||
    !jsonEqual(restEcho(input.draft.contextEcho), restEcho(input.sent.contextEcho))
  ) {
    return "dirty";
  }

  if (
    hasDuplicateKeys(input.draft.packages.map(packageKey)) ||
    hasDuplicateKeys(input.sent.packages.map(packageKey))
  ) {
    return "unknown";
  }

  const packages = compareMapped(
    input.draft.packages,
    input.sent.packages,
    packageKey,
    packageKey,
    (draft, sent) =>
      draft.name === sent.name &&
      draft.customer_label === sent.customer_label &&
      draft.description === sent.description &&
      draft.visible_to_customer === sent.visible_to_customer &&
      draft.customer_subtotal_cents === sent.customer_subtotal_cents &&
      draft.discount_cents === sent.discount_cents &&
      draft.sales_tax_cents === sent.sales_tax_cents &&
      draft.customer_total_cents === sent.customer_total_cents &&
      draft.pricing_complete === sent.pricing_complete &&
      draft.blocking_line_count === sent.blocking_line_count
  );
  if (packages !== "clean") return packages;

  if (
    selectedPackageKey(input.draft, input.selectedOptionId) !==
    sentSelectedPackageKey(input.sent)
  ) {
    return "dirty";
  }

  const pages = compareMapped(
    input.draft.pages,
    input.sent.pages,
    pageKey,
    pageKey,
    (draft, sent) =>
      draft.title === sent.title &&
      draft.customer_title === sent.customer_title &&
      draft.visible_to_customer === sent.visible_to_customer &&
      jsonEqual(draft.content_json, sent.content_json) &&
      jsonEqual(draft.settings_json, sent.settings_json)
  );
  if (pages !== "clean") return pages;

  const lines = compareMapped(
    input.draft.lines,
    input.sent.lines,
    (line) => lineKey(line, input.draft!.packages),
    (line) => lineKey(line, input.sent!.packages),
    (draft, sent) =>
      draft.customer_name === sent.customer_name &&
      draft.description === sent.description &&
      draft.quantity === sent.quantity &&
      draft.unit === sent.unit &&
      draft.customer_unit_price_cents === sent.customer_unit_price_cents &&
      draft.customer_line_total_cents === sent.customer_line_total_cents &&
      draft.visible_to_customer === sent.visible_to_customer &&
      draft.composition_role === sent.composition_role &&
      draft.upgrade_selection_state === sent.upgrade_selection_state &&
      draft.upgrade_effect === sent.upgrade_effect &&
      draft.replaces_source_template_item_id === sent.replaces_source_template_item_id &&
      jsonEqual(draft.quantity_resolution_echo, sent.quantity_resolution_echo)
  );
  if (lines !== "clean") return lines;

  const upgrades = compareMapped(
    input.draft.upgrades,
    input.sent.upgrades,
    (choice) => upgradeKey(choice, input.draft!.packages),
    (choice) => upgradeKey(choice, input.sent!.packages),
    (draft, sent) =>
      draft.selection_state === sent.selection_state &&
      draft.upgrade_effect === sent.upgrade_effect &&
      draft.replaces_source_template_item_id === sent.replaces_source_template_item_id
  );
  if (upgrades !== "clean") return upgrades;

  const freezeAt = (input.snapshotFrozenAt ?? "").trim();
  if (freezeAt) {
    const freezeMs = Date.parse(freezeAt);
    if (Number.isFinite(freezeMs)) {
      const postFreezeSaved = input.draftSavedAt.some((at) => Date.parse(at) > freezeMs);
      const postFreezeScope = input.draftScopeDecisionUpdatedAt.some(
        (at) => Date.parse(at) > freezeMs
      );
      if (postFreezeSaved || postFreezeScope) return "dirty";
    }
  }

  return "clean";
}

export function planDraftContentChangedAtBackfill(
  input: DraftContentBackfillInput
): DraftContentBackfillPlan {
  const outcome = classifyDraftVsSentGraphOutcome(input);
  if (outcome === "unsent") {
    return { outcome, stamp: input.createdAt };
  }

  const frozenAt = (input.sent?.frozenAt ?? "").trim();
  if (outcome === "clean") {
    return { outcome, stamp: frozenAt };
  }

  const freezeEventMs = input.snapshotFrozenAt ? Date.parse(input.snapshotFrozenAt) : NaN;
  const postFreezeSaved = input.draftSavedAt
    .filter((at) => !Number.isFinite(freezeEventMs) || Date.parse(at) > freezeEventMs)
    .sort()
    .at(-1);

  if (
    outcome === "dirty" &&
    postFreezeSaved &&
    (!frozenAt || Date.parse(postFreezeSaved) > Date.parse(frozenAt))
  ) {
    return { outcome, stamp: postFreezeSaved };
  }

  return { outcome, stamp: input.now };
}
