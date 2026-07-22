/**
 * Job Card Proposals tab — Compact Proposal Setup Card helpers.
 *
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  classifyContractorFixtureText,
  filterContractorVisibleTemplates,
} from "@/app/lib/contractorFixtureIsolation";
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
  resolvePackageChoiceDescription,
  resolvePackagePresentation,
  summarizePackageOptionsForWorkspace,
  type PackagePresentationMode,
  type TemplateCreatesSummary,
} from "@/app/tools/roofing/templates/templatesWorkspaceFlow";
import { filterActiveTemplateGraph } from "@/app/tools/roofing/templates/templatesPackageStructurePlanner";

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

/**
 * True when a draft title matches known internal/smoke fixtures (Block 1).
 * Delegates to centralized conservative classifier — not broad "test"/"smoke".
 */
export function looksLikeInternalDraftTitle(
  title: string | null | undefined
): boolean {
  return classifyContractorFixtureText(title).isInternalFixture;
}

/**
 * Contractor-facing title fallback. Preferred path: hide fixture drafts from the
 * normal list entirely (Block 1). Softening remains for edge/dev display only.
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
  /** Included catalog scope only — excludes available upgrades. */
  linkedItemCount: number;
  /** Optional add-ons for this package (not included by default). */
  availableUpgradeCount: number;
  issueCount: number;
  status: "ready" | "needs_attention";
  description: string | null;
  /** Top included item names for package comparison (not upgrades). */
  highlightLabels: readonly string[];
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
  availableUpgradeCount: number;
  packagePresentationMode: PackagePresentationMode;
  createsSummary: TemplateCreatesSummary | null;
  includedItems: JobCardIncludedItemSummary[];
  customerFacingLine: string;
};

/**
 * Contractor-facing create-modal template list: hide smoke fixtures and archived
 * rows. Keep a selected archived/fixture id visible if already chosen.
 */
export function filterJobCardCreateProposalTemplates<
  T extends { id: string; name?: string | null; status?: string | null },
>(templates: readonly T[], selectedTemplateId?: string | null): T[] {
  const visible = filterContractorVisibleTemplates(templates).filter(
    (row) => row.status !== "archived"
  );
  const selectedId = (selectedTemplateId ?? "").trim();
  if (
    selectedId &&
    !visible.some((row) => row.id === selectedId)
  ) {
    const selected = templates.find((row) => row.id === selectedId);
    if (selected) return [...visible, selected];
  }
  return visible;
}

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

/**
 * Job Card + Proposal template eligibility for the *selected* template graph.
 *
 * Unlike company starter readiness (`deriveProposalTemplateReadiness`), this does
 * **not** require Standard/Enhanced/Premium (3 packages) or starter seed shape.
 * Single-package and simple-estimate guided templates are usable when they have
 * linked Catalog items on the starting package.
 */
export type JobCardSelectedTemplateEligibility = {
  usable: boolean;
  /** Quiet contractor-facing reason when not usable; null when usable or no graph yet. */
  reason: string | null;
  graphMatchesSelection: boolean;
};

