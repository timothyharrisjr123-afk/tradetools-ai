import { NextRequest, NextResponse } from "next/server";
import { sendPaymentRequestEmailForContractor } from "@/app/lib/jobPaymentRequestEmail.server";
import {
  isPublicAppOriginError,
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  resolvePublicAppOrigin,
} from "@/app/lib/publicAppOrigin.server";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string; paymentRequestId: string }> };

/**
 * Phase 11 — Email / resend a canonical payment request.
 * Does not create or mutate money request identity.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { jobId, paymentRequestId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }

    const gated = await requireCapabilitySession(
      supabase,
      user.id,
      "payment_request"
    );
    if (!gated.ok) return gated.response;
    const companyId = gated.session.companyId;

    if (!isUuidLike(jobId) || !isUuidLike(paymentRequestId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      contractorNote?: string | null;
      resend?: boolean;
      retrySuffix?: string | null;
      replyTo?: string | null;
    };

    // Reject client-trusted destination / ids
    if (
      (body as { recipientEmail?: unknown }).recipientEmail != null ||
      (body as { to?: unknown }).to != null ||
      (body as { companyId?: unknown }).companyId != null
    ) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    let origin: string;
    try {
      origin = resolvePublicAppOrigin();
    } catch (error) {
      if (isPublicAppOriginError(error)) {
        return NextResponse.json(
          {
            ok: false,
            code: PUBLIC_ORIGIN_MISCONFIGURED_CODE,
            message: PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const wantsResend = body.resend === true;
    const retrySuffix =
      typeof body.retrySuffix === "string" && body.retrySuffix.trim()
        ? body.retrySuffix.trim().slice(0, 64)
        : wantsResend
          ? randomUUID()
          : null;

    const result = await sendPaymentRequestEmailForContractor({
      companyId,
      jobId,
      paymentRequestId,
      userId: user.id,
      origin,
      contractorNote: body.contractorNote ?? null,
      retrySuffix,
      replyTo: typeof body.replyTo === "string" ? body.replyTo : null,
    });

    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "missing_customer_email" ||
              result.code === "request_not_emailable" ||
              result.code === "email_not_configured"
            ? 409
            : result.code === "prior_attempt_failed"
              ? 409
              : 400;
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          attemptId: result.attemptId ?? null,
        },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      replayed: result.replayed,
      attemptId: result.attemptId,
      attemptNumber: result.attemptNumber,
      status: result.status,
      providerMessageId: result.providerMessageId,
      publicUrl: result.publicUrl,
      recipientRedacted: result.recipientRedacted,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
