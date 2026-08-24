/**
 * V2F1 — Contractor sent-history presentation for one proposal lineage.
 *
 * Current = id === proposals.latest_sent_version_id.
 * Does not use version_kind=superseded. Does not persist summaries.
 */

import type { ProposalDeliveryAttemptStatus } from "@/app/lib/proposalDeliveryAttemptTypes";
import { isUuidLike } from "@/app/lib/uuid";

export type JobCardSentVersionFact = {
  versionId: string;
  frozenAt: string | null;
  packageLabel?: string | null;
  deliveryStatus?: ProposalDeliveryAttemptStatus | string | null;
};

export type JobCardSentHistoryRowView = {
  versionId: string;
  href?: string | null;
  sentAtLabel: string;
  packageLabel: string | null;
  deliveryStatusLabel: string | null;
  isCurrent: boolean;
};

export type JobCardSentHistoryView = {
  latestSentFrozenAt: string | null;
  rows: JobCardSentHistoryRowView[];
};

const COMPACT_DELIVERY_LABELS: Record<string, string | null> = {
  delivered: "Delivered",
  failed: "Failed",
  bounced: "Bounced",
  attempted: "Sending",
  provider_accepted: "Emailed",
  complained: "Complaint",
  prepared: null,
};

export function formatJobCardSentAtLabel(frozenAt: string | null | undefined): string | null {
  const raw = (frozenAt ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  try {
    const date = new Date(ms);
    const datePart = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${datePart}, ${timePart}`;
  } catch {
    return null;
  }
}

export function formatJobCardCompactDeliveryStatusLabel(
  status: string | null | undefined
): string | null {
  const key = (status ?? "").trim().toLowerCase();
  if (!key) return null;
  if (!(key in COMPACT_DELIVERY_LABELS)) return null;
  return COMPACT_DELIVERY_LABELS[key] ?? null;
}

function compareSentFactsNewestFirst(a: JobCardSentVersionFact, b: JobCardSentVersionFact): number {
  const aMs = Date.parse(a.frozenAt ?? "") || 0;
  const bMs = Date.parse(b.frozenAt ?? "") || 0;
  if (bMs !== aMs) return bMs - aMs;
  return String(b.versionId).localeCompare(String(a.versionId));
}

export function buildJobCardSentHistoryView(input: {
  latestSentVersionId?: string | null;
  versions: readonly JobCardSentVersionFact[];
}): JobCardSentHistoryView {
  const latestSentVersionId = (input.latestSentVersionId ?? "").trim();
  const latestPointerOk = latestSentVersionId.length > 0 && isUuidLike(latestSentVersionId);

  const sorted = [...input.versions]
    .filter((row) => isUuidLike((row.versionId ?? "").trim()))
    .sort(compareSentFactsNewestFirst);

  const latestFact =
    (latestPointerOk ? sorted.find((row) => row.versionId === latestSentVersionId) : null) ??
    null;

  const rows: JobCardSentHistoryRowView[] = [];
  for (const fact of sorted) {
    const sentAtLabel = formatJobCardSentAtLabel(fact.frozenAt);
    if (!sentAtLabel) continue;
    const packageLabel = (fact.packageLabel ?? "").trim() || null;
    rows.push({
      versionId: fact.versionId,
      sentAtLabel,
      packageLabel,
      deliveryStatusLabel: formatJobCardCompactDeliveryStatusLabel(fact.deliveryStatus),
      isCurrent: latestPointerOk && fact.versionId === latestSentVersionId,
    });
  }

  return {
    latestSentFrozenAt: latestFact?.frozenAt ?? null,
    rows,
  };
}
