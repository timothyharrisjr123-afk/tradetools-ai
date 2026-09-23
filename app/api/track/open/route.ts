import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 1x1 transparent gif — tracking pixel remains inert (no KV write). */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

/**
 * Phase 3 — legacy open-tracking pixel no longer mutates KV approval state.
 * Canonical proposal view tracking lives on /p/{token} public access.
 */
export async function GET() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
