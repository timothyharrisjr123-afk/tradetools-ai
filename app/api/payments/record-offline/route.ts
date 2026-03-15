import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { getDerivedPaymentStateFromSupabase } from "@/app/lib/paymentsTable";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const estimateId = String(body?.estimateId || "").trim();
    const amountCents = Number(body?.amountCents || 0);
    const method = String(body?.method || "other").trim();
    const notes = String(body?.notes || "").trim();
    const estimateTotalCents = Number(body?.estimateTotalCents || 0);
    const stage = (body?.stage === "deposit" ? "deposit" : "additional") as "deposit" | "additional";

    if (!estimateId) {
      return NextResponse.json({ ok: false, error: "Missing estimateId" }, { status: 400 });
    }
    if (!amountCents || amountCents <= 0) {
      return NextResponse.json({ ok: false, error: "Missing amount" }, { status: 400 });
    }
    if (!estimateTotalCents || estimateTotalCents <= 0) {
      return NextResponse.json({ ok: false, error: "Missing estimate total" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const paymentState = await getDerivedPaymentStateFromSupabase({
      supabase,
      companyId,
      estimateId,
      estimateTotalCents,
    });

    const depositPaid = paymentState?.depositAmountCents || 0;
    const fullPaid = paymentState?.fullAmountCents || 0;
    const offlinePaid = paymentState?.offlinePaidCents || 0;
    const alreadyCollected = depositPaid + fullPaid + offlinePaid;
    const remainingBefore = Math.max(estimateTotalCents - alreadyCollected, 0);

    const appliedCents = Math.min(amountCents, remainingBefore);

    const newCollected = depositPaid + fullPaid + offlinePaid + appliedCents;
    const remainingAfter = Math.max(estimateTotalCents - newCollected, 0);

    const status: string =
      remainingAfter === 0
        ? "paid"
        : stage === "deposit"
          ? "deposit_paid"
          : paymentState?.status ?? "deposit_paid";

    const { error: insertError } = await supabase.from("payments").insert({
      company_id: companyId,
      estimate_id: estimateId,
      payment_type: stage === "deposit" ? "deposit" : "offline",
      amount: appliedCents / 100,
      status: "completed",
    });
    if (insertError) {
      console.warn("[record-offline] payments table insert failed", insertError);
      return NextResponse.json({ ok: false, error: "Failed to record payment" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      appliedCents,
      remainingAfter,
      status,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "record-offline failed" }, { status: 500 });
  }
}
