/**
 * Phase 11 / Astra G10 — payment-request email orchestration (server-only).
 * Communication never mutates money request identity.
 */

import "server-only";

import { createAcceptedPaymentPublicLink } from "@/app/lib/jobPaymentPublicLink.server";
import {
  buildPaymentRequestEmailContentHash,
  buildPaymentRequestEmailSendIdempotencyKey,
  buildPaymentRecipientDeliveryFieldsFromEmail,
  isPaymentRequestEmailEligibleStatus,
  normalizePaymentRequestEmailNote,
  normalizeRecipientEmailForPaymentDelivery,
} from "@/app/lib/jobPaymentRequestDeliveryTypes";
import {
  countPaymentRequestDeliveryAttempts,
  createPaymentRequestDeliveryAttempted,
  findPaymentRequestDeliveryAttemptByIdempotencyKey,
  markPaymentRequestDeliveryAttemptFailed,
  markPaymentRequestDeliveryAttemptProviderAccepted,
} from "@/app/lib/jobPaymentRequestDeliveryStore.server";
import { buildPaymentRequestEmailTemplate } from "@/app/lib/jobPaymentRequestEmailTemplate";
import {
  mapResendErrorToSafeMessage,
  type ResendSendResult,
} from "@/app/lib/proposalEmailDelivery";
import {
  isProposalEmailDeliveryConfiguredFromEnv,
  resolveProposalEmailDeliveryConfig,
} from "@/app/lib/proposalEmailDelivery.server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";
import { fetchJobContractTotalCents } from "@/app/lib/jobScopeChangePersistence";
import {
  jobPaymentCollectibleRemainingCents,
  jobPaymentWorkspaceGrossCents,
} from "@/app/lib/jobPaymentWorkspace";

export { isProposalEmailDeliveryConfiguredFromEnv as isPaymentRequestEmailDeliveryConfigured };

export type SendPaymentRequestEmailInput = {
  companyId: string;
  jobId: string;
  paymentRequestId: string;
  userId: string;
  origin: string;
  /** Optional note — communication only. */
  contractorNote?: string | null;
  /** Explicit resend generation suffix; omit for first content-keyed send. */
  retrySuffix?: string | null;
  replyTo?: string | null;
};

export type SendPaymentRequestEmailResult =
  | {
      ok: true;
      replayed: boolean;
      attemptId: string;
      attemptNumber: number;
      status: string;
      providerMessageId: string | null;
      publicUrl: string;
      recipientRedacted: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      attemptId?: string;
    };

