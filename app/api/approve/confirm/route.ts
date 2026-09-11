import { NextResponse } from "next/server";

import {
  LEGACY_APPROVE_CONFIRM_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "@/app/lib/legacyDeliveryRouteRetirement";

export const runtime = "nodejs";

/**
 * D2 TOMBSTONE — legacy KV approve + confirmation emails.
 * Canonical customer acceptance lives on public proposal surfaces, not this path.
 */
export async function POST() {
  return NextResponse.json(
    legacyDeliveryRouteGoneBody(LEGACY_APPROVE_CONFIRM_GONE_MESSAGE),
    { status: 410 }
  );
}
