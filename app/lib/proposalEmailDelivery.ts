/**
 * R18D3B — Pure injectable proposal email send orchestration.
 *
 * Freeze/reuse/refreeze snapshot, fresh mint-at-send, delivery attempt audit, Resend call.
 * No proposals.status, proposal_events, or job board mutation.
 */

import { createHash } from "node:crypto";

import { isUuidLike } from "@/app/lib/uuid";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalDeliveryAttemptRow } from "@/app/lib/proposalDeliveryAttemptTypes";
import { buildRecipientDeliveryFieldsFromEmail } from "@/app/lib/proposalDeliveryAttemptTypes";
import { buildProposalEmailTemplate } from "@/app/lib/proposalEmailTemplate";
import {
  resolveSendGateCustomerFirstName,
  resolveSendGateProjectAddress,
} from "@/app/lib/proposalSendGateReadiness";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import { deriveProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import { isSendPrepReadinessBlocking } from "@/app/lib/proposalSendGateReadiness";
import {
  hashNormalizedRecipientEmailSha256,
  normalizeRecipientEmail,
  resolveProposalSendSnapshotVersion,
  SEND_PREP_ERROR_MESSAGE,
  SEND_PREP_FREEZE_UNAVAILABLE_MESSAGE,
  SEND_PREP_MISSING_RECIPIENT_MESSAGE,
  SEND_PREP_READINESS_BLOCKED_MESSAGE,
  type ResolveProposalSendSnapshotDeps,
  type SendPrepSnapshotStatus,
} from "@/app/lib/proposalSendPrep";
import { buildPublicReviewLinkExpiresAt } from "@/app/lib/proposalPublicReviewLink";

export type ProposalEmailSendMintResult =
  | {
      ok: true;
      raw_token: string;
      token_prefix: string;
      expires_at: string;
      token_id: string;
    }
  | { ok: false; code: string };

export const EMAIL_SEND_MINT_METADATA = {
  source: "contractor_email_send",
  channel: "customer_email",
} as const;

export const EMAIL_SEND_ATTEMPT_METADATA = {
  source: "r18d3b_email_send",
} as const;

export const PROPOSAL_EMAIL_SEND_ERROR_MESSAGE =
  "We couldn't send the proposal email yet. Check the proposal and try again.";

export const PROPOSAL_EMAIL_SEND_NOT_CONFIGURED_MESSAGE =
  "Email delivery is not configured yet.";

export const PROPOSAL_EMAIL_SEND_IN_PROGRESS_MESSAGE =
  "A proposal email send is already in progress. Please wait a moment and try again.";

export const PROPOSAL_EMAIL_SEND_PROVIDER_ERROR_MESSAGE =
  "The email provider could not send this message. Try again in a few minutes.";

export const PROPOSAL_EMAIL_SEND_DOMAIN_ERROR_MESSAGE =
  "Email delivery is not configured correctly. Contact support if this continues.";

export const PROPOSAL_EMAIL_SEND_RATE_LIMIT_MESSAGE =
  "Too many email requests right now. Please wait and try again.";

export const PROPOSAL_EMAIL_SEND_PERSIST_PENDING_MESSAGE =
  "The email may have been sent, but delivery status could not be confirmed. Try again only if the customer did not receive it.";

export const PROPOSAL_EMAIL_MAX_SUBJECT_LENGTH = 200;
export const PROPOSAL_EMAIL_MAX_BODY_LENGTH = 10_000;

export type ProposalEmailDeliveryConfig = {
  resendApiKey: string;
  resendFrom: string;
  origin: string;
  replyTo?: string | null;
};

export type SendProposalEmailInput = {
  companyId: string;
  userId: string;
  jobId: string;
  proposalId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  origin: string;
  pricingStale?: boolean;
};

export type SendProposalEmailSuccess = {
  ok: true;
  deliveryAttemptId: string;
  deliveryStatus: "provider_accepted";
  recipientDisplay: string;
  deliveryEnabled: true;
  snapshotStatus?: SendPrepSnapshotStatus;
};

export type SendProposalEmailFailure = {
  ok: false;
  code: string;
  message: string;
  deliveryAttemptId?: string;
  deliveryStatus?: "failed";
};

export type SendProposalEmailResult = SendProposalEmailSuccess | SendProposalEmailFailure;

export type ResendSendResult =
  | { ok: true; messageId: string }
  | { ok: false; code: string; message: string; statusCode?: number | null };

export type SendProposalEmailDeps = ResolveProposalSendSnapshotDeps & {
  getDraftGraph: (companyId: string, proposalId: string) => Promise<ProposalDraftGraph | null>;
  mintToken: (input: ProposalPublicAccessMintRequest) => Promise<ProposalEmailSendMintResult>;
  getEmailConfig: () => ProposalEmailDeliveryConfig | null;
  createDeliveryAttempt: (input: {
    company_id: string;
    proposal_id: string;
    proposal_version_id: string;
    proposal_public_access_token_id: string;
    token_prefix: string;
    recipient_email_hash: string;
    recipient_email_redacted: string | null;
    idempotency_key: string;
    subject_snapshot: string;
    body_snapshot: string;
    metadata_json: Record<string, unknown>;
    created_by: string;
  }) => Promise<ProposalDeliveryAttemptRow>;
  findDeliveryAttemptByIdempotencyKey: (input: {
    company_id: string;
    idempotency_key: string;
  }) => Promise<ProposalDeliveryAttemptRow | null>;
  markDeliveryAttemptProviderAccepted: (input: {
    company_id: string;
    idempotency_key: string;
    provider_message_id: string;
  }) => Promise<ProposalDeliveryAttemptRow>;
  markDeliveryAttemptFailed: (input: {
    company_id: string;
    idempotency_key?: string;
    attempt_id?: string;
    error_code?: string | null;
    error_message_safe: string;
  }) => Promise<ProposalDeliveryAttemptRow>;
  sendResendEmail: (input: {
    config: ProposalEmailDeliveryConfig;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<ResendSendResult>;
  isDuplicateIdempotencyError: (error: unknown) => boolean;
  now?: () => Date;
};

function failure(
  message: string,
  code: string,
  extra: Partial<SendProposalEmailFailure> = {}
): SendProposalEmailFailure {
  return { ok: false, message, code, ...extra };
}

export function isProposalEmailDeliveryConfiguredFromEnv(env: {
  RESEND_API_KEY?: string | null;
  RESEND_FROM?: string | null;
}): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM?.trim());
}

export function normalizeProposalEmailSubject(subject: string): string | null {
  const trimmed = subject.trim();
  if (!trimmed || trimmed.length > PROPOSAL_EMAIL_MAX_SUBJECT_LENGTH) {
    return null;
  }
  return trimmed;
}

export function normalizeProposalEmailBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > PROPOSAL_EMAIL_MAX_BODY_LENGTH) {
    return null;
  }
  return trimmed;
}

