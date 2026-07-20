/**
 * Job Card Proposals tab — Compact Proposal Setup Card helpers.
 *
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
  type TemplateCatalogLinkStatus,
} from "@/app/lib/proposalTemplateCatalogLink";
import { buildTemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import {
  buildTemplateCreatesSummary,
  defaultSelectedPackageOptionId,
  summarizePackageOptionsForWorkspace,
  type TemplateCreatesSummary,
} from "@/app/tools/roofing/templates/templatesWorkspaceFlow";

/** Primary explainer — what Create proposal does (contractor-facing). */
export const JOB_CARD_CREATE_PROPOSAL_EXPLAINER =
  "Creates a draft from this job’s measurements, the selected template, and Catalog pricing. You’ll review it in Proposal Builder before sending." as const;

/** Explainer when opening an existing draft — Open does not use create selectors. */
export const JOB_CARD_OPEN_PROPOSAL_EXPLAINER =
  "Opens this job’s existing proposal draft in Builder. Details below describe the draft already created — they do not change it." as const;

/** Create-another explainer — selectors create a separate draft. */
export const JOB_CARD_CREATE_ANOTHER_EXPLAINER =
  "Creates a separate draft. Your current proposal is not changed." as const;

export const JOB_CARD_CREATE_ANOTHER_HEADLINE = "Start proposal" as const;

export const JOB_CARD_CURRENT_PROPOSAL_LABEL = "Current proposal" as const;

export const JOB_CARD_SHOW_OLDER_DRAFTS_LABEL = "Show older drafts" as const;

export const JOB_CARD_HIDE_OLDER_DRAFTS_LABEL = "Hide older drafts" as const;

export const JOB_CARD_DRAFT_FROZEN_NOTE =
  "This draft freezes Catalog pricing and template structure from create/refresh. Open Builder to review or refresh draft pricing." as const;

/** Draft-open hint — package switches belong in Builder among saved draft options. */
export { JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE } from "@/app/lib/proposalBuilderDraftPackageOptions";

export const JOB_CARD_INCLUDED_REVIEW_NOTE =
  "Template changes affect future proposals. For this job, create the draft and make final review in Builder." as const;

export const JOB_CARD_EXISTING_DRAFT_INTERNAL_NOTE =
  "Existing draft data — title may be from an earlier smoke or test run." as const;

export type JobCardProposalSetupMode = "create" | "draft_open" | "open_and_create";

/** True when a draft title looks like internal/smoke/test data (not a rename UI). */
export function looksLikeInternalDraftTitle(
  title: string | null | undefined
): boolean {
  const t = (title ?? "").trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes("smoke") ||
    t.includes("test") ||
    t.includes("dev ") ||
    t.startsWith("dev") ||
    t.includes("raw_plus_waste") ||
    t.includes("complete-source")
  );
}

/**
 * Contractor-facing title for the main Current proposal zone.
 * Internal/smoke titles are softened so they do not dominate the screen.
 */
export function formatContractorProposalTitle(
  title: string | null | undefined
): string {
  const raw = (title ?? "").trim();
  if (!raw) return "Saved proposal";
  if (looksLikeInternalDraftTitle(raw)) return "Saved proposal";
  return raw;
}

/** Draft facts shown in draft-open mode (Job Card Proposals). */
export type JobCardDraftOpenSummary = {
  proposalId: string;
  title: string | null;
  templateName: string | null;
  packageLabel: string | null;
  updatedAt: string | null;
  statusLabel: "Draft saved";
};

export function buildJobCardDraftOpenSummary(input: {
  proposalId: string;
  title?: string | null;
  templateName?: string | null;
  packageLabel?: string | null;
  updatedAt?: string | null;
}): JobCardDraftOpenSummary | null {
  const proposalId = (input.proposalId ?? "").trim();
  if (!proposalId) return null;
  return {
    proposalId,
    title: (input.title ?? "").trim() || null,
    templateName: (input.templateName ?? "").trim() || null,
    packageLabel: (input.packageLabel ?? "").trim() || null,
    updatedAt: (input.updatedAt ?? "").trim() || null,
    statusLabel: "Draft saved",
  };
}

/** Proposals tab header chip — open / create-ready vocabulary. */
export function formatJobCardProposalsTabStatus(input: {
  hasExistingDraft: boolean;
  createSetupReady: boolean;
  measurementHeaderLabel: string;
  measurementReady: boolean;
}): { label: string; ready: boolean } {
  if (input.hasExistingDraft && input.createSetupReady) {
    return { label: "Draft ready · can create another", ready: true };
  }
  if (input.hasExistingDraft) {
    return { label: "Draft ready to open", ready: true };
  }
  if (input.createSetupReady) {
    return { label: "Ready to create draft", ready: true };
  }
  if (!input.measurementReady) {
    const label = (input.measurementHeaderLabel ?? "").trim() || "Needs attention";
    return { label, ready: false };
  }
  return { label: "Needs attention", ready: false };
}

