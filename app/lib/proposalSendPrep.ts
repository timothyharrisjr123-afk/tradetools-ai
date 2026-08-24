/**
 * R18D2 — Injectable customer send link prep orchestration.
 *
 * Readiness → freeze if needed → mint customer-send token → return public URL.
 * No email delivery, lifecycle mutation, or Resend.
 */

import { createHash } from "node:crypto";

import { isUuidLike } from "@/app/lib/uuid";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  buildPublicProposalReviewUrl,
  hasPublicProposalSentSnapshot,
  resolvePublicProposalSnapshotVersionId,
} from "@/app/lib/proposalPublicReviewReadiness";
import { buildPublicReviewLinkExpiresAt } from "@/app/lib/proposalPublicReviewLink";
import { deriveProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import { isSendPrepReadinessBlocking } from "@/app/lib/proposalSendGateReadiness";
import type { ProposalIdentityEchoDiff } from "@/app/lib/proposalIdentityEcho";
import { isMutableDraftDirtyAfterSentFreeze } from "@/app/lib/proposalContractorLifecycle";

export const SEND_PREP_MINT_METADATA = {
  source: "contractor_send_prep",
  channel: "customer_link_prep",
} as const;

export const SEND_PREP_ERROR_MESSAGE =
  "We couldn't prepare a customer link yet. Check the proposal and try again.";

export const SEND_PREP_FREEZE_UNAVAILABLE_MESSAGE =
  "Snapshot preparation is not available yet. Try again later.";

export const SEND_PREP_MISSING_RECIPIENT_MESSAGE =
  "Add a customer email before a customer link can be prepared.";

export const SEND_PREP_READINESS_BLOCKED_MESSAGE =
  "Complete pricing and proposal readiness before preparing a customer link.";

export type SendPrepSnapshotStatus = "created" | "reused" | "refrozen";

export type PrepareProposalCustomerSendLinkInput = {
  companyId: string;
  proposalId: string;
  jobId: string;
  userId: string;
  origin: string;
  recipientEmail?: string | null;
  pricingStale?: boolean;
};

export type PrepareProposalCustomerSendLinkSuccess = {
  ok: true;
  publicUrl: string;
  tokenPrefix: string;
  expiresAt: string | null;
  snapshotStatus: SendPrepSnapshotStatus;
  deliveryEnabled: false;
};

export type PrepareProposalCustomerSendLinkFailure = {
  ok: false;
  message: string;
  code?: string;
};

export type PrepareProposalCustomerSendLinkResult =
  | PrepareProposalCustomerSendLinkSuccess
  | PrepareProposalCustomerSendLinkFailure;

export type ProposalSendPrepMintResult =
  | {
      ok: true;
      raw_token: string;
      token_prefix: string;
      expires_at: string;
    }
  | { ok: false; code: string };

export type ResolveProposalSendSnapshotDeps = {
  getProposal: (companyId: string, proposalId: string) => Promise<ProposalRecord | null>;
  getDraftGraph: (companyId: string, proposalId: string) => Promise<ProposalDraftGraph | null>;
  getSentVersionFrozenAt: (
    companyId: string,
    proposalId: string,
    versionId: string
  ) => Promise<string | null>;
  freezeDraft: (input: {
    companyId: string;
    proposalId: string;
    pricingStale?: boolean;
  }) => Promise<{ sentVersionId: string }>;
  isFreezeEnabled: () => boolean;
  ensureProposalIdentityEchoFresh?: (input: {
    companyId: string;
    proposalId: string;
    jobId: string;
    hasSignedSnapshot: boolean;
  }) => Promise<{
    identityRestamped: boolean;
    changedFields: ProposalIdentityEchoDiff[];
  }>;
};

export type ResolveProposalSendSnapshotInput = {
  companyId: string;
  proposalId: string;
  jobId: string;
  pricingStale?: boolean;
};

export type ResolveProposalSendSnapshotSuccess = {
  ok: true;
  proposal: ProposalRecord;
  proposalVersionId: string;
  snapshotStatus: SendPrepSnapshotStatus;
  identityRestamped?: boolean;
  identityChangedFields?: ProposalIdentityEchoDiff[];
};

export type ResolveProposalSendSnapshotFailure = {
  ok: false;
  message: string;
  code?: string;
};

export type ResolveProposalSendSnapshotResult =
  | ResolveProposalSendSnapshotSuccess
  | ResolveProposalSendSnapshotFailure;

export type PrepareProposalCustomerSendLinkDeps = ResolveProposalSendSnapshotDeps & {
  mintToken: (input: ProposalPublicAccessMintRequest) => Promise<ProposalSendPrepMintResult>;
  now?: () => Date;
};

function failure(
  message: string,
  code?: string
): PrepareProposalCustomerSendLinkFailure {
  return code ? { ok: false, message, code } : { ok: false, message };
}

export function normalizeRecipientEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function hashNormalizedRecipientEmailSha256(email: string): string {
  const normalized = normalizeRecipientEmail(email);
  if (!normalized) {
    throw new Error("Recipient email must be normalized before hashing.");
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function hasSignedProposalSnapshot(
  proposal: Pick<ProposalRecord, "signed_version_id">
): boolean {
  const signed = (proposal.signed_version_id ?? "").trim();
  return signed.length > 0 && isUuidLike(signed);
}

export function needsSendPrepRefreeze(input: {
  hasSentSnapshot: boolean;
  hasSignedSnapshot: boolean;
  draftContentChangedAt: string | null;
  sentVersionFrozenAt: string | null;
  pricingStale: boolean;
}): boolean {
  if (input.hasSignedSnapshot) {
    return false;
  }
  if (!input.hasSentSnapshot) {
    return true;
  }
  if (input.pricingStale) {
    return true;
  }
  if (!input.sentVersionFrozenAt) {
    return true;
  }
  if (!input.draftContentChangedAt) {
    return false;
  }
  const draftMs = Date.parse(input.draftContentChangedAt);
  const frozenMs = Date.parse(input.sentVersionFrozenAt);
  if (!Number.isFinite(draftMs) || !Number.isFinite(frozenMs)) {
    return true;
  }
  return isMutableDraftDirtyAfterSentFreeze({
    draftContentChangedAt: input.draftContentChangedAt,
    latestSentFrozenAt: input.sentVersionFrozenAt,
  });
}

export async function resolveProposalSendSnapshotVersion(
  input: ResolveProposalSendSnapshotInput,
  deps: ResolveProposalSendSnapshotDeps
): Promise<ResolveProposalSendSnapshotResult> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId.trim();

  if (!isUuidLike(companyId) || !isUuidLike(proposalId) || !isUuidLike(jobId)) {
    return failure(SEND_PREP_ERROR_MESSAGE, "invalid_request");
  }

  let proposal = await deps.getProposal(companyId, proposalId);
  if (!proposal) {
    return failure(SEND_PREP_ERROR_MESSAGE, "proposal_not_found");
  }

  if ((proposal.job_id ?? "").trim() !== jobId) {
    return failure(SEND_PREP_ERROR_MESSAGE, "binding_mismatch");
  }

  const statusBefore = proposal.status;
  const graph = await deps.getDraftGraph(companyId, proposalId);
  if (!graph) {
    return failure(SEND_PREP_ERROR_MESSAGE, "draft_not_found");
  }

  const hasSentSnapshot = hasPublicProposalSentSnapshot(proposal);
  const hasSignedSnapshot = hasSignedProposalSnapshot(proposal);
  let targetVersionId = resolvePublicProposalSnapshotVersionId(proposal);
  let snapshotStatus: SendPrepSnapshotStatus = "reused";
  let identityRestamped = false;
  let identityChangedFields: ProposalIdentityEchoDiff[] = [];

  if (!hasSignedSnapshot && deps.ensureProposalIdentityEchoFresh) {
    const identityFreshResult = await deps.ensureProposalIdentityEchoFresh({
      companyId,
      proposalId,
      jobId,
      hasSignedSnapshot,
    });
    identityRestamped = identityFreshResult.identityRestamped;
    identityChangedFields = identityFreshResult.changedFields;

    if (identityFreshResult.identityRestamped) {
      proposal = await deps.getProposal(companyId, proposalId);
      if (!proposal) {
        return failure(SEND_PREP_ERROR_MESSAGE, "proposal_not_found");
      }

      if (proposal.status !== statusBefore) {
        return failure(SEND_PREP_ERROR_MESSAGE, "status_changed");
      }
    }
  }

  const shouldRefreeze = needsSendPrepRefreeze({
    hasSentSnapshot,
    hasSignedSnapshot,
    draftContentChangedAt:
      proposal.draft_content_changed_at ?? graph.proposal.draft_content_changed_at ?? null,
    sentVersionFrozenAt: targetVersionId
      ? await deps.getSentVersionFrozenAt(companyId, proposalId, targetVersionId)
      : null,
    pricingStale: input.pricingStale === true,
  });

  if (shouldRefreeze) {
    if (!deps.isFreezeEnabled()) {
      return failure(SEND_PREP_FREEZE_UNAVAILABLE_MESSAGE, "freeze_unavailable");
    }

    await deps.freezeDraft({
      companyId,
      proposalId,
      pricingStale: input.pricingStale,
    });

    proposal = await deps.getProposal(companyId, proposalId);
    if (!proposal) {
      return failure(SEND_PREP_ERROR_MESSAGE, "proposal_not_found");
    }

    if (proposal.status !== statusBefore) {
      return failure(SEND_PREP_ERROR_MESSAGE, "status_changed");
    }

    targetVersionId = resolvePublicProposalSnapshotVersionId(proposal);
    if (!targetVersionId) {
      return failure(SEND_PREP_ERROR_MESSAGE, "snapshot_missing");
    }

    snapshotStatus = hasSentSnapshot ? "refrozen" : "created";
  } else {
    if (!targetVersionId) {
      return failure(SEND_PREP_ERROR_MESSAGE, "snapshot_missing");
    }

    if (!hasSignedSnapshot && hasSentSnapshot) {
      const frozenAt = await deps.getSentVersionFrozenAt(
        companyId,
        proposalId,
        targetVersionId
      );
      if (!frozenAt) {
        return failure(SEND_PREP_ERROR_MESSAGE, "snapshot_metadata_missing");
      }
    }
  }

  return {
    ok: true,
    proposal,
    proposalVersionId: targetVersionId,
    snapshotStatus,
    identityRestamped,
    identityChangedFields,
  };
}

export async function prepareProposalCustomerSendLink(
  input: PrepareProposalCustomerSendLinkInput,
  deps: PrepareProposalCustomerSendLinkDeps
): Promise<PrepareProposalCustomerSendLinkResult> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId.trim();
  const userId = input.userId.trim();
  const origin = input.origin.trim();
  const recipientEmail = normalizeRecipientEmail(input.recipientEmail);

  if (!isUuidLike(companyId) || !isUuidLike(proposalId) || !isUuidLike(jobId) || userId.length === 0) {
    return failure(SEND_PREP_ERROR_MESSAGE, "invalid_request");
  }

  if (origin.length === 0) {
    return failure(SEND_PREP_ERROR_MESSAGE, "invalid_request");
  }

  if (!recipientEmail) {
    return failure(SEND_PREP_MISSING_RECIPIENT_MESSAGE, "missing_recipient");
  }

  const proposal = await deps.getProposal(companyId, proposalId);
  if (!proposal) {
    return failure(SEND_PREP_ERROR_MESSAGE, "proposal_not_found");
  }

  if ((proposal.job_id ?? "").trim() !== jobId) {
    return failure(SEND_PREP_ERROR_MESSAGE, "binding_mismatch");
  }

  const graph = await deps.getDraftGraph(companyId, proposalId);
  if (!graph) {
    return failure(SEND_PREP_ERROR_MESSAGE, "draft_not_found");
  }

  const sendFreezeReadiness = deriveProposalSendFreezeReadiness({
    graph,
    pricingStale: input.pricingStale,
  });

  if (
    isSendPrepReadinessBlocking({
      sendFreezeReadiness,
      previewReadiness: {
        blockingLineCount: sendFreezeReadiness.summary.blockingLineCount,
        pricingComplete: sendFreezeReadiness.summary.pricingComplete,
      },
      recipientEmail,
    })
  ) {
    return failure(SEND_PREP_READINESS_BLOCKED_MESSAGE, "readiness_blocked");
  }

  const snapshotResult = await resolveProposalSendSnapshotVersion(
    {
      companyId,
      proposalId,
      jobId,
      pricingStale: input.pricingStale,
    },
    deps
  );

  if (!snapshotResult.ok) {
    return snapshotResult;
  }

  const targetVersionId = snapshotResult.proposalVersionId;
  const snapshotStatus = snapshotResult.snapshotStatus;

  let recipientEmailHash: string;
  try {
    recipientEmailHash = hashNormalizedRecipientEmailSha256(recipientEmail);
  } catch {
    return failure(SEND_PREP_ERROR_MESSAGE, "invalid_recipient");
  }

  const mintResult = await deps.mintToken({
    company_id: companyId,
    proposal_id: proposalId,
    proposal_version_id: targetVersionId,
    expires_at: buildPublicReviewLinkExpiresAt(deps.now?.()),
    recipient_email_hash: recipientEmailHash,
    metadata_json: { ...SEND_PREP_MINT_METADATA },
    created_by: userId,
  });

  if (!mintResult.ok) {
    return failure(SEND_PREP_ERROR_MESSAGE, "mint_failed");
  }

  const publicUrl = buildPublicProposalReviewUrl(origin, mintResult.raw_token);

  return {
    ok: true,
    publicUrl,
    tokenPrefix: mintResult.token_prefix,
    expiresAt: mintResult.expires_at ?? null,
    snapshotStatus,
    deliveryEnabled: false,
  };
}
