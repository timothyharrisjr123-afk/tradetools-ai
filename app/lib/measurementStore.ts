/**
 * FieldDive Measurement Store — client-side data layer for public.measurement_records.
 *
 * Stores quantity, source, confidence, and readiness truth for roof measurements.
 * No pricing, payment, approval, send/PDF, or proposal copy belongs here.
 * Proposal and pricing logic remain deterministic elsewhere (catalog → template → engine).
 *
 * Uses getSupabaseClient() with RLS (same pattern as jobStore / estimateStore).
 * No React, UI, or estimate/job pricing logic.
 *
 * Stage 3E1: foundation only — not wired from RoofingClient yet.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import type {
  MeasurementConfidenceLabel,
  MeasurementFieldConfidence,
  MeasurementQuantityMap,
  MeasurementRecord,
  MeasurementSourceType,
  MeasurementStatus,
  MeasurementWarning,
} from "@/app/lib/measurementTypes";

// ---------------------------------------------------------------------------
// DB row shape (public.measurement_records)
// ---------------------------------------------------------------------------

export type JsonObject = Record<string, unknown>;

export type MeasurementRecordRow = {
  id: string;
  company_id: string;
  job_id?: string | null;
  estimate_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  is_selected: boolean;
  source_type: string;
  source_provider?: string | null;
  source_report_id?: string | null;
  source_file_id?: string | null;
  source_url?: string | null;
  source_created_at?: string | null;
  imported_at?: string | null;
  model_version?: string | null;
  source_metadata?: JsonObject | null;
  is_verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  confidence_score?: number | null;
  confidence_label?: string | null;
  field_confidence?: JsonObject | null;
  roof_area_sqft?: number | null;
  roof_squares?: number | null;
  adjusted_roof_squares?: number | null;
  waste_percent?: number | null;
  predominant_pitch?: string | null;
  pitch_label?: string | null;
  pitch_segments?: JsonObject | unknown[] | null;
  stories?: string | null;
  roof_complexity?: string | null;
  roof_type?: string | null;
  structure_count?: number | null;
  roof_facets_count?: number | null;
  eaves_lf?: number | null;
  rakes_lf?: number | null;
  ridges_lf?: number | null;
  hips_lf?: number | null;
  valleys_lf?: number | null;
  wall_flashing_lf?: number | null;
  step_flashing_lf?: number | null;
  transitions_lf?: number | null;
  parapet_wall_lf?: number | null;
  drip_edge_lf?: number | null;
  starter_lf?: number | null;
  ridge_cap_lf?: number | null;
  pipe_boots_count?: number | null;
  vents_count?: number | null;
  skylights_count?: number | null;
  chimneys_count?: number | null;
  satellite_dishes_count?: number | null;
  other_penetrations?: JsonObject | null;
  existing_layers_count?: number | null;
  tear_off_required?: boolean | null;
  debris_tons_estimate?: number | null;
  disposal_notes?: string | null;
  report_attached: boolean;
  diagram_available: boolean;
  report_file_id?: string | null;
  report_type?: string | null;
  report_source?: string | null;
  report_status?: string | null;
  report_last_updated_at?: string | null;
  raw_measurements?: JsonObject | null;
  assumptions?: JsonObject | null;
  warnings?: unknown[] | JsonObject | null;
  missing_fields?: unknown[] | JsonObject | null;
  quantity_map?: JsonObject | null;
  measurement_readiness_score?: number | null;
  estimate_ready: boolean;
  production_ready: boolean;
};

/** Pre-persistence shape for insert/update — quantities and readiness only. */
export type MeasurementRecordDraft = {
  company_id: string;
  job_id?: string | null;
  estimate_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: MeasurementStatus;
  is_selected?: boolean;
  source_type?: MeasurementSourceType;
  source_provider?: string | null;
  source_report_id?: string | null;
  source_file_id?: string | null;
  source_url?: string | null;
  source_created_at?: string | null;
  imported_at?: string | null;
  model_version?: string | null;
  source_metadata?: JsonObject | null;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  verification_notes?: string | null;
  confidence_score?: number | null;
  confidence_label?: MeasurementConfidenceLabel | null;
  field_confidence?: MeasurementFieldConfidence | null;
  roof_area_sqft?: number | null;
  roof_squares?: number | null;
  adjusted_roof_squares?: number | null;
  waste_percent?: number | null;
  predominant_pitch?: string | null;
  pitch_label?: string | null;
  pitch_segments?: Array<Record<string, unknown>> | null;
  stories?: string | null;
  roof_complexity?: string | null;
  roof_type?: string | null;
  structure_count?: number | null;
  roof_facets_count?: number | null;
  eaves_lf?: number | null;
  rakes_lf?: number | null;
  ridges_lf?: number | null;
  hips_lf?: number | null;
  valleys_lf?: number | null;
  wall_flashing_lf?: number | null;
  step_flashing_lf?: number | null;
  transitions_lf?: number | null;
  parapet_wall_lf?: number | null;
  drip_edge_lf?: number | null;
  starter_lf?: number | null;
  ridge_cap_lf?: number | null;
  pipe_boots_count?: number | null;
  vents_count?: number | null;
  skylights_count?: number | null;
  chimneys_count?: number | null;
  satellite_dishes_count?: number | null;
  other_penetrations?: Record<string, unknown> | null;
  existing_layers_count?: number | null;
  tear_off_required?: boolean | null;
  debris_tons_estimate?: number | null;
  disposal_notes?: string | null;
  report_attached?: boolean;
  diagram_available?: boolean;
  report_file_id?: string | null;
  report_type?: string | null;
  report_source?: string | null;
  report_status?: string | null;
  report_last_updated_at?: string | null;
  raw_measurements?: Record<string, unknown> | null;
  assumptions?: Record<string, unknown> | null;
  warnings?: MeasurementWarning[] | null;
  missing_fields?: string[] | null;
  quantity_map?: MeasurementQuantityMap | null;
  measurement_readiness_score?: number | null;
  estimate_ready?: boolean;
  production_ready?: boolean;
};

