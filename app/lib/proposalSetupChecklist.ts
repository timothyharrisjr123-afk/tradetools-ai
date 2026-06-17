/**
 * Pure proposal setup checklist + next-best-action (SMOKE-2A).
 * Blocker-driven guidance — no navigation or side effects.
 */

import { buildJobCardHref, buildSetupRouteHref } from "@/app/lib/proposalBuilderReadiness";
import { isUuidLike } from "@/app/lib/jobStore";

export type ProposalSetupItemId =
  | "db_job_card"
  | "customer"
  | "measurement"
  | "catalog"
  | "template"
  | "pricing_policy"
  | "proposal_draft";

export type ProposalSetupItemStatus =
  | "complete"
  | "needs_action"
  | "blocked"
  | "optional"
  | "unknown";

export type ProposalSetupActionType =
  | "job_card_tab"
  | "route"
  | "normalize_job_card"
  | "create_proposal"
  | "open_builder"
  | "none";

export type ProposalSetupTargetTab = "overview" | "measurements" | "proposals";

export type ProposalSetupAction = {
  id: string;
  label: string;
  helperText?: string;
  actionType: ProposalSetupActionType;
  targetTab?: ProposalSetupTargetTab;
  href?: string;
  disabled?: boolean;
};

export type ProposalSetupChecklistItem = {
  id: ProposalSetupItemId;
  label: string;
  status: ProposalSetupItemStatus;
  detail?: string;
  isActiveBlocker?: boolean;
};

export type ProposalSetupChecklistInput = {
  jobId: string | null | undefined;
  isBoardOrigin: boolean;
  identityFromJobRecord: boolean;
  customerId: string | null | undefined;
  measurementProposalReady: boolean;
  hasPersistedMeasurement: boolean;
  hasUnsavedMeasurementChanges: boolean;
  catalogReady: boolean;
  templateReady: boolean;
  pricingPolicyConfigured: boolean | null;
  pricingPolicyLoadComplete: boolean;
  activeProposalId: string | null | undefined;
  hasCreatePayload: boolean;
  proposalLaunchReason?: string | null;
};

export type ProposalSetupChecklistResult = {
  items: ProposalSetupChecklistItem[];
  primaryAction: ProposalSetupAction;
  secondaryActions: ProposalSetupAction[];
  statusText: string;
  quiet: boolean;
  activeBlockerId: ProposalSetupItemId | null;
};

const JOB_BOARD_HREF = "/tools/roofing/saved";
const CATALOG_HREF = "/tools/roofing/catalog";
const TEMPLATES_HREF = "/tools/roofing/templates";
const PRICING_SETTINGS_HREF = "/tools/settings/pricing";

function normalizeJobId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function needsDbBackedJobCard(input: ProposalSetupChecklistInput): boolean {
  return input.isBoardOrigin || !input.identityFromJobRecord;
}

function dbJobCardComplete(input: ProposalSetupChecklistInput): boolean {
  return !input.isBoardOrigin && input.identityFromJobRecord;
}

function customerComplete(input: ProposalSetupChecklistInput): boolean {
  return isUuidLike(input.customerId ?? "");
}

function measurementComplete(input: ProposalSetupChecklistInput): boolean {
  return (
    input.hasPersistedMeasurement &&
    input.measurementProposalReady &&
    !input.hasUnsavedMeasurementChanges
  );
}

function pricingNeedsAction(input: ProposalSetupChecklistInput): boolean {
  if (input.pricingPolicyConfigured === false) return true;
  if (!input.pricingPolicyLoadComplete) return false;
  return input.pricingPolicyConfigured !== true;
}

function pricingItemStatus(input: ProposalSetupChecklistInput): ProposalSetupItemStatus {
  if (input.pricingPolicyConfigured === true) return "complete";
  if (input.pricingPolicyConfigured === false) return "needs_action";
  if (!input.pricingPolicyLoadComplete) return "unknown";
  return "needs_action";
}

function setupPrerequisitesMet(input: ProposalSetupChecklistInput): boolean {
  return (
    dbJobCardComplete(input) &&
    customerComplete(input) &&
    measurementComplete(input) &&
    input.catalogReady &&
    input.templateReady &&
    input.pricingPolicyConfigured === true
  );
}

function returnToJobBoardAction(helperText: string): ProposalSetupAction {
  return {
    id: "return-job-board",
    label: "Return to Job Board",
    helperText,
    actionType: "route",
    href: JOB_BOARD_HREF,
  };
}

function openDbBackedJobCardAction(jobId: string): ProposalSetupAction {
  return {
    id: "open-db-job-card",
    label: "Open DB-backed Job Card",
    helperText:
      "Open this job as a saved Job Card before creating proposal drafts. Saving measurements alone does not unblock board-origin jobs.",
    actionType: "normalize_job_card",
    href: `${buildJobCardHref(jobId)}&tab=proposals`,
  };
}

