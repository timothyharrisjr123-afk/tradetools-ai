/**
 * V2C4 — Pure Preview sent/frozen chrome helpers.
 *
 * Preview always renders the current editable draft document.
 * When latest_sent_version_id exists, chrome must not look "Draft-only".
 * Delivery attempt status is NOT a proxy for sent/frozen truth.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import {
  CUSTOMER_PREVIEW_DRAFT_STATUS,
  CUSTOMER_PREVIEW_LAST_SENT_PREFIX,
} from "@/app/lib/proposalBuilderDocumentIa";

export type ProposalPreviewSentFrozenChromeKind = "unsent_draft" | "draft_after_sent";

export type ProposalPreviewSentFrozenChrome = {
  kind: ProposalPreviewSentFrozenChromeKind;
  /** Primary command-bar status (e.g. "Draft" or "Draft — last sent Jul 22, 4:31 PM"). */
  statusLabel: string;
  /** True when a frozen sent version pointer exists. */
  hasLatestSentVersion: boolean;
  /** Formatted freeze timestamp when known; null if presence-only. */
  lastSentAtLabel: string | null;
};

export function hasLatestSentProposalVersionId(
  latestSentVersionId: string | null | undefined
): boolean {
  const id = (latestSentVersionId ?? "").trim();
  return id.length > 0 && isUuidLike(id);
}

export function formatProposalPreviewLastSentAt(
  frozenAtIso: string | null | undefined
): string | null {
  if (frozenAtIso == null || frozenAtIso.trim().length === 0) return null;
  const ms = Date.parse(frozenAtIso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

/**
 * Build contractor Preview command-bar status.
 * Document is always the editable draft — never claim "Sent version" here.
 */
export function buildProposalPreviewSentFrozenChrome(input: {
  latestSentVersionId: string | null | undefined;
  lastSentFrozenAt: string | null | undefined;
}): ProposalPreviewSentFrozenChrome {
  const hasLatestSentVersion = hasLatestSentProposalVersionId(input.latestSentVersionId);
  if (!hasLatestSentVersion) {
    return {
      kind: "unsent_draft",
      statusLabel: CUSTOMER_PREVIEW_DRAFT_STATUS,
      hasLatestSentVersion: false,
      lastSentAtLabel: null,
    };
  }

  const lastSentAtLabel = formatProposalPreviewLastSentAt(input.lastSentFrozenAt);
  const statusLabel = lastSentAtLabel
    ? `${CUSTOMER_PREVIEW_DRAFT_STATUS} — ${CUSTOMER_PREVIEW_LAST_SENT_PREFIX} ${lastSentAtLabel}`
    : `${CUSTOMER_PREVIEW_DRAFT_STATUS} — ${CUSTOMER_PREVIEW_LAST_SENT_PREFIX}`;

  return {
    kind: "draft_after_sent",
    statusLabel,
    hasLatestSentVersion: true,
    lastSentAtLabel,
  };
}
