/**
 * FieldDive Proposal Version — type contract (3J0b).
 *
 * Versioned proposal content and pricing state. Supports mutable drafts and
 * immutable sent/signed snapshots via version_kind (§6Z M1).
 *
 * Types only — no DB, store, React, or snapshot writer (3J2+).
 */

import type { ProposalVersionKind } from "@/app/lib/proposalLifecycleTypes";

// ---------------------------------------------------------------------------
// Echo blobs — frozen context at send (JSONB in 3J1)
// ---------------------------------------------------------------------------

/** Customer-safe job/customer/company context copied at freeze. */
export type ProposalVersionContextEcho = {
  job_id: string;
  job_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  /** Customer mailing/customer address — distinct from job address_formatted. */
  customer_address?: string | null;
  address_formatted: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  /** Company contact phone — distinct from customer_phone. */
  company_phone?: string | null;
  /** Company license stored for document identity; show_license_on_cover gates display. */
  company_license?: string | null;
  /** Company HQ / mailing address — distinct from job address_formatted. */
  company_address?: string | null;
  company_website?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  show_license_on_cover?: boolean;
  template_id: string;
  template_name: string | null;
  measurement_record_id: string | null;
  /** Customer-safe quantity labels only — e.g. "24 SQ". */
  measurement_quantities_display: string | null;
};

/**
 * Customer-safe pricing policy echo at freeze — not full policy document.
 * Internal purchase tax and cost-side fields stay out of customer surfaces.
 */
export type ProposalVersionPolicyEcho = {
  pricing_policy_id: string | null;
  configured: boolean;
  profitability_type: "margin" | "markup";
  default_profitability_pct: number;
  sales_tax_rate_pct: number;
  discount_kind: "percent" | "fixed" | null;
  discount_value: number | null;
  waste_model: "adjusted_measurement" | "raw_plus_waste";
  quantity_rounding: "exact" | "whole";
};

// ---------------------------------------------------------------------------
// Version row
// ---------------------------------------------------------------------------

export type ProposalVersion = {
  id: string;
  company_id: string;
  proposal_id: string;

  /** Monotonic per proposal (1, 2, 3…). */
  version_number: number;
  version_kind: ProposalVersionKind;

  /** Revision chain — prior version this was copied from. */
  parent_version_id: string | null;

  /** Set when version_kind is sent/signed/superseded; null for mutable draft. */
  frozen_at: string | null;

  context_echo: ProposalVersionContextEcho | null;
  policy_echo: ProposalVersionPolicyEcho | null;

  created_by: string | null;
  created_at: string;
};

export type ProposalVersionCreateInput = {
  company_id: string;
  proposal_id: string;
  version_number: number;
  version_kind: ProposalVersionKind;
  parent_version_id?: string | null;
  frozen_at?: string | null;
  context_echo?: ProposalVersionContextEcho | null;
  policy_echo?: ProposalVersionPolicyEcho | null;
  created_by?: string | null;
};
