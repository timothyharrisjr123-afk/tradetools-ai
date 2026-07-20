/**
 * Job Card + Proposal modal — Block 3 step-flow helpers (contractor-facing polish).
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

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
  "Confirm the measurement, template, and starting package FieldDive will use for this job." as const;

export const CREATE_PROPOSAL_STEP_MEASUREMENT = "Measurement" as const;
export const CREATE_PROPOSAL_STEP_TEMPLATE = "Template" as const;
export const CREATE_PROPOSAL_STEP_PACKAGE = "Package" as const;
export const CREATE_PROPOSAL_STEP_REVIEW = "Review" as const;

export const CREATE_PROPOSAL_MEASUREMENT_GUIDE =
  "Use a completed measurement report for this proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_GUIDE =
  "Choose the proposal structure for this job." as const;

export const CREATE_PROPOSAL_TEMPLATE_STRUCTURE =
  "Includes estimate, package options, terms, warranty, and customer-facing sections." as const;

export const CREATE_PROPOSAL_TEMPLATE_READY = "Ready to use" as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE =
  "Choose the starting package for this proposal. You can change it later in Builder." as const;

export const CREATE_PROPOSAL_PACKAGE_ONE_ONLY =
  "This template has one package." as const;

export const CREATE_PROPOSAL_REVIEW_TITLE = "Ready to build proposal" as const;

export const CREATE_PROPOSAL_REVIEW_INTRO =
  "FieldDive will create a saved proposal for this job using the details below." as const;

export const CREATE_PROPOSAL_INCLUDED_PRIMARY =
  "Estimate · Package details · Terms · Warranty · Customer-facing sections" as const;

export const CREATE_PROPOSAL_INCLUDED_LABEL = "Proposal includes" as const;

export const CREATE_PROPOSAL_USE_MEASUREMENT = "Use this measurement" as const;
export const CREATE_PROPOSAL_USE_TEMPLATE = "Use this template" as const;
export const CREATE_PROPOSAL_CONTINUE_TO_BUILDER = "Continue to Builder" as const;

export const CREATE_PROPOSAL_HELPER = "Existing proposals are not changed." as const;

export const CREATE_PROPOSAL_MEASUREMENT_READY = "Report complete" as const;
export const CREATE_PROPOSAL_MEASUREMENT_BLOCKED =
  "Complete and save a measurement report before creating a proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_BLOCKED =
  "Set up a proposal template before creating a proposal." as const;

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

/** Quiet secondary detail only — never the hero line. */
export function formatCreateProposalTemplateSecondaryDetail(input: {
  linkedItemCount: number;
  packageCount: number;
}): string {
  const parts: string[] = [];
  if (input.linkedItemCount > 0) {
    parts.push(
      `${input.linkedItemCount} pricing item${input.linkedItemCount === 1 ? "" : "s"}`
    );
  }
  if (input.packageCount > 0) {
    parts.push(
      `${input.packageCount} package${input.packageCount === 1 ? "" : "s"}`
    );
  }
  return parts.join(" · ");
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
