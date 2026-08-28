import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  reconcileJobPaymentRefundResultViaRpc,
  reserveJobPaymentRefundViaRpc,
  type JobPaymentRefundReservationSuccess,
} from "@/app/lib/jobPaymentPersistence";
import {
  JOB_PAYMENT_REFUND_MAX_REASON_LENGTH,
  type JobPaymentRefundStatus,
} from "@/app/lib/jobPaymentTypes";
import {
  createDirectPaymentRefund,
  safeStripeRefundError,
  stripeRefundErrorIsDefinitive,
} from "@/app/lib/jobPaymentStripe.server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string; paymentId: string }>;
};

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "job_not_found") return 404;
  if (code === "invalid_capture" || code === "invalid_payment_request") return 404;
  if (
    code === "amount_exceeds_refundable" ||
    code === "idempotency_mismatch" ||
    code === "idempotency_key_conflict" ||
    code === "account_mismatch" ||
    code === "noncanonical_capture"
  ) {
    return 409;
  }
  return 400;
}

function apiStatus(status: JobPaymentRefundStatus): number {
  if (status === "initiating" || status === "pending" || status === "requires_action") return 202;
  if (status === "failed" || status === "canceled") return 422;
  return 200;
}

function canonicalRefund(
  reserved: JobPaymentRefundReservationSuccess,
  status: JobPaymentRefundStatus = reserved.status,
  providerRefundId: string | null = reserved.provider_refund_id,
  retryable = status === "initiating" || status === "pending" || status === "requires_action"
) {
  return {
    ok: status !== "failed" && status !== "canceled",
    id: reserved.id,
    status,
    amountCents: reserved.amount_cents,
    currency: reserved.currency,
    providerRefundId,
    idempotentReplay: reserved.idempotent_replay,
    processing: status === "initiating" || status === "pending" || status === "requires_action",
    retryable,
  };
}

function stripeStatus(value: unknown): Exclude<JobPaymentRefundStatus, "initiating"> | null {
  return typeof value === "string" &&
    ["pending", "requires_action", "succeeded", "failed", "canceled"].includes(value)
    ? (value as Exclude<JobPaymentRefundStatus, "initiating">)
    : null;
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { jobId, paymentId } = await context.params;
    if (!isUuidLike(jobId) || !isUuidLike(paymentId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const amountCents = body?.amountCents;
    const commandId = typeof body?.commandId === "string" ? body.commandId.trim() : "";
    if (
      !body ||
      !Number.isSafeInteger(amountCents) ||
      amountCents < 1 ||
      !isUuidLike(commandId)
    ) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    if (body.reason != null && typeof body.reason !== "string") {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > JOB_PAYMENT_REFUND_MAX_REASON_LENGTH) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }

    const { data: capture, error: captureError } = await supabase
      .from("job_payment_transactions")
      .select("id,payment_request_id")
      .eq("id", paymentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (captureError || !capture?.payment_request_id) {
      return NextResponse.json({ ok: false, code: "invalid_capture" }, { status: 404 });
    }

    const { data: paymentRequest, error: requestError } = await supabase
      .from("job_payment_requests")
      .select("id")
      .eq("id", capture.payment_request_id)
      .eq("company_id", companyId)
      .eq("job_id", jobId)
      .maybeSingle();
    if (requestError || !paymentRequest) {
      return NextResponse.json(
        { ok: false, code: "invalid_payment_request" },
        { status: 404 }
      );
    }

    const idempotencyKey = `job-refund:${commandId}:v1`;
    const reserved = await reserveJobPaymentRefundViaRpc(supabase, {
      id: commandId,
      companyId,
      jobId,
      paymentRequestId: paymentRequest.id,
      canonicalCaptureTransactionId: paymentId,
      amountCents,
      internalReason: reason || null,
      idempotencyKey,
    });
    if (!reserved.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: reserved.code,
          refundableCents: reserved.refundable_cents,
        },
        { status: statusForCode(reserved.code) }
      );
    }

    if (
      reserved.provider_refund_id ||
      reserved.status === "succeeded" ||
      reserved.status === "failed" ||
      reserved.status === "canceled"
    ) {
      return NextResponse.json(canonicalRefund(reserved), {
        status: apiStatus(reserved.status),
      });
    }

    try {
      const refund = await createDirectPaymentRefund({
        connectedAccountId: reserved.provider_account_id,
        refundCommandId: reserved.id,
        paymentIntentId: reserved.provider_payment_intent_id,
        amountCents: reserved.amount_cents,
        companyId,
        jobId,
        paymentRequestId: paymentRequest.id,
        canonicalCaptureTransactionId: paymentId,
      });
      const actualStatus = stripeStatus(refund.status);
      if (!actualStatus) {
        return NextResponse.json(canonicalRefund(reserved, "initiating", refund.id, true), {
          status: 202,
        });
      }
      const createdAt = new Date(refund.created * 1000).toISOString();
      const chargeId =
        typeof refund.charge === "string" ? refund.charge : refund.charge?.id ?? null;
      const pendingReason = (
        refund as unknown as { pending_reason?: string | null }
      ).pending_reason;
      const reasonCode = refund.failure_reason ?? pendingReason ?? null;
      const reconciled = await reconcileJobPaymentRefundResultViaRpc(createAdminClient(), {
        id: reserved.id,
        providerAccountId: reserved.provider_account_id,
        providerRefundId: refund.id,
        providerChargeId: chargeId,
        status: actualStatus,
        providerReasonCode: reasonCode,
        providerReasonMessage: reasonCode,
        providerCreatedAt: createdAt,
        providerUpdatedAt: createdAt,
      });
      if (!reconciled.ok) {
        return NextResponse.json(canonicalRefund(reserved, "initiating", refund.id, true), {
          status: 202,
        });
      }
      return NextResponse.json(
        canonicalRefund(reserved, reconciled.status, reconciled.provider_refund_id),
        { status: apiStatus(reconciled.status) }
      );
    } catch (error) {
      if (!stripeRefundErrorIsDefinitive(error)) {
        return NextResponse.json(canonicalRefund(reserved, "initiating", null, true), {
          status: 202,
        });
      }
      const safe = safeStripeRefundError(error);
      const reconciled = await reconcileJobPaymentRefundResultViaRpc(createAdminClient(), {
        id: reserved.id,
        providerAccountId: reserved.provider_account_id,
        providerRefundId: null,
        providerChargeId: reserved.provider_charge_id,
        status: "failed",
        providerReasonCode: safe.code,
        providerReasonMessage: safe.message,
      });
      if (!reconciled.ok) {
        return NextResponse.json(canonicalRefund(reserved, "initiating", null, true), {
          status: 202,
        });
      }
      return NextResponse.json(
        {
          ...canonicalRefund(reserved, "failed", null, false),
          code: "refund_failed",
        },
        { status: 422 }
      );
    }
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
