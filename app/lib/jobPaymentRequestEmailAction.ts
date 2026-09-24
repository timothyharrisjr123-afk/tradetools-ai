/**
 * Phase 11 — contractor email action wording from durable delivery history.
 * Pure (client-safe). Every non-first action is a new attempt on the SAME
 * payment request; wording only reflects whether an email was ever submitted.
 */

export type PaymentRequestEmailAction = "email" | "retry" | "resend";

export const PAYMENT_REQUEST_EMAIL_ACTION_LABELS: Record<
  PaymentRequestEmailAction,
  string
> = {
  email: "Email request",
  retry: "Retry email",
  resend: "Resend email",
};

/** Provider accepted the message at some point (delivery may still have failed later). */
const SUBMITTED_STATUSES = new Set([
  "provider_accepted",
  "delayed",
  "delivered",
  "bounced",
  "complained",
]);

export function isPaymentRequestEmailSubmittedStatus(status: string): boolean {
  return SUBMITTED_STATUSES.has(status.trim().toLowerCase());
}

/**
 * - no attempts → email
 * - latest attempt never reached the provider (failed / attempted / prepared) → retry
 * - latest attempt was submitted (incl. bounced/complained) → resend
 */
export function resolvePaymentRequestEmailAction(
  attempts: readonly { status: string; attemptNumber: number }[]
): PaymentRequestEmailAction {
  if (attempts.length === 0) return "email";
  const latest = attempts.reduce((a, b) =>
    b.attemptNumber > a.attemptNumber ? b : a
  );
  return isPaymentRequestEmailSubmittedStatus(latest.status) ? "resend" : "retry";
}
