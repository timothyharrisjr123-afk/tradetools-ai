/**
 * R18C4C — Pure public proposal review readiness for Contractor Preview.
 *
 * Models sent-snapshot and review-link states with product language only.
 * No DB, React, mint, or lifecycle mutation.
 */

import { isUuidLike } from "@/app/lib/uuid";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

export const PUBLIC_REVIEW_PANEL_TITLE = "Customer view";

export const PUBLIC_REVIEW_PANEL_INTRO =
  "Review the proposal exactly as your customer will see it after sending.";

export const PUBLIC_REVIEW_REVIEW_LINK_DISCLAIMER =
  "Creates a review link only. Does not email the customer.";

export const PUBLIC_REVIEW_LOADING_MESSAGE = "Checking public proposal readiness…";

export const PUBLIC_REVIEW_NO_SENT_SNAPSHOT_TITLE =
  "Customer view requires a sent proposal snapshot.";

export const PUBLIC_REVIEW_NO_SENT_SNAPSHOT_BODY =
  "The draft preview below is still editable and is not the public customer link.";

export const PUBLIC_REVIEW_SENT_READY_TITLE = "Customer view ready for review.";

export const PUBLIC_REVIEW_SENT_READY_BODY =
  "Create a review link to open the public proposal page.";

export const PUBLIC_REVIEW_LINK_READY_TITLE = "Review link ready.";

export const PUBLIC_REVIEW_LINK_READY_BODY =
  "This link opens the customer proposal page. It has not been emailed to the customer.";

export const PUBLIC_REVIEW_MINT_ERROR_MESSAGE =
  "We couldn't create a review link yet. Check the sent proposal snapshot and try again.";

export const PUBLIC_REVIEW_DEFERRED_SEND = "Send proposal — not enabled yet";
export const PUBLIC_REVIEW_DEFERRED_SIGNATURE = "Signature — coming later";
export const PUBLIC_REVIEW_DEFERRED_PDF = "PDF — coming later";
export const PUBLIC_REVIEW_DEFERRED_PAYMENT = "Payment — coming later";

export const PUBLIC_REVIEW_DEFERRED_ACTIONS = [
  { id: "send", label: PUBLIC_REVIEW_DEFERRED_SEND },
  { id: "signature", label: PUBLIC_REVIEW_DEFERRED_SIGNATURE },
  { id: "pdf", label: PUBLIC_REVIEW_DEFERRED_PDF },
  { id: "payment", label: PUBLIC_REVIEW_DEFERRED_PAYMENT },
] as const;

export type PublicReviewSentSnapshotStatus = "loading" | "not_created" | "ready";

export type PublicReviewLinkStatus = "loading" | "not_created" | "ready";

export type PublicReviewReadinessPhase =
  | "loading"
  | "no_sent_snapshot"
  | "sent_ready"
  | "link_ready"
  | "mint_error";

export type PublicReviewSessionLink = {
  publicUrl: string;
  tokenPrefix: string;
  expiresAt: string;
};

export type PublicReviewReadinessViewModel = {
  phase: PublicReviewReadinessPhase;
  sentSnapshotStatus: PublicReviewSentSnapshotStatus;
  reviewLinkStatus: PublicReviewLinkStatus;
  title: string;
  body: string;
  canCreateReviewLink: boolean;
  canOpenCustomerView: boolean;
  canCopyReviewLink: boolean;
  mintErrorMessage: string | null;
  deferredActions: readonly { id: string; label: string }[];
};

export function resolvePublicProposalSnapshotVersionId(
  proposal: Pick<ProposalRecord, "signed_version_id" | "latest_sent_version_id">
): string | null {
  const signed = (proposal.signed_version_id ?? "").trim();
  if (signed && isUuidLike(signed)) {
    return signed;
  }

  const sent = (proposal.latest_sent_version_id ?? "").trim();
  if (sent && isUuidLike(sent)) {
    return sent;
  }

  return null;
}

export function hasPublicProposalSentSnapshot(
  proposal: Pick<ProposalRecord, "signed_version_id" | "latest_sent_version_id">
): boolean {
  return resolvePublicProposalSnapshotVersionId(proposal) != null;
}

export function buildPublicProposalReviewUrl(origin: string, rawToken: string): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(rawToken)}`;
}

export function buildPublicReviewReadinessViewModel(input: {
  loading?: boolean;
  hasSentSnapshot: boolean;
  sessionLink: PublicReviewSessionLink | null;
  mintError?: boolean;
}): PublicReviewReadinessViewModel {
  const deferredActions = PUBLIC_REVIEW_DEFERRED_ACTIONS;

  if (input.loading) {
    return {
      phase: "loading",
      sentSnapshotStatus: "loading",
      reviewLinkStatus: "loading",
      title: PUBLIC_REVIEW_PANEL_TITLE,
      body: PUBLIC_REVIEW_LOADING_MESSAGE,
      canCreateReviewLink: false,
      canOpenCustomerView: false,
      canCopyReviewLink: false,
      mintErrorMessage: null,
      deferredActions,
    };
  }

  if (input.mintError) {
    return {
      phase: "mint_error",
      sentSnapshotStatus: input.hasSentSnapshot ? "ready" : "not_created",
      reviewLinkStatus: "not_created",
      title: PUBLIC_REVIEW_PANEL_TITLE,
      body: PUBLIC_REVIEW_MINT_ERROR_MESSAGE,
      canCreateReviewLink: input.hasSentSnapshot,
      canOpenCustomerView: false,
      canCopyReviewLink: false,
      mintErrorMessage: PUBLIC_REVIEW_MINT_ERROR_MESSAGE,
      deferredActions,
    };
  }

  if (!input.hasSentSnapshot) {
    return {
      phase: "no_sent_snapshot",
      sentSnapshotStatus: "not_created",
      reviewLinkStatus: "not_created",
      title: PUBLIC_REVIEW_NO_SENT_SNAPSHOT_TITLE,
      body: PUBLIC_REVIEW_NO_SENT_SNAPSHOT_BODY,
      canCreateReviewLink: false,
      canOpenCustomerView: false,
      canCopyReviewLink: false,
      mintErrorMessage: null,
      deferredActions,
    };
  }

  if (input.sessionLink) {
    return {
      phase: "link_ready",
      sentSnapshotStatus: "ready",
      reviewLinkStatus: "ready",
      title: PUBLIC_REVIEW_LINK_READY_TITLE,
      body: PUBLIC_REVIEW_LINK_READY_BODY,
      canCreateReviewLink: true,
      canOpenCustomerView: true,
      canCopyReviewLink: true,
      mintErrorMessage: null,
      deferredActions,
    };
  }

  return {
    phase: "sent_ready",
    sentSnapshotStatus: "ready",
    reviewLinkStatus: "not_created",
    title: PUBLIC_REVIEW_SENT_READY_TITLE,
    body: PUBLIC_REVIEW_SENT_READY_BODY,
    canCreateReviewLink: true,
    canOpenCustomerView: false,
    canCopyReviewLink: false,
    mintErrorMessage: null,
    deferredActions,
  };
}