const MEASUREMENT_SELECT_COLUMNS =
  "id, company_id, job_id, estimate_id, created_by, updated_by, created_at, updated_at, status, is_selected, source_type, source_provider, source_report_id, source_file_id, source_url, source_created_at, imported_at, model_version, source_metadata, is_verified, verified_by, verified_at, verification_notes, confidence_score, confidence_label, field_confidence, roof_area_sqft, roof_squares, adjusted_roof_squares, waste_percent, predominant_pitch, pitch_label, pitch_segments, stories, roof_complexity, roof_type, structure_count, roof_facets_count, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, wall_flashing_lf, step_flashing_lf, transitions_lf, parapet_wall_lf, drip_edge_lf, starter_lf, ridge_cap_lf, pipe_boots_count, vents_count, skylights_count, chimneys_count, satellite_dishes_count, other_penetrations, existing_layers_count, tear_off_required, debris_tons_estimate, disposal_notes, report_attached, diagram_available, report_file_id, report_type, report_source, report_status, report_last_updated_at, raw_measurements, assumptions, warnings, missing_fields, quantity_map, measurement_readiness_score, estimate_ready, production_ready";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function normalizeNullableBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

function normalizeJsonObject(value: unknown): JsonObject | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function normalizeJsonArray(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item != null && typeof item === "object") as Array<
    Record<string, unknown>
  >;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => normalizeNullableString(item))
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : null;
}

function normalizeWarnings(value: unknown): MeasurementWarning[] | null {
  if (!Array.isArray(value)) return null;
  const out: MeasurementWarning[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const msg = normalizeNullableString((item as MeasurementWarning).message);
    if (!msg) continue;
    out.push({
      field: normalizeNullableString((item as MeasurementWarning).field) ?? undefined,
      message: msg,
      severity: (item as MeasurementWarning).severity,
    });
  }
  return out.length > 0 ? out : null;
}

function normalizeQuantityMap(value: unknown): MeasurementQuantityMap | null {
  const obj = normalizeJsonObject(value);
  if (!obj) return null;
  return obj as MeasurementQuantityMap;
}

function normalizeFieldConfidence(value: unknown): MeasurementFieldConfidence | null {
  const obj = normalizeJsonObject(value);
  if (!obj) return null;
  return obj as MeasurementFieldConfidence;
}

// ---------------------------------------------------------------------------
// Row ↔ record mappers
// ---------------------------------------------------------------------------

