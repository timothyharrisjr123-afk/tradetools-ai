/**
 * Job Card Prepare proposal (V2A) — pure view-model + copy.
 * No React, Supabase, or store writes.
 */

import {
  formatActivePackageChoiceGuide,
  formatActivePackageSetupSummary,
  formatPackageScopeCountLine,
  formatTemplateScopeCountLine,
  TEMPLATES_SIMPLE_ESTIMATE_LABEL,
  type PackagePresentationMode,
} from "@/app/tools/roofing/templates/templatesWorkspaceFlow";

export type PrepareProposalFieldId = "measurement" | "setup" | "package";

export type PrepareProposalFieldState =
  | "prepared"
  | "alternative_available"
  | "choice_required"
  | "blocked";

export type CreateProposalMeasurementChoice = {
  id: string;
  title: string;
  summaryLine: string;
  ready: boolean;
};

export type PrepareProposalSetupChoice = {
  id: string;
  name: string;
  ready: boolean;
  archived?: boolean;
};

export type PrepareProposalPackageChoice = {
  optionId: string;
  label: string;
  linkedItemCount: number;
  availableUpgradeCount?: number;
  issueCount: number;
  status: "ready" | "needs_attention";
  description?: string | null;
};

export type PrepareProposalFieldView = {
  field: PrepareProposalFieldId;
  state: PrepareProposalFieldState;
  preparedId: string | null;
  valueLabel: string | null;
  valueDetail: string | null;
  fixPath: string | null;
  showChange: boolean;
  showSelector: boolean;
};

export const PREPARE_PROPOSAL_TITLE = "Prepare proposal" as const;
export const PREPARE_PROPOSAL_MEASUREMENT_LABEL = "Measurement" as const;
export const PREPARE_PROPOSAL_SETUP_LABEL = "Reusable setup" as const;
export const PREPARE_PROPOSAL_PACKAGE_LABEL = "Starting package" as const;
export const PREPARE_PROPOSAL_CHANGE_LABEL = "Change" as const;
export const PREPARE_PROPOSAL_CREATE_LABEL = "Create proposal" as const;
export const PREPARE_PROPOSAL_CANCEL_LABEL = "Cancel" as const;
export const PREPARE_PROPOSAL_FOOTER =
  "Creates a job-specific copy. Your reusable setup stays unchanged." as const;

export const PREPARE_PROPOSAL_MEASUREMENT_REQUIRED = "Measurement required" as const;
export const PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL = "Add measurement" as const;

export const PREPARE_PROPOSAL_MEASUREMENT_CHOOSE = "Choose a measurement." as const;
export const PREPARE_PROPOSAL_SETUP_CHOOSE = "Choose a reusable setup." as const;
export const PREPARE_PROPOSAL_PACKAGE_CHOOSE = "Choose a starting package." as const;
export const PREPARE_PROPOSAL_PACKAGE_NEEDS_SETUP =
  "Choose a reusable setup first." as const;
export const PREPARE_PROPOSAL_PACKAGE_NONE =
  "This setup has no valid package. Add a package under Proposal templates." as const;
export const PREPARE_PROPOSAL_SETUP_NONE =
  "Create or finish a proposal template before creating a proposal." as const;
export const PREPARE_PROPOSAL_CREATING_LABEL = "Creating…" as const;

/** @deprecated V2A uses PREPARE_PROPOSAL_TITLE. Kept for residual copy checks. */
export const CREATE_PROPOSAL_MODAL_TITLE = PREPARE_PROPOSAL_CREATE_LABEL;

export const CREATE_PROPOSAL_MEASUREMENT_READY = "Report complete" as const;
export const CREATE_PROPOSAL_MEASUREMENT_BLOCKED =
  "Complete and save a measurement report before creating a proposal." as const;

export const CREATE_PROPOSAL_TEMPLATE_BLOCKED = PREPARE_PROPOSAL_SETUP_NONE;