export function buildProposalEmailContentHash(subject: string, body: string): string {
  const normalized = `${subject.trim()}\n---\n${body.trim()}`;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function buildProposalEmailSendIdempotencyKey(input: {
  proposalId: string;
  proposalVersionId: string;
  recipientEmailHash: string;
  subject: string;
  body: string;
  retrySuffix?: string;
}): string {
  const contentHash = buildProposalEmailContentHash(input.subject, input.body).slice(0, 16);
  const recipientPrefix = input.recipientEmailHash.slice(0, 8);
  const base = `prop-email-send/v1/${input.proposalId}/${input.proposalVersionId}/${recipientPrefix}/${contentHash}`;
  const key = input.retrySuffix ? `${base}/retry/${input.retrySuffix}` : base;
  return key.length <= 256 ? key : key.slice(0, 256);
}

function successFromAttempt(
  attempt: ProposalDeliveryAttemptRow,
  snapshotStatus?: SendPrepSnapshotStatus
): SendProposalEmailSuccess {
  return {
    ok: true,
    deliveryAttemptId: attempt.id,
    deliveryStatus: "provider_accepted",
    recipientDisplay: attempt.recipient_email_redacted ?? "Customer",
    deliveryEnabled: true,
    snapshotStatus,
  };
}

function inFlightFailure(attempt: ProposalDeliveryAttemptRow): SendProposalEmailFailure {
  return failure(PROPOSAL_EMAIL_SEND_IN_PROGRESS_MESSAGE, "send_in_progress", {
    deliveryAttemptId: attempt.id,
    deliveryStatus: "failed",
  });
}

export async function sendProposalEmail(
  input: SendProposalEmailInput,
  deps: SendProposalEmailDeps
): Promise<SendProposalEmailResult> {
  const companyId = input.companyId.trim();
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId.trim();
  const userId = input.userId.trim();
  const origin = input.origin.trim();
  const recipientEmail = normalizeRecipientEmail(input.recipientEmail);
  const subject = normalizeProposalEmailSubject(input.subject);
  const body = normalizeProposalEmailBody(input.body);

  if (!isUuidLike(companyId) || !isUuidLike(proposalId) || !isUuidLike(jobId) || userId.length === 0) {
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "invalid_request");
  }

  if (!origin) {
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "public_url_unavailable");
  }

  if (!recipientEmail) {
    return failure(SEND_PREP_MISSING_RECIPIENT_MESSAGE, "missing_recipient");
  }

  if (!subject || !body) {
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "invalid_message");
  }

  const config = deps.getEmailConfig();
  if (!config?.resendApiKey || !config.resendFrom) {
    return failure(PROPOSAL_EMAIL_SEND_NOT_CONFIGURED_MESSAGE, "email_delivery_not_configured");
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
    return failure(snapshotResult.message, snapshotResult.code ?? "snapshot_failed");
  }

  const proposalVersionId = snapshotResult.proposalVersionId;
  const snapshotStatus = snapshotResult.snapshotStatus;

  let recipientEmailHash: string;
  let recipientFields: ReturnType<typeof buildRecipientDeliveryFieldsFromEmail>;
  try {
    recipientEmailHash = hashNormalizedRecipientEmailSha256(recipientEmail);
    recipientFields = buildRecipientDeliveryFieldsFromEmail(recipientEmail);
  } catch {
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "invalid_recipient");
  }

  let idempotencyKey = buildProposalEmailSendIdempotencyKey({
    proposalId,
    proposalVersionId,
    recipientEmailHash,
    subject,
    body,
  });

  const existingAttempt = await deps.findDeliveryAttemptByIdempotencyKey({
    company_id: companyId,
    idempotency_key: idempotencyKey,
  });

  if (existingAttempt?.status === "provider_accepted") {
    return successFromAttempt(existingAttempt, snapshotStatus);
  }

  if (existingAttempt?.status === "attempted") {
    return inFlightFailure(existingAttempt);
  }

  if (existingAttempt?.status === "failed") {
    idempotencyKey = buildProposalEmailSendIdempotencyKey({
      proposalId,
      proposalVersionId,
      recipientEmailHash,
      subject,
      body,
      retrySuffix: existingAttempt.id,
    });
  }

  const mintResult = await deps.mintToken({
    company_id: companyId,
    proposal_id: proposalId,
    proposal_version_id: proposalVersionId,
    expires_at: buildPublicReviewLinkExpiresAt(deps.now?.()),
    recipient_email_hash: recipientEmailHash,
    metadata_json: { ...EMAIL_SEND_MINT_METADATA },
    created_by: userId,
  });

  if (!mintResult.ok) {
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "mint_failed");
  }

  const contextEcho =
    graph.version.context_echo != null &&
    typeof graph.version.context_echo === "object" &&
    !Array.isArray(graph.version.context_echo)
      ? (graph.version.context_echo as Record<string, unknown>)
      : null;
  const companyNameFromEcho = contextEcho
    ? String(contextEcho.company_name ?? "").trim() || null
    : null;
  const customerNameFromEcho = contextEcho
    ? String(contextEcho.customer_name ?? "").trim() || null
    : null;

  const emailTemplate = buildProposalEmailTemplate({
    origin,
    rawToken: mintResult.raw_token,
    subject,
    body,
    companyName: companyNameFromEcho,
    customerFirstName: resolveSendGateCustomerFirstName(customerNameFromEcho),
    projectAddress: resolveSendGateProjectAddress(graph),
  });

  let attempt: ProposalDeliveryAttemptRow;
  try {
    attempt = await deps.createDeliveryAttempt({
      company_id: companyId,
      proposal_id: proposalId,
      proposal_version_id: proposalVersionId,
      proposal_public_access_token_id: mintResult.token_id,
      token_prefix: mintResult.token_prefix,
      recipient_email_hash: recipientFields.recipient_email_hash,
      recipient_email_redacted: recipientFields.recipient_email_redacted,
      idempotency_key: idempotencyKey,
      subject_snapshot: subject,
      body_snapshot: body,
      metadata_json: { ...EMAIL_SEND_ATTEMPT_METADATA },
      created_by: userId,
    });
  } catch (error) {
    if (deps.isDuplicateIdempotencyError(error)) {
      const duplicate = await deps.findDeliveryAttemptByIdempotencyKey({
        company_id: companyId,
        idempotency_key: idempotencyKey,
      });
      if (duplicate?.status === "provider_accepted") {
        return successFromAttempt(duplicate, snapshotStatus);
      }
      if (duplicate?.status === "attempted") {
        return inFlightFailure(duplicate);
      }
    }
    return failure(PROPOSAL_EMAIL_SEND_ERROR_MESSAGE, "delivery_attempt_insert_failed");
  }

  const resendResult = await deps.sendResendEmail({
    config,
    to: recipientEmail,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
    idempotencyKey,
  });

  if (!resendResult.ok) {
    try {
      const failedAttempt = await deps.markDeliveryAttemptFailed({
        company_id: companyId,
        attempt_id: attempt.id,
        error_code: resendResult.code,
        error_message_safe: resendResult.message,
      });
      return failure(resendResult.message, resendResult.code, {
        deliveryAttemptId: failedAttempt.id,
        deliveryStatus: "failed",
      });
    } catch {
      return failure(resendResult.message, resendResult.code, {
        deliveryAttemptId: attempt.id,
        deliveryStatus: "failed",
      });
    }
  }

  try {
    const acceptedAttempt = await deps.markDeliveryAttemptProviderAccepted({
      company_id: companyId,
      idempotency_key: idempotencyKey,
      provider_message_id: resendResult.messageId,
    });
    return successFromAttempt(acceptedAttempt, snapshotStatus);
  } catch {
    return failure(PROPOSAL_EMAIL_SEND_PERSIST_PENDING_MESSAGE, "provider_accepted_persist_pending", {
      deliveryAttemptId: attempt.id,
    });
  }
}

