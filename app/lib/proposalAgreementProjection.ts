/**
 * Phase 1 — Shared agreement truth projection (read model only).
 *
 * Interprets canonical pointers + acceptance/signature rows consistently across
 * Board, Job Card, Preview, Proposals, Customer workspace, Activity, and Public.
 * Does not write jobs.stage, create a second state authority, or invent
 * signature-required policy. Signature is optional evidence only.
 */

import {
  resolveProposalAcceptanceAttentionAction,
  type ProposalAcceptanceAttentionAction,
  type ProposalAcceptanceAmbiguityReason,
  type ProposalAcceptanceGuardResult,
} from "@/app/lib/proposalAcceptanceTypes";
import { isMutableDraftDirtyAfterSentFreeze } from "@/app/lib/proposalContractorLifecycle";
import { isUuidLike } from "@/app/lib/uuid";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import {
  resolveCanonicalJobActionEligibilityFromFacts,
  type CanonicalJobActionEligibility,
} from "@/app/lib/jobLifecycleActionEligibility";

export const AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL =
  "Customer accepted · Awaiting approval" as const;

export const AGREEMENT_JOB_CARD_ACCEPTED_HEADING =
  "Customer accepted proposal" as const;

export const AGREEMENT_JOB_CARD_AWAITING_APPROVAL =
  "Awaiting contractor approval" as const;

export const AGREEMENT_JOB_CARD_RECONCILE_HEADING =
  "Acceptance is recorded, but job status needs reconciliation." as const;

export const AGREEMENT_PUBLIC_ACCEPT_RECORDED =
  "Your acceptance is recorded." as const;

export const AGREEMENT_PUBLIC_ACCEPT_NEXT =
  "The contractor will confirm scheduling." as const;

export const AGREEMENT_PUBLIC_SUPERSEDED_MESSAGE =
  "A newer proposal is available. Open the current proposal to continue." as const;

export type AgreementAcceptanceFact = {
  id: string;
  proposalId: string;
  proposalVersionId: string;
  optionId?: string | null;
  optionLabel?: string | null;
  acceptedTotalCents?: number | null;
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  guardResult: Exclude<ProposalAcceptanceGuardResult, "invalid">;
  ambiguityReason?: ProposalAcceptanceAmbiguityReason | string | null;
  confirmedAt?: string | null;
};

export type AgreementSignatureFact = {
  id: string;
  acceptanceId: string;
  proposalId?: string | null;
  signedAt?: string | null;
};

export type AgreementProjectionInput = {
  canonicalJobStage: string | null | undefined;
  jobDisposition?: string | null;
  latestSentVersionId?: string | null;
  latestSentVersionNumber?: number | null;
  latestSentFrozenAt?: string | null;
  currentDraftVersionId?: string | null;
  draftContentChangedAt?: string | null;
  /** Viewing a specific frozen version (sent-record / superseded history). */
  viewingVersionId?: string | null;
  viewingVersionNumber?: number | null;
  acceptance?: AgreementAcceptanceFact | null;
  signature?: AgreementSignatureFact | null;
  /** Historical rows classified valid_review_required / older_sent_version. */
  classifyHistoricalOnly?: boolean;
};

export type AgreementPreviewChromeKind =
  | "never_sent"
  | "current_sent"
  | "accepted"
  | "signed"
  | "editing_revision"
  | "superseded_previous"
  | "sent_record";

export type AgreementSurfaceMode =
  | "none"
  | "sent_waiting"
  | "accepted_awaiting_approval"
  | "accepted_signed_awaiting_approval"
  | "approved"
  | "reconciliation_required"
  | "historical_review_required";

