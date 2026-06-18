/**
 * R16B — Pure helpers for job-specific proposal page body editing.
 *
 * Persists raw body_markdown only — display-time token merge stays in R14.
 * No DB, React, pricing, or template mutation.
 */

import type { ProposalPageContent, ProposalPageType } from "@/app/lib/proposalPageTypes";

/** Page types that support per-proposal body_markdown editing in Proposal Builder. */
export const EDITABLE_PROPOSAL_PAGE_TYPES = [
  "project_overview",
  "terms",
  "warranty",
  "custom_text",
] as const;

export type EditableProposalPageType = (typeof EDITABLE_PROPOSAL_PAGE_TYPES)[number];

const EDITABLE_PROPOSAL_PAGE_TYPE_SET = new Set<string>(EDITABLE_PROPOSAL_PAGE_TYPES);

/**
 * Normalizes contractor-authored body text for persistence.
 * Preserves intentional internal line breaks; trims outer whitespace only.
 */
export function normalizeProposalPageBodyMarkdown(value: string): string | null {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isEditableProposalPageType(
  pageType: ProposalPageType | string | null | undefined
): pageType is EditableProposalPageType {
  if (pageType == null) return false;
  return EDITABLE_PROPOSAL_PAGE_TYPE_SET.has(String(pageType));
}

/**
 * Builds a content_json patch that updates only body_markdown while preserving
 * media_refs, pdf_attachment_key, and any other existing keys.
 */
export function mergeProposalPageBodyMarkdown(
  existingContent: ProposalPageContent | Record<string, unknown> | null | undefined,
  nextBody: string
): ProposalPageContent {
  const existing =
    existingContent && typeof existingContent === "object"
      ? (existingContent as ProposalPageContent)
      : {};

  return {
    ...existing,
    body_markdown: normalizeProposalPageBodyMarkdown(nextBody),
  };
}

/** True when normalized next body differs from persisted current value. */
export function bodyMarkdownChanged(
  current: string | null | undefined,
  next: string
): boolean {
  const normalizedCurrent = normalizeProposalPageBodyMarkdown(current ?? "");
  const normalizedNext = normalizeProposalPageBodyMarkdown(next);
  return normalizedCurrent !== normalizedNext;
}

/** Read body_markdown from a loosely-typed persisted page content_json object. */
export function readProposalPageBodyMarkdown(
  content: ProposalPageContent | Record<string, unknown> | null | undefined
): string | null {
  if (!content || typeof content !== "object") return null;
  const body = (content as ProposalPageContent).body_markdown;
  return typeof body === "string" ? body : null;
}
