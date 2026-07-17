/**
 * Templates Flow Redesign P1 — Use-first / Edit-mode helpers.
 *
 * Pure: mode + edit-tab ids, trust copy, package summaries, outcome ("what this creates").
 * No React, Supabase, or store writes.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  buildCatalogByIdMap,
  resolveTemplateCatalogLinkStatus,
  sectionAcceptsCatalogItems,
} from "@/app/lib/proposalTemplateCatalogLink";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  readEstimatePageSettingsFromTemplate,
} from "@/app/lib/proposalTemplateEstimateSettings";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import {
  proposalTemplateSectionKindLabel,
  type ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";

/** Page mode — default is use (readiness / outcome), not edit. */
export type TemplatesWorkspaceMode = "use" | "edit";

/** Edit-mode tools only — never the first-load IA. */
export type TemplatesEditTabId = "packages" | "estimate" | "content";

/** @deprecated Prefer TemplatesEditTabId — kept for gradual rename in tests. */
export type TemplatesWorkspaceTabId = TemplatesEditTabId | "overview";

export const TEMPLATES_EDIT_TABS: ReadonlyArray<{
  id: TemplatesEditTabId;
  label: string;
}> = [
  { id: "packages", label: "Packages & Catalog" },
  { id: "estimate", label: "Customer display" },
  { id: "content", label: "Content" },
] as const;

/** @deprecated Use TEMPLATES_EDIT_TABS — overview is no longer a tab. */
export const TEMPLATES_WORKSPACE_TABS = TEMPLATES_EDIT_TABS;

/** Single trust note for Use surface — do not repeat under every section. */
export const TEMPLATES_WORKSPACE_TRUST_NOTE =
  "Catalog controls item pricing and measurements. Existing proposal drafts keep frozen prices until refreshed in Builder." as const;

export const TEMPLATES_USE_OUTCOME_SUMMARY =
  "This builds a multi-package roof proposal from Catalog items and job measurements." as const;

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

export type TemplateCreatesSummary = {
  packageLabels: string[];
  linkedCatalogCount: number;
  issueCount: number;
  customerFacingAreas: string[];
  customerDisplayLine: string;
  editableProseCount: number;
};

const CUSTOMER_AREA_KIND_ORDER: ProposalTemplateSectionKind[] = [
  "line_items",
  "upgrade_group",
  "terms",
  "warranty",
  "text",
  "image",
  "signature_placeholder",
];

function customerAreaLabel(kind: ProposalTemplateSectionKind): string | null {
  switch (kind) {
    case "line_items":
      return "Estimate packages";
    case "upgrade_group":
      return "Optional upgrades";
    case "terms":
      return "Terms";
    case "warranty":
      return "Warranty";
    case "text":
      return "Custom text pages";
    case "image":
      return "Photos";
    case "signature_placeholder":
      return "Signature placeholder";
    default:
      return proposalTemplateSectionKindLabel(kind);
  }
}

export function formatCustomerDisplaySummary(
  settings: ProposalPageSettings | null | undefined
): string {
  const resolved = {
    ...DEFAULT_ESTIMATE_PAGE_SETTINGS,
    ...(settings ?? {}),
  };
  const parts: string[] = [];
  if (resolved.show_line_prices) parts.push("line prices");
  if (resolved.show_option_totals) parts.push("package totals");
  if (resolved.show_section_headings) parts.push("section headings");
  if (parts.length === 0) {
    return "Customer estimate shows a simplified package view (line details hidden).";
  }
  return `Customer estimate shows ${parts.join(", ")}.`;
}

export function buildTemplateCreatesSummary(input: {
  graph: ProposalTemplateGraph;
  packageSummaries: readonly PackageOptionSummary[];
  editableProseCount: number;
}): TemplateCreatesSummary {
  const { graph, packageSummaries, editableProseCount } = input;
  const packageLabels = packageSummaries.map((row) => row.optionLabel);
  const linkedCatalogCount = packageSummaries.reduce(
    (sum, row) => sum + row.linkedItemCount,
    0
  );
  const issueCount = packageSummaries.reduce((sum, row) => sum + row.issueCount, 0);

  const kindsPresent = new Set<ProposalTemplateSectionKind>();
  for (const section of graph.sections) {
    kindsPresent.add(section.kind);
  }
  const customerFacingAreas: string[] = [];
  for (const kind of CUSTOMER_AREA_KIND_ORDER) {
    if (!kindsPresent.has(kind)) continue;
    const label = customerAreaLabel(kind);
    if (label) customerFacingAreas.push(label);
  }

  const estimateSettings = readEstimatePageSettingsFromTemplate(graph.template);

  return {
    packageLabels,
    linkedCatalogCount,
    issueCount,
    customerFacingAreas,
    customerDisplayLine: formatCustomerDisplaySummary(estimateSettings),
    editableProseCount,
  };
}

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
