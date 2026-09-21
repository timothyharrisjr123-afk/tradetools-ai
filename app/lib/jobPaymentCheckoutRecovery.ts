/**
 * Phase 2B1 — Checkout session recovery policy (pure).
 *
 * At most one payable Stripe Checkout Session may remain active for one
 * FieldDive payment request. Capture dedupe is defense-in-depth only.
 */

export type CheckoutSessionSnapshot = {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string | null | undefined> | null;
  expires_at?: number | null;
};

export type PayableRequestIdentity = {
  id: string;
  company_id: string;
  job_id: string;
  amount_cents: number;
  currency: string;
  provider_account_id: string;
};

export function checkoutSessionMetadataValue(
  session: CheckoutSessionSnapshot,
  key: string
): string | null {
  const raw = session.metadata?.[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function checkoutSessionBelongsToRequest(
  session: CheckoutSessionSnapshot,
  request: Pick<PayableRequestIdentity, "id" | "company_id" | "job_id">
): boolean {
  const metadataRequestId =
    checkoutSessionMetadataValue(session, "payment_request_id") ??
    checkoutSessionMetadataValue(session, "fielddive_payment_request_id");
  const byReference = session.client_reference_id === request.id;
  const byMetadata = metadataRequestId === request.id;
  if (!byReference && !byMetadata) return false;

  const companyId = checkoutSessionMetadataValue(session, "company_id");
  if (companyId != null && companyId !== request.company_id) return false;

  const jobId = checkoutSessionMetadataValue(session, "job_id");
  if (jobId != null && jobId !== request.job_id) return false;

  return true;
}

export function checkoutSessionMatchesPayableAmount(
  session: CheckoutSessionSnapshot,
  request: Pick<PayableRequestIdentity, "amount_cents" | "currency">
): boolean {
  const currency = (session.currency ?? "").trim().toLowerCase();
  const expected = request.currency.trim().toLowerCase();
  if (!currency || currency !== expected) return false;
  if (
    typeof session.amount_total !== "number" ||
    !Number.isInteger(session.amount_total)
  ) {
    return false;
  }
  return session.amount_total === request.amount_cents;
}

export function checkoutSessionIsPayableOpen(
  session: CheckoutSessionSnapshot
): boolean {
  return session.status === "open" && Boolean(session.url);
}

export function checkoutSessionLooksPaid(
  session: CheckoutSessionSnapshot
): boolean {
  if (session.payment_status === "paid") return true;
  if (session.status === "complete" && session.payment_status !== "unpaid") {
    return true;
  }
  return false;
}

export type SessionRecoveryPlan =
  | { action: "reuse"; session: CheckoutSessionSnapshot; retire: CheckoutSessionSnapshot[] }
  | { action: "already_paid"; session: CheckoutSessionSnapshot }
  | { action: "retire_all_then_replace"; retire: CheckoutSessionSnapshot[] }
  | { action: "none" };

/**
 * Given all known open/complete sessions for one request on the correct
 * connected account, decide reuse vs retire vs paid.
 * Prefer the currently bound session when it remains payable and matching.
 */
export function planCheckoutSessionRecovery(input: {
  request: PayableRequestIdentity;
  sessions: readonly CheckoutSessionSnapshot[];
  preferredSessionId?: string | null;
}): SessionRecoveryPlan {
  const belonging = input.sessions.filter((session) =>
    checkoutSessionBelongsToRequest(session, input.request)
  );

  const paid = belonging.find((session) => checkoutSessionLooksPaid(session));
  if (paid) {
    return { action: "already_paid", session: paid };
  }

  const openMatching = belonging.filter(
    (session) =>
      checkoutSessionIsPayableOpen(session) &&
      checkoutSessionMatchesPayableAmount(session, input.request)
  );
  const openMismatched = belonging.filter(
    (session) =>
      checkoutSessionIsPayableOpen(session) &&
      !checkoutSessionMatchesPayableAmount(session, input.request)
  );

  if (openMatching.length > 0) {
    const preferredId = (input.preferredSessionId ?? "").trim();
    const preferred =
      (preferredId
        ? openMatching.find((session) => session.id === preferredId)
        : null) ?? openMatching[0]!;
    const retire = [
      ...openMatching.filter((session) => session.id !== preferred.id),
      ...openMismatched,
    ];
    return { action: "reuse", session: preferred, retire };
  }

  if (openMismatched.length > 0) {
    return { action: "retire_all_then_replace", retire: openMismatched };
  }

  return { action: "none" };
}
