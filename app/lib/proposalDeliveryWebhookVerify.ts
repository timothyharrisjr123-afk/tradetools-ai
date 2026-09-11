/**
 * D1 — Resend webhook signature verification (Svix).
 * Pure crypto helpers — safe for unit tests. Route entry still imports via .server.ts.
 *
 * Note: svix@2.x Webhook.verify validates signature only (returns undefined);
 * parse the raw JSON body after verify succeeds.
 */

import { Webhook } from "svix";

export type VerifiedResendWebhookPayload = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

export function resolveResendWebhookSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const secret = env.RESEND_WEBHOOK_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function verifyResendWebhookSignature(input: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string | null;
}): VerifiedResendWebhookPayload {
  const secret = input.secret ?? resolveResendWebhookSecret();
  if (!secret) {
    throw new Error("resend_webhook_secret_missing");
  }
  const id = (input.svixId ?? "").trim();
  const timestamp = (input.svixTimestamp ?? "").trim();
  const signature = (input.svixSignature ?? "").trim();
  if (!id || !timestamp || !signature) {
    throw new Error("resend_webhook_headers_missing");
  }

  const wh = new Webhook(secret);
  // Throws on invalid signature / stale timestamp. Does not return payload (svix 2.x).
  wh.verify(input.rawBody, {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    throw new Error("resend_webhook_payload_invalid");
  }

  if (!parsed || typeof parsed !== "object" || typeof (parsed as { type?: unknown }).type !== "string") {
    throw new Error("resend_webhook_payload_invalid");
  }
  return parsed as VerifiedResendWebhookPayload;
}
