/**
 * Templates Workspace Redesign P0 — contractor-first flow helpers.
 *
 * Pure: tab ids, trust copy, package-option summaries for Overview / Packages tab.
 * No React, Supabase, or store writes.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  buildCatalogByIdMap,
  resolveTemplateCatalogLinkStatus,
  sectionAcceptsCatalogItems,
} from "@/app/lib/proposalTemplateCatalogLink";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";

export type TemplatesWorkspaceTabId =
  | "overview"
  | "packages"
  | "estimate"
  | "content";

export const TEMPLATES_WORKSPACE_TABS: ReadonlyArray<{
  id: TemplatesWorkspaceTabId;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "packages", label: "Packages & Catalog" },
  { id: "estimate", label: "Estimate display" },
  { id: "content", label: "Content" },
] as const;

/** Single trust note for Overview — do not repeat under every section. */
export const TEMPLATES_WORKSPACE_TRUST_NOTE =
  "Catalog controls item pricing and measurements. Existing proposal drafts keep frozen prices until refreshed in Builder." as const;

export type PackageOptionSummaryStatus = "ready" | "needs_attention";

export type PackageOptionSummary = {
  optionId: string;
  optionLabel: string;
  sectionCount: number;
  catalogSectionCount: number;
  linkedItemCount: number;
  issueCount: number;
  status: PackageOptionSummaryStatus;
};

export function summarizePackageOptionsForWorkspace(
  graph: ProposalTemplateGraph,
  structureViewModel: TemplateStructureEditorViewModel,
  catalogItems: readonly CatalogItem[]
): PackageOptionSummary[] {
  const catalogById = buildCatalogByIdMap(catalogItems);

  return structureViewModel.optionGroups.map((group) => {
    let linkedItemCount = 0;
    let issueCount = 0;
    let catalogSectionCount = 0;

    for (const section of group.sections) {
      if (sectionAcceptsCatalogItems(section.kind)) {
        catalogSectionCount += 1;
      }
      const sectionItems = graph.items.filter((item) => item.section_id === section.sectionId);
      for (const item of sectionItems) {
        const status = resolveTemplateCatalogLinkStatus(item, catalogById);
        if (status === "linked") {
          linkedItemCount += 1;
        } else {
          issueCount += 1;
        }
      }
    }

    return {
      optionId: group.optionId,
      optionLabel: group.optionLabel,
      sectionCount: group.sections.length,
      catalogSectionCount,
      linkedItemCount,
      issueCount,
      status: issueCount > 0 ? "needs_attention" : "ready",
    };
  });
}

export function defaultExpandedPackageOptionId(
  summaries: readonly PackageOptionSummary[]
): string | null {
  if (summaries.length === 0) return null;
  const needsAttention = summaries.find((row) => row.status === "needs_attention");
  if (needsAttention) return needsAttention.optionId;
  return summaries[0]?.optionId ?? null;
}
