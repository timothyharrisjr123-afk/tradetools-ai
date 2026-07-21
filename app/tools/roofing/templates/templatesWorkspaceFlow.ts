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

/** Page mode — default is reusable setup summary, not advanced editor. */
export type TemplatesWorkspaceMode = "review" | "advanced";

/** @deprecated Prefer review | advanced */
export type TemplatesLegacyUseEditMode = "use" | "edit";

/** Advanced tools only — never the first-load IA. */
export type TemplatesEditTabId = "packages" | "estimate" | "content";

/** @deprecated Prefer TemplatesEditTabId — kept for gradual rename in tests. */
export type TemplatesWorkspaceTabId = TemplatesEditTabId | "overview";

export const TEMPLATES_EDIT_TABS: ReadonlyArray<{
  id: TemplatesEditTabId;
  label: string;
}> = [
  { id: "packages", label: "Edit sections" },
  { id: "estimate", label: "Customer display" },
  { id: "content", label: "Content, warranty & terms" },
] as const;

/** @deprecated Use TEMPLATES_EDIT_TABS */
export const TEMPLATES_WORKSPACE_TABS = TEMPLATES_EDIT_TABS;

/** Quiet secondary note — never the primary landing story. */
export const TEMPLATES_WORKSPACE_TRUST_NOTE =
  "Catalog controls item pricing and measurements. Existing proposal drafts keep frozen prices until refreshed in Builder." as const;

export const TEMPLATES_USE_OUTCOME_SUMMARY =
  "This builds a multi-package roof proposal from Catalog items and job measurements." as const;

/** @deprecated Prefer TEMPLATES_REUSABLE_SETUP_SUBCOPY */
export const TEMPLATES_QUOTE_SETUP_OUTCOME =
  "Review what this template prepares for future proposals." as const;

export const TEMPLATES_REUSABLE_SETUP_EYEBROW = "Reusable proposal setup" as const;
export const TEMPLATES_REUSABLE_SETUP_SUBCOPY =
  "Review what this template prepares for future proposals." as const;
export const TEMPLATES_PACKAGES_SECTION_HEADING = "Packages" as const;
export const TEMPLATES_INCLUDED_WORK_HEADING = "Included work" as const;
export const TEMPLATES_INCLUDED_WORK_HINT =
  "Prepared Catalog items for this setup. Adjust only if needed." as const;
export const TEMPLATES_PROPOSAL_CONTENT_HEADING = "Proposal content" as const;
export const TEMPLATES_NEXT_USE_HEADING = "Next use" as const;
export const TEMPLATES_NEXT_USE_COPY =
  "Use this template from a Job Card when creating a proposal." as const;
export const TEMPLATES_OPEN_JOBS_ACTION = "Open Jobs" as const;
export const TEMPLATES_ADVANCED_EDITING_ACTION = "Advanced editing" as const;
export const TEMPLATES_BACK_TO_SETUP_ACTION = "Back to proposal setup" as const;
export const TEMPLATES_SIMPLE_ESTIMATE_LABEL = "Simple estimate" as const;
export const TEMPLATES_SIMPLE_ESTIMATE_DETAIL =
  "One prepared estimate — no package choices for the customer." as const;

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

export type PackagePresentationMode = "simple" | "single" | "multi";

export type PackagePresentation = {
  mode: PackagePresentationMode;
  /** Contractor-facing section title. */
  heading: string;
  /** True when the landing should hide multi-package switcher chrome. */
  hidePackageSwitcher: boolean;
  summaryLine: string;
};

export type ProposalContentLandingArea = {
  label: string;
  detail: string;
};

/**
 * Resolve how packages should present on the reusable-setup landing.
 * Hides the internal single-option container used for “simple estimate.”
 */
