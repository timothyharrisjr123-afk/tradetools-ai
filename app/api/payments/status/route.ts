import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Retained legacy rows are historical, never current collected/paid truth. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      code: "legacy_payment_status_retired",
      error: "Legacy payment status is no longer a current payment authority.",
    },
    { status: 410 }
  );
}
