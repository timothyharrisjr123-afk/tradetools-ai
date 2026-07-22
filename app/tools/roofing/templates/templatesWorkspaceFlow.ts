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
import { filterActiveTemplateOptions } from "./templatesPackageStructurePlanner";

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

export const TEMPLATES_LIBRARY_HEADING = "Reusable setups" as const;
export const TEMPLATES_LIBRARY_HINT = "Choose a setup to review." as const;

/**
 * R2A — Template library lifecycle (archive/restore).
 *
 * Archive hides a reusable setup from normal future proposal creation; it
 * never deletes the template, its package options, sections, or items, and
 * never touches existing proposal drafts/sent proposals. Restore returns it
 * to active use. This is a template-level lifecycle, separate from R1's
 * package-option `removed_at` soft-remove.
 */
export const TEMPLATES_ARCHIVE_ACTION_LABEL = "Archive" as const;
export const TEMPLATES_RESTORE_ACTION_LABEL = "Restore" as const;
export const TEMPLATES_ARCHIVE_CONFIRM_TITLE = "Archive this setup?" as const;
export const TEMPLATES_ARCHIVE_CONFIRM_COPY =
  "This setup will be hidden from future proposals. Existing proposals are not changed." as const;
export const TEMPLATES_ACTIVE_FILTER_LABEL = "Active" as const;
export const TEMPLATES_ARCHIVED_FILTER_LABEL = "Archived" as const;

/**
 * R2B — Preferred setup for roofing proposal creation.
 *
 * Company + workflow preference for which reusable setup Job Card suggests
 * first. Separate from R1 package-option is_default (which package inside a
 * setup) and R2A archive/restore (template lifecycle).
 */
export const TEMPLATES_PREFERRED_BADGE_LABEL = "Preferred" as const;
export const TEMPLATES_MAKE_PREFERRED_ACTION_LABEL = "Make preferred" as const;
export const TEMPLATES_CLEAR_PREFERRED_ACTION_LABEL = "Clear preferred" as const;
export const TEMPLATES_PREFERRED_HELPER_COPY =
  "Used first when starting a proposal from a Job Card." as const;
export const TEMPLATES_PREFERRED_FOR_ROOFING_COPY =
  "Preferred for new roofing proposals" as const;
export const TEMPLATES_REUSABLE_SETUP_EYEBROW = "Reusable proposal setup" as const;
export const TEMPLATES_REUSABLE_SETUP_SUBCOPY =
  "Review what this template prepares for future proposals." as const;
export const TEMPLATES_PACKAGES_SECTION_HEADING = "Packages" as const;
export const TEMPLATES_PACKAGES_SECTION_HINT =
  "Switch packages to review what each one includes. Package selection happens later from a Job Card." as const;

/**
 * Live active package-option count inside one template.
 * After R1, never hardcode “3 packages” from create-time model.
 * `count` must be active package options (removed_at is null) on the selected template.
 */
export function formatActivePackageSetupSummary(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return "No active package options.";
  if (n === 1) return "This setup has 1 package option.";
  return `This setup has ${n} package options.`;
}

/** Job Card / chooser guide — count-aware package-option choice language. */
export function formatActivePackageChoiceGuide(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) return "Select the package for this proposal.";
  if (n === 2) return "Choose between 2 package options.";
  return `Choose from ${n} package options.`;
}

/** Compact adaptive grid for package cards (Templates / Job Card / Builder). */
export function packageChoiceGridClass(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n >= 5) {
    return "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";
  }
  if (n === 4) {
    return "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
  }
  if (n === 3) {
    return "grid w-full grid-cols-1 gap-3 md:grid-cols-3";
  }
  if (n === 2) {
    return "grid w-full grid-cols-1 gap-3 sm:grid-cols-2";
  }
  return "grid w-full grid-cols-1 gap-3";
}

export const TEMPLATES_INCLUDED_WORK_HEADING = "Included work" as const;
export const TEMPLATES_INCLUDED_WORK_HINT =
  "Prepared scope for this package." as const;
