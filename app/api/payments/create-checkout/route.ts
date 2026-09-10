import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Legacy estimate Checkout used the platform Stripe account and is not an
 * approved paid-beta path. This server-side tombstone makes stale clients fail
 * closed without reading a secret or making any Stripe request.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "legacy_checkout_disabled",
      error: "This payment path is no longer available.",
    },
    { status: 410 }
  );
}
