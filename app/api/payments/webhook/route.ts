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
        session.metadata?.paymentType === "full" || session.metadata?.kind === "full"
          ? "full"
          : session.metadata?.paymentType === "balance" || session.metadata?.kind === "balance"
            ? "balance"
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

        if (paymentType === "deposit") {
          patch.depositPaidAt = nowIso;
          patch.depositAmountCents = amountCents;
          patch.status = "deposit_paid";
        } else if (paymentType === "balance") {
          const { getPaymentState } = await import("@/app/lib/stripePayments");
          const current = await getPaymentState(estimateId);
          const prevFull = Number(current?.fullAmountCents ?? 0) || 0;
          const newFullAmountCents = prevFull + amountCents;
          patch.fullAmountCents = newFullAmountCents;

          const estimateTotalCents = Number(session.metadata?.estimateTotalCents ?? 0) || 0;
          const depositAmountCents = Number(current?.depositAmountCents ?? 0) || 0;
          const offlinePaidCents = Number((current as { offlinePaidCents?: number })?.offlinePaidCents ?? 0) || 0;
          const totalCollected = depositAmountCents + newFullAmountCents + offlinePaidCents;

          if (estimateTotalCents > 0 && totalCollected >= estimateTotalCents) {
            patch.fullPaidAt = nowIso;
            patch.status = "paid";
          } else {
            // Partial balance: do not set fullPaidAt; preserve existing status so work-stage (scheduled/in_progress) is not downgraded
            patch.status = (current as { status?: string })?.status ?? "deposit_paid";
          }
        } else {
          patch.fullPaidAt = nowIso;
          patch.fullAmountCents = amountCents;
          patch.status = "paid";
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