export const CREATE_PROPOSAL_TEMPLATE_STRUCTURE =
  "Prepared packages, included work, optional upgrades, and customer-facing proposal pages." as const;

export const CREATE_PROPOSAL_TEMPLATE_READY = "Ready to use" as const;

export const CREATE_PROPOSAL_PACKAGE_SIMPLE =
  "This template uses one estimate — no customer package choices." as const;

export const CREATE_PROPOSAL_PACKAGE_SINGLE =
  "This setup uses one package for this job." as const;

/** Fallback multi copy when count is unknown — prefer count-aware guide helpers. */
export const CREATE_PROPOSAL_PACKAGE_MULTI =
  "Compare packages, then choose the package for this job." as const;

/** @deprecated Prefer resolveCreateProposalPackageStepEyebrow — avoids false “one package” for simple estimates. */
export const CREATE_PROPOSAL_PACKAGE_ONE_ONLY =
  "This template has one prepared package." as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE =
  "Select the package for this proposal. You can adjust quantities and optional upgrades later in Builder." as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE_ONE =
  "This setup uses one package. Continue when you are ready — you can adjust quantities and optional upgrades later in Builder." as const;

export const CREATE_PROPOSAL_PACKAGE_GUIDE_SIMPLE =
  "This setup uses one estimate with no package comparison. Continue when you are ready." as const;

export const CREATE_PROPOSAL_PACKAGE_BUILDER_NOTE =
  "You can adjust quantities and optional upgrades later in Builder." as const;

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

/** Top guide copy for package counts — mode + live active package count. */
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
  return `${name} package`;
}

export function isValidPrepareProposalPackage(
  choice: PrepareProposalPackageChoice
): boolean {
  return (
    choice.status === "ready" &&
    choice.linkedItemCount > 0 &&
    (choice.issueCount ?? 0) === 0
  );
}

function listEligibleSetups(
  setups: readonly PrepareProposalSetupChoice[]
): PrepareProposalSetupChoice[] {
  return setups.filter((row) => !row.archived);
}

function fieldView(input: {
  field: PrepareProposalFieldId;
  state: PrepareProposalFieldState;
  preparedId?: string | null;
  valueLabel?: string | null;
  valueDetail?: string | null;
  fixPath?: string | null;
  showChange?: boolean;
  showSelector?: boolean;
}): PrepareProposalFieldView {
  const state = input.state;
  const showSelector =
    input.showSelector ??
    (state === "choice_required" || state === "alternative_available");
  const showChange =
    input.showChange ??
    (state === "alternative_available" || state === "choice_required");
  return {
    field: input.field,
    state,
    preparedId: input.preparedId ?? null,
    valueLabel: input.valueLabel ?? null,
    valueDetail: input.valueDetail ?? null,
    fixPath: input.fixPath ?? null,
    showChange,
    showSelector,
  };
}

/**
 * Measurement prepare:
 * - canonical eligible selected measurement when that id is valid
 * - unique eligible measurement may be prepared
 * - multiple eligible without a valid selected id → choice required
 * - never first-of-many
 */
export function resolvePrepareProposalMeasurement(input: {
  eligible: readonly CreateProposalMeasurementChoice[];
  selectedId: string | null | undefined;
}): PrepareProposalFieldView {
  const eligible = input.eligible.filter((row) => row.ready !== false);
  if (eligible.length === 0) {
    return fieldView({
      field: "measurement",
      state: "blocked",
      valueLabel: PREPARE_PROPOSAL_MEASUREMENT_REQUIRED,
      fixPath: CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
      showChange: false,
      showSelector: false,
    });
  }

  const selectedId = (input.selectedId ?? "").trim();
  const selected = selectedId
    ? eligible.find((row) => row.id === selectedId)
    : undefined;

  if (selected) {
    return fieldView({
      field: "measurement",
      state: eligible.length > 1 ? "alternative_available" : "prepared",
      preparedId: selected.id,
      valueLabel: selected.title,
      valueDetail: selected.summaryLine,
      showChange: eligible.length > 1,
      showSelector: eligible.length > 1,
    });
  }

  if (eligible.length === 1) {
    const only = eligible[0]!;
    return fieldView({
      field: "measurement",
      state: "prepared",
      preparedId: only.id,
      valueLabel: only.title,
      valueDetail: only.summaryLine,
      showChange: false,
      showSelector: false,
    });
  }

  return fieldView({
    field: "measurement",
    state: "choice_required",
    valueLabel: PREPARE_PROPOSAL_MEASUREMENT_CHOOSE,
    showChange: true,
    showSelector: true,
  });
}