export function mapResendErrorToSafeMessage(input: {
  statusCode?: number | null;
  name?: string | null;
  message?: string | null;
}): { code: string; message: string } {
  const statusCode = input.statusCode ?? null;
  const name = (input.name ?? "").trim();
  const message = (input.message ?? "").trim();

  if (statusCode === 401 || name === "missing_api_key" || name === "invalid_api_key") {
    return {
      code: "email_delivery_not_configured",
      message: PROPOSAL_EMAIL_SEND_NOT_CONFIGURED_MESSAGE,
    };
  }

  if (statusCode === 403 || /domain is not verified|verify a domain/i.test(message)) {
    return {
      code: "email_delivery_domain_error",
      message: PROPOSAL_EMAIL_SEND_DOMAIN_ERROR_MESSAGE,
    };
  }

  if (statusCode === 429 || name.includes("quota") || name === "rate_limit_exceeded") {
    return {
      code: "email_delivery_rate_limited",
      message: PROPOSAL_EMAIL_SEND_RATE_LIMIT_MESSAGE,
    };
  }

  if (statusCode != null && statusCode >= 500) {
    return {
      code: "email_provider_unavailable",
      message: PROPOSAL_EMAIL_SEND_PROVIDER_ERROR_MESSAGE,
    };
  }

  return {
    code: "email_provider_rejected",
    message: PROPOSAL_EMAIL_SEND_PROVIDER_ERROR_MESSAGE,
  };
}

export function isProposalDeliveryAttemptDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";

  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}
