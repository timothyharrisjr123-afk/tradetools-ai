import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getPaymentState, upsertPaymentState } from "@/app/lib/stripePayments";

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

    const nowIso = new Date().toISOString();
    const state = await getPaymentState(estimateId);

    const depositPaid = (state as any)?.depositAmountCents || 0;
    const fullPaid = (state as any)?.fullAmountCents || 0;
    const offlinePaid = (state as any)?.offlinePaidCents || 0;

    const alreadyCollected = depositPaid + fullPaid + offlinePaid;
    const remainingBefore = Math.max(estimateTotalCents - alreadyCollected, 0);

    // Clamp offline amount so we don't record more than remaining (prevents accidental over-marking)
    const appliedCents = Math.min(amountCents, remainingBefore);

    const newCollected = depositPaid + fullPaid + offlinePaid + appliedCents;
    const remainingAfter = Math.max(estimateTotalCents - newCollected, 0);

    const tx = {
      id: `off_${Date.now()}`,
      amountCents: appliedCents,
      method,
      notes,
      stage,
      recordedAt: nowIso,
    };

    const patch: Record<string, unknown> = {
      offlineLastPaidAt: nowIso,
      offlineLastMethod: method,
      offlineLastNotes: notes,
      offlineTransactions: [tx],
      status:
        remainingAfter === 0
          ? "paid"
          : stage === "deposit"
            ? "deposit_paid"
            : ((state as any)?.status || "approved"),
    };

    await upsertPaymentState(estimateId, patch as any);

    try {
      const supabase = await createClient();
      const { data: estimateRow, error: estimateError } = await supabase
        .from("estimates")
        .select("company_id")
        .eq("id", estimateId)
        .single();
      if (!estimateError && estimateRow?.company_id) {
        const { error: insertError } = await supabase.from("payments").insert({
          company_id: estimateRow.company_id,
          estimate_id: estimateId,
          payment_type: stage === "deposit" ? "deposit" : "offline",
          amount: appliedCents / 100,
          status: "completed",
        });
        if (insertError) console.warn("[record-offline] payments table insert failed", insertError);
      }
    } catch (e) {
      console.warn("[record-offline] payments table write error", e);
    }

    return NextResponse.json({
      ok: true,
      appliedCents,
      remainingAfter,
      status: patch.status,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "record-offline failed" }, { status: 500 });
  }
}
