/**
 * Proposal draft entry resolution (3J3B read-only, 3J3C resolve-or-create).
 *
 * 3J3B: resolveProposalDraftEntry — read-only active draft validation.
 * 3J3C: resolveOrCreateProposalDraftEntry — reuse active/listed draft or create once.
 * 3J3D: createNewProposalDraftEntry — always create a distinct draft (bypass reuse).
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  buildCleanDbJobCardHref,
  evaluateDbProposalLaunchSpine,
  type ProductSpineRouteHints,
} from "@/app/lib/productSpine";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import type {
  CreateDraftProposalInput,
  CreateDraftProposalResult,
} from "@/app/lib/proposalRecordStore";
import type {
  ProposalRecord,
  ProposalRecordStatusSummary,
} from "@/app/lib/proposalRecordTypes";
import { ProposalSnapshotGuardError } from "@/app/lib/proposalSnapshotStatusMapper";

export class ProposalDraftEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalDraftEntryError";
  }
}

export type ResolveProposalDraftEntryReason =
  | "no_active_proposal"
  | "proposal_not_found"
  | "wrong_company"
  | "wrong_job"
  | "non_draft_status"
  | "active_draft";

export type ResolveOrCreateProposalDraftEntryReason =
  | ResolveProposalDraftEntryReason
  | "existing_job_draft"
  | "created_draft"
  | "invalid_company_or_job"
  | "missing_customer_id"
  | "missing_template_id"
  | "missing_measurement_record_id"
  | "missing_quantity_context"
  | "db_identity_not_ready"
  | "unconfigured_pricing_policy"
  | "create_failed"
  | "mixed_spine_context"
  | "legacy_spine_blocked"
  | "missing_job_context";

export type ResolveProposalDraftEntryInput = {
  companyId: string;
  jobId: string;
  activeProposalId?: string | null;
};

export type ResolveProposalDraftEntryResult = {
  proposalId: string | null;
  found: boolean;
  reason: ResolveProposalDraftEntryReason;
};

export type ProposalDraftCreatePayload = {
  customer_id: string;
  template_id: string;
  measurement_record_id: string;
  quantity_context: ProposalQuantityPreviewContext;
  /** Template package option selected on the Job Card (optional). */
  selected_template_option_id?: string | null;
  title?: string | null;
  created_by?: string | null;
  context?: CreateDraftProposalInput["context"];
};

export type ResolveOrCreateProposalDraftEntryInput = {
  companyId: string;
  jobId: string;
  activeProposalId?: string | null;
  /** When omitted, create is skipped after active/list checks (fail closed). */
  createPayload?: ProposalDraftCreatePayload | null;
  /** Explicit route/query hints for DB vs legacy spine guardrails. */
  routeHints?: ProductSpineRouteHints | null;
};

export type ResolveOrCreateProposalDraftEntryResult = {
  proposalId: string | null;
  created: boolean;
  reason: ResolveOrCreateProposalDraftEntryReason;
  errorMessage: string | null;
};

export type ProposalDraftEntryDeps = {
  getProposalById: (
    companyId: string,
    proposalId: string
  ) => Promise<ProposalRecord | null>;
};

export type ResolveOrCreateProposalDraftEntryDeps = ProposalDraftEntryDeps & {
  listProposalsForJob: (
    companyId: string,
    jobId: string
  ) => Promise<ProposalRecordStatusSummary[]>;
  createDraftProposal: (
    input: CreateDraftProposalInput
  ) => Promise<CreateDraftProposalResult>;
};

/** Force-create path — never lists or reuses existing drafts. */
export type CreateNewProposalDraftEntryDeps = {
  createDraftProposal: (
    input: CreateDraftProposalInput
  ) => Promise<CreateDraftProposalResult>;
};

export type CreateNewProposalDraftEntryInput = {
  companyId: string;
  jobId: string;
  createPayload: ProposalDraftCreatePayload | null | undefined;
  /** Explicit route/query hints for DB vs legacy spine guardrails. */
  routeHints?: ProductSpineRouteHints | null;
};

export const PROPOSAL_DRAFT_UNCONFIGURED_POLICY_MESSAGE =
  "Configure pricing policy before creating a proposal draft.";