export const TEMPLATES_INCLUDED_WORK_ADJUST_HINT =
  "Adjust prepared scope for this package. Catalog still owns price and unit." as const;
export const TEMPLATES_AVAILABLE_UPGRADES_HEADING = "Available upgrades" as const;
export const TEMPLATES_AVAILABLE_UPGRADES_HINT =
  "Optional add-ons. Not included by default — selected later in Builder." as const;
export const TEMPLATES_AVAILABLE_UPGRADES_EMPTY =
  "No optional upgrades prepared for this package." as const;
export const TEMPLATES_PROPOSAL_CONTENT_HEADING = "Proposal packet" as const;
export const TEMPLATES_PROPOSAL_CONTENT_HINT =
  "Customer-facing pages in this setup." as const;
export const TEMPLATES_NEXT_USE_HEADING = "Used from a Job Card" as const;
export const TEMPLATES_NEXT_USE_COPY =
  "Use this template from a Job Card: choose measurement → choose template → choose package → continue to Builder." as const;
export const TEMPLATES_OPEN_JOBS_ACTION = "Open Jobs" as const;
export const TEMPLATES_ADJUST_INCLUDED_ACTION = "Adjust included work" as const;
export const TEMPLATES_ADVANCED_EDITING_ACTION = "Advanced editing" as const;
export const TEMPLATES_BACK_TO_SETUP_ACTION = "Back to proposal setup" as const;
export const TEMPLATES_SIMPLE_ESTIMATE_LABEL = "Simple estimate" as const;
export const TEMPLATES_SIMPLE_ESTIMATE_DETAIL =
  "One prepared estimate — no package choices for the customer." as const;
export const TEMPLATES_JOB_CARD_USE_NOTE =
  "Used from a Job Card when creating a proposal." as const;
/** Short contractor-facing blurb for a package choice card. */
export function resolvePackageChoiceDescription(input: {
  optionLabel: string;
  optionDescription?: string | null;
}): string | null {
  const fromOption = input.optionDescription?.trim() || null;
  if (fromOption) return fromOption;
  const label = input.optionLabel.trim().toLowerCase();
  if (label === "standard") return "Core included scope for this proposal choice.";
  if (label === "enhanced") return "Upgraded included materials with optional add-ons available.";
  if (label === "premium") return "Highest included package with optional add-ons available.";
  return null;
}

export type PackageOptionSummaryStatus = "ready" | "needs_attention";

export type PackageOptionSummary = {
  optionId: string;
  optionLabel: string;
  sectionCount: number;
  catalogSectionCount: number;
  /** Package-included scope only — never upgrade_group / available upgrades. */
  linkedItemCount: number;
  /** Included-scope catalog issues only. */
  issueCount: number;
  /** True optional add-ons in upgrade_group (linked). */
  availableUpgradeCount: number;
  /** Available-upgrade catalog issues only. */
  availableUpgradeIssueCount: number;
  /** Template option marked is_default. */
  isDefault: boolean;
  status: PackageOptionSummaryStatus;
};

export type TemplateCreatesSummary = {
  packageLabels: string[];
  /** Included-scope linked catalog items across packages (excludes available upgrades). */
  linkedCatalogCount: number;
  issueCount: number;
  /** Available upgrades across packages (linked + issue rows). */
  availableUpgradeCount: number;
  customerFacingAreas: string[];
  customerDisplayLine: string;
  editableProseCount: number;
};

export type PackagePresentationMode = "simple" | "single" | "multi";

/** Replaces stale starter install copy on the prepared landing. */
export const TEMPLATES_STARTER_PURPOSE_COPY =
  "Reusable roof replacement setup for future proposals." as const;

const STALE_STARTER_PURPOSE_PATTERN =
  /Install catalog items before use|Starter roof replacement template/i;