async function sendResendEmailViaApi(input: {
  resendApiKey: string;
  resendFrom: string;
  replyTo: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<ResendSendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.resendFrom,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
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

async function resolveCanonicalPaymentRecipientEmail(input: {
  companyId: string;
  jobId: string;
  proposalId: string | null;
}): Promise<string | null> {
  const supabase = await createClient();

  if (input.proposalId && isUuidLike(input.proposalId)) {
    const { data: version } = await supabase
      .from("proposal_versions")
      .select("context_echo")
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const echo = version?.context_echo as Record<string, unknown> | null;
    const fromEcho =
      echo && typeof echo.customer_email === "string"
        ? echo.customer_email.trim()
        : "";
    if (fromEcho) return fromEcho;
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("customer_email,customer_id")
    .eq("id", input.jobId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  const fromJob =
    typeof job?.customer_email === "string" ? job.customer_email.trim() : "";
  if (fromJob) return fromJob;

  // Canonical customer record when job snapshot email is empty.
  const customerId =
    typeof job?.customer_id === "string" && isUuidLike(job.customer_id)
      ? job.customer_id
      : null;
  if (customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("email")
      .eq("id", customerId)
      .eq("company_id", input.companyId)
      .maybeSingle();
    const fromCustomer =
      typeof customer?.email === "string" ? customer.email.trim() : "";
    if (fromCustomer) return fromCustomer;
  }

  return null;
}

async function appendPaymentRequestEmailActivity(input: {
  companyId: string;
  jobId: string;
  userId: string;
  eventType: "payment_request_emailed" | "payment_request_email_failed";
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("job_lifecycle_insert_activity", {
      p_company_id: input.companyId,
      p_job_id: input.jobId,
      p_event_type: input.eventType,
      p_actor_user_id: input.userId,
      p_payload: input.payload,
      p_occurred_at: new Date().toISOString(),
    });
  } catch {
    // Chronology is best-effort; delivery attempt remains authority for email.
  }
}

/**
 * Email an existing actionable payment request.
 * Never creates/cancels/mutates the money request.
 */
export async function sendPaymentRequestEmailForContractor(
  input: SendPaymentRequestEmailInput
): Promise<SendPaymentRequestEmailResult> {
  const companyId = input.companyId.trim();
  const jobId = input.jobId.trim();
  const paymentRequestId = input.paymentRequestId.trim();
  const userId = input.userId.trim();

  if (
    !isUuidLike(companyId) ||
    !isUuidLike(jobId) ||
    !isUuidLike(paymentRequestId) ||
    !userId
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Payment request email could not be prepared.",
    };
  }

  const config = resolveProposalEmailDeliveryConfig(
    input.origin,
    input.replyTo
  );
  if (!config) {
    return {
      ok: false,
      code: "email_not_configured",
      message: "Email delivery is not configured.",
    };
  }

  const supabase = await createClient();
  const { data: request, error: requestError } = await supabase
    .from("job_payment_requests")
    .select(
      "id,company_id,job_id,proposal_id,amount_cents,kind,status,accepted_total_cents_snapshot"
    )
    .eq("id", paymentRequestId)
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (requestError || !request) {
    return {
      ok: false,
      code: "not_found",
      message: "Payment request was not found.",
    };
  }

  if (!isPaymentRequestEmailEligibleStatus(String(request.status))) {
    return {
      ok: false,
      code: "request_not_emailable",
      message:
        "This payment request is not open for customer payment email.",
    };
  }

  const amountCents = Number(request.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return {
      ok: false,
      code: "invalid_request_amount",
      message: "Payment request amount is unavailable.",
    };
  }

  const rawRecipient = await resolveCanonicalPaymentRecipientEmail({
    companyId,
    jobId,
    proposalId:
      typeof request.proposal_id === "string" ? request.proposal_id : null,
  });
  if (!rawRecipient) {
    return {
      ok: false,
      code: "missing_customer_email",
      message:
        "Add a customer email before this payment request can be emailed. You can still copy the payment link.",
    };
  }

  let normalizedRecipient: string;
  try {
    normalizedRecipient = normalizeRecipientEmailForPaymentDelivery(rawRecipient);
  } catch {
    return {
      ok: false,
      code: "invalid_customer_email",
      message: "Customer email is not valid for delivery.",
    };
  }

  const recipientFields =
    buildPaymentRecipientDeliveryFieldsFromEmail(normalizedRecipient);
  const note = normalizePaymentRequestEmailNote(input.contractorNote);

  const link = await createAcceptedPaymentPublicLink({
    companyId,
    jobId,
    userId,
    origin: config.origin,
  });
  if (!link.ok) {
    return {
      ok: false,
      code: link.code,
      message: link.message,
    };
  }

  const { data: jobRow } = await supabase
    .from("jobs")
    .select("customer_name,title,address_line1,address_city,address_state,address_zip,company_id")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: companyRow } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  const addressParts = [
    jobRow?.address_line1,
    [jobRow?.address_city, jobRow?.address_state].filter(Boolean).join(", "),
    jobRow?.address_zip,
  ]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  const projectAddress = addressParts.join(", ") || null;

  let contractTotalCents: number | null = null;
  let remainingCollectibleCents: number | null = null;
  try {
    contractTotalCents = await fetchJobContractTotalCents(supabase, {
      company_id: companyId,
      job_id: jobId,
    });
    const { data: jobRequests } = await supabase
      .from("job_payment_requests")
      .select("id")
      .eq("company_id", companyId)
      .eq("job_id", jobId);
    const requestIds = (jobRequests ?? [])
      .map((r) => String(r.id))
      .filter((id) => isUuidLike(id));
    let gross = 0;
    if (requestIds.length > 0) {
      const { data: txns } = await supabase
        .from("job_payment_transactions")
        .select(
          "id,payment_request_id,kind,status,amount_cents,occurred_at,provider_event_id,provider_payment_intent_id"
        )
        .in("payment_request_id", requestIds);
      gross = jobPaymentWorkspaceGrossCents((txns ?? []) as never);
    }
    remainingCollectibleCents = jobPaymentCollectibleRemainingCents({
      contractTotalCents,
      receivedGrossCents: gross,
    });
  } catch {
    contractTotalCents = null;
    remainingCollectibleCents = null;
  }

  const template = buildPaymentRequestEmailTemplate({
    origin: config.origin,
    rawToken: link.publicUrl.split("/p/")[1] ?? "",
    companyName:
      typeof companyRow?.name === "string" ? companyRow.name : null,
    customerName:
      typeof jobRow?.customer_name === "string" ? jobRow.customer_name : null,
    projectAddress,
    kind: String(request.kind),
    amountCents,
    contractorNote: note,
    contractTotalCents,
    remainingCollectibleCents,
  });

  // Prefer mint raw token from link URL
  const tokenMatch = link.publicUrl.match(/\/p\/([^/?#]+)/);
  const rawToken = tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : "";
  const finalTemplate = rawToken
    ? buildPaymentRequestEmailTemplate({
        origin: config.origin,
        rawToken,
        companyName:
          typeof companyRow?.name === "string" ? companyRow.name : null,
        customerName:
          typeof jobRow?.customer_name === "string"
            ? jobRow.customer_name
            : null,
        projectAddress,
        kind: String(request.kind),
        amountCents,
        contractorNote: note,
        contractTotalCents,
        remainingCollectibleCents,
      })
    : template;

  const contentHash = buildPaymentRequestEmailContentHash({
    subject: finalTemplate.subject,
    body: finalTemplate.text,
    note,
  });
  const idempotencyKey = buildPaymentRequestEmailSendIdempotencyKey({
    paymentRequestId,
    recipientHash: recipientFields.recipient_email_hash,
    contentHash,
    retrySuffix: input.retrySuffix,
  });

  const existing = await findPaymentRequestDeliveryAttemptByIdempotencyKey({
    company_id: companyId,
    idempotency_key: idempotencyKey,
  });
  if (existing) {
    if (
      existing.status === "provider_accepted" ||
      existing.status === "delivered" ||
      existing.status === "delayed" ||
      existing.provider_message_id
    ) {
      return {
        ok: true,
        replayed: true,
        attemptId: existing.id,
        attemptNumber: existing.attempt_number,
        status: existing.status,
        providerMessageId: existing.provider_message_id,
        publicUrl: link.publicUrl,
        recipientRedacted: existing.recipient_email_redacted,
      };
    }
    if (existing.status === "failed" || existing.status === "bounced") {
      // Same content failed — caller should supply retrySuffix for a new attempt.
      return {
        ok: false,
        code: "prior_attempt_failed",
        message:
          existing.error_message_safe ??
          "A previous send with the same content failed. Retry email to try again.",
        attemptId: existing.id,
      };
    }
  }

  const priorCount = await countPaymentRequestDeliveryAttempts({
    company_id: companyId,
    payment_request_id: paymentRequestId,
  });
  const attemptNumber = priorCount + 1;

  let attempt;
  try {
    attempt = await createPaymentRequestDeliveryAttempted({
      company_id: companyId,
      job_id: jobId,
      payment_request_id: paymentRequestId,
      recipient_email_hash: recipientFields.recipient_email_hash,
      recipient_email_redacted: recipientFields.recipient_email_redacted,
      contractor_note_snapshot: note,
      token_prefix: link.tokenPrefix,
      idempotency_key: idempotencyKey,
      attempt_number: attemptNumber,
      subject_snapshot: finalTemplate.subject,
      body_snapshot: finalTemplate.text,
      metadata_json: {
        source: "payment_request_email",
        kind: String(request.kind),
        amount_cents: amountCents,
      },
      created_by: userId,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";
    if (code === "23505") {
      const raced = await findPaymentRequestDeliveryAttemptByIdempotencyKey({
        company_id: companyId,
        idempotency_key: idempotencyKey,
      });
      if (raced) {
        return {
          ok: true,
          replayed: true,
          attemptId: raced.id,
          attemptNumber: raced.attempt_number,
          status: raced.status,
          providerMessageId: raced.provider_message_id,
          publicUrl: link.publicUrl,
          recipientRedacted: raced.recipient_email_redacted,
        };
      }
    }
    return {
      ok: false,
      code: "delivery_persist_failed",
      message: "Could not record the email attempt.",
    };
  }

  const sendResult = await sendResendEmailViaApi({
    resendApiKey: config.resendApiKey,
    resendFrom: config.resendFrom,
    replyTo: config.replyTo,
    to: normalizedRecipient,
    subject: finalTemplate.subject,
    html: finalTemplate.html,
    text: finalTemplate.text,
    idempotencyKey,
  });

  if (!sendResult.ok) {
    await markPaymentRequestDeliveryAttemptFailed({
      company_id: companyId,
      attempt_id: attempt.id,
      error_code: sendResult.code,
      error_message_safe: sendResult.message,
    });
    await appendPaymentRequestEmailActivity({
      companyId,
      jobId,
      userId,
      eventType: "payment_request_email_failed",
      payload: {
        payment_request_id: paymentRequestId,
        attempt_id: attempt.id,
        error_code: sendResult.code,
      },
    });
    return {
      ok: false,
      code: sendResult.code,
      message: sendResult.message,
      attemptId: attempt.id,
    };
  }

  const accepted = await markPaymentRequestDeliveryAttemptProviderAccepted({
    company_id: companyId,
    attempt_id: attempt.id,
    provider_message_id: sendResult.messageId,
  });

  await appendPaymentRequestEmailActivity({
    companyId,
    jobId,
    userId,
    eventType: "payment_request_emailed",
    payload: {
      payment_request_id: paymentRequestId,
      attempt_id: accepted.id,
      amount_cents: amountCents,
      kind: String(request.kind),
    },
  });

  return {
    ok: true,
    replayed: false,
    attemptId: accepted.id,
    attemptNumber: accepted.attempt_number,
    status: accepted.status,
    providerMessageId: accepted.provider_message_id,
    publicUrl: link.publicUrl,
    recipientRedacted: accepted.recipient_email_redacted,
  };
}
