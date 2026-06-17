/**
 * Pure view-model for the template content editor (3J4H Pass 3B / R4).
 *
 * Transforms a ProposalTemplateGraph into option-first editable section rows.
 * No DB, store writes, React, UI, or mutation of input.
 */

import { isEditableTextSection } from "@/app/lib/proposalTemplateContentEditing";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateOption,
  ProposalTemplateSection,
  ProposalTemplateSectionKind,
  ProposalTemplateStatus,
} from "@/app/lib/proposalTemplateTypes";

export type TemplateContentEditorSectionView = {
  sectionId: string;
  templateId: string;
  optionId: string;
  kind: ProposalTemplateSectionKind;
  name: string;
  displayTitle: string;
  customerTitle: string | null;
  sortOrder: number | null;
  bodyMarkdown: string;
  contentTitle: string | null;
  layoutHint: string | null;
  assetRef: string | null;
};

export type TemplateContentEditorOptionGroup = {
  optionId: string;
  optionName: string;
  optionLabel: string;
  sortOrder: number | null;
  sections: TemplateContentEditorSectionView[];
};

export type TemplateContentEditorViewModel = {
  templateId: string;
  templateName: string;
  templateStatus: ProposalTemplateStatus | null;
  optionGroups: TemplateContentEditorOptionGroup[];
  totalEditableSectionCount: number;
};

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

function buildSectionView(
  section: ProposalTemplateSection,
  templateId: string
): TemplateContentEditorSectionView {
  const content = section.content;
  return {
    sectionId: section.id,
    templateId,
    optionId: section.option_id,
    kind: section.kind,
    name: section.name,
    displayTitle: resolveSectionDisplayTitle(section),
    customerTitle: section.customer_title ?? null,
    sortOrder: section.sort_order ?? null,
    bodyMarkdown: content?.body_markdown ?? "",
    contentTitle: content?.title ?? null,
    layoutHint: content?.layout_hint ?? null,
    assetRef: content?.asset_ref ?? null,
  };
}

function groupEditableSections(
  graph: ProposalTemplateGraph
): OptionGroupDraft[] {
  const optionById = new Map(graph.options.map((option, index) => [option.id, { option, index }]));
  const groups = new Map<string, OptionGroupDraft>();

  graph.sections.forEach((section, sourceIndex) => {
    if (!isEditableTextSection(section.kind)) return;

    const rawOptionId = section.option_id?.trim();
    const optionId = rawOptionId && rawOptionId.length > 0 ? rawOptionId : UNASSIGNED_OPTION_ID;
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
    const leftIndex = left.option ? optionById.get(left.optionId)?.index ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rightIndex = right.option ? optionById.get(right.optionId)?.index ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return compareSortOrder(leftSort, rightSort, leftIndex, rightIndex);
  });
}

/**
 * Builds an option-first view model of editable template text sections.
 */
export function buildTemplateContentEditorViewModel(
  graph: ProposalTemplateGraph
): TemplateContentEditorViewModel {
  const templateId = graph.template.id;
  const optionGroups = groupEditableSections(graph).map((group) => {
    const sortedSections = [...group.sections].sort((left, right) =>
      compareSortOrder(
        left.section.sort_order,
        right.section.sort_order,
        left.sourceIndex,
        right.sourceIndex
      )
    );

    return {
      optionId: group.optionId,
      optionName: resolveOptionName(group.option, group.optionId),
      optionLabel: resolveOptionLabel(group.option),
      sortOrder: group.isUnassigned ? null : group.option?.sort_order ?? null,
      sections: sortedSections.map(({ section }) => buildSectionView(section, templateId)),
    };
  });

  const totalEditableSectionCount = optionGroups.reduce(
    (count, group) => count + group.sections.length,
    0
  );

  return {
    templateId,
    templateName: graph.template.name,
    templateStatus: graph.template.status ?? null,
    optionGroups,
    totalEditableSectionCount,
  };
}