/** Contractor-facing purpose line for the reusable-setup hero. */
export function resolveTemplatePurposeDescription(input: {
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const raw = input.description?.trim() || null;
  if (!raw) return null;
  if (STALE_STARTER_PURPOSE_PATTERN.test(raw)) {
    return TEMPLATES_STARTER_PURPOSE_COPY;
  }
  return raw;
}

/** Package card / single-package count line — included separate from available upgrades. */
export function formatPackageScopeCountLine(summary: PackageOptionSummary): string {
  const included = summary.linkedItemCount + summary.issueCount;
  const upgrades =
    summary.availableUpgradeCount + summary.availableUpgradeIssueCount;
  const includedPart = `${included} included`;
  if (upgrades <= 0) return includedPart;
  return `${includedPart} · ${upgrades} available upgrade${upgrades === 1 ? "" : "s"}`;
}

/** Hero / library rollup — included totals exclude available upgrades. */
export function formatTemplateScopeCountLine(input: {
  packageCount: number;
  packageMode: PackagePresentationMode;
  linkedCatalogCount: number;
  issueCount: number;
  availableUpgradeCount: number;
}): string {
  const included = input.linkedCatalogCount + input.issueCount;
  const packagesPart =
    input.packageMode === "simple"
      ? TEMPLATES_SIMPLE_ESTIMATE_LABEL
      : input.packageMode === "single"
        ? "1 package"
        : `${input.packageCount} packages`;
  const parts = [packagesPart, `${included} included`];
  if (input.availableUpgradeCount > 0) {
    parts.push(
      `${input.availableUpgradeCount} available upgrade${
        input.availableUpgradeCount === 1 ? "" : "s"
      }`
    );
  }
  return parts.join(" · ");
}

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
    summaryLine: formatActivePackageSetupSummary(packageSummaries.length),
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
  const availableUpgradeCount = packageSummaries.reduce(
    (sum, row) =>
      sum + row.availableUpgradeCount + row.availableUpgradeIssueCount,
    0
  );

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
    availableUpgradeCount,
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
  const activeOptions = filterActiveTemplateOptions(graph.options);
  // When the graph includes option rows, hide soft-removed packages.
  // Empty options (partial fixtures) keep optionGroups as-is.
  const activeOptionIds =
    graph.options.length === 0
      ? null
      : new Set(activeOptions.map((option) => option.id));

  return structureViewModel.optionGroups
    .filter((group) => activeOptionIds == null || activeOptionIds.has(group.optionId))
    .map((group) => {
    let linkedItemCount = 0;
    let issueCount = 0;
    let availableUpgradeCount = 0;
    let availableUpgradeIssueCount = 0;
    let catalogSectionCount = 0;

    for (const section of group.sections) {
      if (sectionAcceptsCatalogItems(section.kind)) {
        catalogSectionCount += 1;
      }
      const isAvailableUpgrade = section.kind === "upgrade_group";
      const sectionItems = graph.items.filter((item) => item.section_id === section.sectionId);
      for (const item of sectionItems) {
        const status = resolveTemplateCatalogLinkStatus(item, catalogById);
        if (isAvailableUpgrade) {
          if (status === "linked") {
            availableUpgradeCount += 1;
          } else {
            availableUpgradeIssueCount += 1;
          }
          continue;
        }
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
      availableUpgradeCount,
      availableUpgradeIssueCount,
      isDefault:
        graph.options.find((option) => option.id === group.optionId)?.is_default === true,
      status:
        issueCount > 0 || availableUpgradeIssueCount > 0
          ? "needs_attention"
          : "ready",
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

/** Default package for quote review — prefer template is_default, else needs_attention, else first. */
export function defaultSelectedPackageOptionId(
  summaries: readonly PackageOptionSummary[]
): string | null {
  if (summaries.length === 0) return null;
  const markedDefault = summaries.find((row) => row.isDefault);
  if (markedDefault) return markedDefault.optionId;
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
  optionId: string,
  preferredKind?: ProposalTemplateSectionKind
): CatalogTargetSectionChoice[] {
  const sections = graph.sections
    .filter((row) => row.option_id === optionId && sectionAcceptsCatalogItems(row.kind))
    .filter((row) => (preferredKind ? row.kind === preferredKind : true))
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