export type ProposalAgreementProjection = {
  operationalStage: string;
  hasLatestSent: boolean;
  latestSentVersionId: string | null;
  latestSentVersionNumber: number | null;
  accepted: boolean;
  acceptedVersionId: string | null;
  acceptedVersionNumber: number | null;
  acceptedOptionLabel: string | null;
  acceptedAt: string | null;
  signed: boolean;
  signatureId: string | null;
  signedAt: string | null;
  draftDirtyAfterLatestSent: boolean;
  supersededView: boolean;
  surfaceMode: AgreementSurfaceMode;
  attentionAction: ProposalAcceptanceAttentionAction;
  approvalEligible: boolean;
  eligibility: CanonicalJobActionEligibility;
  previewChromeKind: AgreementPreviewChromeKind;
  previewStatusLabel: string;
  suppressOrdinarySend: boolean;
  boardAttentionLabel: string | null;
  jobCardHeading: string | null;
  jobCardSupporting: string | null;
  jobCardShowApprove: boolean;
  jobCardTreatment: "none" | "normal" | "signed_support" | "warning";
  customerWorkspaceAcceptedLabel: string | null;
  publicAcceptedTitle: string | null;
  publicAcceptedNext: string | null;
  historicalValidReviewRequired: boolean;
};

function hasId(value: string | null | undefined): boolean {
  const id = String(value ?? "").trim();
  return id.length > 0 && isUuidLike(id);
}

