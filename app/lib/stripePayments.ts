import { kv } from "@vercel/kv";

export type PaymentKind = "deposit" | "full" | "balance";
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

  // accumulated amounts: depositAmountCents = deposit; fullAmountCents = all non-deposit card (full + balance), summed in cents
  depositAmountCents?: number | null;
  fullAmountCents?: number | null;

  // offline payments
  offlinePaidCents?: number | null;
  offlineLastPaidAt?: string | null;
  offlineLastMethod?: string | null;
  offlineLastNotes?: string | null;
  offlineTransactions?: Array<{ id: string; amountCents: number; method: string; notes: string; stage?: "deposit" | "additional"; recordedAt: string }> | null;

  // derived status (can be set by record-offline when remaining === 0)
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

  const existing = current as PaymentState & { offlineTransactions?: unknown[] };
  const existingTx = Array.isArray(existing?.offlineTransactions) ? existing.offlineTransactions : [];
  const patchTx = Array.isArray((patch as { offlineTransactions?: unknown[] })?.offlineTransactions)
    ? (patch as { offlineTransactions: unknown[] }).offlineTransactions
    : [];
  const mergedOfflineTransactions = [...existingTx, ...patchTx];
  const offlinePaidCents = mergedOfflineTransactions.reduce((sum: number, t: unknown) => {
    const amt = Number((t as { amountCents?: number })?.amountCents || 0);
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);

  const next: PaymentState = {
    ...current,
    ...patch,
    estimateId,
    offlineTransactions: mergedOfflineTransactions as PaymentState["offlineTransactions"],
    offlinePaidCents,
  };

  // derive status (preserve if patch set it, e.g. from record-offline)
  const patchStatus = (patch as { status?: PaymentState["status"] }).status;
  next.status =
    patchStatus !== undefined && patchStatus !== null
      ? patchStatus
      : next.fullPaidAt
        ? "paid"
        : next.depositPaidAt
          ? "deposit_paid"
          : "none";

  await kv.set(keyFor(estimateId), next);
  return next;
}
