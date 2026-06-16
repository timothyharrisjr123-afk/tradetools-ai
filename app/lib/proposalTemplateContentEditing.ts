/**
 * Pure helpers for editing proposal template section prose (3J4H).
 *
 * No DB, store writes, React, or UI. Used before calling updateProposalTemplateSection
 * so content patches preserve the known 4-key contract.
 */

import type {
  ProposalTemplateSectionContent,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";

/** Section kinds whose body_markdown may be edited in the template content editor. */
export const EDITABLE_TEXT_SECTION_KINDS = ["text", "terms", "warranty"] as const;

export type EditableTextSectionKind = (typeof EDITABLE_TEXT_SECTION_KINDS)[number];

const EDITABLE_TEXT_SECTION_KIND_SET = new Set<string>(EDITABLE_TEXT_SECTION_KINDS);

function normalizeBodyMarkdown(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns true when a section kind supports template-level body_markdown editing.
 */
export function isEditableTextSection(
  kind: ProposalTemplateSectionKind | string | null | undefined
): boolean {
  if (kind == null) return false;
  return EDITABLE_TEXT_SECTION_KIND_SET.has(String(kind));
}

/**
 * Builds a content patch that updates only body_markdown while preserving
 * title, layout_hint, and asset_ref. Matches the store's 4-key content contract.
 */
export function mergeSectionBodyMarkdown(
  existingContent: ProposalTemplateSectionContent | null | undefined,
  nextBody: string
): ProposalTemplateSectionContent {
  const existing = existingContent ?? {};
  return {
    title: existing.title ?? null,
    body_markdown: normalizeBodyMarkdown(nextBody),
    layout_hint: existing.layout_hint ?? null,
    asset_ref: existing.asset_ref ?? null,
  };
}