export function rowToMeasurementRecord(row: MeasurementRecordRow): MeasurementRecord {
  return {
    id: row.id,
    company_id: row.company_id,
    job_id: row.job_id ?? null,
    estimate_id: row.estimate_id ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status as MeasurementStatus,
    is_selected: Boolean(row.is_selected),
    source_type: row.source_type as MeasurementSourceType,
    source_provider: row.source_provider ?? null,
    source_report_id: row.source_report_id ?? null,
    source_file_id: row.source_file_id ?? null,
    source_url: row.source_url ?? null,
    source_created_at: row.source_created_at ?? null,
    imported_at: row.imported_at ?? null,
    model_version: row.model_version ?? null,
    source_metadata: normalizeJsonObject(row.source_metadata),
    is_verified: Boolean(row.is_verified),
    verified_by: row.verified_by ?? null,
    verified_at: row.verified_at ?? null,
    verification_notes: row.verification_notes ?? null,
    confidence_score: normalizeNullableNumber(row.confidence_score),
    confidence_label: (row.confidence_label as MeasurementConfidenceLabel | null) ?? null,
    field_confidence: normalizeFieldConfidence(row.field_confidence),
    roof_area_sqft: normalizeNullableNumber(row.roof_area_sqft),
    roof_squares: normalizeNullableNumber(row.roof_squares),
    adjusted_roof_squares: normalizeNullableNumber(row.adjusted_roof_squares),
    waste_percent: normalizeNullableNumber(row.waste_percent),
    predominant_pitch: row.predominant_pitch ?? null,
    pitch_label: row.pitch_label ?? null,
    pitch_segments: normalizeJsonArray(row.pitch_segments),
    stories: row.stories ?? null,
    roof_complexity: row.roof_complexity ?? null,
    roof_type: row.roof_type ?? null,
    structure_count: normalizeNullableNumber(row.structure_count),
    roof_facets_count: normalizeNullableNumber(row.roof_facets_count),
    eaves_lf: normalizeNullableNumber(row.eaves_lf),
    rakes_lf: normalizeNullableNumber(row.rakes_lf),
    ridges_lf: normalizeNullableNumber(row.ridges_lf),
    hips_lf: normalizeNullableNumber(row.hips_lf),
    valleys_lf: normalizeNullableNumber(row.valleys_lf),
    wall_flashing_lf: normalizeNullableNumber(row.wall_flashing_lf),
    step_flashing_lf: normalizeNullableNumber(row.step_flashing_lf),
    transitions_lf: normalizeNullableNumber(row.transitions_lf),
    parapet_wall_lf: normalizeNullableNumber(row.parapet_wall_lf),
    drip_edge_lf: normalizeNullableNumber(row.drip_edge_lf),
    starter_lf: normalizeNullableNumber(row.starter_lf),
    ridge_cap_lf: normalizeNullableNumber(row.ridge_cap_lf),
    pipe_boots_count: normalizeNullableNumber(row.pipe_boots_count),
    vents_count: normalizeNullableNumber(row.vents_count),
    skylights_count: normalizeNullableNumber(row.skylights_count),
    chimneys_count: normalizeNullableNumber(row.chimneys_count),
    satellite_dishes_count: normalizeNullableNumber(row.satellite_dishes_count),
    other_penetrations: normalizeJsonObject(row.other_penetrations),
    existing_layers_count: normalizeNullableNumber(row.existing_layers_count),
    tear_off_required: normalizeNullableBoolean(row.tear_off_required),
    debris_tons_estimate: normalizeNullableNumber(row.debris_tons_estimate),
    disposal_notes: row.disposal_notes ?? null,
    report_attached: Boolean(row.report_attached),
    diagram_available: Boolean(row.diagram_available),
    report_file_id: row.report_file_id ?? null,
    report_type: row.report_type ?? null,
    report_source: row.report_source ?? null,
    report_status: row.report_status ?? null,
    report_last_updated_at: row.report_last_updated_at ?? null,
    raw_measurements: normalizeJsonObject(row.raw_measurements),
    assumptions: normalizeJsonObject(row.assumptions),
    warnings: normalizeWarnings(row.warnings),
    missing_fields: normalizeStringArray(row.missing_fields),
    quantity_map: normalizeQuantityMap(row.quantity_map),
    measurement_readiness_score: normalizeNullableNumber(row.measurement_readiness_score),
    estimate_ready: Boolean(row.estimate_ready),
    production_ready: Boolean(row.production_ready),
  };
}

