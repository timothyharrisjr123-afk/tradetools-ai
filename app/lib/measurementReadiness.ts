/**
 * Pure measurement readiness / status truth for Job Card display and persistence.
 * No React, Supabase, pricing, or proposal logic.
 */

import type { MeasurementRecord, MeasurementSourceType, MeasurementStatus } from "@/app/lib/measurementTypes";

export const MEASUREMENT_MISSING_LABEL = {
  roofSize: "Roof size",
  wasteFactor: "Waste factor",
  pitch: "Pitch",
  stories: "Stories",
  reportMeasurements: "Report measurements",
  measurementReport: "Measurement report",
  verification: "Verification",
  lineMeasurements: "Line measurements",
  stale: "Stale measurement",
} as const;

export type MeasurementMissingTier = "estimate" | "production";

export type ReadinessResult = {
  ready: boolean;
  blockers: string[];
};

export type MeasurementWorkspaceStateInput = {
  localRecord: MeasurementRecord;
  persistedRecord: MeasurementRecord | null;
  hasUnsavedChanges: boolean;
};

export type MeasurementWorkspaceState = {
  recordLabel: string;
  headerStatus: string;
  sourceLabel: string;
  isPersistedManual: boolean;
  isPersistedNonManual: boolean;
  isLocalDraft: boolean;
  hasUnsavedChanges: boolean;
  hasLocalRoofSize: boolean;
};

export function hasRoofSize(record: MeasurementRecord): boolean {
  return (record.roof_area_sqft ?? 0) > 0 || (record.roof_squares ?? 0) > 0;
}

export function hasWastePercent(record: MeasurementRecord): boolean {
  return record.waste_percent != null && Number.isFinite(record.waste_percent);
}

export function hasPitch(record: MeasurementRecord): boolean {
  return Boolean((record.pitch_label ?? "").trim() || (record.predominant_pitch ?? "").trim());
}

export function hasStories(record: MeasurementRecord): boolean {
  return Boolean((record.stories ?? "").trim());
}

export function hasLineMeasurements(record: MeasurementRecord): boolean {
  const values = [
    record.roof_facets_count,
    record.eaves_lf,
    record.rakes_lf,
    record.ridges_lf,
    record.hips_lf,
    record.valleys_lf,
    record.wall_flashing_lf,
    record.step_flashing_lf,
    record.transitions_lf,
    record.parapet_wall_lf,
    record.drip_edge_lf,
    record.starter_lf,
    record.ridge_cap_lf,
  ];
  return values.some((v) => v != null && Number.isFinite(v));
}

export function isProviderBackedSource(sourceType: MeasurementSourceType): boolean {
  return sourceType !== "manual";
}

const SOURCE_TYPE_LABELS: Record<MeasurementSourceType, string> = {
  manual: "Manual",
  report_import: "Report import",
  provider_report: "Provider report",
  satellite: "Satellite",
  aerial: "Aerial",
  photo_ai: "Photo AI draft",
  address_ai: "Address AI",
  contractor_verified: "Contractor verified",
  external_import: "External import",
};

export function formatSourceTypeLabel(sourceType: MeasurementSourceType): string {
  return SOURCE_TYPE_LABELS[sourceType];
}

export function formatMeasurementSourceLabel(record: MeasurementRecord): string {
  const provider = (record.source_provider ?? "").trim();
  if (provider) return provider;
  return SOURCE_TYPE_LABELS[record.source_type];
}

