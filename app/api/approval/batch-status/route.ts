import { NextResponse } from "next/server";

import {
  LEGACY_KV_APPROVAL_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "@/app/lib/legacyDeliveryRouteRetirement";

export const runtime = "nodejs";

/**
 * TOMBSTONE — legacy anonymous KV approval status lookup.
 * Canonical customer acceptance: /p/{token}.
 */
export async function POST() {
  return NextResponse.json(legacyDeliveryRouteGoneBody(LEGACY_KV_APPROVAL_GONE_MESSAGE), {
    status: 410,
  });
}
