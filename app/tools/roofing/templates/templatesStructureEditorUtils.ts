import { buildTemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import {
  planRemoveSection,
  type PlanRemoveSectionResult,
} from "@/app/lib/proposalTemplateStructureMutations";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSectionKind } from "@/app/lib/proposalTemplateTypes";

export type StructureReorderDirection = "up" | "down";

export type EstimateSettingsToggleKey = keyof Required<ProposalPageSettings>;

export const ESTIMATE_SETTINGS_TOGGLE_LABELS: Record<
  EstimateSettingsToggleKey,
  { label: string; description: string }
> = {
  show_line_prices: {
    label: "Show line prices",
    description: "Display unit and line totals on the estimate page.",
  },
  show_option_totals: {
    label: "Show option totals",
    description: "Display package option subtotals on the estimate page.",
  },
  show_section_headings: {
    label: "Show section headings",
    description: "Display headings above estimate sections.",
  },
};

export function buildWorkspaceStructureViewModel(
  graph: ProposalTemplateGraph | null
): TemplateStructureEditorViewModel | null {
  if (!graph) return null;
  return buildTemplateStructureEditorViewModel(graph);
}

export function getOrderedSectionIdsForOption(
  viewModel: TemplateStructureEditorViewModel,
  optionId: string
): string[] {
  const group = viewModel.optionGroups.find((row) => row.optionId === optionId);
  if (!group) return [];
  return group.sections.map((section) => section.sectionId);
}

/**
 * Swap one section within the same option list. Returns null when move is not allowed.
 */
export function computeReorderedSectionIds(
  orderedSectionIds: readonly string[],
  sectionId: string,
  direction: StructureReorderDirection
): string[] | null {
  const index = orderedSectionIds.indexOf(sectionId);
  if (index < 0) return null;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= orderedSectionIds.length) return null;

  const next = [...orderedSectionIds];
  const current = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = current;
  return next;
}

export function canMoveSectionInOption(
  orderedSectionIds: readonly string[],
  sectionId: string,
  direction: StructureReorderDirection
): boolean {
  return computeReorderedSectionIds(orderedSectionIds, sectionId, direction) != null;
}

export function describeRemoveSectionState(
  graph: ProposalTemplateGraph,
  sectionId: string
): PlanRemoveSectionResult {
  return planRemoveSection({ graph, sectionId });
}

export function isAddableStructureKind(
  kind: ProposalTemplateSectionKind,
  addableKinds: readonly ProposalTemplateSectionKind[]
): boolean {
  return addableKinds.includes(kind);
}
