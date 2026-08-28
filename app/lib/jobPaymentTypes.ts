/**
 * R3E — Job payment contracts.
 *
 * Request ≠ acceptance ≠ signature ≠ paid ≠ Job stage.
 * Signature is optional evidence. Payment never writes jobs.stage
 * and never creates or mutates proposal_signatures.
 */

export const CREATE_JOB_PAYMENT_REQUEST_RPC_V1 = "create_job_payment_request_v1";
export const COLLECT_JOB_PAYMENT_RPC_V1 = "collect_job_payment_v1";
export const CANCEL_JOB_PAYMENT_REQUEST_RPC_V1 = "cancel_job_payment_request_v1";
export const BIND_JOB_PAYMENT_CHECKOUT_SESSION_RPC_V1 =
  "bind_job_payment_checkout_session_v1";
export const RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1 =
  "record_job_payment_provider_event_v1";
export const RESOLVE_PUBLIC_JOB_PAYMENT_CHECKOUT_RPC_V1 =
  "resolve_public_job_payment_checkout_v1";
export const UPSERT_COMPANY_PAYMENT_SETTINGS_RPC_V1 =
  "upsert_company_payment_settings_v1";
export const ENSURE_COMPANY_PAYMENT_SETTINGS_RPC_V1 =
  "ensure_company_payment_settings_v1";
export const UPSERT_COMPANY_PAYMENT_ACCOUNT_FROM_PROVIDER_RPC_V1 =
  "upsert_company_payment_account_from_provider_v1";
export const SET_JOB_PAYMENT_SETTLED_METHOD_RPC_V1 =
  "set_job_payment_settled_method_v1";

export const JOB_PAYMENT_PROVIDER = "stripe" as const;
export const JOB_PAYMENT_CURRENCY = "usd" as const;
export const JOB_PAYMENT_MIN_AMOUNT_CENTS = 100;

export const JOB_PAYMENT_KINDS = ["deposit", "progress", "balance"] as const;
export type JobPaymentKind = (typeof JOB_PAYMENT_KINDS)[number];

export const COLLECT_AMOUNT_MODES = ["remaining", "percentage", "fixed"] as const;
export type CollectAmountMode = (typeof COLLECT_AMOUNT_MODES)[number];

export const JOB_PAYMENT_REQUEST_STATUSES = [
  "open",
  "processing",
  "paid",
  "cancelled",
  "expired",
  "failed",
] as const;
export type JobPaymentRequestStatus =
  (typeof JOB_PAYMENT_REQUEST_STATUSES)[number];

export const JOB_PAYMENT_TRANSACTION_KINDS = [
  "capture",
  "failure",
  "refund",
] as const;
export type JobPaymentTransactionKind =
  (typeof JOB_PAYMENT_TRANSACTION_KINDS)[number];

export const JOB_PAYMENT_TRANSACTION_STATUSES = [
  "succeeded",
  "failed",
  "refunded",
] as const;
export type JobPaymentTransactionStatus =
  (typeof JOB_PAYMENT_TRANSACTION_STATUSES)[number];

export const COMPANY_PAYMENT_DEPOSIT_MODES = [
  "none",
  "percent",
  "fixed",
] as const;
export type CompanyPaymentDepositMode =
  (typeof COMPANY_PAYMENT_DEPOSIT_MODES)[number];

export const COMPANY_PAYMENT_ONBOARDING_STATUSES = [
  "pending",
  "complete",
  "restricted",
  "disabled",
] as const;
export type CompanyPaymentOnboardingStatus =
  (typeof COMPANY_PAYMENT_ONBOARDING_STATUSES)[number];

export const JOB_PAYMENT_ATTENTION_TYPES = [
  "payments_not_connected",
  "payment_failed",
] as const;

export const JOB_CARD_PAYMENTS_CONNECT_HREF = "/tools/settings/payments";

export const JOB_CARD_PAYMENTS_LABEL = "Payments";
export const JOB_CARD_PAYMENTS_NOT_CONNECTED = "Not connected";
export const JOB_CARD_PAYMENTS_NOT_REQUESTED = "Not requested";
export const JOB_CARD_PAYMENTS_PAID_IN_FULL = "Paid in full";
export const JOB_CARD_PAYMENTS_CONNECT_CTA = "Connect payments";
export const JOB_CARD_PAYMENTS_REQUEST_DEPOSIT_CTA = "Request deposit";
export const JOB_CARD_PAYMENTS_REQUEST_BALANCE_CTA =
  "Request remaining balance";
export const JOB_CARD_PAYMENTS_COLLECT_BALANCE_CTA =
  "Collect remaining balance";
export const JOB_CARD_PAYMENTS_COLLECT_CTA = "Collect payment";
export const JOB_CARD_PAYMENTS_CREATE_REQUEST_CTA = "Create payment request";
export const JOB_CARD_PAYMENTS_COPY_LINK_CTA = "Copy payment link";
export const JOB_CARD_PAYMENTS_CANCEL_REQUEST_CTA = "Cancel request";

export const PUBLIC_PAYMENT_DUE_TITLE = "Payment due";
export const PUBLIC_PAYMENT_PENDING_TITLE = "Payment pending";
export const PUBLIC_PAYMENT_RECEIVED_TITLE = "Payment received";
export const PUBLIC_PAYMENT_REFUNDED_TITLE = "Payment refunded";
export const PUBLIC_PAYMENT_DEPOSIT_LABEL = "Deposit";
export const PUBLIC_PAYMENT_PROGRESS_LABEL = "Progress payment";
export const PUBLIC_PAYMENT_BALANCE_LABEL = "Remaining balance";
export const PUBLIC_PAYMENT_PAY_DEPOSIT_CTA = "Pay deposit";
export const PUBLIC_PAYMENT_PAY_CTA = "Pay";
export const PUBLIC_PAYMENT_PENDING_EXPLANATION =
  "Your payment is processing. This can take a short time for cards and longer for bank payments. You do not need to pay again.";
export const PUBLIC_PAYMENT_REFUNDED_EXPLANATION =
  "This payment was refunded.";
export const PUBLIC_PAYMENT_PARTIAL_REFUND_EXPLANATION =
  "A refund was recorded. The remaining amount is still outstanding.";

export const ACTIVITY_PAYMENT_REQUESTED_LABEL = "Payment requested";
export const ACTIVITY_PAYMENT_RECEIVED_LABEL = "Payment received";
export const ACTIVITY_PAYMENT_FAILED_LABEL = "Payment failed";
export const ACTIVITY_REFUND_RECORDED_LABEL = "Refund recorded";

export const JOB_PAYMENT_CREATE_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "invalid_payload",
  "not_found",
  "job_not_active",
  "job_not_approved",
  "no_acceptance",
  "not_connected",
  "conflicting_request",
  "deposit_already_paid",
  "deposit_required",
  "not_complete",
  "nothing_due",
  "invalid_amount",
  "invalid_amount_mode",
  "invalid_percentage",
  "amount_exceeds_collectible",
  "deposit_not_generic",
  "processing_not_cancellable",
  "signature_mismatch",
  "already_paid",
  "not_payable",
  "account_mismatch",
  "invalid_status",
] as const;

export type JobPaymentCreateErrorCode =
  (typeof JOB_PAYMENT_CREATE_ERROR_CODES)[number];
