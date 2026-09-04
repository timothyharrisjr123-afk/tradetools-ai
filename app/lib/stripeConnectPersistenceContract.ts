export type StripeConnectPersistenceResult = Record<string, unknown>;

/**
 * Acknowledge settlement only after canonical persistence or a safe replay.
 * Unbound ignored events retry because their request binding may arrive later.
 */
export function isConfirmedSettlementPersistence(
  result: StripeConnectPersistenceResult
): boolean {
  return (
    result.ok === true &&
    (result.idempotent_replay === true || result.ignored === false)
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
