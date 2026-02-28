import Stripe from "stripe";
import { upsertPaymentState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

function requireEnv2(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripeWebhook = new Stripe(requireEnv2("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: Request) {
  const webhookSecret = requireEnv2("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripeWebhook.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err?.message ?? "Invalid signature"}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const estimateId = String(session?.metadata?.estimateId ?? "").trim();
    const kind = String(session?.metadata?.kind ?? "deposit").toLowerCase();

    if (estimateId) {
      const nowIso = new Date().toISOString();

      const patch: Record<string, unknown> = {
        lastCheckoutSessionId: session.id ?? null,
        lastPaymentIntentId: (session.payment_intent as string) ?? null,
        lastAmountTotalCents: (session.amount_total as number) ?? null,
        lastCurrency: (session.currency as string) ?? null,
      };

      if (kind === "full") (patch as any).fullPaidAt = nowIso;
      else (patch as any).depositPaidAt = nowIso;

      await upsertPaymentState(estimateId, patch as any);
    }
  }

  return new Response("ok", { status: 200 });
}
