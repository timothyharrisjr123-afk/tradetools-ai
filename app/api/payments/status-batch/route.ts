import { NextResponse } from "next/server";

export const runtime = "nodejs";

function retired() {
  return NextResponse.json(
    {
      ok: false,
      code: "legacy_payment_status_retired",
      error: "Legacy payment status is no longer a current payment authority.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return retired();
}

export async function POST() {
  return retired();
}
