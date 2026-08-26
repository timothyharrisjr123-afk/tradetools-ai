/**
 * R18D3B — Server-only proposal email send wiring.
 */

import "server-only";

import { adaptProposalDraftGraphToBuilderPreview } from "@/app/lib/proposalDraftGraphAdapter";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import {
  createProposalDeliveryAttempted,
  findProposalDeliveryAttemptByIdempotencyKey,
  markProposalDeliveryAttemptFailed,
  markProposalDeliveryAttemptProviderAccepted,
} from "@/app/lib/proposalDeliveryAttemptStore.server";
import { ProposalDeliveryAttemptPersistenceError } from "@/app/lib/proposalDeliveryAttemptPersistence";
import {
  isProposalDeliveryAttemptDuplicateError,
  isProposalEmailDeliveryConfiguredFromEnv,
  mapResendErrorToSafeMessage,
  sendProposalEmail,
  type ProposalEmailDeliveryConfig,
  type ResendSendResult,
  type SendProposalEmailInput,
  type SendProposalEmailResult,
} from "@/app/lib/proposalEmailDelivery";
import { buildProposalSendSnapshotServerDeps } from "@/app/lib/proposalIdentityEcho.server";
import { mintAndSupersedeProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import { getDraftGraph } from "@/app/lib/proposalRecordStore";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import { readDraftOnlineDepositSendReadiness } from "@/app/lib/proposalPaymentTermsPersistence";
import { SEND_GATE_PAYMENTS_SETUP_BODY } from "@/app/lib/proposalPaymentTerms";
import { SEND_GATE_PAYMENTS_SETUP_CODE } from "@/app/lib/proposalPaymentSendReadiness";
import { createClient } from "@/app/lib/supabase/server";

export type {
  SendProposalEmailInput,
  SendProposalEmailResult,
} from "@/app/lib/proposalEmailDelivery";

export { isProposalEmailDeliveryConfiguredFromEnv } from "@/app/lib/proposalEmailDelivery";

export function resolveProposalEmailDeliveryConfig(
  origin: string,
  replyTo?: string | null
): ProposalEmailDeliveryConfig | null {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM?.trim();
  const resolvedOrigin =
    origin.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "";

  if (!resendApiKey || !resendFrom || !resolvedOrigin) {
    return null;
  }

  const normalizedReplyTo = (replyTo ?? "").trim();
  return {
    resendApiKey,
    resendFrom,
    origin: resolvedOrigin,
    replyTo: normalizedReplyTo.length > 0 ? normalizedReplyTo : null,
  };
}

async function sendResendEmailViaApi(input: {
  config: ProposalEmailDeliveryConfig;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<ResendSendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.config.resendFrom,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.config.replyTo ? { reply_to: input.config.replyTo } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string; statusCode?: number }
    | null;

  if (response.ok && payload?.id) {
    return { ok: true, messageId: payload.id };
  }

  const mapped = mapResendErrorToSafeMessage({
    statusCode: payload?.statusCode ?? response.status,
    name: payload?.name ?? null,
    message: payload?.message ?? null,
  });

  return {
    ok: false,
    code: mapped.code,
    message: mapped.message,
    statusCode: payload?.statusCode ?? response.status,
  };
}

export async function sendProposalEmailForContractor(
  input: SendProposalEmailInput & { replyTo?: string | null }
): Promise<SendProposalEmailResult> {
  const supabase = await createClient();

  let pricingStale = input.pricingStale === true;
  if (input.pricingStale == null) {
    const graph = await getDraftGraph(input.companyId, input.proposalId, {
      getSupabase: () => supabase,
    });
    if (graph) {
      const measurement = await getSelectedMeasurementForJob(input.jobId, supabase);
      const adapter = adaptProposalDraftGraphToBuilderPreview(graph);
      pricingStale = deriveProposalPricingStale({
        snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
        currentMeasurementId: measurement?.id ?? null,
        snapshotUpdatedAt: graph.proposal.updated_at,
        measurementUpdatedAt: measurement?.updated_at ?? null,
      }).stale;
    }
  }

  const payments = await readDraftOnlineDepositSendReadiness(supabase, {
    companyId: input.companyId,
    proposalId: input.proposalId,
  });
  if (payments.blocked) {
    return {
      ok: false,
      code: SEND_GATE_PAYMENTS_SETUP_CODE,
      message: SEND_GATE_PAYMENTS_SETUP_BODY,
    };
  }

  const emailConfig = resolveProposalEmailDeliveryConfig(input.origin, input.replyTo);

  return sendProposalEmail(
    { ...input, pricingStale },
    {
      ...buildProposalSendSnapshotServerDeps(supabase),
      mintToken: async (mintInput) => {
        const mintResult = await mintAndSupersedeProposalPublicAccessToken(mintInput);
        if (!mintResult.ok) {
          return mintResult;
        }
        return {
          ok: true,
          raw_token: mintResult.raw_token,
          token_prefix: mintResult.token_prefix,
          expires_at: mintResult.expires_at,
          token_id: mintResult.token_id,
        };
      },
      getEmailConfig: () => emailConfig,
      createDeliveryAttempt: (attemptInput) => createProposalDeliveryAttempted(attemptInput),
      findDeliveryAttemptByIdempotencyKey: (lookupInput) =>
        findProposalDeliveryAttemptByIdempotencyKey(lookupInput),
      markDeliveryAttemptProviderAccepted: (acceptedInput) =>
        markProposalDeliveryAttemptProviderAccepted(acceptedInput),
      markDeliveryAttemptFailed: (failedInput) => markProposalDeliveryAttemptFailed(failedInput),
      sendResendEmail: sendResendEmailViaApi,
      isDuplicateIdempotencyError: (error) =>
        error instanceof ProposalDeliveryAttemptPersistenceError &&
        isProposalDeliveryAttemptDuplicateError(error),
    }
  );
}

export function isProposalEmailDeliveryConfigured(): boolean {
  return isProposalEmailDeliveryConfiguredFromEnv({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
  });
}
