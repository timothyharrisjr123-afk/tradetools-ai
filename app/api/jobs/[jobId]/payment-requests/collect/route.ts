import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { collectJobPaymentViaRpc } from "@/app/lib/jobPaymentPersistence";
import {
  COLLECT_AMOUNT_MODES,
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
  type CollectAmountMode,
} from "@/app/lib/jobPaymentTypes";
import { parseCollectFixedAmountToCents } from "@/app/lib/jobPaymentMoney";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "not_connected") return 409;
  if (code === "conflicting_request") return 409;
  if (code === "job_not_active") return 409;
  if (code === "nothing_due") return 409;
  if (code === "amount_exceeds_collectible") return 409;
  return 400;
}

function asMode(value: unknown): CollectAmountMode | null {
  if (typeof value !== "string") return null;
  const mode = value.trim();
  return (COLLECT_AMOUNT_MODES as readonly string[]).includes(mode)
    ? (mode as CollectAmountMode)
    : null;
}

/**
 * Contractor Collect payment.
 * Client sends amountMode (+ percentageBps or fixedAmount string).
 * Server parses fixed dollars, RPC owns collectible/kind/eligibility.
 * Client kind and amountCents are not authoritative.
 */
export async function POST(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
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
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.kind != null) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    if (body?.amountCents != null) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const amountMode = asMode(body?.amountMode);
    if (!amountMode) {
      return NextResponse.json({ ok: false, code: "invalid_amount_mode" }, { status: 400 });
    }

    if (amountMode === "remaining") {
      if (body?.percentageBps != null || body?.fixedAmount != null) {
        return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
      }
      const result = await collectJobPaymentViaRpc(supabase, {
        companyId,
        jobId,
        amountMode: "remaining",
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, code: result.code },
          { status: statusForCode(result.code) }
        );
      }
      return NextResponse.json({
        ok: true,
        id: result.id,
        kind: result.kind,
        status: result.status,
        amountCents: result.amount_cents,
        currency: result.currency,
        idempotentReplay: result.idempotent_replay,
        jobStageUnchanged: result.job_stage_unchanged,
      });
    }

    if (amountMode === "percentage") {
      if (body?.fixedAmount != null) {
        return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
      }
      const percentageBps = body?.percentageBps;
      if (
        typeof percentageBps !== "number" ||
        !Number.isInteger(percentageBps) ||
        percentageBps < 1 ||
        percentageBps > 10000
      ) {
        return NextResponse.json({ ok: false, code: "invalid_percentage" }, { status: 400 });
      }
      const result = await collectJobPaymentViaRpc(supabase, {
        companyId,
        jobId,
        amountMode: "percentage",
        percentageBps,
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, code: result.code },
          { status: statusForCode(result.code) }
        );
      }
      return NextResponse.json({
        ok: true,
        id: result.id,
        kind: result.kind,
        status: result.status,
        amountCents: result.amount_cents,
        currency: result.currency,
        idempotentReplay: result.idempotent_replay,
        jobStageUnchanged: result.job_stage_unchanged,
      });
    }

    if (typeof body?.fixedAmount !== "string" || body?.percentageBps != null) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const amountCents = parseCollectFixedAmountToCents(body.fixedAmount);
    if (amountCents == null || amountCents < JOB_PAYMENT_MIN_AMOUNT_CENTS) {
      return NextResponse.json({ ok: false, code: "invalid_amount" }, { status: 400 });
    }
    const result = await collectJobPaymentViaRpc(supabase, {
      companyId,
      jobId,
      amountMode: "fixed",
      amountCents,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code },
        { status: statusForCode(result.code) }
      );
    }
    return NextResponse.json({
      ok: true,
      id: result.id,
      kind: result.kind,
      status: result.status,
      amountCents: result.amount_cents,
      currency: result.currency,
      idempotentReplay: result.idempotent_replay,
      jobStageUnchanged: result.job_stage_unchanged,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
