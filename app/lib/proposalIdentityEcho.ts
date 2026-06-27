/**
 * Proposal identity echo — pure field contract and staleness detection (Stage A).
 *
 * Compares draft context_echo identity/contact slices against live identity snapshots.
 * No DB, stores, React, mutations, freeze/send, or token behavior.
 */

/** Stable allowlist order for identity/display fields in context_echo. */
export const PROPOSAL_IDENTITY_ECHO_KEYS = [
  "company_name",
  "company_logo_url",
  "company_phone",
  "company_email",
  "company_website",
  "company_address",
  "customer_name",
  "customer_email",
  "customer_phone",
  "customer_address",
  "address_formatted",
  "job_name",
  "template_name",
  /** Optional — not yet stamped into ProposalVersionContextEcho; reserved for Stage B. */
  "proposal_number",
  /** Optional — reserved for echo stamp alignment with proposals.title. */
  "proposal_title",
] as const;

export type ProposalIdentityEchoKey = (typeof PROPOSAL_IDENTITY_ECHO_KEYS)[number];

export type ProposalIdentityEchoValue = string | null;

export type ProposalIdentityEchoSnapshot = Partial<
  Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue>
>;

export type ProposalIdentityEchoDiff = {
  key: ProposalIdentityEchoKey;
  draftValue: ProposalIdentityEchoValue;
  liveValue: ProposalIdentityEchoValue;
};

export type ProposalIdentityEchoStaleness = {
  isStale: boolean;
  changedFields: ProposalIdentityEchoDiff[];
};

/**
 * Normalize a single identity echo value for comparison.
 * Trims strings; empty/undefined/non-string → null.
 */
export function normalizeProposalIdentityEchoValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readIdentityEchoRawValue(
  contextEcho: unknown,
  key: ProposalIdentityEchoKey
): unknown {
  if (contextEcho == null || typeof contextEcho !== "object" || Array.isArray(contextEcho)) {
    return undefined;
  }
  return (contextEcho as Record<string, unknown>)[key];
}

/**
 * Pick only identity allowlist keys from a context_echo blob and normalize values.
 */
export function pickProposalIdentityEchoSnapshot(
  contextEcho: unknown
): ProposalIdentityEchoSnapshot {
  const snapshot: ProposalIdentityEchoSnapshot = {};

  for (const key of PROPOSAL_IDENTITY_ECHO_KEYS) {
    const normalized = normalizeProposalIdentityEchoValue(
      readIdentityEchoRawValue(contextEcho, key)
    );
    if (normalized != null) {
      snapshot[key] = normalized;
    }
  }

  return snapshot;
}

function normalizedIdentityValue(
  contextEcho: unknown,
  key: ProposalIdentityEchoKey
): ProposalIdentityEchoValue {
  return normalizeProposalIdentityEchoValue(readIdentityEchoRawValue(contextEcho, key));
}

/**
 * Compare draft vs live identity echo snapshots and report stale fields.
 * Field order in changedFields follows PROPOSAL_IDENTITY_ECHO_KEYS.
 */
export function diffProposalIdentityEcho(
  draftEcho: unknown,
  liveEcho: unknown
): ProposalIdentityEchoStaleness {
  const changedFields: ProposalIdentityEchoDiff[] = [];

  for (const key of PROPOSAL_IDENTITY_ECHO_KEYS) {
    const draftValue = normalizedIdentityValue(draftEcho, key);
    const liveValue = normalizedIdentityValue(liveEcho, key);

    if (draftValue !== liveValue) {
      changedFields.push({ key, draftValue, liveValue });
    }
  }

  return {
    isStale: changedFields.length > 0,
    changedFields,
  };
}

/** Convenience wrapper — true when any identity field differs after normalization. */
export function hasProposalIdentityEchoDrift(
  draftEcho: unknown,
  liveEcho: unknown
): boolean {
  return diffProposalIdentityEcho(draftEcho, liveEcho).isStale;
}

/** Full identity snapshot with every allowlist key normalized (null when empty). */
export function buildFullProposalIdentityEchoSnapshot(
  fields: Partial<Record<ProposalIdentityEchoKey, unknown>>
): Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue> {
  const snapshot = {} as Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue>;
  for (const key of PROPOSAL_IDENTITY_ECHO_KEYS) {
    snapshot[key] = normalizeProposalIdentityEchoValue(fields[key]);
  }
  return snapshot;
}

/**
 * Merge live identity values into a context_echo blob.
 * Updates only allowlist keys; preserves all other echo fields.
 */
export function mergeProposalIdentityEchoIntoContextEcho(
  contextEcho: unknown,
  liveIdentity: Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue>
): Record<string, unknown> {
  const base =
    contextEcho != null && typeof contextEcho === "object" && !Array.isArray(contextEcho)
      ? { ...(contextEcho as Record<string, unknown>) }
      : {};

  for (const key of PROPOSAL_IDENTITY_ECHO_KEYS) {
    const normalized = liveIdentity[key] ?? null;
    if (normalized == null) {
      delete base[key];
    } else {
      base[key] = normalized;
    }
  }

  return base;
}
