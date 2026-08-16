/**
 * V2F — Runtime "what changed since last sent" presenter.
 *
 * Compares two proposal graphs in memory. No persisted diff table.
 * Structural facts reuse comparePackageCompositions. Totals come from
 * already-presented option totals. Wording compares customer-visible text.
 */

import {
  comparePackageCompositions,
  type CompositionDiffEntry,
  type PackageComposition,
} from "@/app/lib/packageComposition";
import { adaptDraftGraphToPackageCompositions } from "@/app/lib/proposalOwnedPackageComposition";
import {
  isEditableProposalPageType,
  readProposalPageBodyMarkdown,
} from "@/app/lib/proposalPageContentEditing";
import type {
  ProposalDraftGraph,
  ProposalOptionRow,
  ProposalPageRow,
  ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";

const INTERNAL_LABEL_PATTERN =
  /composition_role|composition_slot|catalog_seed|proposal\.roof|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const INTERNAL_QUANTITY_SUMMARY_PATTERN =
  /^(uses catalog|fixed quantity|measurement|multiplier|quantity mode)/i;

const DIFF_ENUM_PATTERN =
  /\b(UNCHANGED|LABEL_ONLY|PRODUCT_REPLACEMENT|QUANTITY_CHANGE|ADDED_INCLUDED_SCOPE|REMOVED_INCLUDED_SCOPE|OPTIONAL_UPGRADE_ADDED|OPTIONAL_UPGRADE_REMOVED|OPTIONAL_UPGRADE_CHANGED)\b/;

export const REVISION_CHANGE_SUMMARY_PREVIEW_TITLE = "Changes since last sent";
export const REVISION_CHANGE_SUMMARY_SENT_RECORD_TITLE = "Changes from previous proposal";
export const REVISION_CHANGE_SUMMARY_UNCHANGED_LABEL = "No customer-visible changes";
export const REVISION_CHANGE_SUMMARY_WORDING_COMPACT = "Proposal wording updated";

export type RevisionChangeSummaryMode = "revision_preview" | "sent_record";

export type RevisionChangeSummaryKind =
  | "package"
  | "product_replacement"
  | "quantity"
  | "added_included"
  | "removed_included"
  | "optional_added"
  | "optional_removed"
  | "optional_changed"
  | "wording"
  | "total";

export type RevisionChangeSummaryFact = {
  kind: RevisionChangeSummaryKind;
  text: string;
};

export type RevisionChangeSummaryView = {
  mode: RevisionChangeSummaryMode;
  title: string;
  countLabel: string;
  facts: RevisionChangeSummaryFact[];
  hasChanges: boolean;
};

export type RevisionChangeSummaryGraph = Pick<
  ProposalDraftGraph | ProposalVersionGraph,
  "proposal" | "options" | "lineItems" | "pages"
>;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isInternalLabel(value: string): boolean {
  return INTERNAL_LABEL_PATTERN.test(value);
}

function packageLabel(option: Pick<ProposalOptionRow, "name" | "customer_label">): string {
  const label = norm(option.customer_label) || norm(option.name);
  return label.replace(/\s+package$/i, "").trim() || label || "Package";
}

function optionIdentity(option: Pick<ProposalOptionRow, "id" | "source_template_option_id">): string {
  return norm(option.source_template_option_id) || norm(option.id);
}

function resolveSelectedOption(
  graph: RevisionChangeSummaryGraph
): ProposalOptionRow | null {
  const selectedId = norm(graph.proposal.selected_option_id);
  if (selectedId) {
    const matched = graph.options.find((option) => option.id === selectedId);
    if (matched) return matched;
  }
  const marked = graph.options.find((option) => norm(option.selected_at).length > 0);
  if (marked) return marked;
  return graph.options.find((option) => option.is_default) ?? graph.options[0] ?? null;
}

function customerEntryLabel(
  entry: CompositionDiffEntry["target"] | CompositionDiffEntry["base"]
): string | null {
  if (!entry) return null;
  const label = norm(entry.customerLabel) || norm(entry.productName);
  if (!label || /^line item$/i.test(label) || isInternalLabel(label)) {
    return null;
  }
  return label;
}

function isCustomerSafeQuantitySummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;
  if (INTERNAL_QUANTITY_SUMMARY_PATTERN.test(trimmed)) return false;
  if (isInternalLabel(trimmed)) return false;
  return true;
}