function draftToRowFields(
  draft: MeasurementRecordDraft | Partial<MeasurementRecordDraft>,
  mode: "insert" | "update"
): Partial<MeasurementRecordRow> {
  const row: Partial<MeasurementRecordRow> = {
    company_id: draft.company_id,
    job_id: draft.job_id ?? null,
    estimate_id: draft.estimate_id ?? null,
    created_by: draft.created_by ?? null,
    updated_by: draft.updated_by ?? null,
    status: draft.status ?? (mode === "insert" ? "draft" : undefined),
    is_selected: draft.is_selected ?? (mode === "insert" ? false : undefined),
    source_type: draft.source_type ?? (mode === "insert" ? "manual" : undefined),
    source_provider: normalizeNullableString(draft.source_provider),
    source_report_id: normalizeNullableString(draft.source_report_id),
    source_file_id: normalizeNullableString(draft.source_file_id),
    source_url: normalizeNullableString(draft.source_url),
    source_created_at: draft.source_created_at ?? null,
    imported_at: draft.imported_at ?? null,
    model_version: normalizeNullableString(draft.model_version),
    source_metadata: draft.source_metadata ?? null,
    is_verified: draft.is_verified ?? (mode === "insert" ? false : undefined),
    verified_by: draft.verified_by ?? null,
    verified_at: draft.verified_at ?? null,
    verification_notes: normalizeNullableString(draft.verification_notes),
    confidence_score: normalizeNullableNumber(draft.confidence_score),
    confidence_label: draft.confidence_label ?? null,
    field_confidence: (draft.field_confidence as JsonObject | null) ?? null,
    roof_area_sqft: normalizeNullableNumber(draft.roof_area_sqft),
    roof_squares: normalizeNullableNumber(draft.roof_squares),
    adjusted_roof_squares: normalizeNullableNumber(draft.adjusted_roof_squares),
    waste_percent: normalizeNullableNumber(draft.waste_percent),
    predominant_pitch: normalizeNullableString(draft.predominant_pitch),
    pitch_label: normalizeNullableString(draft.pitch_label),
    pitch_segments: draft.pitch_segments ?? null,
    stories: normalizeNullableString(draft.stories),
    roof_complexity: normalizeNullableString(draft.roof_complexity),
    roof_type: normalizeNullableString(draft.roof_type),
    structure_count:
      draft.structure_count != null ? Math.trunc(Number(draft.structure_count)) : null,
    roof_facets_count:
      draft.roof_facets_count != null ? Math.trunc(Number(draft.roof_facets_count)) : null,
    eaves_lf: normalizeNullableNumber(draft.eaves_lf),
    rakes_lf: normalizeNullableNumber(draft.rakes_lf),
    ridges_lf: normalizeNullableNumber(draft.ridges_lf),
    hips_lf: normalizeNullableNumber(draft.hips_lf),
    valleys_lf: normalizeNullableNumber(draft.valleys_lf),
    wall_flashing_lf: normalizeNullableNumber(draft.wall_flashing_lf),
    step_flashing_lf: normalizeNullableNumber(draft.step_flashing_lf),
    transitions_lf: normalizeNullableNumber(draft.transitions_lf),
    parapet_wall_lf: normalizeNullableNumber(draft.parapet_wall_lf),
    drip_edge_lf: normalizeNullableNumber(draft.drip_edge_lf),
    starter_lf: normalizeNullableNumber(draft.starter_lf),
    ridge_cap_lf: normalizeNullableNumber(draft.ridge_cap_lf),
    pipe_boots_count:
      draft.pipe_boots_count != null ? Math.trunc(Number(draft.pipe_boots_count)) : null,
    vents_count: draft.vents_count != null ? Math.trunc(Number(draft.vents_count)) : null,
    skylights_count:
      draft.skylights_count != null ? Math.trunc(Number(draft.skylights_count)) : null,
    chimneys_count:
      draft.chimneys_count != null ? Math.trunc(Number(draft.chimneys_count)) : null,
    satellite_dishes_count:
      draft.satellite_dishes_count != null
        ? Math.trunc(Number(draft.satellite_dishes_count))
        : null,
    other_penetrations: draft.other_penetrations ?? null,
    existing_layers_count:
      draft.existing_layers_count != null ? Math.trunc(Number(draft.existing_layers_count)) : null,
    tear_off_required: draft.tear_off_required ?? null,
    debris_tons_estimate: normalizeNullableNumber(draft.debris_tons_estimate),
    disposal_notes: normalizeNullableString(draft.disposal_notes),
    report_attached: draft.report_attached ?? (mode === "insert" ? false : undefined),
    diagram_available: draft.diagram_available ?? (mode === "insert" ? false : undefined),
    report_file_id: normalizeNullableString(draft.report_file_id),
    report_type: normalizeNullableString(draft.report_type),
    report_source: normalizeNullableString(draft.report_source),
    report_status: normalizeNullableString(draft.report_status),
    report_last_updated_at: draft.report_last_updated_at ?? null,
    raw_measurements: draft.raw_measurements ?? null,
    assumptions: draft.assumptions ?? null,
    warnings: draft.warnings ?? null,
    missing_fields: draft.missing_fields ?? null,
    quantity_map: draft.quantity_map ?? null,
    measurement_readiness_score:
      draft.measurement_readiness_score != null
        ? Math.trunc(Number(draft.measurement_readiness_score))
        : null,
    estimate_ready: draft.estimate_ready ?? (mode === "insert" ? false : undefined),
    production_ready: draft.production_ready ?? (mode === "insert" ? false : undefined),
    created_at: draft.created_at,
    updated_at: draft.updated_at,
  };

  return compactObject(row as Record<string, unknown>) as Partial<MeasurementRecordRow>;
}

