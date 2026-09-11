import { NextRequest, NextResponse } from "next/server";

import { processVerifiedResendWebhookEvent } from "@/app/lib/proposalDeliveryWebhookProcess.server";
import {
  resolveResendWebhookSecret,
  verifyResendWebhookSignature,
} from "@/app/lib/proposalDeliveryWebhookVerify.server";

export const runtime = "nodejs";

/**
 * D1 Resend delivery webhook.
 * Raw body + Svix signature required. Never trusts client company_id.
 */
export async function POST(req: NextRequest) {
  if (!resolveResendWebhookSecret()) {
    return NextResponse.json(
      { ok: false, code: "webhook_not_configured" },
      { status: 503 }
    );
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_body" }, { status: 400 });
  }

  const svixId = req.headers.get("svix-id");
  let payload;
  try {
    payload = verifyResendWebhookSignature({
      rawBody,
      svixId,
      svixTimestamp: req.headers.get("svix-timestamp"),
      svixSignature: req.headers.get("svix-signature"),
    });
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_signature" },
      { status: 400 }
    );
  }

  try {
    const result = await processVerifiedResendWebhookEvent({
      svixId: String(svixId),
      payload,
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      apply_state: result.apply_state,
      matched: result.matched,
    });
  } catch (error) {
    console.error("[resend-webhook] process failed", {
      code: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "process_failed" },
      { status: 500 }
    );
  }
}
