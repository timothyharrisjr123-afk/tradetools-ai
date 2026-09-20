/**
 * V2C4 / Phase 1 — Preview chrome for draft / sent / accepted / revision truth.
 *
 * Preview draft document remains editable until acceptance suppresses ordinary
 * Send. Status labels are version-aware and must not collapse into vague
 * "Draft — last sent" wording after acceptance.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  formatAgreementPreviewStatusLabel,
  projectProposalAgreement,
  type AgreementAcceptanceFact,
  type AgreementPreviewChromeKind,
  type AgreementSignatureFact,
} from "@/app/lib/proposalAgreementProjection";

export type ProposalPreviewSentFrozenChromeKind =
  | "unsent_draft"
  | "draft_after_sent"
  | AgreementPreviewChromeKind;

export type ProposalPreviewSentFrozenChrome = {
  kind: ProposalPreviewSentFrozenChromeKind;
  /** Primary command-bar status. */
  statusLabel: string;
  /** True when a frozen sent version pointer exists. */
  hasLatestSentVersion: boolean;
  /** Formatted freeze timestamp when known; null if presence-only. */
  lastSentAtLabel: string | null;
  /** Phase 1: suppress ordinary Send / revision send for accepted agreements. */
  suppressOrdinarySend?: boolean;
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
 * Prefer agreement projection when acceptance/signature facts are supplied.
 */
export function buildProposalPreviewSentFrozenChrome(input: {
  latestSentVersionId: string | null | undefined;
  lastSentFrozenAt: string | null | undefined;
  latestSentVersionNumber?: number | null;
  draftContentChangedAt?: string | null;
  viewingVersionId?: string | null;
  viewingVersionNumber?: number | null;
  acceptance?: AgreementAcceptanceFact | null;
  signature?: AgreementSignatureFact | null;
  canonicalJobStage?: string | null;
  jobDisposition?: string | null;
}): ProposalPreviewSentFrozenChrome {
  const hasLatestSentVersion = hasLatestSentProposalVersionId(
    input.latestSentVersionId
  );
  const lastSentAtLabel = formatProposalPreviewLastSentAt(
    input.lastSentFrozenAt
  );

  if (
    input.acceptance ||
    input.signature ||
    input.viewingVersionId ||
    input.latestSentVersionNumber != null ||
    input.draftContentChangedAt
  ) {
    const projection = projectProposalAgreement({
      canonicalJobStage: input.canonicalJobStage ?? "proposal",
      jobDisposition: input.jobDisposition ?? "active",
      latestSentVersionId: input.latestSentVersionId,
      latestSentVersionNumber: input.latestSentVersionNumber,
      latestSentFrozenAt: input.lastSentFrozenAt,
      draftContentChangedAt: input.draftContentChangedAt,
      viewingVersionId: input.viewingVersionId,
      viewingVersionNumber: input.viewingVersionNumber,
      acceptance: input.acceptance,
      signature: input.signature,
    });
    return {
      kind: projection.previewChromeKind,
      statusLabel: projection.previewStatusLabel,
      hasLatestSentVersion,
      lastSentAtLabel,
      suppressOrdinarySend: projection.suppressOrdinarySend,
    };
  }

  if (!hasLatestSentVersion) {
    return {
      kind: "unsent_draft",
      statusLabel: formatAgreementPreviewStatusLabel({ kind: "never_sent" }),
      hasLatestSentVersion: false,
      lastSentAtLabel: null,
      suppressOrdinarySend: false,
    };
  }

  return {
    kind: "draft_after_sent",
    statusLabel: formatAgreementPreviewStatusLabel({
      kind: "current_sent",
      versionNumber: input.latestSentVersionNumber,
    }),
    hasLatestSentVersion: true,
    lastSentAtLabel,
    suppressOrdinarySend: false,
  };
}
