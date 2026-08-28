/**
 * Contractor-facing measurement list/detail for the live Job Card.
 * Never exposes raw measurement UUIDs in visible copy.
 */

import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  deriveEstimateReadiness,
  formatMeasurementSourceLabel,
  formatSourceTypeLabel,
} from "@/app/lib/measurementReadiness";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function textContainsMeasurementUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function formatMeasurementCapturedOn(
  iso: string | null | undefined
): string | null {
  const raw = (iso ?? "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  try {
    // Same contractor-readable pattern as FieldDive payment/workspace dates (Aug 28, 2026).
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(parsed));
  } catch {
    return null;
  }
}

export function formatMeasurementDisplayName(
  record: Pick<MeasurementRecord, "source_type" | "source_provider">
): string {
  if (record.source_type === "manual") return "Manual measurement";
  const provider = (record.source_provider ?? "").trim();
  if (provider) return provider;
  return formatSourceTypeLabel(record.source_type) || "Measurement";
}

export function formatMeasurementQuantityLine(
  record: Pick<
    MeasurementRecord,
    "roof_area_sqft" | "waste_percent" | "roof_squares"
  >
): string {
  const parts: string[] = [];
  if (record.roof_area_sqft != null && Number.isFinite(record.roof_area_sqft)) {
    parts.push(`${Math.round(record.roof_area_sqft).toLocaleString()} sq ft`);
  }
  if (record.waste_percent != null && Number.isFinite(record.waste_percent)) {
    parts.push(`${record.waste_percent}% waste`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Quantities not entered";
}

export function formatMeasurementReadinessLabel(
  record: Pick<
    MeasurementRecord,
    | "roof_area_sqft"
    | "roof_squares"
    | "waste_percent"
    | "pitch_label"
    | "predominant_pitch"
    | "stories"
    | "status"
  >
): string {
  if (record.status === "stale") return "Stale";
  if (record.status === "rejected") return "Rejected";
  return deriveEstimateReadiness(record as MeasurementRecord).ready
    ? "Ready"
    : "Incomplete";
}

export type JobCardMeasurementListItem = {
  id: string;
  name: string;
  quantityLine: string;
  sourceLine: string;
  dateLabel: string | null;
  readinessLabel: string;
  selected: boolean;
  estimateReady: boolean;
  canEdit: boolean;
};

/**
 * Live Job Card current measurement.
 * Authority is measurement_records.is_selected, then jobs.selected_measurement_id.
 * Does not invent current from an unselected row, and does not use a proposal
 * measurement pointer as live current.
 */
export function resolveCanonicalJobMeasurement(input: {
  records: readonly MeasurementRecord[];
  selectedMeasurementId?: string | null;
}): MeasurementRecord | null {
  const flagged = input.records.find((row) => row.is_selected === true);
  if (flagged) return flagged;
  const selectedId = (input.selectedMeasurementId ?? "").trim();
  if (!selectedId) return null;
  return input.records.find((row) => row.id === selectedId) ?? null;
}

export function buildJobCardMeasurementListItem(input: {
  record: MeasurementRecord;
  selectedId: string | null | undefined;
}): JobCardMeasurementListItem {
  const selectedId = (input.selectedId ?? "").trim();
  const selected =
    input.record.is_selected === true ||
    (Boolean(selectedId) && input.record.id === selectedId);
  const dateLabel = formatMeasurementCapturedOn(input.record.created_at);
  const source = formatMeasurementSourceLabel(input.record);
  return {
    id: input.record.id,
    name: formatMeasurementDisplayName(input.record),
    quantityLine: formatMeasurementQuantityLine(input.record),
    sourceLine: dateLabel ? `${source} · ${dateLabel}` : source,
    dateLabel,
    readinessLabel: formatMeasurementReadinessLabel(input.record),
    selected,
    estimateReady: deriveEstimateReadiness(input.record).ready,
    canEdit: input.record.source_type === "manual",
  };
}

export function visibleMeasurementCopyHasNoUuid(
  item: JobCardMeasurementListItem
): boolean {
  return ![item.name, item.quantityLine, item.sourceLine, item.readinessLabel]
    .filter(Boolean)
    .some((value) => textContainsMeasurementUuid(value));
}
