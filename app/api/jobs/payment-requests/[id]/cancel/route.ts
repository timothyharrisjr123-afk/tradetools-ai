import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { cancelJobPaymentRequestViaRpc } from "@/app/lib/jobPaymentPersistence";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "processing_not_cancellable") return 409;
  if (code === "already_paid") return 409;
  return 400;
}

/**
 * Contractor cancel of an existing payment request.
 * Wraps cancel_job_payment_request_v1. Processing is not cancellable.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
    if (!isUuidLike(id)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const result = await cancelJobPaymentRequestViaRpc(supabase, {
      companyId,
      paymentRequestId: id,
    });
    if (result.ok !== true) {
      const code = String(result.code ?? "invalid_payload");
      return NextResponse.json({ ok: false, code }, { status: statusForCode(code) });
    }
    return NextResponse.json({
      ok: true,
      id: result.id,
      status: result.status,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