/** Expected business failures — inline UI only; must not trigger dev overlay via console.error. */
export const EXPECTED_PROPOSAL_DRAFT_ENTRY_FAILURE_REASONS = [
  "no_active_proposal",
  "proposal_not_found",
  "wrong_company",
  "wrong_job",
  "non_draft_status",
  "invalid_company_or_job",
  "missing_customer_id",
  "missing_template_id",
  "missing_measurement_record_id",
  "missing_quantity_context",
  "db_identity_not_ready",
  "unconfigured_pricing_policy",
  "mixed_spine_context",
  "legacy_spine_blocked",
  "missing_job_context",
] as const satisfies readonly ResolveOrCreateProposalDraftEntryReason[];

export function isExpectedProposalDraftEntryFailure(
  reason: ResolveOrCreateProposalDraftEntryReason
): boolean {
  return (EXPECTED_PROPOSAL_DRAFT_ENTRY_FAILURE_REASONS as readonly string[]).includes(
    reason
  );
}

export type ProposalLaunchBlockerActionType = "job_card_tab" | "route" | "none";

export type ProposalLaunchBlockerTargetTab = "overview" | "measurements" | "proposals";

export type ProposalLaunchBlockerAction = {
  id: string;
  label: string;
  helperText?: string;
  actionType: ProposalLaunchBlockerActionType;
  targetTab?: ProposalLaunchBlockerTargetTab;
  href?: string;
};

export type ResolveProposalLaunchBlockerActionsContext = {
  catalogNotReady?: boolean;
  templateNotReady?: boolean;
  jobId?: string | null;
};

const JOB_BOARD_HREF = "/tools/roofing/saved";
const CATALOG_HREF = "/tools/roofing/catalog";
const TEMPLATES_HREF = "/tools/roofing/templates";
const PRICING_SETTINGS_HREF = "/tools/settings/pricing";

function goToMeasurementsAction(helperText: string): ProposalLaunchBlockerAction {
  return {
    id: "go-measurements",
    label: "Go to Measurements",
    helperText,
    actionType: "job_card_tab",
    targetTab: "measurements",
  };
}

function returnToJobBoardAction(helperText: string): ProposalLaunchBlockerAction {
  return {
    id: "return-job-board",
    label: "Open Jobs",
    helperText,
    actionType: "route",
    href: JOB_BOARD_HREF,
  };
}

function openDbBackedJobCardAction(jobId: string): ProposalLaunchBlockerAction {
  return {
    id: "open-db-job-card",
    label: "Open Job Card",
    helperText:
      "Open this job from the Job Card before creating a proposal.",
    actionType: "route",
    href: buildJobCardHref(jobId),
  };
}

function openCatalogAction(): ProposalLaunchBlockerAction {
  return {
    id: "open-catalog",
    label: "Open catalog setup",
    helperText: "Finish company catalog setup before creating proposal drafts.",
    actionType: "route",
    href: CATALOG_HREF,
  };
}

function openTemplatesAction(): ProposalLaunchBlockerAction {
  return {
    id: "open-templates",
    label: "Open Templates",
    helperText: "Install or select a proposal template.",
    actionType: "route",
    href: TEMPLATES_HREF,
  };
}

function normalizeProposalLaunchBlockerReason(
  reason: string | null | undefined
): ResolveOrCreateProposalDraftEntryReason | null {
  const key = (reason ?? "").trim();
  if (!key) return null;

  const aliases: Record<string, ResolveOrCreateProposalDraftEntryReason> = {
    missing_customer: "missing_customer_id",
    missing_template: "missing_template_id",
    missing_measurement: "missing_measurement_record_id",
  };

  if (key in aliases) {
    return aliases[key]!;
  }

  const known: ResolveOrCreateProposalDraftEntryReason[] = [
    "no_active_proposal",
    "proposal_not_found",
    "wrong_company",
    "wrong_job",
    "non_draft_status",
    "invalid_company_or_job",
    "missing_customer_id",
    "missing_template_id",
    "missing_measurement_record_id",
    "missing_quantity_context",
    "db_identity_not_ready",
    "unconfigured_pricing_policy",
    "create_failed",
    "mixed_spine_context",
    "legacy_spine_blocked",
    "missing_job_context",
  ];

  if (known.includes(key as ResolveOrCreateProposalDraftEntryReason)) {
    return key as ResolveOrCreateProposalDraftEntryReason;
  }

  return null;
}

