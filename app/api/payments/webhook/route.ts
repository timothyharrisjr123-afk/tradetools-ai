import Stripe from "stripe";
import { setPaidState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

function requireEnv2(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripeWebhook = new Stripe(requireEnv2("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-01-27.acacia" as any,
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
    if (estimateId) {
      await setPaidState({
        estimateId,
        status: "paid",
        paidAt: new Date().toISOString(),
        checkoutSessionId: session.id ?? null,
        paymentIntentId: (session.payment_intent as string) ?? null,
        amountTotalCents: (session.amount_total as number) ?? null,
        currency: (session.currency as string) ?? null,
      });
    }
  }

  return new Response("ok", { status: 200 });
}
