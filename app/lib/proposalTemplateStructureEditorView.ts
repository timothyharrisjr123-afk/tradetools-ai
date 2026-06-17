/**
 * Pure structure view-model for template workspace (R10a).
 *
 * Option-first ordered sections for master template structure editing.
 * No DB, store writes, React, UI, or mutation of input graph.
 */

import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateOption,
  ProposalTemplateSection,
  ProposalTemplateSectionKind,
  ProposalTemplateStatus,
} from "@/app/lib/proposalTemplateTypes";

export type TemplateStructureSectionView = {
  sectionId: string;
  templateId: string;
  optionId: string;
  kind: ProposalTemplateSectionKind;
  name: string;
  displayTitle: string;
  customerTitle: string | null;
  sortOrder: number | null;
  itemCount: number;
  isRemovable: boolean;
  isReorderable: boolean;
  isAddableKind: boolean;
  protectionReason: string | null;
};

export type TemplateStructureOptionGroup = {
  optionId: string;
  optionName: string;
  optionLabel: string;
  sortOrder: number | null;
  sections: TemplateStructureSectionView[];
  addableKinds: ProposalTemplateSectionKind[];
};

export type TemplateStructureEditorViewModel = {
  templateId: string;
  templateName: string;
  templateStatus: ProposalTemplateStatus | null;
  optionGroups: TemplateStructureOptionGroup[];
  totalSectionCount: number;
};

/** Kinds contractors may add via structure editor (R10). */
export const STRUCTURE_ADDABLE_SECTION_KINDS: readonly ProposalTemplateSectionKind[] = [
  "text",
  "terms",
  "warranty",
  "image",
] as const;

/** Kinds that must not be removed from a seeded roofing template spine. */
export const STRUCTURE_PROTECTED_SECTION_KINDS: readonly ProposalTemplateSectionKind[] = [
  "line_items",
  "upgrade_group",
] as const;

const UNASSIGNED_OPTION_ID = "unassigned";
const UNASSIGNED_OPTION_LABEL = "Unassigned option";
const DEFAULT_SECTION_DISPLAY_TITLE = "Template section";
const DEFAULT_OPTION_LABEL = "Option";

type IndexedSection = {
  section: ProposalTemplateSection;
  sourceIndex: number;
};

type OptionGroupDraft = {
  optionId: string;
  option: ProposalTemplateOption | undefined;
  isUnassigned: boolean;
  sections: IndexedSection[];
};

function compareSortOrder(
  a: number | null | undefined,
  b: number | null | undefined,
  indexA: number,
  indexB: number
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (!aMissing && !bMissing) {
    const byOrder = a - b;
    return byOrder !== 0 ? byOrder : indexA - indexB;
  }
  if (!aMissing) return -1;
  if (!bMissing) return 1;
  return indexA - indexB;
}

function resolveOptionLabel(option: ProposalTemplateOption | undefined): string {
  if (!option) return UNASSIGNED_OPTION_LABEL;
  const customerLabel = option.customer_label?.trim();
  if (customerLabel) return customerLabel;
  const name = option.name?.trim();
  if (name) return name;
  return DEFAULT_OPTION_LABEL;
}

function resolveOptionName(option: ProposalTemplateOption | undefined, optionId: string): string {
  if (!option) return UNASSIGNED_OPTION_LABEL;
  const name = option.name?.trim();
  if (name) return name;
  return optionId;
}

function resolveSectionDisplayTitle(section: ProposalTemplateSection): string {
  const customerTitle = section.customer_title?.trim();
  if (customerTitle) return customerTitle;
  const contentTitle = section.content?.title?.trim();
  if (contentTitle) return contentTitle;
  const name = section.name?.trim();
  if (name) return name;
  return DEFAULT_SECTION_DISPLAY_TITLE;
}

function isProtectedSectionKind(kind: ProposalTemplateSectionKind): boolean {
  return (STRUCTURE_PROTECTED_SECTION_KINDS as readonly string[]).includes(kind);
}

function protectionReasonForSection(
  kind: ProposalTemplateSectionKind
): string | null {
  if (kind === "line_items") {
    return "Estimate line-items section is required for each package option.";
  }
  if (kind === "upgrade_group") {
    return "Optional upgrades section is part of the default package structure.";
  }
  if (kind === "signature_placeholder") {
    return "Signature sections are deferred until lifecycle stages (R17+).";
  }
  return null;
}

