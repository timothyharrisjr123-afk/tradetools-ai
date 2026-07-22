/**
 * Job Card + Proposal modal — Block 3 step-flow helpers (contractor-facing polish).
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

import {
  formatActivePackageChoiceGuide,
  formatActivePackageSetupSummary,
  formatPackageScopeCountLine,
  formatTemplateScopeCountLine,
  TEMPLATES_SIMPLE_ESTIMATE_LABEL,
  type PackagePresentationMode,
} from "@/app/tools/roofing/templates/templatesWorkspaceFlow";

export type CreateProposalModalStep =
  | "measurement"
  | "template"
  | "package"
  | "review";

export type CreateProposalMeasurementChoice = {
  id: string;
  title: string;
  summaryLine: string;
  ready: boolean;
};

export const CREATE_PROPOSAL_MODAL_TITLE = "Create proposal" as const;

export const CREATE_PROPOSAL_MODAL_SUBTITLE =
  "Use a reusable proposal setup for this job: measurement, template, package, then Builder." as const;

export const CREATE_PROPOSAL_STEP_MEASUREMENT = "Measurement" as const;
export const CREATE_PROPOSAL_STEP_TEMPLATE = "Template" as const;
export const CREATE_PROPOSAL_STEP_PACKAGE = "Package" as const;
export const CREATE_PROPOSAL_STEP_REVIEW = "Review" as const;

export const CREATE_PROPOSAL_MEASUREMENT_GUIDE =
  "Choose the measurement FieldDive will use for quantities on this proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_GUIDE =
  "Choose the reusable proposal setup for this job. Manage templates under Proposal templates." as const;

export const CREATE_PROPOSAL_TEMPLATE_STRUCTURE =
  "Prepared packages, included work, available upgrades, and customer-facing proposal pages." as const;

export const CREATE_PROPOSAL_TEMPLATE_READY = "Ready to use" as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE =
  "Select the package for this proposal. You can adjust quantities and optional upgrades later in Builder." as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE_ONE =
  "This setup uses one package. Continue when you are ready — you can adjust quantities and optional upgrades later in Builder." as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE_SIMPLE =
  "This setup uses one estimate with no package comparison. Continue when you are ready." as const;

export const CREATE_PROPOSAL_PACKAGE_BUILDER_NOTE =
  "You can adjust quantities and optional upgrades later in Builder." as const;

/** @deprecated Prefer resolveCreateProposalPackageStepEyebrow — avoids false “one package” for simple estimates. */
export const CREATE_PROPOSAL_PACKAGE_ONE_ONLY =
  "This template has one prepared package." as const;

export const CREATE_PROPOSAL_PACKAGE_SIMPLE =
  "This template uses one estimate — no customer package choices." as const;

export const CREATE_PROPOSAL_PACKAGE_SINGLE =
  "This setup uses one package for this job." as const;

/** Fallback multi copy when count is unknown — prefer count-aware guide helpers. */
export const CREATE_PROPOSAL_PACKAGE_MULTI =
  "Compare packages, then choose the package for this job." as const;

export const CREATE_PROPOSAL_REVIEW_TITLE = "Ready to continue" as const;

export const CREATE_PROPOSAL_REVIEW_INTRO =
  "Confirm what FieldDive will use, then continue to Builder for this job." as const;

export const CREATE_PROPOSAL_REVIEW_NEXT_LABEL = "In Builder next" as const;

export const CREATE_PROPOSAL_REVIEW_NEXT =
  "Apply this job’s quantities, adjust optional upgrades if needed, then review the proposal before sending." as const;

export const CREATE_PROPOSAL_INCLUDED_PRIMARY =
  "Estimate · Package details · Terms · Warranty · Customer-facing sections" as const;

export const CREATE_PROPOSAL_INCLUDED_LABEL = "Proposal packet includes" as const;

export const CREATE_PROPOSAL_USE_MEASUREMENT = "Use this measurement" as const;
export const CREATE_PROPOSAL_USE_TEMPLATE = "Use this template" as const;
export const CREATE_PROPOSAL_CONTINUE_TO_BUILDER = "Continue to Builder" as const;

