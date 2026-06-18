/**
 * Pure Proposal Builder page/workspace navigation (3J4A mock).
 * R16A — customer-logical strip order via proposalBuilderDocumentIa.
 */

import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import {
  BUILDER_ADD_PAGE_STRIP_POLICY,
  BUILDER_DEFAULT_LANDING_PAGE_CONTEXT,
  BUILDER_OVERFLOW_MENU_LABEL,
  BUILDER_PREVIEW_STRIP_POLICY,
  PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS,
  PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE,
  PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE,
  type ProposalBuilderPlaceholderSlot,
} from "./proposalBuilderDocumentIa";

export type BuilderPageContextId = "cover" | "estimate" | "preview" | "add_page" | (string & {});

export type BuilderWorkspaceSectionId =
  | "overview"
  | "options"
  | "sections"
  | "lines"
  | "quantities";

export const BUILDER_DEFAULT_PAGE_CONTEXT: BuilderPageContextId =
  BUILDER_DEFAULT_LANDING_PAGE_CONTEXT;

export const BUILDER_DEFAULT_WORKSPACE_SECTION: BuilderWorkspaceSectionId = "overview";

export const BUILDER_WORKSPACE_SECTIONS: readonly {
  id: BuilderWorkspaceSectionId;
  label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "options", label: "Options" },
  { id: "sections", label: "Sections" },
  { id: "lines", label: "Line Items" },
  { id: "quantities", label: "Quantities" },
] as const;

export type PageStripItemKind = "fixed" | "page" | "placeholder";

/**
 * 3J4B6 — intrinsic page status (document-page chip). Runtime "Active" is
 * decided by the component from the selected context, never by this model.
 */
export type PageStripStatus =
  | "template"
  | "empty"
  | "soon"
  | "locked"
  | "none";

export type PageStripItem = {
  kind: PageStripItemKind;
  id: BuilderPageContextId;
  label: string;
  enabled: boolean;
  showSoon?: boolean;
  status: PageStripStatus;
  pageType?: ProposalPageType | null;
  fromDb?: boolean;
};

function findPageByType(pages: ProposalPageRow[], pageType: ProposalPageType): ProposalPageRow | null {
  return pages.find((p) => p.page_type === pageType) ?? null;
}

function pageLabel(page: ProposalPageRow): string {
  const customer = (page.customer_title ?? "").trim();
  if (customer) return customer;
  const title = (page.title ?? "").trim();
  return title || page.page_type;
}

function appendPlaceholderOrPageSlot(
  items: PageStripItem[],
  slot: ProposalBuilderPlaceholderSlot,
  dbPages: ProposalPageRow[],
  usedIds: Set<string>
): void {
  const match = findPageByType(dbPages, slot.pageType);
  if (match) {
    usedIds.add(match.id);
    items.push({
      kind: "page",
      id: match.id,
      label: pageLabel(match),
      enabled: true,
      status: "template",
      pageType: match.page_type,
      fromDb: true,
    });
  } else {
    items.push({
      kind: "placeholder",
      id: slot.id,
      label: slot.label,
      enabled: true,
      status: "empty",
      pageType: slot.pageType,
      fromDb: false,
    });
  }
}

export type BuildPageContextStripItemsOptions = {
  /** R15 — persisted proposal with frozen document context enables Cover navigation. */
  persistedProposalDocument?: boolean;
};

