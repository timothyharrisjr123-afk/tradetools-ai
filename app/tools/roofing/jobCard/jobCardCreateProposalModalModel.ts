/**
 * Job Card + Proposal modal — Block 3 step-flow helpers.
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

export type CreateProposalModalStep =
  | "measurement"
  | "template"
  | "package"
  | "review";

export const CREATE_PROPOSAL_MODAL_TITLE = "Create proposal" as const;

export const CREATE_PROPOSAL_MODAL_SUBTITLE =
  "Use this job’s measurement report and a proposal template to build a customer-ready proposal." as const;

export const CREATE_PROPOSAL_STEP_MEASUREMENT = "Measurement" as const;
export const CREATE_PROPOSAL_STEP_TEMPLATE = "Template" as const;
export const CREATE_PROPOSAL_STEP_PACKAGE = "Package" as const;
export const CREATE_PROPOSAL_STEP_REVIEW = "Review" as const;

export const CREATE_PROPOSAL_USE_MEASUREMENT = "Use this measurement" as const;
export const CREATE_PROPOSAL_USE_TEMPLATE = "Use this template" as const;
export const CREATE_PROPOSAL_CONTINUE_TO_BUILDER = "Continue to Builder" as const;

export const CREATE_PROPOSAL_HELPER =
  "FieldDive creates a saved proposal for this job. Existing proposals are not changed." as const;

export const CREATE_PROPOSAL_MEASUREMENT_READY = "Report Complete" as const;
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

export function formatCreateProposalMeasurementDetail(input: {
  selectedLabel: string | null | undefined;
  quantitiesLine: string | null | undefined;
}): string {
  const label = (input.selectedLabel ?? "").trim() || "Measurement report";
  const qty = (input.quantitiesLine ?? "").trim();
  return qty ? `${label} · ${qty}` : label;
}

export function formatCreateProposalTemplateDetail(input: {
  templateName: string | null | undefined;
  linkedItemCount: number;
  packageCount: number;
  ready: boolean;
}): string {
  const name = (input.templateName ?? "").trim() || "Template";
  const parts = [
    `${input.linkedItemCount} linked catalog item${input.linkedItemCount === 1 ? "" : "s"}`,
  ];
  if (input.packageCount > 0) {
    parts.push(
      `${input.packageCount} package${input.packageCount === 1 ? "" : "s"}`
    );
  }
  parts.push(input.ready ? "Ready" : "Needs attention");
  return `${name}\n${parts.join(" · ")}`;
}

export function formatCreateProposalTemplateMetaLine(input: {
  linkedItemCount: number;
  packageCount: number;
  ready: boolean;
}): string {
  const parts = [
    `${input.linkedItemCount} linked catalog item${input.linkedItemCount === 1 ? "" : "s"}`,
  ];
  if (input.packageCount > 0) {
    parts.push(
      `${input.packageCount} package${input.packageCount === 1 ? "" : "s"}`
    );
  }
  parts.push(input.ready ? "Ready" : "Needs attention");
  return parts.join(" · ");
}

export function formatCreateProposalIncludedLine(input: {
  includedItemCount: number;
  customerFacingLine: string | null | undefined;
}): string {
  const count = Math.max(0, input.includedItemCount);
  const base = `${count} catalog item${count === 1 ? "" : "s"}`;
  const extras = (input.customerFacingLine ?? "").trim();
  return extras ? `${base} · ${extras}` : base;
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