export const CREATE_PROPOSAL_HELPER =
  "Existing proposals on this job are not changed." as const;

export const CREATE_PROPOSAL_MEASUREMENT_READY = "Report complete" as const;
export const CREATE_PROPOSAL_MEASUREMENT_BLOCKED =
  "Complete and save a measurement report before creating a proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_BLOCKED =
  "Create or finish a proposal template before creating a proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_SELECTED_UNUSABLE =
  "This template needs a bit more setup. Choose another ready template, or finish it under Proposal templates." as const;

/**
 * Orange / amber template-step message. Only when there are no templates, or the
 * selected template is loaded and truly unusable — never a global block just
 * because company starter readiness failed.
 */
export function resolveCreateProposalTemplateStepMessage(input: {
  templatesLength: number;
  selectedTemplateId: string | null | undefined;
  templateReady: boolean;
  selectedUnusableReason: string | null | undefined;
}): string | null {
  if (input.templatesLength <= 0) {
    return CREATE_PROPOSAL_TEMPLATE_BLOCKED;
  }
  const selectedId = (input.selectedTemplateId ?? "").trim();
  if (!selectedId || input.templateReady) {
    return null;
  }
  const reason = (input.selectedUnusableReason ?? "").trim();
  if (reason) {
    return reason;
  }
  return null;
}

export const CREATE_PROPOSAL_PACKAGE_BLOCKED =
  "Choose a package to continue." as const;

export const CREATE_PROPOSAL_STEPS: readonly CreateProposalModalStep[] = [
  "measurement",
  "template",
  "package",
  "review",
] as const;

export function createProposalStepLabel(step: CreateProposalModalStep): string {
  switch (step) {
    case "measurement":
      return CREATE_PROPOSAL_STEP_MEASUREMENT;
    case "template":
      return CREATE_PROPOSAL_STEP_TEMPLATE;
    case "package":
      return CREATE_PROPOSAL_STEP_PACKAGE;
    case "review":
      return CREATE_PROPOSAL_STEP_REVIEW;
  }
}

export function nextCreateProposalStep(
  step: CreateProposalModalStep
): CreateProposalModalStep | null {
  const idx = CREATE_PROPOSAL_STEPS.indexOf(step);
  if (idx < 0 || idx >= CREATE_PROPOSAL_STEPS.length - 1) return null;
  return CREATE_PROPOSAL_STEPS[idx + 1] ?? null;
}

export function prevCreateProposalStep(
  step: CreateProposalModalStep
): CreateProposalModalStep | null {
  const idx = CREATE_PROPOSAL_STEPS.indexOf(step);
  if (idx <= 0) return null;
  return CREATE_PROPOSAL_STEPS[idx - 1] ?? null;
}

/** Contractor title — prefer “Saved manual report” over short internal label. */
export function formatCreateProposalMeasurementTitle(
  selectedLabel: string | null | undefined
): string {
  const raw = (selectedLabel ?? "").trim();
  if (!raw) return "Measurement report";
  if (/^saved manual$/i.test(raw)) return "Saved manual report";
  if (/^saved manual \(unsaved edits\)$/i.test(raw)) {
    return "Saved manual report (unsaved edits)";
  }
  return raw;
}

/**
 * Compact contractor summary — area + waste + ready stamp.
 * Avoids SQ / adj SQ / resolver-style packing in the modal card.
 */
export function formatCreateProposalMeasurementSummary(input: {
  roofAreaSqft?: number | null;
  wastePercent?: number | null;
  ready?: boolean;
}): string {
  const parts: string[] = [];
  if (input.roofAreaSqft != null && Number.isFinite(input.roofAreaSqft)) {
    parts.push(`${Math.round(input.roofAreaSqft).toLocaleString()} sq ft`);
  }
  if (input.wastePercent != null && Number.isFinite(input.wastePercent)) {
    parts.push(`${input.wastePercent}% waste`);
  }
  if (input.ready !== false) {
    parts.push(CREATE_PROPOSAL_MEASUREMENT_READY);
  }
  return parts.length > 0 ? parts.join(" · ") : CREATE_PROPOSAL_MEASUREMENT_READY;
}