export function buildPageContextStripItems(
  pages: ProposalPageRow[] | null | undefined,
  options?: BuildPageContextStripItemsOptions
): { items: PageStripItem[]; overflowPages: PageStripItem[] } {
  const dbPages = pages ?? [];
  const usedIds = new Set<string>();
  const coverEnabled = options?.persistedProposalDocument === true;

  const items: PageStripItem[] = [
    {
      kind: "fixed",
      id: "cover",
      label: "Cover",
      enabled: coverEnabled,
      status: coverEnabled ? "none" : "soon",
      ...(coverEnabled ? {} : { showSoon: true }),
    },
  ];

  for (const slot of PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE) {
    appendPlaceholderOrPageSlot(items, slot, dbPages, usedIds);
  }

  items.push({
    kind: "fixed",
    id: "estimate",
    label: "Estimate",
    enabled: true,
    status: "none",
  });

  for (const slot of PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE) {
    appendPlaceholderOrPageSlot(items, slot, dbPages, usedIds);
  }

  items.push({
    kind: "fixed",
    id: "add_page",
    label: "Add Page",
    enabled: BUILDER_ADD_PAGE_STRIP_POLICY.enabled,
    showSoon: BUILDER_ADD_PAGE_STRIP_POLICY.showSoon,
    status: BUILDER_ADD_PAGE_STRIP_POLICY.status,
  });

  const overflowPages = dbPages
    .filter((p) => p.page_type !== "estimate" && p.page_type !== "cover" && !usedIds.has(p.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map(
      (p): PageStripItem => ({
        kind: "page",
        id: p.id,
        label: pageLabel(p),
        enabled: true,
        status: "template",
        pageType: p.page_type,
        fromDb: true,
      })
    );

  items.push({
    kind: "fixed",
    id: "preview",
    label: "Preview",
    enabled: BUILDER_PREVIEW_STRIP_POLICY.enabled,
    showSoon: BUILDER_PREVIEW_STRIP_POLICY.showSoon,
    status: BUILDER_PREVIEW_STRIP_POLICY.status,
  });

  return { items, overflowPages };
}

export function isEstimatePageContext(contextId: BuilderPageContextId): boolean {
  return contextId === "estimate";
}

export function isCoverPageContext(contextId: BuilderPageContextId): boolean {
  return contextId === "cover";
}

export function resolvePersistedPageByContextId(
  pages: ProposalPageRow[] | null | undefined,
  contextId: BuilderPageContextId
): ProposalPageRow | null {
  if (
    contextId === "cover" ||
    contextId === "estimate" ||
    contextId === "preview" ||
    contextId === "add_page" ||
    contextId.startsWith("placeholder:")
  ) {
    return null;
  }
  const id = (contextId ?? "").trim();
  if (!id) return null;
  return (pages ?? []).find((p) => p.id === id) ?? null;
}

export function isPlaceholderPageContext(contextId: BuilderPageContextId): boolean {
  return typeof contextId === "string" && contextId.startsWith("placeholder:");
}

/**
 * 3J4F — resolve the proposal page_type for a context id so the canvas can
 * pick the right read-only renderer. Persisted pages carry their own type;
 * placeholder slots map through PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS; fixed slots are typed.
 * Returns null for non-page contexts (preview, add_page) or unknown ids.
 */
export function resolvePageTypeForContext(
  contextId: BuilderPageContextId,
  pages: ProposalPageRow[] | null | undefined
): ProposalPageType | null {
  if (contextId === "cover") return "cover";
  if (contextId === "estimate") return "estimate";
  if (contextId === "preview" || contextId === "add_page") return null;

  const placeholder = PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS.find((slot) => slot.id === contextId);
  if (placeholder) return placeholder.pageType;

  const persisted = resolvePersistedPageByContextId(pages, contextId);
  return persisted?.page_type ?? null;
}

/** R16C1 — true when the active context id is a persisted overflow strip page. */
export function isOverflowPageContext(
  contextId: BuilderPageContextId,
  overflowPages: PageStripItem[]
): boolean {
  return overflowPages.some((page) => page.id === contextId);
}

/** R16C1 — active overflow strip item, if any. */
export function resolveActiveOverflowPage(
  contextId: BuilderPageContextId,
  overflowPages: PageStripItem[]
): PageStripItem | null {
  return overflowPages.find((page) => page.id === contextId) ?? null;
}

export type OverflowMenuTriggerState = {
  label: string;
  isOverflowActive: boolean;
  overflowCount: number;
};

/** R16C1 — overflow menu trigger label: active page name or "More pages". */
export function resolveOverflowMenuTriggerState(
  activeContextId: BuilderPageContextId,
  overflowPages: PageStripItem[]
): OverflowMenuTriggerState {
  const active = resolveActiveOverflowPage(activeContextId, overflowPages);
  return {
    label: active?.label ?? BUILDER_OVERFLOW_MENU_LABEL,
    isOverflowActive: active != null,
    overflowCount: overflowPages.length,
  };
}

export function resolvePageContextDisplayLabel(
  contextId: BuilderPageContextId,
  pages: ProposalPageRow[] | null | undefined
): string {
  switch (contextId) {
    case "cover":
      return "Cover";
    case "estimate":
      return "Estimate";
    case "preview":
      return "Preview";
    case "add_page":
      return "Add Page";
    default:
      break;
  }

  const placeholder = PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS.find((slot) => slot.id === contextId);
  if (placeholder) return placeholder.label;

  const persisted = resolvePersistedPageByContextId(pages, contextId);
  if (persisted) return pageLabel(persisted);

  return String(contextId);
}
