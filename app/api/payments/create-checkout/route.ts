import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

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
    const runtimeStripeKey = process.env.STRIPE_SECRET_KEY || "";
    if (!runtimeStripeKey || runtimeStripeKey.includes("...") || runtimeStripeKey.length < 50) {
      throw new Error("Invalid STRIPE_SECRET_KEY configuration");
    }
    console.log(
      "[create-checkout runtime key]",
      `length=${runtimeStripeKey.length}`,
      `first16=${runtimeStripeKey.slice(0, 16)}`,
      `last12=${runtimeStripeKey.slice(-12)}`
    );
    const stripe = new Stripe(runtimeStripeKey, {
      apiVersion: "2025-02-24.acacia",
    });
    const baseUrl = getBaseUrl(req);

    const body = await req.json().catch(() => ({}));
    const estimateId = String(body?.estimateId || "").trim();
    const paymentTypeRaw = body?.paymentType;
    const paymentType = (paymentTypeRaw === "full" ? "full" : paymentTypeRaw === "balance" ? "balance" : "deposit") as "deposit" | "full" | "balance";

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
    const remainingCents = Math.max(0, estimateTotalCents - alreadyCollected);

    const customDepositCentsRaw = Number(body?.customDepositCents ?? 0);
    const clientAmountCentsRaw = Number(body?.amountCents ?? 0);

    let amountCents: number;

    if (paymentType === "full") {
      amountCents = remainingCents;
      const clientAmount = Number.isFinite(clientAmountCentsRaw) ? Math.floor(clientAmountCentsRaw) : 0;
      if (clientAmount > 0 && clientAmount !== remainingCents) {
        return NextResponse.json(
          { ok: false, error: "Full payment must equal remaining balance" },
          { status: 400 }
        );
      }
    } else if (paymentType === "balance") {
      const clientAmount = Number.isFinite(clientAmountCentsRaw) ? Math.floor(clientAmountCentsRaw) : 0;
      if (clientAmount <= 0) {
        return NextResponse.json(
          { ok: false, error: "Balance amount must be greater than zero" },
          { status: 400 }
        );
      }
      amountCents = Math.min(clientAmount, remainingCents);
    } else {
      if (customDepositCentsRaw > 0) {
        const requested = Math.floor(customDepositCentsRaw);
        if (!Number.isFinite(requested) || requested <= 0) {
          return NextResponse.json(
            { ok: false, error: "Invalid deposit amount" },
            { status: 400 }
          );
        }
        amountCents = Math.min(Math.max(100, requested), remainingCents);
      } else {
        const depositPercent = 0.2;
        const depositTarget = Math.round(estimateTotalCents * depositPercent);
        amountCents = Math.max(depositTarget - depositPaid, 0);
      }
    }

    amountCents = Math.floor(amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Nothing left to charge" },
        { status: 400 }
      );
    }

    if (amountCents > remainingCents) {
      return NextResponse.json(
        { ok: false, error: "Amount exceeds remaining balance" },
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
              name: paymentType === "deposit" ? "Roofing Deposit" : "Roofing Payment",
              description:
                paymentType === "deposit"
                  ? `Deposit for estimate ${estimateId}`
                  : paymentType === "balance"
                    ? `Remaining balance for estimate ${estimateId}`
                    : `Full payment for estimate ${estimateId}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        estimateId,
        paymentType,
        estimateTotalCents: String(estimateTotalCents),
      },
      success_url: `${baseUrl}/tools/roofing/saved?paid=1&id=${encodeURIComponent(estimateId)}&kind=${paymentType}`,
      cancel_url: `${baseUrl}/tools/roofing/saved?paid=0&id=${encodeURIComponent(estimateId)}&kind=${paymentType}`,
    });

    return NextResponse.json({ ok: true, url: session.url, id: session.id });
  } catch (err: any) {
    console.error("[create-checkout]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "create-checkout failed" },
      { status: 500 }
    );
  }
}
