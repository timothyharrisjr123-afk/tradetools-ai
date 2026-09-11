/**
 * D1 — Server entry for Resend webhook verification.
 * Keeps RESEND_WEBHOOK_SECRET server-side only at the route boundary.
 */

import "server-only";

export {
  resolveResendWebhookSecret,
  verifyResendWebhookSignature,
  type VerifiedResendWebhookPayload,
} from "./proposalDeliveryWebhookVerify";
