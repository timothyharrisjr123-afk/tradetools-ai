/**
 * R3E Checkout orchestration. DB request is source of amount/account.
 * Browser cannot choose amount.
 *
 * Phase 2B1: at most one payable Stripe Checkout Session per active FieldDive
 * payment request. Generation bumps must not leave prior Sessions payable.
 */

import "server-only";

import {
  bindJobPaymentCheckoutSessionViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import {
  planCheckoutSessionRecovery,
  type CheckoutSessionSnapshot,
} from "@/app/lib/jobPaymentCheckoutRecovery";
import {
  createDirectCheckoutSession,
  expireDirectCheckoutSession,
  listCheckoutSessionsForPaymentRequest,
  retrieveDirectCheckoutSession,
} from "@/app/lib/jobPaymentStripe.server";
import { createOrRecoverCheckoutSession } from "@/app/lib/stripeIdempotentCreation";
import { stripeMutationErrorIsAmbiguous } from "@/app/lib/stripeMutationSafety";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type Stripe from "stripe";

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

function codedError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function toSnapshot(session: Stripe.Checkout.Session): CheckoutSessionSnapshot {
  return {
    id: session.id,
    url: session.url,
    status: session.status,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    currency: session.currency,
    client_reference_id: session.client_reference_id,
    metadata: session.metadata,
    expires_at: session.expires_at,
  };
}

export async function openHostedCheckoutForRequest(input: {
  request: PayablePaymentRequest;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; reused: boolean }> {
  const request = input.request;
  if (request.status === "paid") {
    throw codedError("already_paid");
  }
  if (request.status === "processing") {
    throw codedError("processing");
  }
  if (request.status === "cancelled" || request.status === "expired") {
    throw codedError("not_payable");
  }
  if (request.status !== "open") {
    throw codedError("not_payable");
  }
  if (request.currency !== "usd") {
    throw codedError("invalid_amount");
  }

  const admin = createAdminClient();
  const identity = {
    id: request.id,
    company_id: request.company_id,
    job_id: request.job_id,
    amount_cents: request.amount_cents,
    currency: request.currency,
    provider_account_id: request.provider_account_id,
  };

  const bindSession = async (
    session: { id: string; expires_at?: number | null },
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

  const expireOwned = async (session: CheckoutSessionSnapshot) => {
    try {
      await expireDirectCheckoutSession({
        connectedAccountId: request.provider_account_id,
        sessionId: session.id,
      });
    } catch (error) {
      if (!stripeMutationErrorIsAmbiguous(error)) {
        // Already expired / complete are definitive and acceptable.
        const message = error instanceof Error ? error.message : "";
        if (/already.*(expired|complete)|resource_missing/i.test(message)) {
          return;
        }
        throw error;
      }
      // Ambiguous expire → re-retrieve before allowing replacement.
      try {
        const again = await retrieveDirectCheckoutSession({
          connectedAccountId: request.provider_account_id,
          sessionId: session.id,
        });
        if (again.status === "open") {
          throw codedError("checkout_reconciliation_unavailable");
        }
      } catch (retrieveError) {
        if (
          retrieveError instanceof Error &&
          (retrieveError as { code?: string }).code ===
            "checkout_reconciliation_unavailable"
        ) {
          throw retrieveError;
        }
        throw codedError("checkout_reconciliation_unavailable");
      }
    }
  };

  // Bound id alone is not authority that no other Session exists — always
  // reconcile provider inventory for this request before minting.
  let listed: Stripe.Checkout.Session[];
  try {
    const inventory = await listCheckoutSessionsForPaymentRequest({
      connectedAccountId: request.provider_account_id,
      paymentRequestId: request.id,
    });
    if (inventory.truncated) {
      throw codedError("checkout_reconciliation_unavailable");
    }
    listed = inventory.sessions;
  } catch (error) {
    if (
      error instanceof Error &&
      (error as { code?: string }).code === "checkout_reconciliation_unavailable"
    ) {
      throw error;
    }
    throw codedError("checkout_reconciliation_unavailable");
  }

  // If DB has a bound id missing from the list window, retrieve it exactly.
  if (request.provider_checkout_session_id) {
    const knownId = request.provider_checkout_session_id;
    if (!listed.some((session) => session.id === knownId)) {
      try {
        const exact = await retrieveDirectCheckoutSession({
          connectedAccountId: request.provider_account_id,
          sessionId: knownId,
        });
        listed = [exact, ...listed];
      } catch (error) {
        // Missing bound session is recoverable via list; ambiguous retrieve is not.
        if (stripeMutationErrorIsAmbiguous(error)) {
          throw codedError("checkout_reconciliation_unavailable");
        }
      }
    }
  }

  const plan = planCheckoutSessionRecovery({
    request: identity,
    sessions: listed.map(toSnapshot),
    preferredSessionId: request.provider_checkout_session_id,
  });

  if (plan.action === "already_paid") {
    throw codedError("already_paid");
  }

  if (plan.action === "reuse") {
    for (const stale of plan.retire) {
      await expireOwned(stale);
    }
    const generation =
      Number.parseInt(
        plan.session.metadata?.checkout_generation ?? "",
        10
      ) || request.checkout_generation || 0;
    try {
      await bindSession(
        { id: plan.session.id, expires_at: plan.session.expires_at },
        generation
      );
    } catch {
      // Provider Session remains the payable path; webhook/list recover bind.
    }
    if (!plan.session.url) {
      throw codedError("checkout_unavailable");
    }
    return { url: plan.session.url, reused: true };
  }

  if (plan.action === "retire_all_then_replace") {
    for (const stale of plan.retire) {
      await expireOwned(stale);
    }
  }

  // Re-list after retirement — fail closed if any payable sibling remains.
  let afterRetire: Stripe.Checkout.Session[];
  try {
    const inventory = await listCheckoutSessionsForPaymentRequest({
      connectedAccountId: request.provider_account_id,
      paymentRequestId: request.id,
    });
    if (inventory.truncated) {
      throw codedError("checkout_reconciliation_unavailable");
    }
    afterRetire = inventory.sessions;
  } catch (error) {
    if (
      error instanceof Error &&
      (error as { code?: string }).code === "checkout_reconciliation_unavailable"
    ) {
      throw error;
    }
    throw codedError("checkout_reconciliation_unavailable");
  }
  const residual = planCheckoutSessionRecovery({
    request: identity,
    sessions: afterRetire.map(toSnapshot),
    preferredSessionId: null,
  });
  if (residual.action === "already_paid") {
    throw codedError("already_paid");
  }
  if (residual.action === "reuse") {
    if (!residual.session.url) throw codedError("checkout_unavailable");
    return { url: residual.session.url, reused: true };
  }
  if (
    residual.action === "retire_all_then_replace" &&
    residual.retire.length > 0
  ) {
    throw codedError("checkout_reconciliation_unavailable");
  }

  const generation = (request.checkout_generation ?? 0) + 1;
  const createInput = {
    connectedAccountId: request.provider_account_id,
    paymentRequestId: request.id,
    companyId: request.company_id,
    jobId: request.job_id,
    kind: request.kind,
    amountCents: request.amount_cents,
    currency: "usd" as const,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    checkoutGeneration: generation,
  };
  const created = await createOrRecoverCheckoutSession({
    create: () => createDirectCheckoutSession(createInput),
    reconcile: async () => {
      const again = await listCheckoutSessionsForPaymentRequest({
        connectedAccountId: request.provider_account_id,
        paymentRequestId: request.id,
      });
      if (again.truncated) return null;
      const recovered = planCheckoutSessionRecovery({
        request: identity,
        sessions: again.sessions.map(toSnapshot),
        preferredSessionId: null,
      });
      if (recovered.action !== "reuse") return null;
      const full = again.sessions.find(
        (session) => session.id === recovered.session.id
      );
      return full ?? null;
    },
    isAmbiguous: stripeMutationErrorIsAmbiguous,
  });
  const session = created.session;

  try {
    await bindSession(session, generation);
  } catch {
    // Stripe session exists. Webhook metadata + session list recover the bind.
  }

  if (!session.url) {
    throw codedError("checkout_unavailable");
  }
  return { url: session.url, reused: created.recovered };
}