function goToMeasurementsAction(label: string, helperText: string): ProposalSetupAction {
  return {
    id: "go-measurements",
    label,
    helperText,
    actionType: "job_card_tab",
    targetTab: "measurements",
  };
}

function openCatalogAction(jobId: string): ProposalSetupAction {
  return {
    id: "open-catalog",
    label: "Open Catalog Setup",
    helperText: "Finish company catalog setup before creating proposal drafts.",
    actionType: "route",
    href: buildSetupRouteHref(CATALOG_HREF, jobId),
  };
}

function openTemplatesAction(jobId: string): ProposalSetupAction {
  return {
    id: "open-templates",
    label: "Open Templates",
    helperText: "Install or select a proposal template.",
    actionType: "route",
    href: buildSetupRouteHref(TEMPLATES_HREF, jobId),
  };
}

function configurePricingPolicyAction(jobId: string): ProposalSetupAction {
  return {
    id: "configure-pricing-policy",
    label: "Configure Pricing Policy",
    helperText: "Configure company pricing before creating proposal drafts.",
    actionType: "route",
    href: buildSetupRouteHref(PRICING_SETTINGS_HREF, jobId),
  };
}

function createProposalAction(): ProposalSetupAction {
  return {
    id: "create-proposal",
    label: "Create Proposal",
    helperText: "Create a draft proposal for this job.",
    actionType: "create_proposal",
  };
}

function openBuilderAction(jobId: string, proposalId: string): ProposalSetupAction {
  return {
    id: "open-builder",
    label: "Open Proposal Builder",
    helperText: "Continue editing the draft proposal.",
    actionType: "open_builder",
    href: `/tools/roofing/proposals/builder?job=${encodeURIComponent(jobId)}&proposal=${encodeURIComponent(proposalId)}`,
  };
}

function derivePrimaryAction(input: ProposalSetupChecklistInput): {
  action: ProposalSetupAction;
  blockerId: ProposalSetupItemId | null;
  secondaryActions: ProposalSetupAction[];
} {
  const jobId = normalizeJobId(input.jobId);

  if (!jobId || !isUuidLike(jobId)) {
    return {
      action: returnToJobBoardAction("Open a valid saved job before creating proposals."),
      blockerId: null,
      secondaryActions: [],
    };
  }

  if (needsDbBackedJobCard(input)) {
    return {
      action: openDbBackedJobCardAction(jobId),
      blockerId: "db_job_card",
      secondaryActions: [
        returnToJobBoardAction("Reopen this job from the Job Board if needed."),
      ],
    };
  }

  if (!customerComplete(input)) {
    return {
      action: {
        id: "complete-customer",
        label: "Complete Customer Info",
        helperText: "A saved job customer is required before creating a proposal draft.",
        actionType: "job_card_tab",
        targetTab: "overview",
      },
      blockerId: "customer",
      secondaryActions: [],
    };
  }

  if (input.hasUnsavedMeasurementChanges) {
    return {
      action: goToMeasurementsAction(
        "Save Measurement",
        "Save measurement changes on the Job Card before creating a proposal draft."
      ),
      blockerId: "measurement",
      secondaryActions: [],
    };
  }

  if (!input.hasPersistedMeasurement || !input.measurementProposalReady) {
    return {
      action: goToMeasurementsAction(
        "Go to Measurements",
        "Save measurement on the Job Card before creating a proposal draft."
      ),
      blockerId: "measurement",
      secondaryActions: [],
    };
  }

  if (!input.catalogReady) {
    return {
      action: openCatalogAction(jobId),
      blockerId: "catalog",
      secondaryActions: [],
    };
  }

  if (!input.templateReady) {
    return {
      action: openTemplatesAction(jobId),
      blockerId: "template",
      secondaryActions: [],
    };
  }

  if (pricingNeedsAction(input)) {
    return {
      action: configurePricingPolicyAction(jobId),
      blockerId: "pricing_policy",
      secondaryActions: [],
    };
  }

  const proposalId =
    input.activeProposalId && isUuidLike(input.activeProposalId)
      ? input.activeProposalId
      : null;

  if (proposalId) {
    return {
      action: openBuilderAction(jobId, proposalId),
      blockerId: null,
      secondaryActions: [],
    };
  }

  return {
    action: createProposalAction(),
    blockerId: "proposal_draft",
    secondaryActions: [],
  };
}