export function resolvePackagePresentation(input: {
  graph: ProposalTemplateGraph;
  packageSummaries: readonly PackageOptionSummary[];
}): PackagePresentation {
  const { graph, packageSummaries } = input;
  const packageModel =
    graph.template.metadata &&
    typeof graph.template.metadata === "object" &&
    !Array.isArray(graph.template.metadata)
      ? String((graph.template.metadata as Record<string, unknown>).package_model ?? "")
          .trim()
          .toLowerCase()
      : "";

  const onlyOption = graph.options.length === 1 ? graph.options[0] : null;
  const looksLikeSimpleContainer =
    onlyOption != null &&
    (packageModel === "simple" ||
      onlyOption.selection_mode === "included" ||
      (onlyOption.name ?? "").trim().toLowerCase() === "estimate");

  if (looksLikeSimpleContainer || packageSummaries.length === 0) {
    return {
      mode: "simple",
      heading: TEMPLATES_PACKAGES_SECTION_HEADING,
      hidePackageSwitcher: true,
      summaryLine: TEMPLATES_SIMPLE_ESTIMATE_DETAIL,
    };
  }

  if (packageSummaries.length === 1) {
    const label = packageSummaries[0]?.optionLabel ?? "Package";
    return {
      mode: "single",
      heading: TEMPLATES_PACKAGES_SECTION_HEADING,
      hidePackageSwitcher: true,
      summaryLine: `Single package: ${label}`,
    };
  }

  return {
    mode: "multi",
    heading: TEMPLATES_PACKAGES_SECTION_HEADING,
    hidePackageSwitcher: false,
    summaryLine: `Packages: ${packageSummaries.map((row) => row.optionLabel).join(" · ")}`,
  };
}

/** Prepared proposal-content areas for the main landing (not the editor). */
export function buildProposalContentLandingAreas(
  graph: ProposalTemplateGraph
): ProposalContentLandingArea[] {
  const areas: ProposalContentLandingArea[] = [];
  const seen = new Set<string>();

  const ordered = graph.sections.slice().sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  for (const section of ordered) {
    const name = (section.customer_title ?? section.name ?? "").trim();
    let label: string | null = null;
    let detail = "";

    switch (section.kind) {
      case "text":
        if (/overview/i.test(name)) {
          label = "Overview";
          detail = "Opening page customers see first";
        } else if (/scope/i.test(name)) {
          label = "Scope notes";
          detail = "Clarifies assumptions and confirmations";
        } else {
          label = name || "Custom page";
          detail = "Customer-facing page";
        }
        break;
      case "line_items":
        label = "Estimate";
        detail = "Catalog-backed scope and pricing lines";
        break;
      case "upgrade_group": {
        const hasItems = graph.items.some((item) => item.section_id === section.id);
        if (!hasItems) continue;
        label = "Optional upgrades";
        detail = "Optional add-ons for this package";
        break;
      }
      case "warranty":
        label = "Warranty";
        detail = "Customer-facing warranty language";
        break;
      case "terms":
        label = "Terms";
        detail = "Customer-facing terms language";
        break;
      case "image":
        label = "Photos";
        detail = "Photo page";
        break;
      default:
        continue;
    }

    if (!label || seen.has(label)) continue;
    seen.add(label);
    areas.push({ label, detail });
  }

  return areas;
}

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

/** Default package for quote review — first option, preferring needs_attention. */
export function defaultSelectedPackageOptionId(
  summaries: readonly PackageOptionSummary[]
): string | null {
  return defaultExpandedPackageOptionId(summaries);
}

export type CatalogTargetSectionChoice = {
  sectionId: string;
  optionId: string;
  label: string;
  kind: ProposalTemplateSectionKind;
};

/** Catalog-capable sections for a package — used when Add item has multiple targets. */
export function listCatalogTargetSectionsForOption(
  graph: ProposalTemplateGraph,
  optionId: string
): CatalogTargetSectionChoice[] {
  const sections = graph.sections
    .filter((row) => row.option_id === optionId && sectionAcceptsCatalogItems(row.kind))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  return sections.map((section) => ({
    sectionId: section.id,
    optionId: section.option_id,
    kind: section.kind,
    label:
      section.kind === "upgrade_group"
        ? section.name?.trim() || "Optional upgrades"
        : section.name?.trim() || "Estimate items",
  }));
}
