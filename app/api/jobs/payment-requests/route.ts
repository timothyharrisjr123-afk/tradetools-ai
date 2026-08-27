import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createJobPaymentRequestViaRpc } from "@/app/lib/jobPaymentPersistence";
import { JOB_PAYMENT_KINDS } from "@/app/lib/jobPaymentTypes";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "not_connected") return 409;
  if (code === "conflicting_request") return 409;
  if (code === "deposit_not_generic") return 400;
  return 400;
}

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const kind = typeof body?.kind === "string" ? body.kind.trim() : "";
    const proposalSignatureId =
      typeof body?.proposalSignatureId === "string"
        ? body.proposalSignatureId.trim()
        : null;

    if (!isUuidLike(jobId) || !(JOB_PAYMENT_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    if (kind === "deposit") {
      return NextResponse.json({ ok: false, code: "deposit_not_generic" }, { status: 400 });
    }
    if (body?.amountCents != null && body.amount !== undefined) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const result = await createJobPaymentRequestViaRpc(supabase, {
      companyId,
      jobId,
      kind: kind as (typeof JOB_PAYMENT_KINDS)[number],
      proposalSignatureId: proposalSignatureId && isUuidLike(proposalSignatureId)
        ? proposalSignatureId
        : null,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: statusForCode(result.code) });
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      kind: result.kind,
      status: result.status,
      amountCents: result.amount_cents,
      currency: result.currency,
      proposalSignatureId: result.proposal_signature_id,
      acceptedTotalCentsSnapshot: result.accepted_total_cents_snapshot,
      optionLabelSnapshot: result.option_label_snapshot,
      requestedAt: result.requested_at,
      idempotentReplay: result.idempotent_replay,
      jobStageUnchanged: result.job_stage_unchanged,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