export function formatNullableId(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

export function formatReportAttachedLabel(attached: boolean): string {
  return attached ? "Attached" : "Not attached";
}

export function formatDiagramAvailableLabel(available: boolean): string {
  return available ? "Available" : "Not available";
}

export function formatReportStatusLabel(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (!raw) return "Not started";
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");
  const labels: Record<string, string> = {
    not_started: "Not started",
    not_attached: "Not attached",
    pending: "Pending",
    processing: "Processing",
    available: "Available",
    ready: "Available",
    complete: "Available",
    completed: "Available",
    failed: "Failed",
    error: "Failed",
    needs_review: "Needs review",
  };
  return labels[normalized] ?? raw;
}

export function formatReportLastUpdatedLabel(value: string | null | undefined): string {
  if (!(value ?? "").trim()) return "Not updated yet";
  const parsed = Date.parse(value!);
  if (!Number.isFinite(parsed)) return value!.trim();
  return new Date(parsed).toLocaleString();
}

export function formatReportPathHelperText(input: {
  workspace: MeasurementWorkspaceState;
  estimateReady: boolean;
}): string {
  if (input.workspace.isPersistedNonManual) {
    return "Review provider report data and line measurements before production.";
  }
  if (input.workspace.isPersistedManual && input.estimateReady) {
    return "Manual measurements are estimate-ready; production needs a verified report or provider data.";
  }
  return "Order a provider report, attach a PDF, or add a photo/AI draft when those flows are enabled.";
}

export function deriveEstimateReadiness(record: MeasurementRecord): ReadinessResult {
  const blockers: string[] = [];
  if (!hasRoofSize(record)) blockers.push(MEASUREMENT_MISSING_LABEL.roofSize);
  if (!hasWastePercent(record)) blockers.push(MEASUREMENT_MISSING_LABEL.wasteFactor);
  if (!hasPitch(record)) blockers.push(MEASUREMENT_MISSING_LABEL.pitch);
  if (!hasStories(record)) blockers.push(MEASUREMENT_MISSING_LABEL.stories);
  return { ready: blockers.length === 0, blockers };
}

export function deriveProductionReadiness(record: MeasurementRecord): ReadinessResult {
  const blockers: string[] = [];

  if (record.status === "stale") {
    blockers.push(MEASUREMENT_MISSING_LABEL.stale);
    return { ready: false, blockers };
  }

  const providerBacked = isProviderBackedSource(record.source_type);

  if (!record.is_verified && !providerBacked) {
    blockers.push(MEASUREMENT_MISSING_LABEL.verification);
  }

  if (!record.report_attached && !providerBacked) {
    blockers.push(MEASUREMENT_MISSING_LABEL.measurementReport);
  }

  const hasProductionQuantities =
    hasLineMeasurements(record) ||
    (record.roof_facets_count != null &&
      Number.isFinite(record.roof_facets_count) &&
      record.roof_facets_count > 0);

  if (!hasProductionQuantities) {
    blockers.push(MEASUREMENT_MISSING_LABEL.lineMeasurements);
  }

  return { ready: blockers.length === 0, blockers };
}

export function deriveMeasurementMissingFields(
  record: MeasurementRecord,
  tier: MeasurementMissingTier
): string[] {
  const estimate = deriveEstimateReadiness(record);
  const production = deriveProductionReadiness(record);

  if (tier === "estimate") return [...estimate.blockers];
  return [...production.blockers];
}

export function deriveAllMissingFieldsForPersistence(record: MeasurementRecord): string[] {
  const estimate = deriveEstimateReadiness(record);
  const production = deriveProductionReadiness(record);
  const combined = [...estimate.blockers, ...production.blockers];
  return [...new Set(combined)];
}

export function deriveMeasurementStatusForPersistence(
  record: MeasurementRecord,
  estimateReady: boolean
): MeasurementStatus {
  if (record.status === "stale") return "stale";
  if (!hasRoofSize(record)) return "incomplete";
  if (!estimateReady) return "needs_review";
  if (record.is_verified) return "verified";
  return "measured";
}

export function deriveMeasurementReadinessScore(
  estimateReady: boolean,
  productionReady: boolean,
  hasRoofSizeValue: boolean
): number {
  if (productionReady) return 100;
  if (estimateReady) return 80;
  if (hasRoofSizeValue) return 50;
  return 0;
}

export function measurementRecordsDiffer(
  local: MeasurementRecord,
  persisted: MeasurementRecord
): boolean {
  const num = (a: number | null | undefined, b: number | null | undefined) =>
    (a ?? null) !== (b ?? null);
  if (num(local.roof_area_sqft, persisted.roof_area_sqft)) return true;
  if (num(local.roof_squares, persisted.roof_squares)) return true;
  if (num(local.waste_percent, persisted.waste_percent)) return true;
  if ((local.pitch_label ?? "").trim() !== (persisted.pitch_label ?? "").trim()) return true;
  if ((local.stories ?? "").trim() !== (persisted.stories ?? "").trim()) return true;
  if ((local.roof_complexity ?? "").trim() !== (persisted.roof_complexity ?? "").trim()) return true;
  return false;
}

export function resolveMeasurementWorkspaceState(
  input: MeasurementWorkspaceStateInput
): MeasurementWorkspaceState {
  const { localRecord, persistedRecord, hasUnsavedChanges } = input;
  const hasLocalRoofSize = hasRoofSize(localRecord);
  const isPersistedManual = persistedRecord?.source_type === "manual";
  const isPersistedNonManual = persistedRecord != null && !isPersistedManual;
  const isLocalDraft = !persistedRecord || hasUnsavedChanges;

  let recordLabel: string;
  if (isPersistedNonManual && persistedRecord) {
    recordLabel = persistedRecord.is_verified
      ? "Verified"
      : formatMeasurementSourceLabel(persistedRecord);
  } else if (isPersistedManual && !hasUnsavedChanges) {
    recordLabel = "Saved manual";
  } else if (hasLocalRoofSize) {
    recordLabel = "Local draft";
  } else {
    recordLabel = "Not started";
  }

  let headerStatus: string;
  if (isPersistedNonManual && persistedRecord) {
    headerStatus = persistedRecord.is_verified
      ? "Verified"
      : formatMeasurementSourceLabel(persistedRecord);
  } else if (isPersistedManual && !hasUnsavedChanges) {
    headerStatus = "Saved manual";
  } else if (hasLocalRoofSize) {
    headerStatus = "Local draft";
  } else {
    headerStatus = "Not measured";
  }

  const sourceLabel = isPersistedNonManual && persistedRecord
    ? formatMeasurementSourceLabel(persistedRecord)
    : "Manual";

  return {
    recordLabel,
    headerStatus,
    sourceLabel,
    isPersistedManual: Boolean(isPersistedManual),
    isPersistedNonManual,
    isLocalDraft,
    hasUnsavedChanges,
    hasLocalRoofSize,
  };
}

export function formatEstimateReadinessLabel(ready: boolean, blockers: string[]): string {
  if (ready) return "Estimate-ready";
  if (blockers.includes(MEASUREMENT_MISSING_LABEL.roofSize)) return "Needs roof size";
  return "Needs review";
}

export function formatProductionReadinessLabel(ready: boolean, blockers: string[]): string {
  if (ready) return "Production-ready";
  if (blockers.includes(MEASUREMENT_MISSING_LABEL.stale)) {
    return "Not ready — stale measurement";
  }
  if (
    blockers.includes(MEASUREMENT_MISSING_LABEL.verification) ||
    blockers.includes(MEASUREMENT_MISSING_LABEL.measurementReport)
  ) {
    return "Not ready — needs verified report";
  }
  if (blockers.includes(MEASUREMENT_MISSING_LABEL.lineMeasurements)) {
    return "Needs line measurements";
  }
  return "Not ready";
}

export function formatRailMeasurementStatusLabel(
  workspace: MeasurementWorkspaceState,
  estimateReady: boolean,
  productionReady: boolean,
  persistedRecord: MeasurementRecord | null
): { label: string; ready: boolean } {
  if (!workspace.hasLocalRoofSize && !workspace.isPersistedManual && !workspace.isPersistedNonManual) {
    return { label: "Needs roof size", ready: false };
  }
  if (workspace.isLocalDraft && estimateReady) {
    return { label: "Draft", ready: false };
  }
  if (workspace.isLocalDraft) {
    return { label: "Needs review", ready: false };
  }
  if (productionReady && persistedRecord) {
    return { label: "Production-ready", ready: true };
  }
  if (workspace.isPersistedNonManual && persistedRecord && estimateReady) {
    return { label: formatMeasurementSourceLabel(persistedRecord), ready: true };
  }
  if (workspace.isPersistedManual && estimateReady) {
    return { label: "Estimate-ready", ready: true };
  }
  if (workspace.isPersistedManual) {
    return { label: "Saved manual", ready: false };
  }
  return { label: "Pending", ready: false };
}

export function resolveNextMeasurementAction(input: {
  workspace: MeasurementWorkspaceState;
  estimateReady: boolean;
  persistedRecord: MeasurementRecord | null;
}): { title: string; subtitle: string; done: boolean } {
  const { workspace, estimateReady, persistedRecord } = input;

  if (!workspace.hasLocalRoofSize && !workspace.isPersistedManual && !workspace.isPersistedNonManual) {
    return {
      title: "Enter roof size",
      subtitle: "Add roof area in Measurements",
      done: false,
    };
  }

  if (workspace.isLocalDraft && estimateReady) {
    return {
      title: "Save measurement",
      subtitle: "Save manual measurement to this job",
      done: false,
    };
  }

  if (workspace.isLocalDraft) {
    return {
      title: "Complete measurement details",
      subtitle: "Waste factor, pitch, and stories",
      done: false,
    };
  }

  if (workspace.isPersistedManual && estimateReady) {
    return {
      title: "Attach photos or report",
      subtitle: "Optional before proposal builder",
      done: true,
    };
  }

  if (workspace.isPersistedNonManual && persistedRecord) {
    return {
      title: "Review report measurements",
      subtitle: "Verify line measurements and report data",
      done: estimateReady,
    };
  }

  return {
    title: "Confirm roof measurements",
    subtitle: "Roof size, waste factor, pitch",
    done: workspace.hasLocalRoofSize,
  };
}

export function resolveActivityMeasurementLine(input: {
  persistedRecord: MeasurementRecord | null;
  isPersistedManual: boolean;
  isPersistedNonManual: boolean;
}): { label: string; note: string } {
  if (input.isPersistedManual && input.persistedRecord) {
    return { label: "Measurement saved", note: "Manual measurement on file" };
  }
  if (input.isPersistedNonManual && input.persistedRecord) {
    return {
      label: "Provider measurement selected",
      note: formatMeasurementSourceLabel(input.persistedRecord),
    };
  }
  return { label: "Measurements pending", note: "Not saved yet" };
}

export function resolveReportPathNextAction(input: {
  workspace: MeasurementWorkspaceState;
  estimateReady: boolean;
  persistedRecord: MeasurementRecord | null;
}): { title: string; subtitle: string; done: boolean } {
  if (input.workspace.isPersistedNonManual && input.persistedRecord) {
    return {
      title: "Review report measurements",
      subtitle: "Verify line measurements and report data",
      done: input.estimateReady,
    };
  }
  if (input.workspace.isPersistedManual && input.estimateReady) {
    return {
      title: "Order or attach report",
      subtitle: "Provider order or PDF upload coming soon",
      done: false,
    };
  }
  return {
    title: "Attach photos or report",
    subtitle: "Inspection photos or measurement report later",
    done: false,
  };
}
