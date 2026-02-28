import Stripe from "stripe";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-01-27.acacia" as any,
});

export async function POST(req: Request) {
  const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");

  const body = await req.json().catch(() => ({}));

  const estimateId = String(body?.estimateId ?? "").trim();
  const customerEmail = String(body?.customerEmail ?? "").trim();
  const amountCents = Number(body?.amountCents);
  const currency = String(body?.currency ?? "usd").toLowerCase();

  if (!estimateId) {
    return Response.json({ ok: false, error: "Missing estimateId" }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return Response.json({ ok: false, error: "Missing/invalid amountCents" }, { status: 400 });
  }

  const successUrl =
    String(body?.successUrl ?? `${appUrl}/tools/roofing/saved?paid=1&id=${encodeURIComponent(estimateId)}`);
  const cancelUrl =
    String(body?.cancelUrl ?? `${appUrl}/tools/roofing/saved?pay_cancel=1&id=${encodeURIComponent(estimateId)}`);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(amountCents),
          product_data: {
            name: "Roofing Deposit",
            description: `Deposit for estimate ${estimateId}`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      estimateId,
      kind: "deposit",
    },
  });

  return Response.json({
    ok: true,
    checkoutUrl: session.url,
    sessionId: session.id,
  });
}
