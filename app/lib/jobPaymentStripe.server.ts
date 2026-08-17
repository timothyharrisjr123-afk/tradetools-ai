/**
 * R3E Stripe Connect — TEST/SANDBOX only.
 * Direct charges on the contractor connected account. No platform charge.
 * No application fee. Hosted Checkout only.
 */

import "server-only";

import Stripe from "stripe";
import { checkoutLineLabel } from "@/app/lib/jobPaymentMoney";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function stripeSecretKeyLooksLive(key: string): boolean {
  return key.startsWith("sk_live_");
}

export function getStripeConnectClient(): Stripe {
  const key = requireEnv("STRIPE_SECRET_KEY");
  if (stripeSecretKeyLooksLive(key)) {
    throw new Error("R3E refuses live Stripe keys. Use TEST/SANDBOX only.");
  }
  return new Stripe(key);
}

export function getStripeConnectWebhookSecret(): string {
  return (
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET ||
    requireEnv("STRIPE_WEBHOOK_SECRET")
  );
}

export function appOriginFromRequest(originHeader: string | null): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (env) return env;
  const origin = (originHeader ?? "").trim().replace(/\/$/, "");
  if (origin) return origin;
  return "http://localhost:3000";
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
}): Promise<Stripe.Account> {
  const stripe = getStripeConnectClient();
  return stripe.accounts.create({
    type: "standard",
    country: "US",
    metadata: { company_id: input.companyId },
  });
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
  idempotencyKey: string;
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
      },
    },
  };
  assertNoPlatformChargeParams(params);

  const requestOptions: Stripe.RequestOptions = {
    stripeAccount: input.connectedAccountId,
    idempotencyKey: input.idempotencyKey,
  };

  try {
    return await stripe.checkout.sessions.create(
      {
        ...params,
        payment_method_types: ["card", "us_bank_account"],
      },
      requestOptions
    );
  } catch {
    return stripe.checkout.sessions.create(
      {
        ...params,
        payment_method_types: ["card"],
      },
      requestOptions
    );
  }
}

export async function retrieveDirectCheckoutSession(input: {
  connectedAccountId: string;
  sessionId: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeConnectClient();
  return stripe.checkout.sessions.retrieve(input.sessionId, {
    stripeAccount: input.connectedAccountId,
  });
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

export async function findReusableCheckoutSessionForRequest(input: {
  connectedAccountId: string;
  paymentRequestId: string;
}): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripeConnectClient();
  const listed = await stripe.checkout.sessions.list(
    { limit: 20 },
    { stripeAccount: input.connectedAccountId }
  );
  return (
    listed.data.find(
      (session) =>
        checkoutSessionIsReusable(session) &&
        checkoutSessionMatchesRequest(session, input.paymentRequestId)
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
