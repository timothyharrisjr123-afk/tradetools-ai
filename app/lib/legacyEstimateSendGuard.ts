/**
 * Legacy estimate send/approve fence — blocks DB proposal payloads from legacy lifecycle APIs.
 */

import { DB_BOARD_JOB_ID_PREFIX } from "@/app/lib/jobBoardAdapter";
import { isUuidLike } from "@/app/lib/jobStore";

export const LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE =
  "Legacy estimate send is not available for DB proposal drafts.";

export type LegacyEstimateSendPayloadHints = {
  savedEstimateId?: string | null;
  proposalId?: string | null;
  proposalJobId?: string | null;
  dbProposalRouteContext?: boolean;
};

export type LegacyEstimateSendValidation = {
  ok: boolean;
  error: string | null;
};

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Reject payloads that reference DB proposal workflow instead of legacy saved estimates. */
export function validateLegacyEstimateSendPayload(
  hints: LegacyEstimateSendPayloadHints
): LegacyEstimateSendValidation {
  const proposalId = normalizeId(hints.proposalId);
  if (proposalId && isUuidLike(proposalId)) {
    return {
      ok: false,
      error: LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE,
    };
  }

  if (hints.dbProposalRouteContext === true) {
    return {
      ok: false,
      error: LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE,
    };
  }

  const proposalJobId = normalizeId(hints.proposalJobId);
  if (proposalJobId && isUuidLike(proposalJobId) && hints.dbProposalRouteContext) {
    return {
      ok: false,
      error: LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE,
    };
  }

  const savedEstimateId = normalizeId(hints.savedEstimateId);
  if (savedEstimateId?.startsWith(DB_BOARD_JOB_ID_PREFIX)) {
    return {
      ok: false,
      error: LEGACY_ESTIMATE_SEND_BLOCKED_FOR_DB_MESSAGE,
    };
  }

  return { ok: true, error: null };
}
