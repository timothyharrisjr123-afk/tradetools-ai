/**
 * Manual measurement persistence draft for the live Job Card.
 * Quantity + readiness only — no pricing, proposal copy, or provider import.
 */

import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import type { MeasurementRecordDraft } from "@/app/lib/measurementStore";
import {
  deriveAllMissingFieldsForPersistence,
  deriveEstimateReadiness,
  deriveMeasurementReadinessScore,
  deriveMeasurementStatusForPersistence,
  deriveProductionReadiness,
  hasRoofSize,
} from "@/app/lib/measurementReadiness";

/** Optional report provenance labels — existing `report_source` column; not required. */
export const TRUSTED_MEASUREMENT_REPORT_SOURCES = [
  "EagleView",
  "Hover",
  "Roofr",
  "Manual",
  "Other",
] as const;

export type TrustedMeasurementReportSource =
  (typeof TRUSTED_MEASUREMENT_REPORT_SOURCES)[number];

export type JobCardManualMeasurementFields = {
  roof_area_sqft: number;
  waste_percent: number;
  pitch_label: string;
  stories: string;
  /** Optional; maps to measurement_records.report_source. */
  report_source?: string;
};

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function deriveManualMeasurementSquares(areaSqft: number): number | null {
  if (!Number.isFinite(areaSqft) || areaSqft <= 0) return null;
  return areaSqft / 100;
}

export function deriveManualAdjustedSquares(
  areaSqft: number,
  wastePercent: number
): number | null {
  const squares = deriveManualMeasurementSquares(areaSqft);
  if (squares == null) return null;
  if (!Number.isFinite(wastePercent)) return squares;
  return squares * (1 + wastePercent / 100);
}

export function buildManualMeasurementRecordShape(
  fields: JobCardManualMeasurementFields
): Pick<
  MeasurementRecord,
  | "source_type"
  | "status"
  | "is_selected"
  | "is_verified"
  | "roof_area_sqft"
  | "roof_squares"
  | "adjusted_roof_squares"
  | "waste_percent"
  | "pitch_label"
  | "stories"
  | "report_source"
> {
  const area = Number(fields.roof_area_sqft);
  const waste = Number(fields.waste_percent);
  const reportSource = (fields.report_source ?? "").trim() || "Manual";
  return {
    source_type: "manual",
    status: "incomplete",
    is_selected: false,
    is_verified: false,
    roof_area_sqft: finiteOrNull(area) ?? (Number.isFinite(area) ? area : null),
    roof_squares: deriveManualMeasurementSquares(area),
    adjusted_roof_squares: deriveManualAdjustedSquares(area, waste),
    waste_percent: Number.isFinite(waste) ? waste : null,
    pitch_label: fields.pitch_label.trim() || null,
    stories: fields.stories.trim() || null,
    report_source: reportSource,
  };
}

export function isManualMeasurementEstimateReady(
  fields: JobCardManualMeasurementFields
): boolean {
  const shape = buildManualMeasurementRecordShape(fields);
  return deriveEstimateReadiness(shape as MeasurementRecord).ready;
}

export function buildManualMeasurementDraftFromFields(input: {
  companyId: string;
  jobId: string;
  fields: JobCardManualMeasurementFields;
}): MeasurementRecordDraft {
  const shape = buildManualMeasurementRecordShape(input.fields);
  const record = shape as MeasurementRecord;
  const estimate = deriveEstimateReadiness(record);
  const production = deriveProductionReadiness(record);
  const estimateReady = estimate.ready;
  const productionReady = production.ready;

  return {
    company_id: input.companyId,
    job_id: input.jobId,
    estimate_id: null,
    source_type: "manual",
    status: deriveMeasurementStatusForPersistence(record, estimateReady),
    is_selected: false,
    is_verified: false,
    roof_area_sqft: shape.roof_area_sqft,
    roof_squares: shape.roof_squares,
    adjusted_roof_squares: shape.adjusted_roof_squares,
    waste_percent: shape.waste_percent,
    pitch_label: shape.pitch_label,
    stories: shape.stories,
    report_attached: false,
    diagram_available: false,
    report_status: "Not attached",
    report_source: shape.report_source,
    missing_fields: deriveAllMissingFieldsForPersistence(record),
    measurement_readiness_score: deriveMeasurementReadinessScore(
      estimateReady,
      productionReady,
      hasRoofSize(record)
    ),
    estimate_ready: estimateReady,
    production_ready: productionReady,
  };
}
