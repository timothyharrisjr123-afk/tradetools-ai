import { createHash } from "node:crypto";

export type ProviderAccountForConnect = {
  id: string;
  metadata?: Record<string, string> | null;
};

export type CheckoutSessionForCreation = {
  id: string;
  url?: string | null;
  expires_at?: number | null;
  status?: string | null;
};

export function stripeConnectOperationToken(input: {
  companyId: string;
  predecessorProviderAccountId: string | null;
}): string {
  return createHash("sha256")
    .update(
      `fielddive-connect-v1\0${input.companyId}\0${input.predecessorProviderAccountId ?? "initial"}`,
      "utf8"
    )
    .digest("hex");
}

export function stripeConnectAccountIdempotencyKey(operationToken: string): string {
  return `fielddive_connect_account_${operationToken}`;
}

export function stripeCheckoutIdempotencyKey(input: {
  connectedAccountId: string;
  paymentRequestId: string;
  companyId: string;
  jobId: string;
  kind: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  checkoutGeneration: number;
}): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([
      input.connectedAccountId,
      input.paymentRequestId,
      input.companyId,
      input.jobId,
      input.kind,
      input.amountCents,
      input.currency,
      input.successUrl,
      input.cancelUrl,
      input.checkoutGeneration,
    ]))
    .digest("hex");
  return `fielddive_r3e_checkout_${input.paymentRequestId}_${input.checkoutGeneration}_${fingerprint}`;
}

export async function createOrRecoverStripeAccount<T extends ProviderAccountForConnect>(input: {
  operationToken: string;
  findExisting: () => Promise<T | null>;
  create: () => Promise<T>;
  isAmbiguous: (error: unknown) => boolean;
}): Promise<{ account: T; recovered: boolean }> {
  const existing = await input.findExisting();
  if (existing) return { account: existing, recovered: true };

  try {
    return { account: await input.create(), recovered: false };
  } catch (error) {
    if (!input.isAmbiguous(error)) throw error;
    const recovered = await input.findExisting();
    if (recovered) return { account: recovered, recovered: true };
    // Exact replay: the caller closes over the same params and idempotency key.
    return { account: await input.create(), recovered: true };
  }
}

export async function createOrRecoverCheckoutSession<T extends CheckoutSessionForCreation>(input: {
  reconcile: () => Promise<T | null>;
  create: () => Promise<T>;
  isAmbiguous: (error: unknown) => boolean;
}): Promise<{ session: T; recovered: boolean }> {
  try {
    return { session: await input.create(), recovered: false };
  } catch (error) {
    if (!input.isAmbiguous(error)) throw error;
    const reconciled = await input.reconcile();
    if (reconciled) return { session: reconciled, recovered: true };
    // Exact replay: the caller closes over the same params and idempotency key.
    return { session: await input.create(), recovered: true };
  }
}
