/**
 * FieldDive Stripe Connect — environment-bound TEST/LIVE access.
 * Direct charges on the contractor connected account. No platform charge.
 * No application fee. Hosted Checkout only.
 */

import "server-only";

import Stripe from "stripe";
import { checkoutLineLabel } from "@/app/lib/jobPaymentMoney";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";
import { resolvePublicAppOrigin } from "@/app/lib/publicAppOrigin.server";
import {
  requireStripeConnectWebhookSecret,
  requireStripeSecretKey,
} from "@/app/lib/stripeRuntimeEnvironment";
import {
  stripeConnectAccountIdempotencyKey,
  stripeCheckoutIdempotencyKey,
} from "@/app/lib/stripeIdempotentCreation";

export function getStripeConnectClient(): Stripe {
  return new Stripe(requireStripeSecretKey(), {
    apiVersion: "2026-07-29.dahlia",
  });
}

export function getStripeConnectWebhookSecret(): string {
  return requireStripeConnectWebhookSecret();
}

/**
 * Canonical public origin for Connect return URLs and Checkout success/cancel.
 * Ignores request Origin/Host in non-development (fail-closed via resolvePublicAppOrigin).
 */
export function appOriginFromRequest(_originHeader: string | null): string {
  return resolvePublicAppOrigin();
}

