import { NextResponse } from "next/server";

import {
  LEGACY_DELIVERY_ROUTE_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "@/app/lib/legacyDeliveryRouteRetirement";

export const runtime = "nodejs";

/**
 * D2 TOMBSTONE — legacy estimate PDF email send.
 * Canonical proposal delivery: POST /api/proposals/send.
 */
export async function POST() {
  return NextResponse.json(legacyDeliveryRouteGoneBody(LEGACY_DELIVERY_ROUTE_GONE_MESSAGE), {
    status: 410,
  });
}
