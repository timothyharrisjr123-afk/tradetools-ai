/**
 * V2F1 — Derived contractor proposal lifecycle presentation.
 *
 * Pointer/timestamp truth only. Not persisted. Header status is ignored.
 * Job stage is not consumed or written.
 *
 * Dirty-revision signal is proposals.draft_content_changed_at > latest sent
 * frozen_at. Persist ownership is draft-scoped DB triggers / RPCs — Job Card
 * only reads the header clock. Send-prep uses the same comparison via
 * isMutableDraftDirtyAfterSentFreeze (excluding pricingStale / missing
 * snapshot, which remain send-prep-only freeze reasons).
 */

import { isUuidLike } from "@/app/lib/jobStore";

export const CONTRACTOR_PROPOSAL_LIFECYCLE_KINDS = [
  "draft",
  "sent",
  "revision_in_progress",
  "signed",
] as const;

export type ContractorProposalLifecycleKind =
  (typeof CONTRACTOR_PROPOSAL_LIFECYCLE_KINDS)[number];

/** Contractor-facing labels. Signed is recognized internally; UI still says Sent. */
export const CONTRACTOR_PROPOSAL_LIFECYCLE_STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  revision_in_progress: "Revision in progress",
  signed: "Sent",
} as const satisfies Record<ContractorProposalLifecycleKind, string>;

export type ContractorProposalLifecycle = {
  kind: ContractorProposalLifecycleKind;
  statusLabel: string;
  hasLatestSentVersion: boolean;
  isDraftDirtyAfterLatestSent: boolean;
  editingAllowed: boolean;
};

export type DeriveContractorProposalLifecycleInput = {
  latestSentVersionId?: string | null;
  signedVersionId?: string | null;
  /** proposals.draft_content_changed_at — not generic updated_at. */
  draftContentChangedAt?: string | null;
  /** proposal_versions.frozen_at for latest_sent_version_id. */
  latestSentFrozenAt?: string | null;
  /**
   * Ignored. Accepted only so callers can prove header status does not win.
   */
  headerStatus?: string | null;
};

function hasVersionPointer(id: string | null | undefined): boolean {
  const value = (id ?? "").trim();
  return value.length > 0 && isUuidLike(value);
}

/**
 * True when authoritative mutable draft content changed after the latest sent freeze.
 *
 * Uses strict `>` so a freeze that does not advance draft_content_changed_at
 * does not look like a contractor revision (even though generic updated_at moves).
 *
 * Missing frozen_at → not dirty (Job Card must not invent Revision in progress).
 */
export function isMutableDraftDirtyAfterSentFreeze(input: {
  draftContentChangedAt?: string | null;
  latestSentFrozenAt?: string | null;
}): boolean {
  const frozenRaw = (input.latestSentFrozenAt ?? "").trim();
  if (!frozenRaw) return false;
  const draftRaw = (input.draftContentChangedAt ?? "").trim();
  if (!draftRaw) return false;
  const draftMs = Date.parse(draftRaw);
  const frozenMs = Date.parse(frozenRaw);
  if (!Number.isFinite(draftMs) || !Number.isFinite(frozenMs)) return false;
  return draftMs > frozenMs;
}

export function formatContractorProposalLifecycleStatusLabel(
  kind: ContractorProposalLifecycleKind
): string {
  return CONTRACTOR_PROPOSAL_LIFECYCLE_STATUS_LABELS[kind];
}

export function isContractorProposalEditingAllowed(
  kind: ContractorProposalLifecycleKind
): boolean {
  return kind !== "signed";
}

export function deriveContractorProposalLifecycle(
  input: DeriveContractorProposalLifecycleInput
): ContractorProposalLifecycle {
  void input.headerStatus;

  const hasSignedVersion = hasVersionPointer(input.signedVersionId);
  const hasLatestSentVersion = hasVersionPointer(input.latestSentVersionId);
  const isDraftDirtyAfterLatestSent =
    hasLatestSentVersion &&
    isMutableDraftDirtyAfterSentFreeze({
      draftContentChangedAt: input.draftContentChangedAt,
      latestSentFrozenAt: input.latestSentFrozenAt,
    });

  if (hasSignedVersion) {
    return {
      kind: "signed",
      statusLabel: formatContractorProposalLifecycleStatusLabel("signed"),
      hasLatestSentVersion,
      isDraftDirtyAfterLatestSent,
      editingAllowed: false,
    };
  }

  if (!hasLatestSentVersion) {
    return {
      kind: "draft",
      statusLabel: formatContractorProposalLifecycleStatusLabel("draft"),
      hasLatestSentVersion: false,
      isDraftDirtyAfterLatestSent: false,
      editingAllowed: true,
    };
  }

  if (isDraftDirtyAfterLatestSent) {
    return {
      kind: "revision_in_progress",
      statusLabel: formatContractorProposalLifecycleStatusLabel("revision_in_progress"),
      hasLatestSentVersion: true,
      isDraftDirtyAfterLatestSent: true,
      editingAllowed: true,
    };
  }

  return {
    kind: "sent",
    statusLabel: formatContractorProposalLifecycleStatusLabel("sent"),
    hasLatestSentVersion: true,
    isDraftDirtyAfterLatestSent: false,
    editingAllowed: true,
  };
}
