import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Legacy estimate-scoped offline payments are permanently retired.
 *
 * Canonical collection belongs to the Job Card and public payment-request
 * flows backed by job_payment_*. Keeping this explicit tombstone makes stale
 * pre-cutover clients fail closed without recreating a second money ledger.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "legacy_offline_payments_retired",
      error: "Offline payment recording has moved to the Job Card payment workflow.",
    },
    { status: 410 }
  );
}
