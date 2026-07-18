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
  "Create a draft proposal from this job’s measurements, the selected template, and Catalog pricing. You’ll review it in Proposal Builder before sending." as const;

export const JOB_CARD_INCLUDED_REVIEW_NOTE =
  "Template changes affect future proposals. For this job, create the draft and make final review in Builder." as const;

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