/**
 * Map proposal launch failure reasons to user-facing next actions (3J3-smoke-1).
 * Pure — does not navigate or mutate state.
 */
export function resolveProposalLaunchBlockerActions(
  reason: ResolveOrCreateProposalDraftEntryReason | string | null | undefined,
  context?: ResolveProposalLaunchBlockerActionsContext
): ProposalLaunchBlockerAction[] {
  const normalized = normalizeProposalLaunchBlockerReason(reason);

  if (!normalized) {
    if (context?.catalogNotReady) {
      return [openCatalogAction()];
    }
    if (context?.templateNotReady) {
      return [openTemplatesAction()];
    }
    return [];
  }

  switch (normalized) {
    case "db_identity_not_ready": {
      const jobId = normalizeId(context?.jobId);
      if (jobId) {
        return [
          openDbBackedJobCardAction(jobId),
          returnToJobBoardAction("Reopen this job from the Job Board if needed."),
        ];
      }
      return [
        returnToJobBoardAction(
          "Open a job before creating a proposal."
        ),
      ];
    }
    case "mixed_spine_context":
    case "legacy_spine_blocked":
    case "missing_job_context": {
      const jobId = normalizeId(context?.jobId);
      if (jobId) {
        return [
          {
            id: "normalize-db-job-card",
            label: "Open Job Card",
            helperText:
              "Open this job from the Job Card before creating or opening a proposal.",
            actionType: "route",
            href: buildCleanDbJobCardHref(jobId),
          },
          returnToJobBoardAction("Return to Jobs and reopen this job."),
        ];
      }
      return [
        returnToJobBoardAction(
          "Open a job before creating a proposal."
        ),
      ];
    }
    case "missing_measurement_record_id":
    case "missing_quantity_context":
      return [
        goToMeasurementsAction("Save measurement on the Job Card before creating a proposal draft."),
      ];
    case "missing_customer_id":
      return [
        {
          id: "complete-customer",
          label: "Complete Customer Info",
          helperText: "A saved job customer is required before creating a proposal draft.",
          actionType: "job_card_tab",
          targetTab: "overview",
        },
      ];
    case "missing_template_id":
      return [openTemplatesAction()];
    case "unconfigured_pricing_policy":
      return [
        {
          id: "configure-pricing-policy",
          label: "Configure Pricing Policy",
          helperText: "Configure pricing before creating proposal drafts.",
          actionType: "route",
          href: PRICING_SETTINGS_HREF,
        },
      ];
    case "wrong_company":
    case "wrong_job":
    case "proposal_not_found":
    case "non_draft_status":
    case "invalid_company_or_job":
      return [returnToJobBoardAction("Reopen the job from the board.")];
    case "create_failed":
    case "no_active_proposal":
      return [];
    default:
      if (context?.catalogNotReady) {
        return [openCatalogAction()];
      }
      if (context?.templateNotReady) {
        return [openTemplatesAction()];
      }
      return [];
  }
}

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || !isUuidLike(trimmed)) return null;
  return trimmed;
}

function mapCreateFailureMessage(error: unknown): {
  reason: "unconfigured_pricing_policy" | "create_failed";
  message: string;
} {
  const text =
    error instanceof Error ? error.message : "Could not create proposal draft.";
  const lower = text.toLowerCase();
  if (
    error instanceof ProposalSnapshotGuardError ||
    lower.includes("not configured") ||
    lower.includes("placeholder") ||
    lower.includes("pricing policy")
  ) {
    return {
      reason: "unconfigured_pricing_policy",
      message: PROPOSAL_DRAFT_UNCONFIGURED_POLICY_MESSAGE,
    };
  }
  return {
    reason: "create_failed",
    message: text,
  };
}