export function measurementRecordToInsertRow(
  draft: MeasurementRecordDraft
): Partial<MeasurementRecordRow> {
  return draftToRowFields(draft, "insert");
}

export function measurementRecordToUpdateRow(
  patch: Partial<MeasurementRecordDraft>
): Partial<MeasurementRecordRow> {
  return draftToRowFields(patch, "update");
}

// ---------------------------------------------------------------------------
// Supabase reads
// ---------------------------------------------------------------------------

export async function getMeasurementById(id: string): Promise<MeasurementRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] getMeasurementById: Supabase client unavailable");
    return null;
  }
  const measurementId = String(id || "").trim();
  if (!isUuidLike(measurementId)) {
    console.error("[measurementStore] getMeasurementById: invalid measurement id");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .select(MEASUREMENT_SELECT_COLUMNS)
      .eq("id", measurementId)
      .maybeSingle();

    if (error) {
      console.error("[measurementStore] getMeasurementById failed:", error.message, {
        id: measurementId,
      });
      return null;
    }
    if (!data) return null;
    return rowToMeasurementRecord(data as MeasurementRecordRow);
  } catch (err) {
    console.error("[measurementStore] getMeasurementById error:", err);
    return null;
  }
}

export async function getSelectedMeasurementForJob(
  jobId: string
): Promise<MeasurementRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] getSelectedMeasurementForJob: Supabase client unavailable");
    return null;
  }
  const id = String(jobId || "").trim();
  if (!isUuidLike(id)) {
    console.error("[measurementStore] getSelectedMeasurementForJob: invalid job id");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .select(MEASUREMENT_SELECT_COLUMNS)
      .eq("job_id", id)
      .eq("is_selected", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[measurementStore] getSelectedMeasurementForJob failed:", error.message, {
        jobId: id,
      });
      return null;
    }
    if (!data) return null;
    return rowToMeasurementRecord(data as MeasurementRecordRow);
  } catch (err) {
    console.error("[measurementStore] getSelectedMeasurementForJob error:", err);
    return null;
  }
}

export async function getMeasurementsForJob(jobId: string): Promise<MeasurementRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] getMeasurementsForJob: Supabase client unavailable");
    return [];
  }
  const id = String(jobId || "").trim();
  if (!isUuidLike(id)) {
    console.error("[measurementStore] getMeasurementsForJob: invalid job id");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .select(MEASUREMENT_SELECT_COLUMNS)
      .eq("job_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[measurementStore] getMeasurementsForJob failed:", error.message, {
        jobId: id,
      });
      return [];
    }
    const rows = (data ?? []) as MeasurementRecordRow[];
    return rows.map(rowToMeasurementRecord);
  } catch (err) {
    console.error("[measurementStore] getMeasurementsForJob error:", err);
    return [];
  }
}