/** Short contractor-facing updated stamp for draft-open mode. */
export function formatJobCardDraftUpdatedLabel(
  updatedAt: string | null | undefined
): string | null {
  const raw = (updatedAt ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export type JobCardPackageChoice = {
  optionId: string;
  label: string;
  linkedItemCount: number;
  issueCount: number;
  status: "ready" | "needs_attention";
};

export type JobCardIncludedItemSummary = {
  id: string;
  label: string;
  linkStatus: TemplateCatalogLinkStatus;
};

export type JobCardProposalSetupPackages = {
  choices: JobCardPackageChoice[];
  selectedOptionId: string | null;
  selected: JobCardPackageChoice | null;
  includedItemCount: number;
  createsSummary: TemplateCreatesSummary | null;
  includedItems: JobCardIncludedItemSummary[];
  customerFacingLine: string;
};

/**
 * Prefer template `is_default`, else first by sort_order (workspace default).
 */
export function resolveDefaultPackageOptionId(
  graph: ProposalTemplateGraph | null
): string | null {
  if (!graph?.options?.length) return null;
  const ordered = sortTemplateOptionsByOrder(graph.options);
  const markedDefault = ordered.find((row) => row.is_default === true);
  if (markedDefault?.id) return markedDefault.id;
  const structureVm = buildTemplateStructureEditorViewModel(graph);
  const summaries = summarizePackageOptionsForWorkspace(graph, structureVm, []);
  return defaultSelectedPackageOptionId(summaries);
}

export function buildJobCardPackageSetup(
  graph: ProposalTemplateGraph | null,
  catalogItems: readonly CatalogItem[],
  selectedOptionId: string | null
): JobCardProposalSetupPackages {
  if (!graph) {
    return {
      choices: [],
      selectedOptionId: null,
      selected: null,
      includedItemCount: 0,
      createsSummary: null,
      includedItems: [],
      customerFacingLine: "",
    };
  }

  const structureVm = buildTemplateStructureEditorViewModel(graph);
  const packageSummaries = summarizePackageOptionsForWorkspace(
    graph,
    structureVm,
    catalogItems
  );
  const createsSummary = buildTemplateCreatesSummary({
    graph,
    packageSummaries,
    editableProseCount: 0,
  });

  const choices: JobCardPackageChoice[] = packageSummaries.map((row) => ({
    optionId: row.optionId,
    label: row.optionLabel,
    linkedItemCount: row.linkedItemCount,
    issueCount: row.issueCount,
    status: row.status,
  }));

  const resolvedSelectedId =
    selectedOptionId && choices.some((c) => c.optionId === selectedOptionId)
      ? selectedOptionId
      : resolveDefaultPackageOptionId(graph);

  const selected =
    choices.find((c) => c.optionId === resolvedSelectedId) ?? choices[0] ?? null;

  const includedItems =
    selected != null
      ? listIncludedItemsForPackage(graph, selected.optionId, catalogItems)
      : [];

  const customerFacingParts = [
    createsSummary.customerFacingAreas.length > 0
      ? createsSummary.customerFacingAreas.join(" · ")
      : null,
    createsSummary.customerDisplayLine || null,
  ].filter(Boolean);

  return {
    choices,
    selectedOptionId: selected?.optionId ?? null,
    selected,
    includedItemCount: selected?.linkedItemCount ?? includedItems.length,
    createsSummary,
    includedItems,
    customerFacingLine: customerFacingParts.join(" · "),
  };
}

export function listIncludedItemsForPackage(
  graph: ProposalTemplateGraph,
  optionId: string,
  catalogItems: readonly CatalogItem[]
): JobCardIncludedItemSummary[] {
  const catalogById = buildCatalogByIdMap(catalogItems);
  const sections = graph.sections
    .filter((row) => row.option_id === optionId)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const rows: JobCardIncludedItemSummary[] = [];
  for (const section of sections) {
    const items = graph.items
      .filter((item) => item.section_id === section.id)
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const item of items) {
      const view = buildTemplateCatalogLinkView(item, catalogById);
      rows.push({
        id: item.id,
        label: view.displayName,
        linkStatus: view.status,
      });
    }
  }
  return rows;
}

export function formatReturnToJobProposalsLabel(
  jobLabel: string | null | undefined
): string {
  const name = (jobLabel ?? "").trim();
  if (!name) return "Return to Job Card · Proposals";
  return `Return to ${name} · Proposals`;
}

export function sanitizeSetupReturnLabel(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().replace(/\s+/g, " ").slice(0, 80);
  return trimmed.length > 0 ? trimmed : null;
}

/** Prefer starter, else first active template, else first listed. */
export function resolveDefaultJobCardTemplateId(
  templates: readonly ProposalTemplate[],
  starterId: string | null
): string | null {
  if (starterId && templates.some((t) => t.id === starterId)) return starterId;
  const active = templates.find((t) => t.active !== false);
  if (active?.id) return active.id;
  return templates[0]?.id ?? null;
}