function normStage(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatVersionSuffix(versionNumber: number | null | undefined): string {
  if (
    versionNumber == null ||
    !Number.isFinite(versionNumber) ||
    versionNumber <= 0
  ) {
    return "";
  }
  return ` · Version ${Math.floor(versionNumber)}`;
}

export function formatAgreementPreviewStatusLabel(input: {
  kind: AgreementPreviewChromeKind;
  versionNumber?: number | null;
  lastSentVersionNumber?: number | null;
}): string {
  const v = formatVersionSuffix(input.versionNumber);
  switch (input.kind) {
    case "never_sent":
      return "Draft · Not sent";
    case "current_sent":
    case "sent_record":
      return `Sent proposal${v}`;
    case "accepted":
      return `Accepted proposal${v}`;
    case "signed":
      return `Signed proposal${v}`;
    case "editing_revision": {
      const last = formatVersionSuffix(input.lastSentVersionNumber).replace(
        /^ · /,
        ""
      );
      return last
        ? `Editing revision · Last sent: ${last}`
        : "Editing revision";
    }
    case "superseded_previous": {
      const replaced = formatVersionSuffix(input.lastSentVersionNumber).replace(
        /^ · /,
        ""
      );
      return replaced
        ? `Previous version · Replaced by ${replaced}`
        : "Previous version · Replaced";
    }
    default:
      return "Draft · Not sent";
  }
}

/**
 * Pure agreement projection. Callers supply already-loaded canonical facts.
 * Signature never gates approval eligibility.
 */
export function projectProposalAgreement(
  input: AgreementProjectionInput
): ProposalAgreementProjection {
  const stage = normStage(input.canonicalJobStage) || "intake";
  const latestSentVersionId = hasId(input.latestSentVersionId)
    ? String(input.latestSentVersionId).trim()
    : null;
  const latestSentVersionNumber =
    input.latestSentVersionNumber != null &&
    Number.isFinite(input.latestSentVersionNumber)
      ? Math.floor(input.latestSentVersionNumber)
      : null;
  const acceptance = input.acceptance ?? null;
  const signature = input.signature ?? null;
  const accepted = acceptance !== null;
  const acceptedVersionId = acceptance
    ? String(acceptance.proposalVersionId ?? "").trim() || null
    : null;
  const viewingVersionId = hasId(input.viewingVersionId)
    ? String(input.viewingVersionId).trim()
    : null;
  const viewingVersionNumber =
    input.viewingVersionNumber != null &&
    Number.isFinite(input.viewingVersionNumber)
      ? Math.floor(input.viewingVersionNumber)
      : null;

  const signed = Boolean(
    signature &&
      acceptance &&
      String(signature.acceptanceId).trim() === String(acceptance.id).trim()
  );

  const draftDirtyAfterLatestSent =
    Boolean(latestSentVersionId) &&
    isMutableDraftDirtyAfterSentFreeze({
      draftContentChangedAt: input.draftContentChangedAt,
      latestSentFrozenAt: input.latestSentFrozenAt,
    });

  const attentionAction = resolveProposalAcceptanceAttentionAction({
    canonicalJobStage: stage,
    jobDisposition: input.jobDisposition,
  });

  const historicalValidReviewRequired =
    acceptance?.guardResult === "valid_review_required";

  const ambiguity = String(acceptance?.ambiguityReason ?? "").trim();
  const isOlderSentHistorical = ambiguity === "older_sent_version";
  const isReconcileAnomaly =
    accepted &&
    (ambiguity === "job_not_in_proposal" ||
      (stage === "intake" && attentionAction === "none") ||
      (historicalValidReviewRequired &&
        (ambiguity === "version_pointer_conflict" ||
          ambiguity === "proposal_lineage_conflict")));

  const acceptancePendingApproval =
    accepted &&
    !acceptance?.confirmedAt &&
    attentionAction === "approve_job" &&
    acceptance.guardResult === "valid_clean";

  const eligibility = resolveCanonicalJobActionEligibilityFromFacts({
    stage,
    disposition: input.jobDisposition,
    schedule: null,
    approvalAcceptancePending: acceptancePendingApproval,
  });

  const approvalEligible = eligibility.canApproveJob === true;

  const supersededView = Boolean(
    viewingVersionId &&
      latestSentVersionId &&
      viewingVersionId !== latestSentVersionId
  );

  let previewChromeKind: AgreementPreviewChromeKind = "never_sent";
  if (viewingVersionId && supersededView) {
    previewChromeKind = "superseded_previous";
  } else if (viewingVersionId && !draftDirtyAfterLatestSent) {
    if (signed && acceptedVersionId === viewingVersionId) {
      previewChromeKind = "signed";
    } else if (accepted && acceptedVersionId === viewingVersionId) {
      previewChromeKind = "accepted";
    } else {
      previewChromeKind = "sent_record";
    }
  } else if (!latestSentVersionId) {
    previewChromeKind = "never_sent";
  } else if (accepted && acceptedVersionId === latestSentVersionId) {
    previewChromeKind = signed ? "signed" : "accepted";
  } else if (draftDirtyAfterLatestSent) {
    previewChromeKind = "editing_revision";
  } else {
    previewChromeKind = "current_sent";
  }

  const statusVersionNumber =
    previewChromeKind === "editing_revision" ||
    previewChromeKind === "superseded_previous"
      ? latestSentVersionNumber
      : viewingVersionNumber ??
        (accepted && acceptedVersionId === latestSentVersionId
          ? latestSentVersionNumber
          : latestSentVersionNumber);

  const previewStatusLabel = formatAgreementPreviewStatusLabel({
    kind: previewChromeKind,
    versionNumber:
      previewChromeKind === "editing_revision" ||
      previewChromeKind === "superseded_previous"
        ? latestSentVersionNumber
        : statusVersionNumber,
    lastSentVersionNumber: latestSentVersionNumber,
  });

  const suppressOrdinarySend =
    previewChromeKind === "accepted" ||
    previewChromeKind === "signed" ||
    previewChromeKind === "superseded_previous" ||
    previewChromeKind === "sent_record" ||
    (accepted &&
      acceptedVersionId === latestSentVersionId &&
      acceptance.guardResult === "valid_clean");

  let surfaceMode: AgreementSurfaceMode = "none";
  if (accepted && acceptance?.confirmedAt) {
    surfaceMode = "approved";
  } else if (isReconcileAnomaly) {
    surfaceMode = "reconciliation_required";
  } else if (
    historicalValidReviewRequired &&
    (isOlderSentHistorical || input.classifyHistoricalOnly)
  ) {
    surfaceMode = "historical_review_required";
  } else if (acceptancePendingApproval && signed) {
    surfaceMode = "accepted_signed_awaiting_approval";
  } else if (acceptancePendingApproval) {
    surfaceMode = "accepted_awaiting_approval";
  } else if (latestSentVersionId && !accepted) {
    surfaceMode = "sent_waiting";
  }

  let jobCardTreatment: ProposalAgreementProjection["jobCardTreatment"] =
    "none";
  let jobCardHeading: string | null = null;
  let jobCardSupporting: string | null = null;
  let jobCardShowApprove = false;
  let boardAttentionLabel: string | null = null;

  if (surfaceMode === "reconciliation_required") {
    jobCardTreatment = "warning";
    jobCardHeading = AGREEMENT_JOB_CARD_RECONCILE_HEADING;
    jobCardSupporting = null;
    jobCardShowApprove = false;
  } else if (surfaceMode === "historical_review_required") {
    jobCardTreatment = "warning";
    jobCardHeading = AGREEMENT_JOB_CARD_ACCEPTED_HEADING;
    jobCardSupporting =
      ambiguity === "older_sent_version"
        ? "Customer accepted an earlier proposal"
        : "Review required before approval";
    jobCardShowApprove = false;
  } else if (
    surfaceMode === "accepted_awaiting_approval" ||
    surfaceMode === "accepted_signed_awaiting_approval"
  ) {
    jobCardTreatment =
      surfaceMode === "accepted_signed_awaiting_approval"
        ? "signed_support"
        : "normal";
    jobCardHeading = AGREEMENT_JOB_CARD_ACCEPTED_HEADING;
    jobCardSupporting =
      surfaceMode === "accepted_signed_awaiting_approval"
        ? `Signed\n${AGREEMENT_JOB_CARD_AWAITING_APPROVAL}`
        : AGREEMENT_JOB_CARD_AWAITING_APPROVAL;
    jobCardShowApprove = approvalEligible;
    boardAttentionLabel = AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL;
  }

  const customerWorkspaceAcceptedLabel = accepted
    ? signed
      ? "Customer accepted · Signed"
      : "Customer accepted"
    : null;

  return {
    operationalStage: stage,
    hasLatestSent: Boolean(latestSentVersionId),
    latestSentVersionId,
    latestSentVersionNumber,
    accepted,
    acceptedVersionId,
    acceptedVersionNumber:
      accepted && acceptedVersionId === latestSentVersionId
        ? latestSentVersionNumber
        : null,
    acceptedOptionLabel: acceptance?.optionLabel?.trim() || null,
    acceptedAt: acceptance?.acceptedAt ?? null,
    signed,
    signatureId: signed ? signature?.id ?? null : null,
    signedAt: signed ? signature?.signedAt ?? null : null,
    draftDirtyAfterLatestSent,
    supersededView,
    surfaceMode,
    attentionAction,
    approvalEligible,
    eligibility,
    previewChromeKind,
    previewStatusLabel,
    suppressOrdinarySend,
    boardAttentionLabel,
    jobCardHeading,
    jobCardSupporting,
    jobCardShowApprove,
    jobCardTreatment,
    customerWorkspaceAcceptedLabel,
    publicAcceptedTitle: accepted ? AGREEMENT_PUBLIC_ACCEPT_RECORDED : null,
    publicAcceptedNext: accepted ? AGREEMENT_PUBLIC_ACCEPT_NEXT : null,
    historicalValidReviewRequired,
  };
}

/** Board attention label override for acceptance awaiting contractor approval. */
export function resolveBoardAgreementAttentionLabel(input: {
  primaryType?: string | null;
  attentionAction?: ProposalAcceptanceAttentionAction | null;
  reviewRequired?: boolean;
  confirmedAt?: string | null;
  canonicalJobStage?: string | null;
}): string | null {
  if (input.primaryType !== "acceptance_confirmation_required") return null;
  if (input.confirmedAt) return null;
  if (input.reviewRequired) return null;
  const action =
    input.attentionAction ??
    resolveProposalAcceptanceAttentionAction({
      canonicalJobStage: input.canonicalJobStage,
    });
  if (action !== "approve_job") return null;
  return AGREEMENT_BOARD_ACCEPTED_AWAITING_LABEL;
}

export function isHistoricalValidReviewRequiredAcceptance(input: {
  guardResult?: string | null;
  ambiguityReason?: string | null;
}): boolean {
  return (
    String(input.guardResult ?? "").trim() === "valid_review_required" &&
    String(input.ambiguityReason ?? "").trim().length > 0
  );
}

/** Stage label used by customer workspace — operational stage only. */
export function formatCustomerWorkspaceStageWithAgreement(input: {
  stageLabel: string;
  accepted?: boolean;
  signed?: boolean;
}): string {
  const stage = input.stageLabel.trim() || "Intake";
  if (!input.accepted) return stage;
  if (input.signed) return `${stage} · Customer accepted · Signed`;
  return `${stage} · Customer accepted`;
}

export type { CanonicalJobStage };
