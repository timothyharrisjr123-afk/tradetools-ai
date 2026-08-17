/**
 * R3E Checkout orchestration. DB request is source of amount/account.
 * Browser cannot choose amount. Stripe success + DB bind failure is retried.
 */

import "server-only";

import {
  bindJobPaymentCheckoutSessionViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import {
  checkoutSessionIsReusable,
  createDirectCheckoutSession,
  findReusableCheckoutSessionForRequest,
  retrieveDirectCheckoutSession,
} from "@/app/lib/jobPaymentStripe.server";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type PayablePaymentRequest = {
  id: string;
  company_id: string;
  job_id: string;
  kind: JobPaymentKind;
  status: string;
  amount_cents: number;
  currency: string;
  provider_account_id: string;
  provider_checkout_session_id: string | null;
  checkout_generation: number;
};

export async function openHostedCheckoutForRequest(input: {
  request: PayablePaymentRequest;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; reused: boolean }> {
  const request = input.request;
  if (request.status === "paid") {
    throw Object.assign(new Error("already_paid"), { code: "already_paid" });
  }
  if (request.status === "cancelled" || request.status === "expired") {
    throw Object.assign(new Error("not_payable"), { code: "not_payable" });
  }
  if (request.currency !== "usd") {
    throw Object.assign(new Error("invalid_amount"), { code: "invalid_amount" });
  }

  const admin = createAdminClient();

  const bindSession = async (
    session: {
      id: string;
      expires_at?: number | null;
    },
    generation: number
  ) => {
    const bindOnce = () =>
      bindJobPaymentCheckoutSessionViaRpc(admin, {
        companyId: request.company_id,
        paymentRequestId: request.id,
        checkoutSessionId: session.id,
        checkoutGeneration: generation,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        providerAccountId: request.provider_account_id,
      });
    try {
      await bindOnce();
    } catch {
      await bindOnce();
    }
  };

  if (request.provider_checkout_session_id) {
    try {
      const existing = await retrieveDirectCheckoutSession({
        connectedAccountId: request.provider_account_id,
        sessionId: request.provider_checkout_session_id,
      });
      if (checkoutSessionIsReusable(existing) && existing.url) {
        return { url: existing.url, reused: true };
      }
    } catch {
      // Session missing or expired — recover from provider list or remint.
    }
  }

  try {
    const recovered = await findReusableCheckoutSessionForRequest({
      connectedAccountId: request.provider_account_id,
      paymentRequestId: request.id,
    });
    if (recovered?.url && checkoutSessionIsReusable(recovered)) {
      try {
        await bindSession(recovered, request.checkout_generation ?? 0);
      } catch {
        // Provider session remains reusable even if bind is delayed.
      }
      return { url: recovered.url, reused: true };
    }
  } catch {
    // Listing is best-effort recovery; remint below if needed.
  }

  const generation = (request.checkout_generation ?? 0) + 1;
  const session = await createDirectCheckoutSession({
    connectedAccountId: request.provider_account_id,
    paymentRequestId: request.id,
    companyId: request.company_id,
    jobId: request.job_id,
    kind: request.kind,
    amountCents: request.amount_cents,
    currency: "usd",
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    idempotencyKey: `fielddive_r3e_checkout_${request.id}_${generation}`,
  });

  try {
    await bindSession(session, generation);
  } catch {
    // Stripe session exists. Webhook metadata + session list recover the bind.
  }

  if (!session.url) {
    throw Object.assign(new Error("checkout_unavailable"), {
      code: "checkout_unavailable",
    });
  }
  return { url: session.url, reused: false };
}
