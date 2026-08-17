import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { upsertCompanyPaymentSettingsViaRpc } from "@/app/lib/jobPaymentPersistence";
import { COMPANY_PAYMENT_DEPOSIT_MODES } from "@/app/lib/jobPaymentTypes";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

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
    const mode = String(body?.defaultDepositMode ?? "").trim();
    if (!(COMPANY_PAYMENT_DEPOSIT_MODES as readonly string[]).includes(mode)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const percentBps =
      mode === "percent" ? Number(body?.defaultDepositPercentBps) : null;
    const fixedCents =
      mode === "fixed" ? Number(body?.defaultDepositFixedCents) : null;

    const result = await upsertCompanyPaymentSettingsViaRpc(supabase, {
      companyId,
      mode: mode as (typeof COMPANY_PAYMENT_DEPOSIT_MODES)[number],
      percentBps: Number.isInteger(percentBps) ? percentBps : null,
      fixedCents: Number.isInteger(fixedCents) ? fixedCents : null,
    });
    if (result.ok !== true) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
