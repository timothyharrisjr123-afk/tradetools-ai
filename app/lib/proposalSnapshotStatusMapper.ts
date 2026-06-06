/**
 * FieldDive Proposal Snapshot Status Mapper (3J2B1).
 *
 * Shared mapping from pricing engine / Builder preview line status to persisted
 * proposal_line_items.pricing_status (ProposalPricingStatusSnapshot).
 *
 * Pure lib — no Supabase, React, stores, UI, or pricing math.
 * Consumed by proposalSnapshotBuilder (3J2B2) and proposalBuilderPricingPreview.
 */

import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import {
  PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS,
  type ProposalPricingStatusSnapshot,
} from "@/app/lib/proposalLineSnapshotTypes";
import type { LinePricingStatus, PricingPolicy } from "@/app/lib/proposalPricingTypes";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalSnapshotGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSnapshotGuardError";
  }
}

// ---------------------------------------------------------------------------
// Allowed snapshot pricing statuses (matches DB CHECK + proposalLineSnapshotTypes)
// ---------------------------------------------------------------------------

export const PROPOSAL_SNAPSHOT_PRICING_STATUSES: readonly ProposalPricingStatusSnapshot[] = [
  "priced",
  "grouped",
  "included",
  "needs_quantity",
  "not_priced",
  "omitted",
] as const;

const SNAPSHOT_STATUS_SET = new Set<string>(PROPOSAL_SNAPSHOT_PRICING_STATUSES);

/** Keys forbidden on customer-facing proposal_line_items rows (includes policy echo). */
const LINE_ROW_FORBIDDEN_KEYS = [...PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS, "policy_echo_json"] as const;

// ---------------------------------------------------------------------------
// Engine / preview → snapshot status
// ---------------------------------------------------------------------------

export type MapEngineLineStatusToSnapshotParams = {
  engineStatus: LinePricingStatus;
  customerVisibility: CustomerVisibility;
  /**
   * When true, unresolved_quantity surfaces as not_priced (missing catalog link).
   * Matches Builder preview behavior for absent catalog_item_id rows.
   */
  catalogItemMissing?: boolean;
};

/**
 * Map engine line status + visibility → persisted ProposalPricingStatusSnapshot.
 * Order matches Builder preview display rules (extracted from 3I-2A orchestrator).
 */
export function mapEngineLineStatusToSnapshot(
  params: MapEngineLineStatusToSnapshotParams
): ProposalPricingStatusSnapshot {
  const { engineStatus, customerVisibility, catalogItemMissing = false } = params;

  if (customerVisibility === "internal_only") return "omitted";
  if (engineStatus === "hidden") return "omitted";
  if (engineStatus === "unresolved_quantity") {
    return catalogItemMissing ? "not_priced" : "needs_quantity";
  }
  if (engineStatus === "unpriced" || engineStatus === "unsupported") return "not_priced";
  if (engineStatus === "included") return "included";
  if (engineStatus === "priced") {
    return customerVisibility === "grouped" ? "grouped" : "priced";
  }
  return "not_priced";
}

/**
 * Preview display status uses the same vocabulary as ProposalPricingStatusSnapshot.
 * Validates and returns the snapshot enum (identity map with guard).
 */
export function mapPreviewLineStatusToSnapshot(
  displayStatus: ProposalPricingStatusSnapshot
): ProposalPricingStatusSnapshot {
  if (!SNAPSHOT_STATUS_SET.has(displayStatus)) {
    throw new ProposalSnapshotGuardError(
      `Invalid preview line display status for snapshot: ${displayStatus}`
    );
  }
  return displayStatus;
}

// ---------------------------------------------------------------------------
// Customer-safe line row guard
// ---------------------------------------------------------------------------

/**
 * Reject plain objects that carry internal/cost/profit/margin/markup/policy echo keys.
 * Null values are still forbidden — keys must not exist on customer line rows.
 */
export function assertCustomerSafeLineRow(row: Record<string, unknown>): void {
  for (const key of LINE_ROW_FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      throw new ProposalSnapshotGuardError(`Forbidden customer line field: ${key}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Configured policy guard (persistence gate)
// ---------------------------------------------------------------------------

export type PersistablePricingPolicyInput = {
  /** Must be true — from CompanyPricingPolicyResolution.configured. */
  configured: boolean;
  /** When set, must be "company" (reject missing/starter_default/preview/placeholder). */
  source?: string;
  /** Resolved PricingPolicy when configured. */
  policy?: PricingPolicy | null;
  /** company_pricing_policies.id — required when requirePricingPolicyId is true. */
  pricingPolicyId?: string | null;
  /** Snapshot store sets true when persisting proposal header pricing_policy_id. */
  requirePricingPolicyId?: boolean;
};

/**
 * Gate proposal persistence on configured company policy — never placeholder preview.
 * Does not call the resolver; validates a resolution-like shape only.
 */
export function assertConfiguredPolicyForPersistence(input: PersistablePricingPolicyInput): void {
  if (!input.configured) {
    throw new ProposalSnapshotGuardError("Pricing policy is not configured for persistence.");
  }

  if (input.source != null && input.source !== "company") {
    throw new ProposalSnapshotGuardError(
      `Pricing policy source "${input.source}" is not persistable.`
    );
  }

  if (input.policy == null) {
    throw new ProposalSnapshotGuardError(
      "Pricing policy must be present when configured for persistence."
    );
  }

  if (input.requirePricingPolicyId) {
    const id = (input.pricingPolicyId ?? "").trim();
    if (!id) {
      throw new ProposalSnapshotGuardError(
        "pricing_policy_id is required for persistence when company policy is configured."
      );
    }
  }
}