export function deriveJobCardSelectedTemplateEligibility(input: {
  selectedTemplateId: string | null | undefined;
  graph: ProposalTemplateGraph | null;
  catalogItems: readonly CatalogItem[];
  selectedOptionId?: string | null;
}): JobCardSelectedTemplateEligibility {
  const selectedTemplateId = (input.selectedTemplateId ?? "").trim();
  if (!selectedTemplateId) {
    return {
      usable: false,
      reason: null,
      graphMatchesSelection: false,
    };
  }

  const graph = input.graph;
  if (!graph?.template?.id) {
    return {
      usable: false,
      reason: null,
      graphMatchesSelection: false,
    };
  }

  if (graph.template.id !== selectedTemplateId) {
    // Stale graph from a previous selection — do not treat as ready/blocked yet.
    return {
      usable: false,
      reason: null,
      graphMatchesSelection: false,
    };
  }

  if (!graph.options.length) {
    return {
      usable: false,
      reason: "This template has no package structure yet.",
      graphMatchesSelection: true,
    };
  }

  const packageSetup = buildJobCardPackageSetup(
    graph,
    input.catalogItems,
    input.selectedOptionId ?? null
  );

  if (packageSetup.choices.length === 0) {
    return {
      usable: false,
      reason: "This template has no package structure yet.",
      graphMatchesSelection: true,
    };
  }

  const selected = packageSetup.selected;
  if (!selected) {
    return {
      usable: false,
      reason: "Choose a package to continue.",
      graphMatchesSelection: true,
    };
  }

  if (selected.linkedItemCount <= 0) {
    return {
      usable: false,
      reason:
        "This template needs included Catalog items before it can start a proposal.",
      graphMatchesSelection: true,
    };
  }

  if ((selected.issueCount ?? 0) > 0) {
    return {
      usable: false,
      reason:
        "Some included items need a Catalog link fixed before this template can be used.",
      graphMatchesSelection: true,
    };
  }

  return {
    usable: true,
    reason: null,
    graphMatchesSelection: true,
  };
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
      availableUpgradeCount: 0,
      packagePresentationMode: "simple",
      createsSummary: null,
      includedItems: [],
      customerFacingLine: "",
    };
  }

  const activeParts = filterActiveTemplateGraph(graph);
  const activeGraph: ProposalTemplateGraph = {
    ...graph,
    options: activeParts.options,
    sections: activeParts.sections,
    items: activeParts.items,
  };

  const structureVm = buildTemplateStructureEditorViewModel(activeGraph);
  const packageSummaries = summarizePackageOptionsForWorkspace(
    activeGraph,
    structureVm,
    catalogItems
  );
  const createsSummary = buildTemplateCreatesSummary({
    graph: activeGraph,
    packageSummaries,
    editableProseCount: 0,
  });
  const packagePresentation = resolvePackagePresentation({
    graph: activeGraph,
    packageSummaries,
  });

  const optionById = new Map(activeGraph.options.map((row) => [row.id, row]));

  const choices: JobCardPackageChoice[] = packageSummaries.map((row) => {
    const option = optionById.get(row.optionId);
    const includedForOption = listIncludedItemsForPackage(
      activeGraph,
      row.optionId,
      catalogItems
    );
    return {
      optionId: row.optionId,
      label: row.optionLabel,
      linkedItemCount: row.linkedItemCount,
      availableUpgradeCount:
        row.availableUpgradeCount + row.availableUpgradeIssueCount,
      issueCount: row.issueCount,
      status: row.status,
      description: resolvePackageChoiceDescription({
        optionLabel: row.optionLabel,
        optionDescription: option?.description ?? null,
      }),
      highlightLabels: includedForOption
        .slice(0, 4)
        .map((item) => item.label)
        .filter(Boolean),
    };
  });

  const resolvedSelectedId =
    selectedOptionId && choices.some((c) => c.optionId === selectedOptionId)
      ? selectedOptionId
      : resolveDefaultPackageOptionId(activeGraph);

  const selected =
    choices.find((c) => c.optionId === resolvedSelectedId) ?? choices[0] ?? null;

  const includedItems =
    selected != null
      ? listIncludedItemsForPackage(activeGraph, selected.optionId, catalogItems)
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
    availableUpgradeCount: selected?.availableUpgradeCount ?? 0,
    packagePresentationMode: packagePresentation.mode,
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
    .filter(
      (row) => row.option_id === optionId && row.kind !== "upgrade_group"
    )
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

/**
 * Prefer starter, else first active template, else first listed.
 * Callers should pass contractor-visible templates (smoke fixtures filtered).
 */
export function resolveDefaultJobCardTemplateId(
  templates: readonly ProposalTemplate[],
  starterId: string | null
): string | null {
  const visible = filterContractorVisibleTemplates(templates);
  if (starterId && visible.some((t) => t.id === starterId)) return starterId;
  const active = visible.find((t) => t.active !== false);
  if (active?.id) return active.id;
  return visible[0]?.id ?? null;
}