function deriveChecklistItems(
  input: ProposalSetupChecklistInput,
  activeBlockerId: ProposalSetupItemId | null
): ProposalSetupChecklistItem[] {
  const dbStatus: ProposalSetupItemStatus = dbJobCardComplete(input)
    ? "complete"
    : input.isBoardOrigin
      ? "blocked"
      : "needs_action";

  const measurementStatus: ProposalSetupItemStatus = measurementComplete(input)
    ? "complete"
    : input.hasUnsavedMeasurementChanges
      ? "blocked"
      : "needs_action";

  const draftStatus: ProposalSetupItemStatus = (() => {
    const hasDraft =
      input.activeProposalId != null && isUuidLike(input.activeProposalId);
    if (hasDraft) return "complete";
    if (setupPrerequisitesMet(input)) return "needs_action";
    return "optional";
  })();

  return [
    {
      id: "db_job_card",
      label: "DB-backed Job Card",
      status: dbStatus,
      detail: input.isBoardOrigin
        ? "Board-origin jobs must be opened as a saved Job Card before proposal drafts can be created."
        : undefined,
      isActiveBlocker: activeBlockerId === "db_job_card",
    },
    {
      id: "customer",
      label: "Customer saved",
      status: customerComplete(input) ? "complete" : "needs_action",
      isActiveBlocker: activeBlockerId === "customer",
    },
    {
      id: "measurement",
      label: "Measurement saved",
      status: measurementStatus,
      detail: input.hasUnsavedMeasurementChanges ? "Unsaved measurement changes" : undefined,
      isActiveBlocker: activeBlockerId === "measurement",
    },
    {
      id: "catalog",
      label: "Catalog ready",
      status: input.catalogReady ? "complete" : "needs_action",
      isActiveBlocker: activeBlockerId === "catalog",
    },
    {
      id: "template",
      label: "Template ready",
      status: input.templateReady ? "complete" : "needs_action",
      isActiveBlocker: activeBlockerId === "template",
    },
    {
      id: "pricing_policy",
      label: "Pricing policy configured",
      status: pricingItemStatus(input),
      isActiveBlocker: activeBlockerId === "pricing_policy",
    },
    {
      id: "proposal_draft",
      label: "Proposal draft ready",
      status: draftStatus,
      isActiveBlocker: activeBlockerId === "proposal_draft",
    },
  ];
}

function deriveStatusText(
  input: ProposalSetupChecklistInput,
  activeBlockerId: ProposalSetupItemId | null,
  primaryAction: ProposalSetupAction
): string {
  if (primaryAction.actionType === "open_builder") {
    return "Proposal setup ready — draft available";
  }
  if (setupPrerequisitesMet(input) && activeBlockerId === "proposal_draft") {
    return "Proposal setup ready — create a draft to continue";
  }
  if (activeBlockerId === "db_job_card") {
    return "Open a DB-backed Job Card before creating proposal drafts";
  }
  if (activeBlockerId === "measurement" && input.hasUnsavedMeasurementChanges) {
    return "Save measurement changes before creating a proposal";
  }
  if (activeBlockerId) {
    const item = deriveChecklistItems(input, activeBlockerId).find(
      (i) => i.id === activeBlockerId
    );
    return item ? `${item.label} needed` : "Complete proposal setup to continue";
  }
  return "Complete proposal setup to continue";
}

/**
 * Derive compact proposal setup checklist state and a single primary next action.
 */
/** Header CTA enablement — same launch actions as checklist primary, no duplicate gates. */
export function isProposalHeaderLaunchEnabled(
  checklist: ProposalSetupChecklistResult,
  options?: { createBlockedOnBoard?: boolean }
): boolean {
  const { primaryAction } = checklist;
  if (primaryAction.disabled) return false;
  const isLaunchAction =
    primaryAction.actionType === "create_proposal" ||
    primaryAction.actionType === "open_builder";
  if (!isLaunchAction) return false;
  if (options?.createBlockedOnBoard && primaryAction.actionType === "create_proposal") {
    return false;
  }
  return true;
}

/** Compact header label aligned with checklist primary action. */
export function proposalHeaderButtonLabel(checklist: ProposalSetupChecklistResult): string {
  const { primaryAction } = checklist;
  if (primaryAction.actionType === "open_builder") return "Open proposal";
  if (primaryAction.actionType === "create_proposal") return "Create proposal";
  return "Proposal";
}

/** Disabled-state title for the header CTA — mirrors checklist guidance. */
export function proposalHeaderButtonTitle(
  checklist: ProposalSetupChecklistResult,
  fallbackTitle?: string | null
): string | undefined {
  if (isProposalHeaderLaunchEnabled(checklist)) {
    return checklist.primaryAction.helperText ?? undefined;
  }
  return (
    checklist.primaryAction.helperText ??
    checklist.statusText ??
    fallbackTitle ??
    undefined
  );
}

export function deriveProposalSetupChecklist(
  input: ProposalSetupChecklistInput
): ProposalSetupChecklistResult {
  const { action: primaryAction, blockerId: activeBlockerId, secondaryActions } =
    derivePrimaryAction(input);

  const items = deriveChecklistItems(input, activeBlockerId);
  const statusText = deriveStatusText(input, activeBlockerId, primaryAction);

  const quiet =
    (setupPrerequisitesMet(input) &&
      (primaryAction.actionType === "create_proposal" ||
        primaryAction.actionType === "open_builder")) ||
    false;

  return {
    items,
    primaryAction,
    secondaryActions,
    statusText,
    quiet,
    activeBlockerId,
  };
}
