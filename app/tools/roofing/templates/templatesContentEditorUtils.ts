import { mergeSectionBodyMarkdown } from "@/app/lib/proposalTemplateContentEditing";
import type { ProposalTemplateSectionContent } from "@/app/lib/proposalTemplateTypes";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

export function buildSectionContentSavePatch(
  existingContent: ProposalTemplateSectionContent | null | undefined,
  draftBody: string
): ProposalTemplateSectionContent {
  return mergeSectionBodyMarkdown(existingContent, draftBody);
}

export function isSectionBodyDraftDirty(
  existingContent: ProposalTemplateSectionContent | null | undefined,
  savedBodyMarkdown: string,
  draftBody: string
): boolean {
  const savedPatch = mergeSectionBodyMarkdown(existingContent, savedBodyMarkdown);
  const draftPatch = mergeSectionBodyMarkdown(existingContent, draftBody);
  return savedPatch.body_markdown !== draftPatch.body_markdown;
}

export function countDirtySectionDrafts(
  viewModel: TemplateContentEditorViewModel,
  graph: ProposalTemplateGraph,
  draftsBySectionId: Readonly<Record<string, string>>
): number {
  let count = 0;

  for (const group of viewModel.optionGroups) {
    for (const section of group.sections) {
      const draftBody = draftsBySectionId[section.sectionId] ?? section.bodyMarkdown;
      const existingContent = findSectionContent(graph, section.sectionId);
      if (isSectionBodyDraftDirty(existingContent, section.bodyMarkdown, draftBody)) {
        count += 1;
      }
    }
  }

  return count;
}

export function buildInitialSectionDrafts(
  viewModel: TemplateContentEditorViewModel
): Record<string, string> {
  const drafts: Record<string, string> = {};

  for (const group of viewModel.optionGroups) {
    for (const section of group.sections) {
      drafts[section.sectionId] = section.bodyMarkdown;
    }
  }

  return drafts;
}

export function findSectionContent(
  graph: ProposalTemplateGraph,
  sectionId: string
): ProposalTemplateSectionContent | null | undefined {
  return graph.sections.find((section) => section.id === sectionId)?.content;
}
