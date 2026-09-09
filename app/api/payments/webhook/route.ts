import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired legacy estimate-payment webhook.
 *
 * Its only producer, POST /api/payments/create-checkout, is also tombstoned.
 * The canonical money path is POST /api/webhooks/stripe/connect. This endpoint
 * deliberately reads no Stripe secret or body and performs no persistence.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "legacy_payments_webhook_disabled",
      error: "This webhook path is no longer available.",
    },
    { status: 410 }
  );
}
