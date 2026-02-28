import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-06-20",
});

function getBaseUrl(req: NextRequest) {
  const origin = req.nextUrl?.origin;
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";
  return origin || fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const estimateId = String(body?.estimateId ?? "").trim();
    const amountCents = Number(body?.amountCents);
    const currency = String(body?.currency ?? "usd").toLowerCase();
    const kind = (String(body?.kind ?? "deposit").toLowerCase() as "deposit" | "full");
    const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : undefined;

    if (!estimateId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing/invalid estimateId or amountCents" },
        { status: 400 }
      );
    }
    if (kind !== "deposit" && kind !== "full") {
      return NextResponse.json({ ok: false, error: "Invalid kind" }, { status: 400 });
    }

    const baseUrl = getBaseUrl(req);

    const successUrl = `${baseUrl}/tools/roofing/saved?paid=1&id=${encodeURIComponent(estimateId)}&kind=${encodeURIComponent(kind)}`;
    const cancelUrl = `${baseUrl}/tools/roofing/saved?canceled=1&id=${encodeURIComponent(estimateId)}&kind=${encodeURIComponent(kind)}`;

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
              name: kind === "full" ? "Roofing Payment" : "Roofing Deposit",
              description: `Payment for estimate ${estimateId}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        estimateId,
        kind,
      },
    });

    return NextResponse.json({ ok: true, checkoutUrl: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
