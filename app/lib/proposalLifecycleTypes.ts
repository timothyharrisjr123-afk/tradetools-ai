/**
 * FieldDive Proposal Lifecycle — type contract (3J0b).
 *
 * Lifecycle states, version kinds, and audit event types for job-scoped
 * proposal records. Pure types and label helpers only — no DB, store, React,
 * or transition enforcement at runtime (3J2+).
 *
 * Aligns with §6Z / PRICING_SNAPSHOT_INTENTS freeze_on_send / lock_on_sign.
 */

// ---------------------------------------------------------------------------
// Lifecycle status — proposals header
// ---------------------------------------------------------------------------

/** Contractor-facing proposal lifecycle (header row). */
export type ProposalStatus =
  | "draft"
  | "previewed"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "revised"
  | "archived"
  | "deleted";

export const PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  "draft",
  "previewed",
  "sent",
  "viewed",
  "signed",
  "declined",
  "revised",
  "archived",
  "deleted",
] as const;

/** Statuses where a mutable draft version may still exist. */
export const PROPOSAL_DRAFT_EDITABLE_STATUSES: readonly ProposalStatus[] = [
  "draft",
  "previewed",
  "revised",
] as const;

/** Statuses where at least one immutable sent/signed customer version exists. */
export const PROPOSAL_CUSTOMER_FROZEN_STATUSES: readonly ProposalStatus[] = [
  "sent",
  "viewed",
  "signed",
  "declined",
] as const;

// ---------------------------------------------------------------------------
// Version kind — proposal_versions row
// ---------------------------------------------------------------------------

/**
 * Immutable boundary for a proposal_versions row.
 * - draft: mutable (latest draft only)
 * - sent / signed: immutable customer truth
 * - superseded: prior sent replaced by revision; immutable archive
 */
export type ProposalVersionKind = "draft" | "sent" | "signed" | "superseded";

export const PROPOSAL_VERSION_KINDS: readonly ProposalVersionKind[] = [
  "draft",
  "sent",
  "signed",
  "superseded",
] as const;

export const PROPOSAL_IMMUTABLE_VERSION_KINDS: readonly ProposalVersionKind[] = [
  "sent",
  "signed",
  "superseded",
] as const;

// ---------------------------------------------------------------------------
// Audit events — proposal_events append-only log
// ---------------------------------------------------------------------------

export type ProposalEventType =
  | "created"
  | "draft_saved"
  | "previewed"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "revised"
  | "archived"
  | "payment_requested"
  | "payment_recorded"
  | "snapshot_frozen";

export const PROPOSAL_EVENT_TYPES: readonly ProposalEventType[] = [
  "created",
  "draft_saved",
  "previewed",
  "sent",
  "viewed",
  "signed",
  "declined",
  "revised",
  "archived",
  "payment_requested",
  "payment_recorded",
  "snapshot_frozen",
] as const;

// ---------------------------------------------------------------------------
// Pure helpers — documentation / future validation (no store I/O)
// ---------------------------------------------------------------------------

export function isImmutableProposalVersionKind(kind: ProposalVersionKind): boolean {
  return (PROPOSAL_IMMUTABLE_VERSION_KINDS as readonly string[]).includes(kind);
}

export function isDraftEditableProposalStatus(status: ProposalStatus): boolean {
  return (PROPOSAL_DRAFT_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function formatProposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "previewed":
      return "Previewed";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "signed":
      return "Signed";
    case "declined":
      return "Declined";
    case "revised":
      return "Revised";
    case "archived":
      return "Archived";
    case "deleted":
      return "Deleted";
    default:
      return status;
  }
}

export function formatProposalVersionKindLabel(kind: ProposalVersionKind): string {
  switch (kind) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "signed":
      return "Signed";
    case "superseded":
      return "Superseded";
    default:
      return kind;
  }
}
