import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";

function requireEnv2(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = requireEnv2("STRIPE_SECRET_KEY");
    const stripe2 = new Stripe(stripeSecretKey);
    const webhookSecret = requireEnv2("STRIPE_WEBHOOK_SECRET");
    console.log("[payments webhook] received");

    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });

    const rawBody = await req.text();
    const event = stripe2.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("[payments webhook] event", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const estimateId = String(session.metadata?.estimateId || "").trim();

      const paymentType =
        session.metadata?.paymentType === "full" || session.metadata?.kind === "full"
          ? "full"
          : session.metadata?.paymentType === "balance" || session.metadata?.kind === "balance"
            ? "balance"
            : "deposit";

      if (estimateId) {
        const amountCents = (session.amount_total as number) ?? 0;

        try {
          const supabase = createAdminClient();
          const { data: estimateRow, error: estimateError } = await supabase
            .from("estimates")
            .select("company_id")
            .eq("id", estimateId)
            .single();
          if (estimateError) {
            console.warn("[payments webhook] estimate lookup failed", { estimateId, paymentType, error: estimateError });
          } else if (!estimateRow) {
            console.warn("[payments webhook] estimate not found for payment insert", { estimateId, paymentType });
          } else if (!estimateRow.company_id) {
            console.warn("[payments webhook] estimate missing company_id for payment insert", { estimateId, paymentType });
          } else {
            const { error: insertError } = await supabase.from("payments").insert({
              company_id: estimateRow.company_id,
              estimate_id: estimateId,
              payment_type: paymentType,
              amount: amountCents / 100,
              status: "completed",
            });
            if (insertError) console.warn("[payments webhook] payments table insert failed", insertError);
            else console.log("[payments webhook] payments table insert ok", { estimateId, paymentType, companyId: estimateRow.company_id, amountCents });
          }
        } catch (e) {
          console.warn("[payments webhook] payments table write error", e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[payments webhook] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "webhook failed" },
      { status: 400 }
    );
  }
}
