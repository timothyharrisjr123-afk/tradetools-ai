/**
 * FieldDive Proposal Record — type contract (3J0b).
 *
 * Job-scoped proposal header (mutable lifecycle pointer). Line items, pages,
 * and pricing live on proposal_versions and child tables — not on this row.
 *
 * Types only — no DB, store, React, or pricing math.
 */

import type { ProposalStatus } from "@/app/lib/proposalLifecycleTypes";

// ---------------------------------------------------------------------------
// Core record
// ---------------------------------------------------------------------------

/**
 * One contractor-owned proposal instance (many per job allowed).
 * `jobs.active_proposal_id` points at the current working draft proposal.
 */
export type ProposalRecord = {
  id: string;
  company_id: string;
  job_id: string;
  /** Denormalized from job for list/filter queries. */
  customer_id: string | null;

  /** Template instantiated at create; draft detaches after copy-on-create (§6Z M5). */
  template_id: string;

  status: ProposalStatus;

  /** Latest editable draft version (mutable). */
  current_draft_version_id: string | null;
  /** Most recent immutable sent version (customer link source). */
  latest_sent_version_id: string | null;
  /** Accepted/signed immutable version. */
  signed_version_id: string | null;

  /** Live draft UI selection; frozen on signed version (lock_on_sign). */
  selected_option_id: string | null;

  /** Quantity source at create; draft may refresh measurement on open (§6Z M3). */
  measurement_record_id: string | null;
  /** Company pricing policy used for draft recompute; null when placeholder blocked. */
  pricing_policy_id: string | null;

  /** Human label — sequencing deferred to 3J1 (§6Z M8). */
  proposal_number: string | null;
  title: string | null;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  /** Authoritative mutable customer-facing draft-content change clock (041). */
  draft_content_changed_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

/** Summary for Job Card / list surfaces — no line detail. */
export type ProposalRecordStatusSummary = {
  id: string;
  job_id: string;
  status: ProposalStatus;
  title: string | null;
  proposal_number: string | null;
  template_id: string;
  /** Live draft package pointer — used for draft-open Job Card summary. */
  selected_option_id: string | null;
  latest_sent_version_id: string | null;
  signed_version_id: string | null;
  created_at: string | null;
  updated_at: string;
  /** Dirty-revision owner. Generic recency display still uses updated_at. */
  draft_content_changed_at: string;
};

// ---------------------------------------------------------------------------
// Create / update inputs (3J1+ store — shapes only)
// ---------------------------------------------------------------------------

export type ProposalRecordCreateInput = {
  company_id: string;
  job_id: string;
  customer_id?: string | null;
  template_id: string;
  measurement_record_id?: string | null;
  pricing_policy_id?: string | null;
  title?: string | null;
  proposal_number?: string | null;
  selected_option_id?: string | null;
  created_by?: string | null;
};

export type ProposalRecordUpdateInput = {
  status?: ProposalStatus;
  current_draft_version_id?: string | null;
  latest_sent_version_id?: string | null;
  signed_version_id?: string | null;
  selected_option_id?: string | null;
  measurement_record_id?: string | null;
  pricing_policy_id?: string | null;
  title?: string | null;
  proposal_number?: string | null;
  updated_by?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};