/**
 * Reusable setup prepare:
 * 1. eligible preferred setup
 * 2. eligible company starter (existing named Job Card rule)
 * 3. unique eligible setup
 * 4. contractor explicit eligible choice
 * Never first-listed among many. Archived rows cannot be prepared.
 */
export function resolvePrepareProposalSetup(input: {
  setups: readonly PrepareProposalSetupChoice[];
  preferredId: string | null | undefined;
  starterId: string | null | undefined;
  explicitId: string | null | undefined;
  selectedId?: string | null;
  selectedUnusableReason?: string | null;
}): PrepareProposalFieldView {
  const eligible = listEligibleSetups(input.setups);
  if (eligible.length === 0) {
    return fieldView({
      field: "setup",
      state: "blocked",
      fixPath: PREPARE_PROPOSAL_SETUP_NONE,
      showChange: false,
      showSelector: false,
    });
  }

  const unusableReason = (input.selectedUnusableReason ?? "").trim();
  const knownUnusableId = unusableReason
    ? (input.selectedId ?? input.explicitId ?? "").trim()
    : "";
  const explicitId = (input.explicitId ?? "").trim();
  if (explicitId && explicitId === knownUnusableId && unusableReason) {
    const selected = eligible.find((row) => row.id === explicitId);
    return fieldView({
      field: "setup",
      state: "blocked",
      valueLabel: selected?.name ?? null,
      fixPath: unusableReason,
      showChange: eligible.some((row) => row.id !== explicitId),
      showSelector: eligible.some((row) => row.id !== explicitId),
    });
  }
  const preparable = knownUnusableId
    ? eligible.filter((row) => row.id !== knownUnusableId)
    : eligible;

  if (preparable.length === 0) {
    const blockedName =
      eligible.find((row) => row.id === knownUnusableId)?.name ?? null;
    return fieldView({
      field: "setup",
      state: "blocked",
      valueLabel: blockedName,
      fixPath: unusableReason || PREPARE_PROPOSAL_SETUP_NONE,
      showChange: false,
      showSelector: false,
    });
  }

  const byId = (id: string | null | undefined) => {
    const trimmed = (id ?? "").trim();
    if (!trimmed) return undefined;
    return preparable.find((row) => row.id === trimmed);
  };

  const explicit = byId(input.explicitId);
  const preferred = byId(input.preferredId);
  const starter = byId(input.starterId);
  const unique = preparable.length === 1 ? preparable[0] : undefined;
  const prepared = explicit ?? preferred ?? starter ?? unique;

  if (!prepared) {
    return fieldView({
      field: "setup",
      state: "choice_required",
      valueLabel: PREPARE_PROPOSAL_SETUP_CHOOSE,
      showChange: true,
      showSelector: true,
    });
  }

  return fieldView({
    field: "setup",
    state: eligible.length > 1 ? "alternative_available" : "prepared",
    preparedId: prepared.id,
    valueLabel: prepared.name,
    showChange: eligible.length > 1,
    showSelector: eligible.length > 1,
  });
}

/**
 * Starting package prepare:
 * - selected setup’s valid starting/default package
 * - unique valid package may be prepared (no selector)
 * - invalid/missing starting package with multiple valids → choice required
 * - never array-order among many
 */
