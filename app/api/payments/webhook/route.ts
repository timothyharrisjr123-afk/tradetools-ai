import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertPaymentState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

function requireEnv2(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const stripe2 = new Stripe(requireEnv2("STRIPE_SECRET_KEY"));
const webhookSecret = requireEnv2("STRIPE_WEBHOOK_SECRET");

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });

    const rawBody = await req.text();
    const event = stripe2.webhooks.constructEvent(rawBody, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const estimateId = String(session.metadata?.estimateId || "").trim();

      const paymentType =
        session.metadata?.paymentType === "full" ||
        session.metadata?.kind === "full"
          ? "full"
          : "deposit";

      if (estimateId) {
        const nowIso = new Date().toISOString();
        const amountCents = (session.amount_total as number) ?? 0;

        const patch: Record<string, unknown> = {
          lastCheckoutSessionId: session.id ?? null,
          lastPaymentIntentId: (session.payment_intent as string) ?? null,
          lastAmountTotalCents: amountCents,
          lastCurrency: (session.currency as string) ?? null,
        };

        if (paymentType === "full") {
          patch.fullPaidAt = nowIso;
          patch.fullAmountCents = amountCents;
          patch.status = "paid";
        } else {
          patch.depositPaidAt = nowIso;
          patch.depositAmountCents = amountCents;
          patch.status = "deposit_paid";
        }

        await upsertPaymentState(estimateId, patch as any);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "webhook failed" },
      { status: 400 }
    );
  }
}