function countItemsForSection(
  graph: ProposalTemplateGraph,
  sectionId: string
): number {
  return graph.items.filter((item) => item.section_id === sectionId).length;
}

function resolveAddableKindsForOption(
  _sections: ProposalTemplateSection[]
): ProposalTemplateSectionKind[] {
  return [...STRUCTURE_ADDABLE_SECTION_KINDS];
}

function buildSectionView(
  graph: ProposalTemplateGraph,
  section: ProposalTemplateSection
): TemplateStructureSectionView {
  const itemCount = countItemsForSection(graph, section.id);
  const protectedKind = isProtectedSectionKind(section.kind);
  const protectionReason =
    protectionReasonForSection(section.kind) ??
    (protectedKind ? "This section kind is protected in the template spine." : null);

  const isRemovable = !protectedKind && section.kind !== "signature_placeholder";
  const isReorderable = true;
  const isAddableKind = (STRUCTURE_ADDABLE_SECTION_KINDS as readonly string[]).includes(
    section.kind
  );

  return {
    sectionId: section.id,
    templateId: section.template_id,
    optionId: section.option_id,
    kind: section.kind,
    name: section.name,
    displayTitle: resolveSectionDisplayTitle(section),
    customerTitle: section.customer_title ?? null,
    sortOrder: section.sort_order ?? null,
    itemCount,
    isRemovable,
    isReorderable,
    isAddableKind,
    protectionReason: isRemovable ? null : protectionReason,
  };
}

function groupAllSections(graph: ProposalTemplateGraph): OptionGroupDraft[] {
  const optionById = new Map(
    graph.options.map((option, index) => [option.id, { option, index }])
  );
  const groups = new Map<string, OptionGroupDraft>();

  graph.sections.forEach((section, sourceIndex) => {
    const rawOptionId = section.option_id?.trim();
    const optionId =
      rawOptionId && rawOptionId.length > 0 ? rawOptionId : UNASSIGNED_OPTION_ID;
    const known = optionById.get(optionId);
    const isUnassigned = !known;

    let group = groups.get(optionId);
    if (!group) {
      group = {
        optionId,
        option: known?.option,
        isUnassigned,
        sections: [],
      };
      groups.set(optionId, group);
    }

    group.sections.push({ section, sourceIndex });
  });

  return Array.from(groups.values()).sort((left, right) => {
    const leftSort = left.isUnassigned ? null : left.option?.sort_order ?? null;
    const rightSort = right.isUnassigned ? null : right.option?.sort_order ?? null;
    const leftIndex = left.option
      ? optionById.get(left.optionId)?.index ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    const rightIndex = right.option
      ? optionById.get(right.optionId)?.index ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    return compareSortOrder(leftSort, rightSort, leftIndex, rightIndex);
  });
}

/**
 * Build option-first structure view model for all template sections.
 */
export function buildTemplateStructureEditorViewModel(
  graph: ProposalTemplateGraph
): TemplateStructureEditorViewModel {
  const templateId = graph.template.id;

  const optionGroups = groupAllSections(graph).map((group) => {
    const sortedSections = [...group.sections].sort((left, right) =>
      compareSortOrder(
        left.section.sort_order,
        right.section.sort_order,
        left.sourceIndex,
        right.sourceIndex
      )
    );

    const sectionViews = sortedSections.map(({ section }) =>
      buildSectionView(graph, section)
    );

    return {
      optionId: group.optionId,
      optionName: resolveOptionName(group.option, group.optionId),
      optionLabel: resolveOptionLabel(group.option),
      sortOrder: group.isUnassigned ? null : group.option?.sort_order ?? null,
      sections: sectionViews,
      addableKinds: resolveAddableKindsForOption(
        sortedSections.map(({ section }) => section)
      ),
    };
  });

  const totalSectionCount = optionGroups.reduce(
    (count, group) => count + group.sections.length,
    0
  );

  return {
    templateId,
    templateName: graph.template.name,
    templateStatus: graph.template.status ?? null,
    optionGroups,
    totalSectionCount,
  };
}