function assertFactSafe(text: string): void {
  if (INTERNAL_LABEL_PATTERN.test(text) || DIFF_ENUM_PATTERN.test(text)) {
    throw new Error(`Revision change fact exposes internal identity: ${text}`);
  }
}

function formatCompositionFact(entry: CompositionDiffEntry): RevisionChangeSummaryFact | null {
  switch (entry.kind) {
    case "PRODUCT_REPLACEMENT": {
      const next = customerEntryLabel(entry.target);
      const prior = customerEntryLabel(entry.base);
      if (next && prior && next.toLowerCase() !== prior.toLowerCase()) {
        return { kind: "product_replacement", text: `${next} replace ${prior}` };
      }
      if (next) return { kind: "product_replacement", text: `${next} replaced the previous product` };
      return null;
    }
    case "QUANTITY_CHANGE": {
      const label = customerEntryLabel(entry.target) ?? customerEntryLabel(entry.base);
      if (!label) return null;
      const baseSummary = norm(entry.base?.quantity.summary);
      const targetSummary = norm(entry.target?.quantity.summary);
      if (
        isCustomerSafeQuantitySummary(baseSummary) &&
        isCustomerSafeQuantitySummary(targetSummary) &&
        baseSummary !== targetSummary
      ) {
        return {
          kind: "quantity",
          text: `${label} changed from ${baseSummary} to ${targetSummary}`,
        };
      }
      return { kind: "quantity", text: `${label} quantity changed` };
    }
    case "ADDED_INCLUDED_SCOPE": {
      const label = customerEntryLabel(entry.target);
      return label ? { kind: "added_included", text: `${label} added` } : null;
    }
    case "REMOVED_INCLUDED_SCOPE": {
      const label = customerEntryLabel(entry.base);
      return label ? { kind: "removed_included", text: `${label} removed` } : null;
    }
    case "OPTIONAL_UPGRADE_ADDED": {
      const label = customerEntryLabel(entry.target);
      return label ? { kind: "optional_added", text: `${label} selected` } : null;
    }
    case "OPTIONAL_UPGRADE_REMOVED": {
      const label = customerEntryLabel(entry.base);
      return label ? { kind: "optional_removed", text: `${label} removed` } : null;
    }
    case "OPTIONAL_UPGRADE_CHANGED": {
      const next = customerEntryLabel(entry.target);
      const prior = customerEntryLabel(entry.base);
      if (next && prior && next.toLowerCase() !== prior.toLowerCase()) {
        return { kind: "optional_changed", text: `${next} replace ${prior}` };
      }
      if (next) return { kind: "optional_changed", text: `${next} updated` };
      return null;
    }
    case "UNCHANGED":
    case "LABEL_ONLY":
    default:
      return null;
  }
}

function findPackageComposition(
  packages: readonly PackageComposition[],
  option: Pick<ProposalOptionRow, "id" | "source_template_option_id">
): PackageComposition | null {
  const sourceId = norm(option.source_template_option_id);
  if (sourceId) {
    const bySource = packages.find((item) => item.packageId === sourceId);
    if (bySource) return bySource;
  }
  return packages.find((item) => item.packageId === norm(option.id)) ?? null;
}

function wordingPageKey(page: ProposalPageRow): string {
  return `${page.page_type}:${norm(page.source_template_section_id) || page.sort_order}`;
}

function pageWordingFingerprint(page: ProposalPageRow): string {
  return JSON.stringify({
    title: norm(page.customer_title) || norm(page.title),
    body: readProposalPageBodyMarkdown(page.content_json) ?? "",
    visible: page.visible_to_customer !== false,
  });
}

const WORDING_PAGE_LABELS: Record<string, string> = {
  project_overview: "Project overview updated",
  terms: "Terms updated",
  warranty: "Warranty wording updated",
  custom_text: "Proposal wording updated",
};

