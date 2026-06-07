/**
 * Proposal pricing staleness — pure detection helper (Pricing Trust Hardening).
 *
 * A persisted proposal draft snapshots its pricing against the measurement that
 * was current when the snapshot was built (`proposal_versions.context_echo`
 * .measurement_record_id). When the job's currently selected measurement differs
 * from that snapshot measurement, the persisted prices/quantities are stale and
 * the Builder must say so instead of presenting live quantities beside snapshot
 * prices (no mixed truth — §6J).
 *
 * Pure: no Supabase, React, persistence, or pricing math. Detection only.
 */

export type ProposalStalenessReason =
  | "measurement_changed"
  | "measurement_updated"
  | "measurement_unknown"
  | null;

export type DeriveProposalPricingStaleInput = {
  /** measurement_record_id captured in the proposal version snapshot. */
  snapshotMeasurementId: string | null | undefined;
  /** Currently selected measurement id for the job (live). */
  currentMeasurementId: string | null | undefined;
  /** Snapshot timestamp (e.g. proposal/version updated_at). Optional. */
  snapshotUpdatedAt?: string | null;
  /** Current measurement updated_at. Optional. */
  measurementUpdatedAt?: string | null;
};

export type ProposalPricingStaleResult = {
  stale: boolean;
  reason: ProposalStalenessReason;
};

function normalizeId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTime(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Decide whether a persisted draft's pricing snapshot is stale relative to the
 * job's currently selected measurement.
 *
 * Rules (id comparison is primary):
 *  - No current measurement to compare against → not stale.
 *  - Snapshot has no recorded measurement id but a current one exists →
 *    `measurement_unknown` (snapshot predates measurement tracking; flag so a
 *    refresh records the id and clears the state).
 *  - Ids differ → `measurement_changed`.
 *  - Ids equal, and both timestamps present with current measurement newer than
 *    the snapshot → `measurement_updated`.
 *  - Otherwise → not stale.
 */
export function deriveProposalPricingStale(
  input: DeriveProposalPricingStaleInput
): ProposalPricingStaleResult {
  const snapshotId = normalizeId(input.snapshotMeasurementId);
  const currentId = normalizeId(input.currentMeasurementId);

  if (!currentId) {
    return { stale: false, reason: null };
  }

  if (!snapshotId) {
    return { stale: true, reason: "measurement_unknown" };
  }

  if (snapshotId !== currentId) {
    return { stale: true, reason: "measurement_changed" };
  }

  const snapshotTime = parseTime(input.snapshotUpdatedAt);
  const measurementTime = parseTime(input.measurementUpdatedAt);
  if (snapshotTime != null && measurementTime != null && measurementTime > snapshotTime) {
    return { stale: true, reason: "measurement_updated" };
  }

  return { stale: false, reason: null };
}

export const PROPOSAL_PRICING_STALE_BANNER_COPY =
  "Proposal pricing is based on an older measurement. Refresh draft pricing.";
