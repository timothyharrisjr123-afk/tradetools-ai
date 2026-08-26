/**
 * Post-payment method labels from Stripe provider truth only.
 * FieldDive never infers debit vs credit. CTAs stay method-agnostic.
 */

export type StripePaymentMethodDisplayInput = {
  type?: string | null;
  brand?: string | null;
  last4?: string | null;
  wallet?: string | null;
};

export function formatStripePaymentMethodDisplay(
  input: StripePaymentMethodDisplayInput | null | undefined
): string | null {
  if (!input) return null;
  const type = (input.type ?? "").trim().toLowerCase();
  const brand = (input.brand ?? "").trim();
  const last4 = (input.last4 ?? "").trim();
  const wallet = (input.wallet ?? "").trim().toLowerCase();

  if (wallet === "cashapp" || type === "cashapp") {
    return "Cash App Pay";
  }
  if (type === "us_bank_account" || type === "ach_debit" || type === "financial_connections") {
    return last4 ? `Bank payment •••• ${last4}` : "Bank payment";
  }
  if (type === "card" || type === "link" || brand || last4) {
    const brandLabel = brand
      ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
      : "Card";
    return last4 ? `${brandLabel} •••• ${last4}` : brandLabel === "Card" ? "Cards" : brandLabel;
  }
  return null;
}

export function stripePaymentMethodFromObject(
  object: Record<string, unknown> | null | undefined
): StripePaymentMethodDisplayInput | null {
  if (!object) return null;
  const details =
    (object.payment_method_details as Record<string, unknown> | undefined) ??
    ((object.charges as { data?: Record<string, unknown>[] } | undefined)?.data?.[0]
      ?.payment_method_details as Record<string, unknown> | undefined) ??
    null;
  const paymentMethod = object.payment_method as Record<string, unknown> | string | undefined;
  const pmRecord =
    paymentMethod && typeof paymentMethod === "object" ? paymentMethod : null;
  const type =
    (typeof details?.type === "string" ? details.type : null) ??
    (typeof pmRecord?.type === "string" ? pmRecord.type : null) ??
    (typeof object.payment_method_types === "object" &&
    Array.isArray(object.payment_method_types) &&
    typeof object.payment_method_types[0] === "string"
      ? object.payment_method_types[0]
      : null);
  const card = (details?.card ?? pmRecord?.card) as Record<string, unknown> | undefined;
  const bank = (details?.us_bank_account ?? pmRecord?.us_bank_account) as
    | Record<string, unknown>
    | undefined;
  const walletType =
    typeof (card?.wallet as Record<string, unknown> | undefined)?.type === "string"
      ? String((card?.wallet as Record<string, unknown>).type)
      : typeof details?.type === "string" && details.type === "cashapp"
        ? "cashapp"
        : null;
  return {
    type,
    brand: typeof card?.brand === "string" ? card.brand : null,
    last4:
      (typeof card?.last4 === "string" ? card.last4 : null) ??
      (typeof bank?.last4 === "string" ? bank.last4 : null),
    wallet: walletType,
  };
}
