/**
 * Pure structure mutation planners for template workspace (R10a).
 *
 * Plans add / remove / reorder without DB or proposal_pages mutation.
 */

import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateSectionDraft,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";
import {
  STRUCTURE_ADDABLE_SECTION_KINDS,
  STRUCTURE_PROTECTED_SECTION_KINDS,
} from "@/app/lib/proposalTemplateStructureEditorView";

export type StructureMutationStatus = "ready" | "blocked";

export type StructureReorderPatch = {
  sectionId: string;
  sort_order: number;
};

export type PlanReorderSectionsInput = {
  graph: ProposalTemplateGraph;
  optionId: string;
  orderedSectionIds: string[];
};

export type PlanReorderSectionsResult =
  | {
      status: "ready";
      patches: StructureReorderPatch[];
    }
  | {
      status: "blocked";
      reason: string;
    };

export type PlanAddSectionInput = {
  graph: ProposalTemplateGraph;
  optionId: string;
  kind: ProposalTemplateSectionKind;
  name?: string | null;
  customerTitle?: string | null;
};

export type PlanAddSectionResult =
  | {
      status: "ready";
      draft: ProposalTemplateSectionDraft;
      sort_order: number;
    }
  | {
      status: "blocked";
      reason: string;
    };

export type PlanRemoveSectionInput = {
  graph: ProposalTemplateGraph;
  sectionId: string;
};

export type PlanRemoveSectionResult = {
  status: StructureMutationStatus;
  reason: string;
  sectionId: string;
  optionId: string | null;
  itemCount: number;
  /** DB cascade would remove dependent template items when delete is implemented. */
  itemsWouldCascade: boolean;
  /** Store delete API is not implemented in R10a — R10b must gate UI. */
  storeDeleteAvailable: boolean;
};

const SORT_ORDER_STEP = 10;

function sectionsForOption(graph: ProposalTemplateGraph, optionId: string) {
  return graph.sections.filter((section) => section.option_id === optionId);
}

function normalizeSortOrderPatches(
  orderedSectionIds: string[],
  startAt = SORT_ORDER_STEP
): StructureReorderPatch[] {
  return orderedSectionIds.map((sectionId, index) => ({
    sectionId,
    sort_order: startAt + index * SORT_ORDER_STEP,
  }));
}

function defaultNameForKind(kind: ProposalTemplateSectionKind): string {
  switch (kind) {
    case "text":
      return "Custom text";
    case "terms":
      return "Terms";
    case "warranty":
      return "Warranty";
    case "image":
      return "Photos";
    case "line_items":
      return "Roof replacement scope";
    case "upgrade_group":
      return "Optional upgrades";
    case "signature_placeholder":
      return "Signature";
    default:
      return "Template section";
  }
}

function nextSortOrder(graph: ProposalTemplateGraph, optionId: string): number {
  const sections = sectionsForOption(graph, optionId);
  if (sections.length === 0) return SORT_ORDER_STEP;
  const maxOrder = sections.reduce(
    (max, section) => Math.max(max, section.sort_order ?? 0),
    0
  );
  return maxOrder + SORT_ORDER_STEP;
}

function isAddableKind(
  graph: ProposalTemplateGraph,
  optionId: string,
  kind: ProposalTemplateSectionKind
): string | null {
  if (!(STRUCTURE_ADDABLE_SECTION_KINDS as readonly string[]).includes(kind)) {
    return `Section kind "${kind}" cannot be added via the structure editor.`;
  }

  if (kind === "line_items" && sectionsForOption(graph, optionId).some((s) => s.kind === "line_items")) {
    return "Each package option may only have one line-items (estimate) section.";
  }

  if (
    kind === "upgrade_group" &&
    sectionsForOption(graph, optionId).some((s) => s.kind === "upgrade_group")
  ) {
    return "Each package option may only have one upgrade group section.";
  }

  if (kind === "signature_placeholder") {
    return "Signature sections are deferred until lifecycle stages (R17+).";
  }

  return null;
}

/**
 * Plan in-option section reorder with normalized sort_order values.
 */