export function resolvePrepareProposalPackage(input: {
  setupState: PrepareProposalFieldState;
  choices: readonly PrepareProposalPackageChoice[];
  startingOptionId: string | null | undefined;
  explicitId: string | null | undefined;
  packagePresentationMode: PackagePresentationMode;
  graphReady?: boolean;
}): PrepareProposalFieldView {
  if (input.setupState === "choice_required") {
    return fieldView({
      field: "package",
      state: "blocked",
      fixPath: PREPARE_PROPOSAL_PACKAGE_NEEDS_SETUP,
      showChange: false,
      showSelector: false,
    });
  }
  if (input.setupState === "blocked") {
    return fieldView({
      field: "package",
      state: "blocked",
      fixPath: PREPARE_PROPOSAL_PACKAGE_NEEDS_SETUP,
      showChange: false,
      showSelector: false,
    });
  }
  if (input.graphReady === false) {
    return fieldView({
      field: "package",
      state: "choice_required",
      valueLabel: null,
      showChange: false,
      showSelector: false,
    });
  }

  const valid = input.choices.filter(isValidPrepareProposalPackage);
  if (valid.length === 0) {
    return fieldView({
      field: "package",
      state: "blocked",
      fixPath: PREPARE_PROPOSAL_PACKAGE_NONE,
      showChange: false,
      showSelector: false,
    });
  }

  const byId = (id: string | null | undefined) => {
    const trimmed = (id ?? "").trim();
    if (!trimmed) return undefined;
    return valid.find((row) => row.optionId === trimmed);
  };

  const explicit = byId(input.explicitId);
  const starting = byId(input.startingOptionId);
  const unique = valid.length === 1 ? valid[0] : undefined;
  const prepared = explicit ?? starting ?? unique;

  if (!prepared) {
    return fieldView({
      field: "package",
      state: "choice_required",
      valueLabel: PREPARE_PROPOSAL_PACKAGE_CHOOSE,
      showChange: true,
      showSelector: true,
    });
  }

  const simpleOne =
    input.packagePresentationMode === "simple" || valid.length === 1;
  const label =
    input.packagePresentationMode === "simple"
      ? TEMPLATES_SIMPLE_ESTIMATE_LABEL
      : prepared.label;

  return fieldView({
    field: "package",
    state: simpleOne ? "prepared" : "alternative_available",
    preparedId: prepared.optionId,
    valueLabel: label,
    valueDetail: formatCreateProposalPackageCountLine({
      linkedItemCount: prepared.linkedItemCount,
      availableUpgradeCount: prepared.availableUpgradeCount ?? 0,
      issueCount: prepared.issueCount,
    }),
    showChange: !simpleOne,
    showSelector: !simpleOne,
  });
}

export function canCreatePrepareProposal(input: {
  measurement: PrepareProposalFieldState;
  setup: PrepareProposalFieldState;
  package: PrepareProposalFieldState;
}): boolean {
  const ok = (state: PrepareProposalFieldState) =>
    state === "prepared" || state === "alternative_available";
  return ok(input.measurement) && ok(input.setup) && ok(input.package);
}

export function resolvePrepareProposalExpandedField(input: {
  measurement: PrepareProposalFieldView;
  setup: PrepareProposalFieldView;
  package: PrepareProposalFieldView;
  contractorExpanded: PrepareProposalFieldId | null;
}): PrepareProposalFieldId | null {
  if (input.contractorExpanded) {
    const field =
      input.contractorExpanded === "measurement"
        ? input.measurement
        : input.contractorExpanded === "setup"
          ? input.setup
          : input.package;
    return field.showSelector ? input.contractorExpanded : null;
  }
  if (input.measurement.state === "choice_required" && input.measurement.showSelector) {
    return "measurement";
  }
  if (input.setup.state === "choice_required" && input.setup.showSelector) {
    return "setup";
  }
  if (input.package.state === "choice_required" && input.package.showSelector) {
    return "package";
  }
  return null;
}
