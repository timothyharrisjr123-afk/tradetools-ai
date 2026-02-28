import { kv } from "@vercel/kv";

export type PaymentState = {
  estimateId: string;
  status: "paid";
  paidAt: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  amountTotalCents?: number | null;
  currency?: string | null;
};

function keyFor(estimateId: string) {
  return `ttai_payments:${estimateId}`;
}

export async function setPaidState(state: PaymentState) {
  await kv.set(keyFor(state.estimateId), state);
  return state;
}

export async function getPaymentState(estimateId: string) {
  return (await kv.get(keyFor(estimateId))) as PaymentState | null;
}
