/**
 * FieldDive Proposal Line / Option Snapshots — type contract (3J0b).
 *
 * Customer-safe normalized rows for proposal options and line items.
 * Internal profitability lives in ProposalInternalSummarySnapshot only.
 *
 * Types only — no DB, store, React, or pricing engine changes.
 */

import type { GuardrailOutcome } from "@/app/lib/proposalPricingTypes";
import type { ProposalTemplateItemRole } from "@/app/lib/proposalTemplateTypes";

// ---------------------------------------------------------------------------
// Pricing / guardrail status echoes (customer-safe words)
// ---------------------------------------------------------------------------

/** Customer-facing line pricing status — mirrors Builder display statuses. */
export type ProposalPricingStatusSnapshot =
  | "priced"
  | "grouped"
  | "included"
  | "needs_quantity"
  | "not_priced"
  | "omitted";

export type ProposalGuardrailOutcomeSnapshot = GuardrailOutcome;

// ---------------------------------------------------------------------------
// Option snapshot — per proposal_version
// ---------------------------------------------------------------------------

export type ProposalOptionSnapshot = {
  id: string;
  company_id: string;
  proposal_version_id: string;

  source_template_option_id: string;
  name: string;
  customer_label: string | null;
  sort_order: number;
  is_default: boolean;
  visible_to_customer: boolean;

  pricing_complete: boolean;
  blocking_line_count: number;
  guardrail_outcome: ProposalGuardrailOutcomeSnapshot;

  customer_subtotal_cents: number | null;
  discount_cents: number | null;
  sales_tax_cents: number | null;
  customer_total_cents: number | null;
};

// ---------------------------------------------------------------------------
// Line item snapshot — customer-safe columns ONLY
// ---------------------------------------------------------------------------

/**
 * Customer-facing estimate line. Must NOT include unit_cost, internal_cost,
 * profit, margin, or markup — see proposalSnapshotTypes internal-only list.
 */
export type ProposalLineItemSnapshot = {
  id: string;
  company_id: string;
  proposal_option_id: string;

  source_template_item_id: string | null;
  catalog_item_id: string | null;
  catalog_seed_key: string | null;

  section_id: string | null;
  page_id: string | null;
  sort_order: number;

  customer_name: string;
  description: string | null;
  role: ProposalTemplateItemRole;

  quantity: number | null;
  quantity_display_label: string;
  quantity_source_label: string | null;
  unit: string | null;

  customer_unit_price_cents: number | null;
  customer_line_total_cents: number | null;

  pricing_status: ProposalPricingStatusSnapshot;
  visible_to_customer: boolean;
  measurement_quantity_key: string | null;
};

// ---------------------------------------------------------------------------
// Internal summary — contractor-only (separate table in 3J1)
// ---------------------------------------------------------------------------

/**
 * Contractor-only profitability per option. Never expose on customer routes/PDF.
 * Draft: recomputed live (§6Z M4). Sent/signed: frozen at send.
 */
export type ProposalInternalSummarySnapshot = {
  id: string;
  company_id: string;
  proposal_option_id: string;

  internal_cost_cents: number | null;
  internal_profit_cents: number | null;
  effective_margin_pct: number | null;

  /** Narrow policy echo for audit — not full PricingPolicy document. */
  policy_echo_json: Record<string, unknown> | null;
  computed_at: string;
};

/** Keys that must never appear on ProposalLineItemSnapshot (compile-time guard reference). */
export const PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS = [
  "unit_cost",
  "unit_cost_cents",
  "internal_cost",
  "internal_cost_cents",
  "internal_profit",
  "internal_profit_cents",
  "profit",
  "profit_cents",
  "margin",
  "margin_pct",
  "markup",
  "markup_pct",
] as const;

export type ProposalLineCustomerForbiddenKey =
  (typeof PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS)[number];
