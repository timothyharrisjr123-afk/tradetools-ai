/**
 * Pure Proposal Builder page/workspace navigation (3J4A mock).
 */

import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";

export type BuilderPageContextId = "cover" | "estimate" | "preview" | "add_page" | (string & {});

export type BuilderWorkspaceSectionId =
  | "overview"
  | "options"
  | "sections"
  | "lines"
  | "quantities";

export const BUILDER_DEFAULT_PAGE_CONTEXT: BuilderPageContextId = "estimate";

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

const MOCK_PLACEHOLDER_PAGES: readonly {
  id: string;
  label: string;
  pageType: ProposalPageType;
}[] = [
  { id: "placeholder:terms", label: "Terms", pageType: "terms" },
  { id: "placeholder:warranty", label: "Warranty", pageType: "warranty" },
  { id: "placeholder:about", label: "Project overview", pageType: "project_overview" },
  { id: "placeholder:photos", label: "Project Photos", pageType: "photos" },
] as const;

function findPageByType(pages: ProposalPageRow[], pageType: ProposalPageType): ProposalPageRow | null {
  return pages.find((p) => p.page_type === pageType) ?? null;
}

function pageLabel(page: ProposalPageRow): string {
  const customer = (page.customer_title ?? "").trim();
  if (customer) return customer;
  const title = (page.title ?? "").trim();
  return title || page.page_type;
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
    {
      kind: "fixed",
      id: "estimate",
      label: "Estimate",
      enabled: true,
      status: "none",
    },
  ];

  for (const slot of MOCK_PLACEHOLDER_PAGES) {
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

  items.push({
    kind: "fixed",
    id: "add_page",
    label: "Add Page",
    enabled: false,
    showSoon: true,
    status: "soon",
  });

  const overflowPages = dbPages
    .filter((p) => p.page_type !== "estimate" && p.page_type !== "cover" && !usedIds.has(p.id))
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
    enabled: false,
    showSoon: true,
    status: "locked",
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
 * placeholder slots map through MOCK_PLACEHOLDER_PAGES; fixed slots are typed.
 * Returns null for non-page contexts (preview, add_page) or unknown ids.
 */
export function resolvePageTypeForContext(
  contextId: BuilderPageContextId,
  pages: ProposalPageRow[] | null | undefined
): ProposalPageType | null {
  if (contextId === "cover") return "cover";
  if (contextId === "estimate") return "estimate";
  if (contextId === "preview" || contextId === "add_page") return null;

  const placeholder = MOCK_PLACEHOLDER_PAGES.find((slot) => slot.id === contextId);
  if (placeholder) return placeholder.pageType;

  const persisted = resolvePersistedPageByContextId(pages, contextId);
  return persisted?.page_type ?? null;
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

  const placeholder = MOCK_PLACEHOLDER_PAGES.find((slot) => slot.id === contextId);
  if (placeholder) return placeholder.label;

  const persisted = resolvePersistedPageByContextId(pages, contextId);
  if (persisted) return pageLabel(persisted);

  return String(contextId);
}