export function validateProposalDraftCreatePayload(
  payload: ProposalDraftCreatePayload | null | undefined
):
  | { valid: true; payload: ProposalDraftCreatePayload }
  | {
      valid: false;
      reason: Extract<
        ResolveOrCreateProposalDraftEntryReason,
        | "missing_customer_id"
        | "missing_template_id"
        | "missing_measurement_record_id"
        | "missing_quantity_context"
      >;
      errorMessage: string;
    } {
  if (!payload) {
    return {
      valid: false,
      reason: "missing_quantity_context",
      errorMessage: "Proposal draft create input is not available.",
    };
  }

  if (!normalizeId(payload.customer_id)) {
    return {
      valid: false,
      reason: "missing_customer_id",
      errorMessage: "A saved job customer is required before creating a proposal draft.",
    };
  }

  if (!normalizeId(payload.template_id)) {
    return {
      valid: false,
      reason: "missing_template_id",
      errorMessage: "An installed proposal template is required before creating a proposal draft.",
    };
  }

  if (!normalizeId(payload.measurement_record_id)) {
    return {
      valid: false,
      reason: "missing_measurement_record_id",
      errorMessage: "Save measurement on the Job Card before creating a proposal draft.",
    };
  }

  const ctx = payload.quantity_context;
  if (
    !ctx ||
    ctx.measurementHandoff == null ||
    ctx.quantityMap == null
  ) {
    return {
      valid: false,
      reason: "missing_quantity_context",
      errorMessage: "Measurement quantity context is required before creating a proposal draft.",
    };
  }

  return { valid: true, payload };
}

async function findExistingJobDraftId(
  companyId: string,
  jobId: string,
  deps: Pick<ResolveOrCreateProposalDraftEntryDeps, "listProposalsForJob">
): Promise<string | null> {
  const summaries = await deps.listProposalsForJob(companyId, jobId);
  for (const summary of summaries) {
    if (summary.status !== "draft") continue;
    if (normalizeId(summary.job_id) !== jobId) continue;
    const id = normalizeId(summary.id);
    if (id) return id;
  }
  return null;
}

/**
 * Read-only: resolve whether `activeProposalId` is a valid draft for this job.
 * Never writes to the database.
 */
export async function resolveProposalDraftEntry(
  input: ResolveProposalDraftEntryInput,
  deps: ProposalDraftEntryDeps
): Promise<ResolveProposalDraftEntryResult> {
  const companyId = normalizeId(input.companyId);
  const jobId = normalizeId(input.jobId);
  const activeProposalId = normalizeId(input.activeProposalId);

  if (!companyId || !jobId) {
    return { proposalId: null, found: false, reason: "no_active_proposal" };
  }

  if (!activeProposalId) {
    return { proposalId: null, found: false, reason: "no_active_proposal" };
  }

  const proposal = await deps.getProposalById(companyId, activeProposalId);
  if (!proposal) {
    return { proposalId: null, found: false, reason: "proposal_not_found" };
  }

  if (normalizeId(proposal.company_id) !== companyId) {
    return { proposalId: null, found: false, reason: "wrong_company" };
  }

  if (normalizeId(proposal.job_id) !== jobId) {
    return { proposalId: null, found: false, reason: "wrong_job" };
  }

  if (proposal.status !== "draft") {
    return { proposalId: null, found: false, reason: "non_draft_status" };
  }

  return {
    proposalId: activeProposalId,
    found: true,
    reason: "active_draft",
  };
}

async function createDraftFromValidatedPayload(
  companyId: string,
  jobId: string,
  payload: ProposalDraftCreatePayload,
  createDraftProposal: CreateNewProposalDraftEntryDeps["createDraftProposal"],
  logLabel: string
): Promise<ResolveOrCreateProposalDraftEntryResult> {
  try {
    const created = await createDraftProposal({
      company_id: companyId,
      job_id: jobId,
      template_id: payload.template_id,
      customer_id: payload.customer_id,
      measurement_record_id: payload.measurement_record_id,
      quantity_context: payload.quantity_context,
      selected_template_option_id: payload.selected_template_option_id ?? null,
      title: payload.title ?? null,
      created_by: payload.created_by ?? null,
      context: payload.context,
    });

    const proposalId = normalizeId(created.proposal.id);
    if (!proposalId) {
      return {
        proposalId: null,
        created: false,
        reason: "create_failed",
        errorMessage: "Proposal draft was created but returned an invalid id.",
      };
    }

    return {
      proposalId,
      created: true,
      reason: "created_draft",
      errorMessage: null,
    };
  } catch (error) {
    const mapped = mapCreateFailureMessage(error);
    if (!isExpectedProposalDraftEntryFailure(mapped.reason)) {
      console.error(`[${logLabel}] create failed:`, error);
    }
    return {
      proposalId: null,
      created: false,
      reason: mapped.reason,
      errorMessage: mapped.message,
    };
  }
}

