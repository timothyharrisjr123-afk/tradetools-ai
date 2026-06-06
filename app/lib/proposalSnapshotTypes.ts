/**
 * FieldDive Proposal Snapshot Boundaries — type contract (3J0b).
 *
 * Extends the freeze intent documented in proposalPricingTypes.ts
 * (PRICING_SNAPSHOT_INTENTS) with proposal-wide page/content boundaries.
 * Documentation-as-types for 3J2 snapshot builder — no persistence here.
 *
 * Do not modify proposalPricingEngine or PRICING_SNAPSHOT_INTENTS in 3J0b.
 */

import type { SnapshotFreezeStage } from "@/app/lib/proposalPricingTypes";

// ---------------------------------------------------------------------------
// Freeze stages (aligned with proposalPricingTypes.ts)
// ---------------------------------------------------------------------------

export type ProposalSnapshotFreezeStage = SnapshotFreezeStage;

export const PROPOSAL_SNAPSHOT_FREEZE_ON_SEND: ProposalSnapshotFreezeStage = "freeze_on_send";
export const PROPOSAL_SNAPSHOT_LOCK_ON_SIGN: ProposalSnapshotFreezeStage = "lock_on_sign";
export const PROPOSAL_SNAPSHOT_DRAFT_LIVE: ProposalSnapshotFreezeStage = "draft_live";

// ---------------------------------------------------------------------------
// Field classification
// ---------------------------------------------------------------------------

export type ProposalSnapshotFieldClass =
  | "quantity"
  | "unit_price"
  | "line_totals"
  | "option_totals"
  | "policy"
  | "tax"
  | "discount"
  | "option_selection"
  | "customer_copy"
  | "page_content"
  | "measurement_echo"
  | "context_echo";

export type ProposalSnapshotFreezeIntent = {
  fieldClass: ProposalSnapshotFieldClass;
  freezeStage: ProposalSnapshotFreezeStage;
  liveOnlyInDraft: boolean;
};

/**
 * Canonical proposal snapshot freeze intents — superset of pricing intents
 * plus page/content classes. Consumed by 3J2 snapshot builder design.
 */
export const PROPOSAL_SNAPSHOT_INTENTS: readonly ProposalSnapshotFreezeIntent[] = [
  { fieldClass: "quantity", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "unit_price", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "line_totals", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "option_totals", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "policy", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "tax", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "discount", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "option_selection", freezeStage: "lock_on_sign", liveOnlyInDraft: true },
  { fieldClass: "customer_copy", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "page_content", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "measurement_echo", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
  { fieldClass: "context_echo", freezeStage: "freeze_on_send", liveOnlyInDraft: true },
] as const;

/** Customer-visible fields frozen at send (normalized rows + echoes). */
export type ProposalSnapshotCustomerVisibleField =
  | "job_customer_company_context"
  | "proposal_pages"
  | "proposal_options"
  | "proposal_line_items"
  | "quantities"
  | "customer_unit_prices"
  | "customer_line_totals"
  | "customer_subtotal"
  | "discount"
  | "sales_tax"
  | "customer_total"
  | "terms_warranty_notes"
  | "measurement_echo"
  | "policy_echo_customer_safe";

export const PROPOSAL_SNAPSHOT_CUSTOMER_VISIBLE_FIELDS: readonly ProposalSnapshotCustomerVisibleField[] =
  [
    "job_customer_company_context",
    "proposal_pages",
    "proposal_options",
    "proposal_line_items",
    "quantities",
    "customer_unit_prices",
    "customer_line_totals",
    "customer_subtotal",
    "discount",
    "sales_tax",
    "customer_total",
    "terms_warranty_notes",
    "measurement_echo",
    "policy_echo_customer_safe",
  ] as const;

/** Fields that must never appear on customer snapshot surfaces. */
export type ProposalSnapshotInternalOnlyField =
  | "unit_cost"
  | "unit_cost_cents"
  | "internal_cost"
  | "internal_cost_cents"
  | "internal_profit"
  | "internal_profit_cents"
  | "profit"
  | "profit_cents"
  | "margin"
  | "margin_pct"
  | "markup"
  | "markup_pct"
  | "material_purchase_tax"
  | "full_pricing_policy_document"
  | "catalog_supplier_metadata"
  | "catalog_internal_metadata";

export const PROPOSAL_SNAPSHOT_INTERNAL_ONLY_FIELDS: readonly ProposalSnapshotInternalOnlyField[] =
  [
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
    "material_purchase_tax",
    "full_pricing_policy_document",
    "catalog_supplier_metadata",
    "catalog_internal_metadata",
  ] as const;

export type ProposalSnapshotBoundary = {
  customerVisible: readonly ProposalSnapshotCustomerVisibleField[];
  internalOnly: readonly ProposalSnapshotInternalOnlyField[];
  draftRecomputeOnOpen: boolean;
  draftManualRefreshSupported: boolean;
  sentSignedNeverAutoMutate: boolean;
  placeholderPolicyMustNeverSend: boolean;
};

/** Approved §6Z snapshot boundary rules (M2–M4, M7). */
export const PROPOSAL_SNAPSHOT_BOUNDARY: ProposalSnapshotBoundary = {
  customerVisible: PROPOSAL_SNAPSHOT_CUSTOMER_VISIBLE_FIELDS,
  internalOnly: PROPOSAL_SNAPSHOT_INTERNAL_ONLY_FIELDS,
  draftRecomputeOnOpen: true,
  draftManualRefreshSupported: true,
  sentSignedNeverAutoMutate: true,
  placeholderPolicyMustNeverSend: true,
};

export function formatProposalSnapshotFreezeStageLabel(
  stage: ProposalSnapshotFreezeStage
): string {
  switch (stage) {
    case "draft_live":
      return "Live in draft";
    case "freeze_on_send":
      return "Freeze on send";
    case "lock_on_sign":
      return "Lock on sign";
    default:
      return stage;
  }
}