export function planReorderSections(
  input: PlanReorderSectionsInput
): PlanReorderSectionsResult {
  const optionId = input.optionId.trim();
  if (!optionId) {
    return { status: "blocked", reason: "Option id is required to reorder sections." };
  }

  const optionSections = sectionsForOption(input.graph, optionId);
  if (optionSections.length === 0) {
    return { status: "blocked", reason: "No sections found for this option." };
  }

  const orderedIds = input.orderedSectionIds.map((id) => id.trim()).filter(Boolean);
  if (orderedIds.length !== optionSections.length) {
    return {
      status: "blocked",
      reason: "Reorder must include every section for the option exactly once.",
    };
  }

  const optionSectionIds = new Set(optionSections.map((section) => section.id));
  const seen = new Set<string>();

  for (const sectionId of orderedIds) {
    if (!optionSectionIds.has(sectionId)) {
      return {
        status: "blocked",
        reason: "Reorder cannot move sections across package options.",
      };
    }
    if (seen.has(sectionId)) {
      return { status: "blocked", reason: "Reorder contains duplicate section ids." };
    }
    seen.add(sectionId);
  }

  return {
    status: "ready",
    patches: normalizeSortOrderPatches(orderedIds),
  };
}

/**
 * Plan defaults for a new master template section (create payload only).
 */
export function planAddSection(input: PlanAddSectionInput): PlanAddSectionResult {
  const optionId = input.optionId.trim();
  if (!optionId) {
    return { status: "blocked", reason: "Option id is required to add a section." };
  }

  const optionExists = input.graph.options.some((option) => option.id === optionId);
  if (!optionExists) {
    return { status: "blocked", reason: "Option was not found on this template." };
  }

  const blockedReason = isAddableKind(input.graph, optionId, input.kind);
  if (blockedReason) {
    return { status: "blocked", reason: blockedReason };
  }

  const name = (input.name ?? defaultNameForKind(input.kind)).trim() || defaultNameForKind(input.kind);
  const customerTitle = input.customerTitle?.trim() || name;
  const sort_order = nextSortOrder(input.graph, optionId);

  const draft: ProposalTemplateSectionDraft = {
    template_id: input.graph.template.id,
    option_id: optionId,
    kind: input.kind,
    name,
    customer_title: customerTitle,
    customer_visibility: "customer_visible",
    sort_order,
    content:
      input.kind === "text" || input.kind === "terms" || input.kind === "warranty"
        ? { title: customerTitle, body_markdown: null }
        : {},
    metadata: {},
  };

  return { status: "ready", draft, sort_order };
}

/**
 * Plan section removal safety. Does not perform delete — store delete is R10b+.
 */
export function planRemoveSection(
  input: PlanRemoveSectionInput
): PlanRemoveSectionResult {
  const sectionId = input.sectionId.trim();
  const section = input.graph.sections.find((row) => row.id === sectionId);

  if (!section) {
    return {
      status: "blocked",
      reason: "Section was not found on this template.",
      sectionId,
      optionId: null,
      itemCount: 0,
      itemsWouldCascade: false,
      storeDeleteAvailable: false,
    };
  }

  const itemCount = input.graph.items.filter((item) => item.section_id === sectionId).length;

  if ((STRUCTURE_PROTECTED_SECTION_KINDS as readonly string[]).includes(section.kind)) {
    return {
      status: "blocked",
      reason:
        section.kind === "line_items"
          ? "Estimate line-items section cannot be removed."
          : "Upgrade group section cannot be removed.",
      sectionId,
      optionId: section.option_id,
      itemCount,
      itemsWouldCascade: itemCount > 0,
      storeDeleteAvailable: false,
    };
  }

  if (section.kind === "signature_placeholder") {
    return {
      status: "blocked",
      reason: "Signature sections are deferred until lifecycle stages (R17+).",
      sectionId,
      optionId: section.option_id,
      itemCount,
      itemsWouldCascade: false,
      storeDeleteAvailable: false,
    };
  }

  return {
    status: "blocked",
    reason:
      "Template section delete is not wired in the store yet. Removal will be enabled in a later R10 pass after delete semantics are approved.",
    sectionId,
    optionId: section.option_id,
    itemCount,
    itemsWouldCascade: itemCount > 0,
    storeDeleteAvailable: false,
  };
}
