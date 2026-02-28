import { kv } from "@vercel/kv";

export type PaymentKind = "deposit" | "full";
export type PaymentState = {
  estimateId: string;

  // payment progress
  depositPaidAt?: string | null;
  fullPaidAt?: string | null;

  // last checkout info
  lastCheckoutSessionId?: string | null;
  lastPaymentIntentId?: string | null;

  // totals (optional but useful)
  lastAmountTotalCents?: number | null;
  lastCurrency?: string | null;

  // derived status
  status: "none" | "deposit_paid" | "paid";
};

function keyFor(estimateId: string) {
  return `ttai_payments:${estimateId}`;
}

export async function getPaymentState(estimateId: string) {
  return (await kv.get(keyFor(estimateId))) as PaymentState | null;
}

export async function upsertPaymentState(estimateId: string, patch: Partial<PaymentState>) {
  const current =
    ((await kv.get(keyFor(estimateId))) as PaymentState | null) ??
    ({
      estimateId,
      status: "none",
      depositPaidAt: null,
      fullPaidAt: null,
      lastCheckoutSessionId: null,
      lastPaymentIntentId: null,
      lastAmountTotalCents: null,
      lastCurrency: null,
    } satisfies PaymentState);

  const next: PaymentState = {
    ...current,
    ...patch,
    estimateId,
  };

  // derive status
  next.status = next.fullPaidAt ? "paid" : next.depositPaidAt ? "deposit_paid" : "none";

  await kv.set(keyFor(estimateId), next);
  return next;
}