export function withPaymentReturnHint(
  path: string,
  hint: "pending" | "cancelled"
): string {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}payment=${hint}`;
}

export async function createStandardConnectedAccount(input: {
  companyId: string;
  operationToken: string;
}): Promise<Stripe.Account> {
  const stripe = getStripeConnectClient();
  return stripe.accounts.create(
    {
      type: "standard",
      country: "US",
      metadata: {
        company_id: input.companyId,
        fielddive_connect_operation: input.operationToken,
      },
    },
    { idempotencyKey: stripeConnectAccountIdempotencyKey(input.operationToken) }
  );
}

export async function findStandardConnectedAccountForOperation(input: {
  companyId: string;
  operationToken: string;
}): Promise<Stripe.Account | null> {
  let matched: Stripe.Account | null = null;
  await getStripeConnectClient()
    .accounts.list({ limit: 100 })
    .autoPagingEach((account) => {
      if (
        account.type === "standard" &&
        account.metadata?.company_id === input.companyId &&
        account.metadata?.fielddive_connect_operation === input.operationToken
      ) {
        matched = account;
        return false;
      }
      return true;
    });
  return matched;
}

export async function createAccountOnboardingLink(input: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string> {
  const stripe = getStripeConnectClient();
  const link = await stripe.accountLinks.create({
    account: input.accountId,
    type: "account_onboarding",
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
  });
  return link.url;
}

export async function retrieveConnectedAccount(
  accountId: string,
  options?: { timeoutMs?: number }
): Promise<Stripe.Account> {
  const stripe = getStripeConnectClient();
  const timeoutMs = options?.timeoutMs ?? 8000;
  return Promise.race([
    stripe.accounts.retrieve(accountId, {}, { timeout: timeoutMs }),
    new Promise<Stripe.Account>((_, reject) => {
      setTimeout(() => reject(new Error("stripe_retrieve_timeout")), timeoutMs);
    }),
  ]);
}

export type CreateDirectCheckoutInput = {
  connectedAccountId: string;
  paymentRequestId: string;
  companyId: string;
  jobId: string;
  kind: JobPaymentKind;
  amountCents: number;
  currency: "usd";
  successUrl: string;
  cancelUrl: string;
  checkoutGeneration: number;
};

export type CreateDirectPaymentRefundInput = {
  connectedAccountId: string;
  refundCommandId: string;
  paymentIntentId: string;
  amountCents: number;
  companyId: string;
  jobId: string;
  paymentRequestId: string;
  canonicalCaptureTransactionId: string;
};

function assertNoPlatformChargeParams(params: Stripe.Checkout.SessionCreateParams) {
  const fee = params.payment_intent_data?.application_fee_amount;
  const transfer = params.payment_intent_data?.transfer_data;
  if (fee != null || transfer) {
    throw new Error("R3E Checkout must not set application fees or transfer_data.");
  }
}

export async function createDirectCheckoutSession(
  input: CreateDirectCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeConnectClient();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.paymentRequestId,
    metadata: {
      payment_request_id: input.paymentRequestId,
      company_id: input.companyId,
      job_id: input.jobId,
      checkout_generation: String(input.checkoutGeneration),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency,
          unit_amount: input.amountCents,
          product_data: {
            name: checkoutLineLabel(input.kind),
          },
        },
      },
    ],
    payment_intent_data: {
      metadata: {
        payment_request_id: input.paymentRequestId,
        company_id: input.companyId,
        job_id: input.jobId,
        checkout_generation: String(input.checkoutGeneration),
      },
    },
  };
  assertNoPlatformChargeParams(params);

  const requestOptions: Stripe.RequestOptions = {
    stripeAccount: input.connectedAccountId,
    idempotencyKey: stripeCheckoutIdempotencyKey(input),
  };

  return stripe.checkout.sessions.create(params, requestOptions);
}

export async function createDirectPaymentRefund(
  input: CreateDirectPaymentRefundInput
): Promise<Stripe.Refund> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) {
    throw new Error("Refund amount must be a positive integer.");
  }
  const stripe = getStripeConnectClient();
  const params: Stripe.RefundCreateParams = {
    payment_intent: input.paymentIntentId,
    amount: input.amountCents,
    metadata: {
      fielddive_refund_id: input.refundCommandId,
      refund_command_id: input.refundCommandId,
      company_id: input.companyId,
      job_id: input.jobId,
      payment_request_id: input.paymentRequestId,
      canonical_capture_transaction_id: input.canonicalCaptureTransactionId,
    },
  };
  return stripe.refunds.create(params, {
    stripeAccount: input.connectedAccountId,
    idempotencyKey: `job-refund:${input.refundCommandId}:v1`,
  });
}

export async function retrieveDirectPaymentRefund(input: {
  connectedAccountId: string;
  refundId: string;
}): Promise<Stripe.Refund> {
  return getStripeConnectClient().refunds.retrieve(
    input.refundId,
    {},
    { stripeAccount: input.connectedAccountId }
  );
}

export async function listDirectChargeRefunds(input: {
  connectedAccountId: string;
  chargeId: string;
}): Promise<Stripe.Refund[]> {
  return getStripeConnectClient()
    .refunds.list(
      { charge: input.chargeId, limit: 100 },
      { stripeAccount: input.connectedAccountId }
    )
    .autoPagingToArray({ limit: 1000 });
}

export function stripeRefundErrorIsDefinitive(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  if (error instanceof Stripe.errors.StripeConnectionError) return false;
  const status = error.statusCode;
  return !(typeof status === "number" && status >= 500);
}

export function safeStripeRefundError(error: unknown): {
  code: string;
  message: string;
} {
  if (!(error instanceof Stripe.errors.StripeError)) {
    return { code: "stripe_request_error", message: "Stripe refund request failed." };
  }
  const code =
    typeof error.code === "string" && error.code.trim()
      ? error.code.trim().slice(0, 120)
      : error.type.slice(0, 120);
  return {
    code,
    message: (error.message || "Stripe refund request failed.").trim().slice(0, 1000),
  };
}

export async function retrieveDirectCheckoutSession(input: {
  connectedAccountId: string;
  sessionId: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeConnectClient();
  return stripe.checkout.sessions.retrieve(
    input.sessionId,
    {},
    { stripeAccount: input.connectedAccountId }
  );
}

/**
 * Expire an open Checkout Session on the connected account.
 * Callers must verify request/company/account ownership before invoking.
 * Retry-safe: Stripe returns the expired session if already expired.
 */
export async function expireDirectCheckoutSession(input: {
  connectedAccountId: string;
  sessionId: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeConnectClient();
  return stripe.checkout.sessions.expire(
    input.sessionId,
    {},
    { stripeAccount: input.connectedAccountId }
  );
}

export function checkoutSessionIsReusable(
  session: Stripe.Checkout.Session
): boolean {
  return session.status === "open" && Boolean(session.url);
}

export function checkoutSessionMatchesRequest(
  session: Stripe.Checkout.Session,
  paymentRequestId: string
): boolean {
  const metadataId =
    session.metadata?.payment_request_id ??
    session.metadata?.fielddive_payment_request_id;
  return (
    session.client_reference_id === paymentRequestId ||
    metadataId === paymentRequestId
  );
}

/**
 * Exact recoverability for one payment request: page connected-account Checkout
 * Sessions and keep every match for this request (open or complete).
 * Does not depend on "probably in last 20".
 *
 * If the safety ceiling is hit before the account inventory is fully scanned for
 * this request, `truncated` is true — callers must fail closed (never mint).
 */
export async function listCheckoutSessionsForPaymentRequest(input: {
  connectedAccountId: string;
  paymentRequestId: string;
  /** Hard cap on matched sessions; enough for realistic retry history. */
  maxSessions?: number;
}): Promise<{ sessions: Stripe.Checkout.Session[]; truncated: boolean }> {
  const stripe = getStripeConnectClient();
  const maxSessions = input.maxSessions ?? 100;
  const matched: Stripe.Checkout.Session[] = [];
  let truncated = false;
  await stripe.checkout.sessions
    .list({ limit: 100 }, { stripeAccount: input.connectedAccountId })
    .autoPagingEach((session) => {
      if (checkoutSessionMatchesRequest(session, input.paymentRequestId)) {
        matched.push(session);
        if (matched.length >= maxSessions) {
          truncated = true;
          return false;
        }
      }
      return true;
    });
  return { sessions: matched, truncated };
}

/** @deprecated Prefer listCheckoutSessionsForPaymentRequest — generation-scoped list of 20 is insufficient for money safety. */
export async function findReusableCheckoutSessionForRequest(input: {
  connectedAccountId: string;
  paymentRequestId: string;
  checkoutGeneration: number;
}): Promise<Stripe.Checkout.Session | null> {
  const listed = await listCheckoutSessionsForPaymentRequest({
    connectedAccountId: input.connectedAccountId,
    paymentRequestId: input.paymentRequestId,
  });
  if (listed.truncated) return null;
  return (
    listed.sessions.find(
      (session) =>
        checkoutSessionIsReusable(session) &&
        session.metadata?.checkout_generation === String(input.checkoutGeneration)
    ) ?? null
  );
}


export function verifyStripeConnectWebhook(
  rawBody: string,
  signature: string
): Stripe.Event {
  const stripe = getStripeConnectClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    getStripeConnectWebhookSecret()
  );
}
