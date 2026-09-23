import { NextResponse } from "next/server";

import {
  LEGACY_KV_APPROVAL_GONE_MESSAGE,
  legacyDeliveryRouteGoneBody,
} from "@/app/lib/legacyDeliveryRouteRetirement";

export const runtime = "nodejs";

/**
 * Phase 3 TOMBSTONE — legacy KV approval check read.
 */
export async function GET() {
  return NextResponse.json(legacyDeliveryRouteGoneBody(LEGACY_KV_APPROVAL_GONE_MESSAGE), {
    status: 410,
  });
}

export async function POST() {
  return NextResponse.json(legacyDeliveryRouteGoneBody(LEGACY_KV_APPROVAL_GONE_MESSAGE), {
    status: 410,
  });
}
