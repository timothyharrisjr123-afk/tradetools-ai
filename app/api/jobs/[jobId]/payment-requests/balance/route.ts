import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { collectJobRemainingBalanceViaRpc } from "@/app/lib/jobPaymentPersistence";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "not_connected") return 409;
  if (code === "conflicting_request") return 409;
  if (code === "not_complete") return 409;
  if (code === "nothing_due") return 409;
  if (code === "job_not_active") return 409;
  return 400;
}

/**
 * Contractor Collect remaining balance.
 * Amount, contract, stage, and eligibility are server/DB-owned.
 */
export async function POST(_req: Request, context: { params: Promise<{ jobId: string }> }) {
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

    const result = await collectJobRemainingBalanceViaRpc(supabase, {
      companyId,
      jobId,
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