/** @deprecated Prefer title + summaryLine card layout. Kept for review one-liners. */
export function formatCreateProposalMeasurementDetail(input: {
  selectedLabel: string | null | undefined;
  quantitiesLine: string | null | undefined;
}): string {
  const title = formatCreateProposalMeasurementTitle(input.selectedLabel);
  const qty = (input.quantitiesLine ?? "").trim();
  return qty ? `${title} · ${qty}` : title;
}

export function formatCreateProposalMeasurementReviewLine(input: {
  selectedLabel: string | null | undefined;
  roofAreaSqft?: number | null;
  wastePercent?: number | null;
}): string {
  const title = formatCreateProposalMeasurementTitle(input.selectedLabel);
  const parts: string[] = [title];
  if (input.roofAreaSqft != null && Number.isFinite(input.roofAreaSqft)) {
    parts.push(`${Math.round(input.roofAreaSqft).toLocaleString()} sq ft`);
  }
  if (input.wastePercent != null && Number.isFinite(input.wastePercent)) {
    parts.push(`${input.wastePercent}% waste`);
  }
  return parts.join(" · ");
}

export function buildCreateProposalMeasurementChoice(input: {
  id: string;
  selectedLabel: string | null | undefined;
  roofAreaSqft?: number | null;
  wastePercent?: number | null;
  ready: boolean;
}): CreateProposalMeasurementChoice {
  return {
    id: input.id,
    title: formatCreateProposalMeasurementTitle(input.selectedLabel),
    summaryLine: formatCreateProposalMeasurementSummary({
      roofAreaSqft: input.roofAreaSqft,
      wastePercent: input.wastePercent,
      ready: input.ready,
    }),
    ready: input.ready,
  };
}

/** Primary template body — structure, not admin link counts. */
export function formatCreateProposalTemplatePrimaryBody(): string {
  return CREATE_PROPOSAL_TEMPLATE_STRUCTURE;
}

/**
 * Quiet secondary detail — truthful included / package / upgrade counts.
 * Avoids “pricing items” admin language.
 */
export function formatCreateProposalTemplateSecondaryDetail(input: {
  linkedItemCount: number;
  packageCount: number;
  availableUpgradeCount?: number;
  packageMode?: PackagePresentationMode;
}): string {
  const packageMode =
    input.packageMode ??
    (input.packageCount <= 0
      ? "simple"
      : input.packageCount === 1
        ? "single"
        : "multi");
  if (input.linkedItemCount <= 0 && input.packageCount <= 0) return "";
  return formatTemplateScopeCountLine({
    packageCount: Math.max(0, input.packageCount),
    packageMode,
    linkedCatalogCount: Math.max(0, input.linkedItemCount),
    issueCount: 0,
    availableUpgradeCount: Math.max(0, input.availableUpgradeCount ?? 0),
  });
}

/**
 * @deprecated Admin-style meta. Prefer primary body + Ready to use + secondary detail.
 */
export function formatCreateProposalTemplateMetaLine(input: {
  linkedItemCount: number;
  packageCount: number;
  ready: boolean;
}): string {
  if (input.ready) return CREATE_PROPOSAL_TEMPLATE_READY;
  return "Needs attention";
}

export function formatCreateProposalIncludedPrimary(
  customerFacingLine?: string | null
): string {
  const extras = (customerFacingLine ?? "").trim();
  if (!extras) return CREATE_PROPOSAL_INCLUDED_PRIMARY;
  // Prefer short area lists; fall back to approved default when dense/admin-like.
  if (/linked catalog|catalog item/i.test(extras)) {
    return CREATE_PROPOSAL_INCLUDED_PRIMARY;
  }
  if (extras.length > 120) return CREATE_PROPOSAL_INCLUDED_PRIMARY;
  return extras
    .replace(/Estimate packages/gi, "Estimate")
    .replace(/Package options/gi, "Package details")
    .replace(/Custom text pages/gi, "Customer-facing sections")
    .replace(/customer\s+proposal\s+pages/gi, "Customer-facing sections")
    .replace(/\s*·\s*/g, " · ");
}

