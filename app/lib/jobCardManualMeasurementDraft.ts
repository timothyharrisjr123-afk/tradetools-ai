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
  /** Report geometry — linear feet; NaN means missing (not zero). */
  eaves_lf?: number;
  rakes_lf?: number;
  ridges_lf?: number;
  hips_lf?: number;
  valleys_lf?: number;
  step_flashing_lf?: number;
  /** Job/scope counts; NaN means missing (not zero). Zero is a valid entered value. */
  pipe_boots_count?: number;
  vents_count?: number;
  /** Job/scope; null means unanswered. */
  tear_off_required?: boolean | null;
  debris_tons_estimate?: number;
};

function finitePositiveOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

function isEnteredNumber(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value);
}

export function emptyJobCardManualMeasurementFields(): JobCardManualMeasurementFields {
  return {
    roof_area_sqft: 0,
    waste_percent: Number.NaN,
    pitch_label: "",
    stories: "",
    report_source: "",
    eaves_lf: Number.NaN,
    rakes_lf: Number.NaN,
    ridges_lf: Number.NaN,
    hips_lf: Number.NaN,
    valleys_lf: Number.NaN,
    step_flashing_lf: Number.NaN,
    pipe_boots_count: Number.NaN,
    vents_count: Number.NaN,
    tear_off_required: null,
    debris_tons_estimate: Number.NaN,
  };
}

export function jobCardManualMeasurementFieldsFromRecord(
  record: MeasurementRecord
): JobCardManualMeasurementFields {
  return {
    roof_area_sqft:
      record.roof_area_sqft != null && Number.isFinite(record.roof_area_sqft)
        ? record.roof_area_sqft
        : 0,
    waste_percent:
      record.waste_percent != null && Number.isFinite(record.waste_percent)
        ? record.waste_percent
        : Number.NaN,
    pitch_label: (record.pitch_label ?? "").trim(),
    stories: (record.stories ?? "").trim(),
    report_source: (record.report_source ?? "").trim(),
    eaves_lf: finiteNumberOrNull(record.eaves_lf) ?? Number.NaN,
    rakes_lf: finiteNumberOrNull(record.rakes_lf) ?? Number.NaN,
    ridges_lf: finiteNumberOrNull(record.ridges_lf) ?? Number.NaN,
    hips_lf: finiteNumberOrNull(record.hips_lf) ?? Number.NaN,
    valleys_lf: finiteNumberOrNull(record.valleys_lf) ?? Number.NaN,
    step_flashing_lf: finiteNumberOrNull(record.step_flashing_lf) ?? Number.NaN,
    pipe_boots_count: finiteNumberOrNull(record.pipe_boots_count) ?? Number.NaN,
    vents_count: finiteNumberOrNull(record.vents_count) ?? Number.NaN,
    tear_off_required:
      record.tear_off_required === true || record.tear_off_required === false
        ? record.tear_off_required
        : null,
    debris_tons_estimate:
      finiteNumberOrNull(record.debris_tons_estimate) ?? Number.NaN,
  };
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

/**
 * Report + job-scope inputs the starter resolver needs.
 * Does not invent zeros. Empty remains missing.
 */
export function isManualMeasurementStarterQuantityInputComplete(
  fields: JobCardManualMeasurementFields
): boolean {
  if (!isManualMeasurementEstimateReady(fields)) return false;
  if (!isEnteredNumber(fields.eaves_lf)) return false;
  if (!isEnteredNumber(fields.rakes_lf)) return false;
  if (!isEnteredNumber(fields.ridges_lf)) return false;
  if (!isEnteredNumber(fields.valleys_lf)) return false;
  if (!isEnteredNumber(fields.step_flashing_lf)) return false;
  if (!isEnteredNumber(fields.pipe_boots_count)) return false;
  if (!isEnteredNumber(fields.vents_count)) return false;
  if (fields.tear_off_required !== true && fields.tear_off_required !== false) {
    return false;
  }
  if (!isEnteredNumber(fields.debris_tons_estimate)) return false;
  return true;
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
  | "eaves_lf"
  | "rakes_lf"
  | "ridges_lf"
  | "hips_lf"
  | "valleys_lf"
  | "step_flashing_lf"
  | "pipe_boots_count"
  | "vents_count"
  | "tear_off_required"
  | "debris_tons_estimate"
> {
  const area = Number(fields.roof_area_sqft);
  const waste = Number(fields.waste_percent);
  const reportSource = (fields.report_source ?? "").trim() || "Manual";
  return {
    source_type: "manual",
    status: "incomplete",
    is_selected: false,
    is_verified: false,
    roof_area_sqft: finitePositiveOrNull(area) ?? (Number.isFinite(area) ? area : null),
    roof_squares: deriveManualMeasurementSquares(area),
    adjusted_roof_squares: deriveManualAdjustedSquares(area, waste),
    waste_percent: Number.isFinite(waste) ? waste : null,
    pitch_label: fields.pitch_label.trim() || null,
    stories: fields.stories.trim() || null,
    report_source: reportSource,
    eaves_lf: finiteNumberOrNull(fields.eaves_lf),
    rakes_lf: finiteNumberOrNull(fields.rakes_lf),
    ridges_lf: finiteNumberOrNull(fields.ridges_lf),
    hips_lf: finiteNumberOrNull(fields.hips_lf),
    valleys_lf: finiteNumberOrNull(fields.valleys_lf),
    step_flashing_lf: finiteNumberOrNull(fields.step_flashing_lf),
    pipe_boots_count: finiteNumberOrNull(fields.pipe_boots_count),
    vents_count: finiteNumberOrNull(fields.vents_count),
    tear_off_required:
      fields.tear_off_required === true || fields.tear_off_required === false
        ? fields.tear_off_required
        : null,
    debris_tons_estimate: finiteNumberOrNull(fields.debris_tons_estimate),
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
    eaves_lf: shape.eaves_lf,
    rakes_lf: shape.rakes_lf,
    ridges_lf: shape.ridges_lf,
    hips_lf: shape.hips_lf,
    valleys_lf: shape.valleys_lf,
    step_flashing_lf: shape.step_flashing_lf,
    pipe_boots_count: shape.pipe_boots_count,
    vents_count: shape.vents_count,
    tear_off_required: shape.tear_off_required,
    debris_tons_estimate: shape.debris_tons_estimate,
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
