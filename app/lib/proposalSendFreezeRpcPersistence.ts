/**
 * R18B4A — Transactional send-freeze RPC persistence.
 *
 * Calls `persist_proposal_send_freeze_v1` with a pre-built payload from
 * proposalSendFreezePersistence. No sequential fallback, routes, or lifecycle UI.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import type { getSupabaseClient } from "@/app/lib/supabaseClient";
import type { ProposalSendFreezePersistPayload } from "@/app/lib/proposalSendFreezePersistence";

// ---------------------------------------------------------------------------
// RPC contract
// ---------------------------------------------------------------------------

export const PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1 = "persist_proposal_send_freeze_v1";

export type ProposalSendFreezeRpcResult = {
  ok: true;
  proposal_id: string;
  draft_version_id: string;
  sent_version_id: string;
  version_number: number;
  page_count: number;
  option_count: number;
  latest_sent_version_id: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalSendFreezeRpcPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSendFreezeRpcPersistenceError";
  }
}

// ---------------------------------------------------------------------------
// Env gate (default OFF — inverted from create/refresh RPC-default-on)
// ---------------------------------------------------------------------------

/** Explicit opt-in to send-freeze RPC — server-only; not for public/browser bundles. */
export function isProposalSendFreezeRpcEnabled(): boolean {
  return process.env.USE_PROPOSAL_SEND_FREEZE_RPC === "1";
}

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

function parsePositiveInt(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new ProposalSendFreezeRpcPersistenceError(
      `persist_proposal_send_freeze_v1 RPC returned invalid ${label}.`
    );
  }
  return n;
}

/**
 * Validates RPC JSON against the submitted payload. Exported for harness tests.
 */
export function parseProposalSendFreezeRpcResult(
  data: unknown,
  payload: ProposalSendFreezePersistPayload
): ProposalSendFreezeRpcResult {
  if (!data || typeof data !== "object") {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok !== true) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC returned ok !== true."
    );
  }

  const proposalId = String(result.proposal_id ?? "").trim();
  const draftVersionId = String(result.draft_version_id ?? "").trim();
  const sentVersionId = String(result.sent_version_id ?? "").trim();
  const latestSentVersionId = String(result.latest_sent_version_id ?? "").trim();
  const versionNumber = parsePositiveInt(result.version_number, "version_number");

  if (
    !isUuidLike(proposalId) ||
    !isUuidLike(draftVersionId) ||
    !isUuidLike(sentVersionId) ||
    !isUuidLike(latestSentVersionId)
  ) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC returned invalid ids."
    );
  }

  if (proposalId !== payload.proposal_id) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC proposal_id mismatch."
    );
  }

  if (draftVersionId !== payload.draft_version_id) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC draft_version_id mismatch."
    );
  }

  if (sentVersionId !== payload.sent_version_id) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC sent_version_id mismatch."
    );
  }

  if (versionNumber !== payload.version_number) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC version_number mismatch."
    );
  }

  if (latestSentVersionId !== sentVersionId) {
    throw new ProposalSendFreezeRpcPersistenceError(
      "persist_proposal_send_freeze_v1 RPC latest_sent_version_id mismatch."
    );
  }

  return {
    ok: true,
    proposal_id: proposalId,
    draft_version_id: draftVersionId,
    sent_version_id: sentVersionId,
    version_number: versionNumber,
    page_count: parsePositiveInt(result.page_count, "page_count"),
    option_count: parsePositiveInt(result.option_count, "option_count"),
    latest_sent_version_id: latestSentVersionId,
  };
}

export async function persistProposalSendFreezeViaRpc(
  supabase: SupabaseClient,
  payload: ProposalSendFreezePersistPayload
): Promise<ProposalSendFreezeRpcResult> {
  const { data, error } = await supabase.rpc(PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1, {
    p_payload: payload,
  });

  if (error) {
    throw new ProposalSendFreezeRpcPersistenceError(
      error.message ?? "persist_proposal_send_freeze_v1 RPC failed."
    );
  }

  return parseProposalSendFreezeRpcResult(data, payload);
}