function collectWordingFacts(
  base: RevisionChangeSummaryGraph,
  target: RevisionChangeSummaryGraph
): RevisionChangeSummaryFact[] {
  const basePages = new Map<string, ProposalPageRow>();
  for (const page of base.pages) {
    if (!isEditableProposalPageType(page.page_type)) {
      continue;
    }
    if (page.visible_to_customer === false) continue;
    basePages.set(wordingPageKey(page), page);
  }

  const changedLabels = new Set<string>();
  for (const page of target.pages) {
    if (!isEditableProposalPageType(page.page_type)) {
      continue;
    }
    if (page.visible_to_customer === false) continue;
    const prior = basePages.get(wordingPageKey(page));
    if (!prior) {
      changedLabels.add(WORDING_PAGE_LABELS[page.page_type] ?? REVISION_CHANGE_SUMMARY_WORDING_COMPACT);
      continue;
    }
    if (pageWordingFingerprint(prior) !== pageWordingFingerprint(page)) {
      changedLabels.add(WORDING_PAGE_LABELS[page.page_type] ?? REVISION_CHANGE_SUMMARY_WORDING_COMPACT);
    }
  }

  const baseSelected = resolveSelectedOption(base);
  const targetSelected = resolveSelectedOption(target);
  if (baseSelected && targetSelected) {
    const samePackage = optionIdentity(baseSelected) === optionIdentity(targetSelected);
    if (samePackage && norm(baseSelected.description) !== norm(targetSelected.description)) {
      changedLabels.add("Package wording updated");
    }
  }

  if (changedLabels.size === 0) return [];
  if (changedLabels.size > 1) {
    return [{ kind: "wording", text: REVISION_CHANGE_SUMMARY_WORDING_COMPACT }];
  }
  return [{ kind: "wording", text: [...changedLabels][0] }];
}

function formatCountLabel(count: number): string {
  if (count === 0) return REVISION_CHANGE_SUMMARY_UNCHANGED_LABEL;
  return `${count} change${count === 1 ? "" : "s"}`;
}

export function buildRevisionChangeSummary(input: {
  mode: RevisionChangeSummaryMode;
  current: RevisionChangeSummaryGraph | null | undefined;
  previous: RevisionChangeSummaryGraph | null | undefined;
}): RevisionChangeSummaryView | null {
  if (!input.current || !input.previous) return null;

  const facts: RevisionChangeSummaryFact[] = [];
  const currentSelected = resolveSelectedOption(input.current);
  const previousSelected = resolveSelectedOption(input.previous);

  if (currentSelected && previousSelected) {
    const currentLabel = packageLabel(currentSelected);
    const previousLabel = packageLabel(previousSelected);
    if (currentLabel.toLowerCase() !== previousLabel.toLowerCase()) {
      facts.push({
        kind: "package",
        text: `Starting package changed from ${previousLabel} to ${currentLabel}`,
      });
    }
  }

  const currentPackages = adaptDraftGraphToPackageCompositions(
    input.current as Pick<ProposalDraftGraph, "options" | "lineItems">
  );
  const previousPackages = adaptDraftGraphToPackageCompositions(
    input.previous as Pick<ProposalDraftGraph, "options" | "lineItems">
  );
  if (currentSelected && previousSelected) {
    const currentPkg = findPackageComposition(currentPackages, currentSelected);
    const previousPkg = findPackageComposition(previousPackages, previousSelected);
    if (currentPkg && previousPkg) {
      const diff = comparePackageCompositions(
        { ...previousPkg, packageId: `${previousPkg.packageId}::previous` },
        { ...currentPkg, packageId: `${currentPkg.packageId}::current` }
      );
      for (const entry of diff.entries) {
        const fact = formatCompositionFact(entry);
        if (!fact) continue;
        if (facts.some((existing) => existing.text === fact.text)) continue;
        facts.push(fact);
      }
    }
  }

  facts.push(...collectWordingFacts(input.previous, input.current));

  if (
    currentSelected?.customer_total_cents != null &&
    previousSelected?.customer_total_cents != null &&
    currentSelected.customer_total_cents !== previousSelected.customer_total_cents
  ) {
    facts.push({
      kind: "total",
      text: `Total updated from ${formatPriceCents(previousSelected.customer_total_cents)} to ${formatPriceCents(currentSelected.customer_total_cents)}`,
    });
  }

  for (const fact of facts) {
    assertFactSafe(fact.text);
  }

  return {
    mode: input.mode,
    title:
      input.mode === "sent_record"
        ? REVISION_CHANGE_SUMMARY_SENT_RECORD_TITLE
        : REVISION_CHANGE_SUMMARY_PREVIEW_TITLE,
    countLabel: formatCountLabel(facts.length),
    facts,
    hasChanges: facts.length > 0,
  };
}

export function revisionChangeSummaryHasInternalLeak(text: string): boolean {
  return INTERNAL_LABEL_PATTERN.test(text) || DIFF_ENUM_PATTERN.test(text);
}
