import { NextResponse } from "next/server";

import {
  LEGACY_EMAIL_FOLLOWUP_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "@/app/lib/legacyDeliveryRouteRetirement";

export const runtime = "nodejs";

/**
 * D2 TOMBSTONE — legacy follow-up email send.
 * Canonical proposal delivery: POST /api/proposals/send.
 */
export async function POST() {
  return NextResponse.json(
    legacyDeliveryRouteGoneBody(LEGACY_EMAIL_FOLLOWUP_GONE_MESSAGE),
    { status: 410 }
  );
}
