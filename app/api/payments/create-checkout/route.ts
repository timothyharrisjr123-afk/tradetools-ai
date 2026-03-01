import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    new URL(req.url).host;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const baseUrl = getBaseUrl(req);

    const body = await req.json().catch(() => ({}));
    const estimateId = String(body?.estimateId || "").trim();
    const paymentType = (body?.paymentType === "full" ? "full" : "deposit") as "deposit" | "full";

    if (!estimateId) {
      return NextResponse.json(
        { ok: false, error: "Missing estimateId" },
        { status: 400 }
      );
    }

    const estimateTotalCents = Number(body?.estimateTotalCents || 0);

    if (!estimateTotalCents || estimateTotalCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing estimate total" },
        { status: 400 }
      );
    }

    const paymentState = await getPaymentState(estimateId);

    const depositPaid = paymentState?.depositAmountCents || 0;
    const fullPaid = paymentState?.fullAmountCents || 0;
    const offlinePaid = (paymentState as { offlinePaidCents?: number })?.offlinePaidCents || 0;
    const alreadyCollected = depositPaid + fullPaid + offlinePaid;
    const remaining = Math.max(estimateTotalCents - alreadyCollected, 0);

    const customDepositCents = Number(body?.customDepositCents || 0);

    let amountCents = 0;

    if (paymentType === "deposit") {
      if (customDepositCents > 0) {
        amountCents = Math.min(Math.max(100, customDepositCents), remaining);
      } else {
        const depositPercent = 0.2;
        const depositTarget = Math.round(estimateTotalCents * depositPercent);
        amountCents = Math.max(depositTarget - depositPaid, 0);
      }
    } else {
      amountCents = remaining;
    }

    if (amountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nothing left to charge" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: paymentType === "full" ? "Roofing Payment" : "Roofing Deposit",
              description:
                paymentType === "full"
                  ? `Full payment for estimate ${estimateId}`
                  : `Deposit for estimate ${estimateId}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        estimateId,
        paymentType,
      },
      success_url: `${baseUrl}/tools/roofing/saved?paid=1&id=${encodeURIComponent(estimateId)}&kind=${paymentType}`,
      cancel_url: `${baseUrl}/tools/roofing/saved?paid=0&id=${encodeURIComponent(estimateId)}&kind=${paymentType}`,
    });

    return NextResponse.json({ ok: true, url: session.url, id: session.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "create-checkout failed" },
      { status: 500 }
    );
  }
}