/**
 * Always create a distinct proposal draft for the job.
 * Does not reuse active_proposal_id or listed drafts.
 * createDraftProposal updates jobs.active_proposal_id to the new draft.
 */
export async function createNewProposalDraftEntry(
  input: CreateNewProposalDraftEntryInput,
  deps: CreateNewProposalDraftEntryDeps
): Promise<ResolveOrCreateProposalDraftEntryResult> {
  const companyId = normalizeId(input.companyId);
  const jobId = normalizeId(input.jobId);

  if (!companyId || !jobId) {
    return {
      proposalId: null,
      created: false,
      reason: "invalid_company_or_job",
      errorMessage: "A valid company and job are required to create a proposal draft.",
    };
  }

  const spineLaunch = evaluateDbProposalLaunchSpine(input.routeHints ?? null);
  if (!spineLaunch.allowed && input.routeHints) {
    return {
      proposalId: null,
      created: false,
      reason: spineLaunch.reason ?? "mixed_spine_context",
      errorMessage: spineLaunch.errorMessage,
    };
  }

  const validated = validateProposalDraftCreatePayload(input.createPayload);
  if (!validated.valid) {
    const reason =
      input.createPayload == null
        ? "db_identity_not_ready"
        : validated.reason;
    const errorMessage =
      input.createPayload == null
        ? "Save this job from the Job Card with a persisted customer and measurement before creating a proposal draft."
        : validated.errorMessage;
    return {
      proposalId: null,
      created: false,
      reason,
      errorMessage,
    };
  }

  return createDraftFromValidatedPayload(
    companyId,
    jobId,
    validated.payload,
    deps.createDraftProposal,
    "createNewProposalDraftEntry"
  );
}

/**
 * Resolve an existing job draft or create one when no valid draft exists.
 * Never creates when an active or listed draft is found.
 * For an explicit “create another” action, use createNewProposalDraftEntry.
 */
export async function resolveOrCreateProposalDraftEntry(
  input: ResolveOrCreateProposalDraftEntryInput,
  deps: ResolveOrCreateProposalDraftEntryDeps
): Promise<ResolveOrCreateProposalDraftEntryResult> {
  const companyId = normalizeId(input.companyId);
  const jobId = normalizeId(input.jobId);

  if (!companyId || !jobId) {
    return {
      proposalId: null,
      created: false,
      reason: "invalid_company_or_job",
      errorMessage: "A valid company and job are required to open Proposal Builder.",
    };
  }

  const spineLaunch = evaluateDbProposalLaunchSpine(input.routeHints ?? null);
  if (!spineLaunch.allowed && input.routeHints) {
    return {
      proposalId: null,
      created: false,
      reason: spineLaunch.reason ?? "mixed_spine_context",
      errorMessage: spineLaunch.errorMessage,
    };
  }

  const activeResolved = await resolveProposalDraftEntry(
    {
      companyId,
      jobId,
      activeProposalId: input.activeProposalId,
    },
    deps
  );
  if (activeResolved.found && activeResolved.proposalId) {
    return {
      proposalId: activeResolved.proposalId,
      created: false,
      reason: "active_draft",
      errorMessage: null,
    };
  }

  const listedDraftId = await findExistingJobDraftId(companyId, jobId, deps);
  if (listedDraftId) {
    return {
      proposalId: listedDraftId,
      created: false,
      reason: "existing_job_draft",
      errorMessage: null,
    };
  }

  const validated = validateProposalDraftCreatePayload(input.createPayload);
  if (!validated.valid) {
    const reason =
      input.createPayload == null
        ? "db_identity_not_ready"
        : validated.reason;
    const errorMessage =
      input.createPayload == null
        ? "Save this job from the Job Card with a persisted customer and measurement before creating a proposal draft."
        : validated.errorMessage;
    return {
      proposalId: null,
      created: false,
      reason,
      errorMessage,
    };
  }

  return createDraftFromValidatedPayload(
    companyId,
    jobId,
    validated.payload,
    deps.createDraftProposal,
    "resolveOrCreateProposalDraftEntry"
  );
}
