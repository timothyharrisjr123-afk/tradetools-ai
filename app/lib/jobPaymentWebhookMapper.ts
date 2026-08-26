/**
 * R3E — Map verified Stripe Connect events into FieldDive settlement commands.
 *
 * Checkout redirect is never paid. checkout.session.completed is not paid
 * unless payment_status is paid (typical card). ACH stays processing until
 * async success. Paid never regresses in SQL.
 */

import type {
  JobPaymentRequestStatus,
  JobPaymentTransactionKind,
  JobPaymentTransactionStatus,
} from "@/app/lib/jobPaymentTypes";
import {
  formatStripePaymentMethodDisplay,
  stripePaymentMethodFromObject,
} from "@/app/lib/jobPaymentMethodDisplay";

export type StripeConnectEventLike = {
  id: string;
  type: string;
  created?: number;
  account?: string | null;
  data: {
    object: Record<string, unknown>;
  };
};

export type JobPaymentProviderEventCommand = {
  provider_event_id: string;
  raw_type: string;
  occurred_at: string;
  payment_request_id: string | null;
  provider_checkout_session_id: string | null;
  provider_account_id: string | null;
  provider_payment_intent_id: string | null;
  provider_charge_id: string | null;
  amount_cents: number | null;
  transaction_kind: JobPaymentTransactionKind | null;
  transaction_status: JobPaymentTransactionStatus | null;
  apply_request_status: Extract<
    JobPaymentRequestStatus,
    "processing" | "paid" | "failed"
  > | null;
  account_update: {
    provider_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    disabled: boolean;
    company_id: string | null;
  } | null;
  payment_method_label: string | null;
};

const HANDLED_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
  "charge.refunded",
  "refund.created",
  "account.updated",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function metadataId(
  object: Record<string, unknown>,
  key: string
): string | null {
  const metadata = asRecord(object.metadata);
  return metadata ? asString(metadata[key]) : null;
}

function expandPaymentIntent(
  value: unknown
): { id: string | null; status: string | null } {
  if (typeof value === "string") return { id: asString(value), status: null };
  const record = asRecord(value);
  if (!record) return { id: null, status: null };
  return {
    id: asString(record.id),
    status: asString(record.status),
  };
}

function isoFromUnix(seconds: number | undefined): string {
  const ms =
    typeof seconds === "number" && Number.isFinite(seconds)
      ? seconds * 1000
      : Date.now();
  return new Date(ms).toISOString();
}

export function isIgnoredStripeConnectCommand(
  value: JobPaymentProviderEventCommand | { ignore: true; type: string }
): value is { ignore: true; type: string } {
  return "ignore" in value && value.ignore === true;
}

export function isHandledStripeConnectEventType(type: string): boolean {
  return HANDLED_TYPES.has(type);
}

export function mapStripeConnectEventToCommand(
  event: StripeConnectEventLike
): JobPaymentProviderEventCommand | { ignore: true; type: string } {
  const type = asString(event.type) ?? "";
  if (!HANDLED_TYPES.has(type)) {
    return { ignore: true, type: type || "unknown" };
  }

  const object = asRecord(event.data?.object) ?? {};
  const connectedAccount =
    asString(event.account) ??
    asString(object.stripe_account) ??
    (type === "account.updated" ? asString(object.id) : null);

  const base = {
    provider_event_id: event.id,
    raw_type: type,
    occurred_at: isoFromUnix(event.created),
    payment_request_id:
      metadataId(object, "payment_request_id") ??
      metadataId(object, "fielddive_payment_request_id"),
    provider_checkout_session_id:
      type.startsWith("checkout.session.") ? asString(object.id) : null,
    provider_account_id: connectedAccount,
    provider_payment_intent_id: null as string | null,
    provider_charge_id: null as string | null,
    amount_cents: asInt(object.amount_total) ?? asInt(object.amount) ?? null,
    transaction_kind: null as JobPaymentTransactionKind | null,
    transaction_status: null as JobPaymentTransactionStatus | null,
    apply_request_status: null as JobPaymentProviderEventCommand["apply_request_status"],
    account_update: null as JobPaymentProviderEventCommand["account_update"],
    payment_method_label: formatStripePaymentMethodDisplay(
      stripePaymentMethodFromObject(object)
    ),
  };

  if (type === "account.updated") {
    const metadata = asRecord(object.metadata);
    return {
      ...base,
      provider_account_id: asString(object.id),
      account_update: {
        provider_account_id: asString(object.id) ?? "",
        charges_enabled: object.charges_enabled === true,
        payouts_enabled: object.payouts_enabled === true,
        details_submitted: object.details_submitted === true,
        disabled:
          object.charges_enabled !== true &&
          (asString(object.requirements && asRecord(object.requirements)?.disabled_reason) !=
            null ||
            object.payouts_enabled === false),
        company_id: metadata ? asString(metadata.company_id) : null,
      },
    };
  }

  const paymentIntent = expandPaymentIntent(object.payment_intent ?? object);
  if (type.startsWith("payment_intent.")) {
    base.provider_payment_intent_id = asString(object.id);
  } else {
    base.provider_payment_intent_id = paymentIntent.id;
  }

  if (type === "checkout.session.completed") {
    const paymentStatus = asString(object.payment_status);
    const piStatus = paymentIntent.status;
    if (paymentStatus === "paid" || piStatus === "succeeded") {
      base.transaction_kind = "capture";
      base.transaction_status = "succeeded";
      base.apply_request_status = "paid";
    } else {
      base.apply_request_status = "processing";
    }
    return base;
  }

  if (type === "checkout.session.async_payment_succeeded") {
    base.transaction_kind = "capture";
    base.transaction_status = "succeeded";
    base.apply_request_status = "paid";
    return base;
  }

  if (type === "checkout.session.async_payment_failed") {
    base.transaction_kind = "failure";
    base.transaction_status = "failed";
    base.apply_request_status = "failed";
    return base;
  }

  if (type === "checkout.session.expired") {
    return { ignore: true, type };
  }

  if (type === "payment_intent.succeeded") {
    base.transaction_kind = "capture";
    base.transaction_status = "succeeded";
    base.apply_request_status = "paid";
    return base;
  }

  if (type === "payment_intent.processing") {
    base.apply_request_status = "processing";
    return base;
  }

  if (type === "payment_intent.payment_failed") {
    base.transaction_kind = "failure";
    base.transaction_status = "failed";
    base.apply_request_status = "failed";
    return base;
  }

  if (type === "charge.refunded" || type === "refund.created") {
    base.provider_charge_id =
      type === "charge.refunded" ? asString(object.id) : asString(object.charge);
    base.transaction_kind = "refund";
    base.transaction_status = "refunded";
    base.amount_cents =
      asInt(object.amount_refunded) ?? asInt(object.amount) ?? base.amount_cents;
    if (!base.payment_request_id) {
      const charge = asRecord(object);
      const chargeMeta = asRecord(charge?.metadata);
      base.payment_request_id = chargeMeta
        ? asString(chargeMeta.payment_request_id)
        : null;
    }
    return base;
  }

  return { ignore: true, type };
}

export function nextRequestStatusFromPrecedence(input: {
  current: JobPaymentRequestStatus;
  apply: JobPaymentRequestStatus | null;
}): JobPaymentRequestStatus {
  const apply = input.apply;
  if (!apply) return input.current;
  if (input.current === "paid") return "paid";
  if (input.current === "cancelled" || input.current === "expired") {
    return input.current;
  }
  if (apply === "paid") return "paid";
  if (apply === "failed") return "failed";
  if (apply === "processing") return "processing";
  return input.current;
}
