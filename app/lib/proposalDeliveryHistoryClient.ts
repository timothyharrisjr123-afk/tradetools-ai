/**
 * R18D3C3 — Client helpers for contractor delivery history read path.
 *
 * Pure fetch/parse utilities for Preview Send panel. No Send orchestration.
 */

import type {
  ProposalDeliveryAttemptListItemViewModel,
  ProposalDeliveryHistoryViewModel,
} from "@/app/lib/proposalDeliveryAttemptViewModel";

export const PROPOSAL_DELIVERY_HISTORY_API_PATH = "/api/proposals/delivery-attempts";

export const SEND_GATE_DELIVERY_HISTORY_SECTION_TITLE = "Email delivery history";

export const SEND_GATE_DELIVERY_HISTORY_LOADING_MESSAGE = "Loading delivery history…";

export const SEND_GATE_DELIVERY_HISTORY_ERROR_MESSAGE =
  "Couldn't load delivery history right now.";

export const SEND_GATE_DELIVERY_HISTORY_EARLIER_ATTEMPTS_LABEL = "Earlier attempts";

export const PROPOSAL_DELIVERY_HISTORY_FORBIDDEN_SERIALIZED_KEYS = [
  "id",
  "recipient_email_hash",
  "proposal_public_access_token_id",
  "proposal_version_id",
  "provider_message_id",
  "idempotency_key",
  "body_snapshot",
  "token_prefix",
] as const;

export type ProposalDeliveryHistoryFetchResult =
  | { ok: true; history: ProposalDeliveryHistoryViewModel }
  | { ok: false; error: string };

export function buildProposalDeliveryHistoryRequestUrl(
  proposalId: string,
  jobId: string
): string {
  const params = new URLSearchParams({
    proposalId: proposalId.trim(),
    jobId: jobId.trim(),
  });
  return `${PROPOSAL_DELIVERY_HISTORY_API_PATH}?${params.toString()}`;
}

export function formatProposalDeliveryHistoryTimestamp(
  iso: string | null | undefined
): string | null {
  if (iso == null || iso.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function parseProposalDeliveryHistoryResponse(
  payload: unknown
): ProposalDeliveryHistoryFetchResult {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "invalid_response" };
  }

  const record = payload as Record<string, unknown>;

  if (record.ok === true && record.history != null && typeof record.history === "object") {
    return {
      ok: true,
      history: record.history as ProposalDeliveryHistoryViewModel,
    };
  }

  if (record.ok === false) {
    const error =
      typeof record.error === "string" && record.error.trim().length > 0
        ? record.error.trim()
        : "request_failed";
    return { ok: false, error };
  }

  return { ok: false, error: "invalid_response" };
}

export function proposalDeliveryHistoryContainsForbiddenSerializedFields(
  value: unknown
): boolean {
  const serialized = JSON.stringify(value);
  for (const key of PROPOSAL_DELIVERY_HISTORY_FORBIDDEN_SERIALIZED_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      return true;
    }
  }
  return /\/p\/|https?:\/\//i.test(serialized);
}

export function getProposalDeliveryHistoryEarlierAttempts(
  history: ProposalDeliveryHistoryViewModel
): ProposalDeliveryAttemptListItemViewModel[] {
  if (history.history.length <= 1) {
    return [];
  }

  return history.history.slice(1);
}

export async function fetchProposalDeliveryHistory(
  input: { proposalId: string; jobId: string },
  deps: { fetch?: typeof fetch } = {}
): Promise<ProposalDeliveryHistoryFetchResult> {
  const proposalId = input.proposalId.trim();
  const jobId = input.jobId.trim();

  if (proposalId.length === 0 || jobId.length === 0) {
    return { ok: false, error: "missing_scope" };
  }

  const fetchFn = deps.fetch ?? fetch;
  const url = buildProposalDeliveryHistoryRequestUrl(proposalId, jobId);

  try {
    const response = await fetchFn(url);
    const payload = await response.json().catch(() => null);
    const parsed = parseProposalDeliveryHistoryResponse(payload);

    if (!response.ok) {
      return parsed.ok ? parsed : { ok: false, error: parsed.error };
    }

    return parsed;
  } catch {
    return { ok: false, error: "network_error" };
  }
}
