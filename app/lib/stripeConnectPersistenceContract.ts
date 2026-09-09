import { isUuidLike } from "@/app/lib/uuid";

export type StripeConnectPersistenceResult = Record<string, unknown>;

/**
 * Acknowledge settlement only after canonical persistence or a safe replay.
 * Unbound ignored events retry because their request binding may arrive later.
 */
export function isConfirmedSettlementPersistence(
  result: StripeConnectPersistenceResult
): boolean {
  if (
    result.ok !== true ||
    result.ignored !== false ||
    !isUuidLike(result.payment_request_id) ||
    typeof result.idempotent_replay !== "boolean"
  ) {
    return false;
  }

  const hasCanonicalTransaction =
    isUuidLike(result.transaction_id);

  // Replays are acknowledged only when the RPC proves convergence on the
  // existing canonical request and transaction identities.
  if (result.idempotent_replay === true) {
    return hasCanonicalTransaction;
  }

  // A fresh apply must prove the canonical request update and lifecycle
  // invariant. Processing-only events legitimately have no transaction yet;
  // financial capture/failure applies include the canonical transaction id.
  return (
    result.job_stage_unchanged === true &&
    typeof result.request_status === "string" &&
    ["processing", "paid", "failed"].includes(result.request_status) &&
    (result.request_status === "processing"
      ? result.transaction_id === null || hasCanonicalTransaction
      : hasCanonicalTransaction)
  );
}

/** Provider-account truth must round-trip the exact signed Connect account. */
export function isConfirmedAccountPersistence(
  result: StripeConnectPersistenceResult,
  providerAccountId: string
): boolean {
  return (
    result.ok === true &&
    result.provider_account_id === providerAccountId &&
    typeof result.company_id === "string" &&
    result.company_id.length > 0
  );
}
