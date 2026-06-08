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

export type PageStripItem = {
  kind: PageStripItemKind;
  id: BuilderPageContextId;
  label: string;
  enabled: boolean;
  showSoon?: boolean;
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

export function buildPageContextStripItems(
  pages: ProposalPageRow[] | null | undefined
): { items: PageStripItem[]; overflowPages: PageStripItem[] } {
  const dbPages = pages ?? [];
  const usedIds = new Set<string>();

  const items: PageStripItem[] = [
    {
      kind: "fixed",
      id: "cover",
      label: "Cover",
      enabled: false,
      showSoon: true,
    },
    {
      kind: "fixed",
      id: "estimate",
      label: "Estimate",
      enabled: true,
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
        pageType: match.page_type,
        fromDb: true,
      });
    } else {
      items.push({
        kind: "placeholder",
        id: slot.id,
        label: slot.label,
        enabled: true,
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
  });

  const overflowPages = dbPages
    .filter((p) => p.page_type !== "estimate" && p.page_type !== "cover" && !usedIds.has(p.id))
    .map(
      (p): PageStripItem => ({
        kind: "page",
        id: p.id,
        label: pageLabel(p),
        enabled: true,
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
  });

  return { items, overflowPages };
}

export function isEstimatePageContext(contextId: BuilderPageContextId): boolean {
  return contextId === "estimate";
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