export function formatCreateProposalPricingItemsReady(
  includedItemCount: number
): string {
  const count = Math.max(0, includedItemCount);
  if (count <= 0) return "Pricing items and proposal pages are ready";
  return `${count} pricing item${count === 1 ? "" : "s"} ready`;
}

/** Package card count line — reuses Templates truthful formatter. */
export function formatCreateProposalPackageCountLine(input: {
  linkedItemCount: number;
  availableUpgradeCount: number;
  issueCount?: number;
}): string {
  return formatPackageScopeCountLine({
    optionId: "",
    optionLabel: "",
    sectionCount: 0,
    catalogSectionCount: 0,
    linkedItemCount: Math.max(0, input.linkedItemCount),
    issueCount: Math.max(0, input.issueCount ?? 0),
    availableUpgradeCount: Math.max(0, input.availableUpgradeCount),
    availableUpgradeIssueCount: 0,
    status: "ready",
  });
}

export function resolveCreateProposalPackageStepEyebrow(
  mode: PackagePresentationMode,
  activePackageCount = 0
): string {
  if (mode === "simple") return CREATE_PROPOSAL_PACKAGE_SIMPLE;
  if (mode === "single") return CREATE_PROPOSAL_PACKAGE_SINGLE;
  if (activePackageCount >= 2) {
    return formatActivePackageSetupSummary(activePackageCount);
  }
  return CREATE_PROPOSAL_PACKAGE_MULTI;
}

/** Top guide copy for the Job Card package step — mode + live active package count. */
export function resolveCreateProposalPackageStepGuide(
  mode: PackagePresentationMode,
  activePackageCount = 0
): string {
  if (mode === "simple") return CREATE_PROPOSAL_PACKAGE_GUIDE_SIMPLE;
  if (mode === "single") return CREATE_PROPOSAL_PACKAGE_GUIDE_ONE;
  if (activePackageCount >= 2) {
    return `${formatActivePackageChoiceGuide(activePackageCount)} ${CREATE_PROPOSAL_PACKAGE_BUILDER_NOTE}`;
  }
  return CREATE_PROPOSAL_PACKAGE_GUIDE;
}

export function formatCreateProposalPackageReviewLine(input: {
  packageMode: PackagePresentationMode;
  packageName: string | null | undefined;
}): string {
  const name = (input.packageName ?? "").trim();
  if (input.packageMode === "simple") {
    return TEMPLATES_SIMPLE_ESTIMATE_LABEL;
  }
  if (!name) return "Package selected";
  if (input.packageMode === "single") return `${name} package`;
  return `${name} package`;
}

export function formatCreateProposalReviewScopeLine(input: {
  includedItemCount: number;
  availableUpgradeCount: number;
}): string {
  return formatCreateProposalPackageCountLine({
    linkedItemCount: input.includedItemCount,
    availableUpgradeCount: input.availableUpgradeCount,
  });
}

/** @deprecated Prefer formatCreateProposalIncludedPrimary + quiet secondary. */
export function formatCreateProposalIncludedLine(input: {
  includedItemCount: number;
  customerFacingLine: string | null | undefined;
}): string {
  return formatCreateProposalIncludedPrimary(input.customerFacingLine);
}

export function canContinueCreateProposal(input: {
  measurementReady: boolean;
  templateReady: boolean;
  packageSelected: boolean;
  packageIssueCount: number;
  createEnabled: boolean;
}): boolean {
  return (
    input.measurementReady &&
    input.templateReady &&
    input.packageSelected &&
    input.packageIssueCount === 0 &&
    input.createEnabled
  );
}