export async function getMeasurementsForEstimate(
  estimateId: string
): Promise<MeasurementRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] getMeasurementsForEstimate: Supabase client unavailable");
    return [];
  }
  const id = String(estimateId || "").trim();
  if (!isUuidLike(id)) {
    console.error("[measurementStore] getMeasurementsForEstimate: invalid estimate id");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .select(MEASUREMENT_SELECT_COLUMNS)
      .eq("estimate_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[measurementStore] getMeasurementsForEstimate failed:", error.message, {
        estimateId: id,
      });
      return [];
    }
    const rows = (data ?? []) as MeasurementRecordRow[];
    return rows.map(rowToMeasurementRecord);
  } catch (err) {
    console.error("[measurementStore] getMeasurementsForEstimate error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Supabase writes
// ---------------------------------------------------------------------------

export async function createMeasurementRecord(
  draft: MeasurementRecordDraft
): Promise<MeasurementRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] createMeasurementRecord: Supabase client unavailable");
    return null;
  }
  if (!normalizeNullableString(draft.company_id)) {
    console.error("[measurementStore] createMeasurementRecord: company_id is required");
    return null;
  }

  const nowIso = new Date().toISOString();
  const row = measurementRecordToInsertRow({
    ...draft,
    updated_at: draft.updated_at ?? nowIso,
    created_at: draft.created_at ?? nowIso,
  });

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .insert(row)
      .select(MEASUREMENT_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[measurementStore] createMeasurementRecord failed:", error.message);
      return null;
    }
    if (!data) return null;
    return rowToMeasurementRecord(data as MeasurementRecordRow);
  } catch (err) {
    console.error("[measurementStore] createMeasurementRecord error:", err);
    return null;
  }
}

export async function updateMeasurementRecord(
  id: string,
  patch: Partial<MeasurementRecordDraft>
): Promise<MeasurementRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] updateMeasurementRecord: Supabase client unavailable");
    return null;
  }
  const measurementId = String(id || "").trim();
  if (!isUuidLike(measurementId)) {
    console.error("[measurementStore] updateMeasurementRecord: invalid measurement id");
    return null;
  }

  const row = measurementRecordToUpdateRow({
    ...patch,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  });
  delete (row as { id?: string }).id;
  delete (row as { created_at?: string }).created_at;
  delete (row as { company_id?: string }).company_id;

  if (Object.keys(row).length === 0) {
    return getMeasurementById(measurementId);
  }

  try {
    const { data, error } = await supabase
      .from("measurement_records")
      .update(row)
      .eq("id", measurementId)
      .select(MEASUREMENT_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[measurementStore] updateMeasurementRecord failed:", error.message, {
        id: measurementId,
      });
      return null;
    }
    if (!data) return null;
    return rowToMeasurementRecord(data as MeasurementRecordRow);
  } catch (err) {
    console.error("[measurementStore] updateMeasurementRecord error:", err);
    return null;
  }
}

export type SelectMeasurementScope = {
  jobId?: string | null;
  estimateId?: string | null;
};

/**
 * Mark one measurement record as selected for its job and/or estimate scope.
 *
 * Staged client two-step clear + set. A future Postgres RPC/transaction would be
 * better for race-proof single-selected enforcement.
 */
export async function selectMeasurementRecord(
  id: string,
  scope?: SelectMeasurementScope
): Promise<MeasurementRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[measurementStore] selectMeasurementRecord: Supabase client unavailable");
    return null;
  }
  const measurementId = String(id || "").trim();
  if (!isUuidLike(measurementId)) {
    console.error("[measurementStore] selectMeasurementRecord: invalid measurement id");
    return null;
  }

  const target = await getMeasurementById(measurementId);
  if (!target) {
    console.error("[measurementStore] selectMeasurementRecord: record not found", {
      id: measurementId,
    });
    return null;
  }

  const effectiveJobId =
    normalizeNullableString(scope?.jobId) ?? normalizeNullableString(target.job_id);
  const effectiveEstimateId =
    normalizeNullableString(scope?.estimateId) ?? normalizeNullableString(target.estimate_id);

  try {
    if (effectiveJobId) {
      const { error } = await supabase
        .from("measurement_records")
        .update({ is_selected: false })
        .eq("job_id", effectiveJobId);

      if (error) {
        console.error("[measurementStore] selectMeasurementRecord clear job scope failed:", error.message, {
          jobId: effectiveJobId,
        });
        return null;
      }
    } else if (effectiveEstimateId) {
      const { error } = await supabase
        .from("measurement_records")
        .update({ is_selected: false })
        .eq("estimate_id", effectiveEstimateId);

      if (error) {
        console.error(
          "[measurementStore] selectMeasurementRecord clear estimate scope failed:",
          error.message,
          { estimateId: effectiveEstimateId }
        );
        return null;
      }
    }

    const { error: selectError } = await supabase
      .from("measurement_records")
      .update({ is_selected: true, updated_at: new Date().toISOString() })
      .eq("id", measurementId);

    if (selectError) {
      console.error("[measurementStore] selectMeasurementRecord set selected failed:", selectError.message, {
        id: measurementId,
      });
      return null;
    }

    return getMeasurementById(measurementId);
  } catch (err) {
    console.error("[measurementStore] selectMeasurementRecord error:", err);
    return null;
  }
}
