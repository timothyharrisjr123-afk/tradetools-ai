/**
 * FieldDive Job Store — client-side data layer for public.jobs.
 *
 * Uses getSupabaseClient() with RLS (same pattern as estimateStore / customerStore).
 * No React, UI, pricing, payment, or approval logic.
 *
 * Stage 3D1: foundation only — not wired from RoofingClient or SavedClient yet.
 */

import {
  ensureBrowserAuthSession,
  getSupabaseClient,
} from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JobAddress,
  JobCardStatus,
  JobContactSnapshot,
  JobDraft,
  JobPriority,
  JobRecord,
  JobSource,
  JobStage,
  JobSummary,
} from "@/app/lib/jobTypes";

// ---------------------------------------------------------------------------
// DB row shape (public.jobs)
// ---------------------------------------------------------------------------

export type JobRow = {
  id: string;
  company_id: string;
  customer_id?: string | null;
  property_id?: string | null;
  job_name?: string | null;
  stage: string;
  status: string;
  source: string;
  priority?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  address_country?: string | null;
  address_formatted?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  notes?: string | null;
  summary?: string | null;
  last_activity_at?: string | null;
  archived?: boolean;
  deleted_at?: string | null;
  selected_measurement_id?: string | null;
  active_proposal_id?: string | null;
  latest_estimate_id?: string | null;
  latest_proposal_id?: string | null;
  source_metadata?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  stage_entered_at?: string | null;
  production_started_at?: string | null;
  completed_at?: string | null;
};

/** Minimal estimate shape for lazy job linking — avoids estimateStore import. */
export type EstimateSnapshotForJob = {
  id: string;
  company_id?: string | null;
  customer_id?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  zip?: string;
  jobAddress1?: string;
  jobCity?: string;
  jobState?: string;
  jobZip?: string;
  roofAreaSqFt?: number;
  area?: string;
  createdAt?: string;
  lastSavedAt?: string;
  status?: string;
  job_id?: string | null;
  jobId?: string | null;
};

const JOB_SELECT_COLUMNS =
  "id, company_id, customer_id, property_id, job_name, stage, status, source, priority, customer_name, customer_email, customer_phone, address_line1, address_line2, address_city, address_state, address_zip, address_country, address_formatted, assigned_to, created_by, updated_by, notes, summary, last_activity_at, stage_entered_at, production_started_at, completed_at, archived, deleted_at, selected_measurement_id, active_proposal_id, latest_estimate_id, latest_proposal_id, source_metadata, custom_fields, created_at, updated_at";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export { isUuidLike } from "@/app/lib/uuid";

export function buildFormattedAddress(address?: JobAddress | null): string | null {
  if (!address) return null;
  const parts = [
    normalizeNullableString(address.line1),
    normalizeNullableString(address.line2),
    [normalizeNullableString(address.city), normalizeNullableString(address.state)]
      .filter(Boolean)
      .join(", "),
    normalizeNullableString(address.zip),
  ].filter(Boolean) as string[];
  if (parts.length === 0) return normalizeNullableString(address.formatted);
  return parts.join(", ");
}

export function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

// ---------------------------------------------------------------------------
// Row ↔ record mappers
// ---------------------------------------------------------------------------

export function rowToJobRecord(row: JobRow): JobRecord {
  const address: JobAddress | null =
    row.address_line1 ||
    row.address_city ||
    row.address_state ||
    row.address_zip ||
    row.address_formatted
      ? {
          line1: row.address_line1 ?? null,
          line2: row.address_line2 ?? null,
          city: row.address_city ?? null,
          state: row.address_state ?? null,
          zip: row.address_zip ?? null,
          country: row.address_country ?? null,
          formatted: row.address_formatted ?? null,
        }
      : null;

  const contact: JobContactSnapshot | null =
    row.customer_name || row.customer_email || row.customer_phone || row.customer_id
      ? {
          customer_id: row.customer_id ?? null,
          customer_name: row.customer_name ?? null,
          customer_email: row.customer_email ?? null,
          customer_phone: row.customer_phone ?? null,
        }
      : row.customer_id
        ? { customer_id: row.customer_id }
        : null;

  return {
    id: row.id,
    company_id: row.company_id,
    customer_id: row.customer_id ?? null,
    property_id: row.property_id ?? null,
    job_name: row.job_name ?? null,
    stage: row.stage as JobStage,
    status: row.status as JobCardStatus,
    source: row.source as JobSource,
    priority: (row.priority as JobPriority | null) ?? null,
    contact,
    address,
    assigned_to: row.assigned_to ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    notes: row.notes ?? null,
    summary: row.summary ?? null,
    last_activity_at: row.last_activity_at ?? null,
    stage_entered_at: row.stage_entered_at ?? null,
    production_started_at: row.production_started_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived: row.archived ?? false,
    deleted_at: row.deleted_at ?? null,
    selected_measurement_id: row.selected_measurement_id ?? null,
    active_proposal_id: row.active_proposal_id ?? null,
    latest_estimate_id: row.latest_estimate_id ?? null,
    latest_proposal_id: row.latest_proposal_id ?? null,
    source_metadata: row.source_metadata ?? null,
    custom_fields: row.custom_fields ?? null,
  };
}

export function rowToJobSummary(row: JobRow): JobSummary {
  const record = rowToJobRecord(row);
  return {
    id: record.id,
    company_id: record.company_id,
    customer_id: record.customer_id ?? null,
    property_id: record.property_id ?? null,
    customer_name: record.contact?.customer_name ?? null,
    customer_email: record.contact?.customer_email ?? null,
    customer_phone: record.contact?.customer_phone ?? null,
    job_name: record.job_name ?? null,
    address: record.address ?? null,
    stage: record.stage,
    status: record.status,
    source: record.source,
    priority: record.priority ?? null,
    assigned_to: record.assigned_to ?? null,
    selected_measurement_id: record.selected_measurement_id ?? null,
    active_proposal_id: record.active_proposal_id ?? null,
    latest_estimate_id: record.latest_estimate_id ?? null,
    latest_proposal_id: record.latest_proposal_id ?? null,
    last_activity_at: record.last_activity_at ?? null,
    stage_entered_at: record.stage_entered_at ?? null,
    production_started_at: record.production_started_at ?? null,
    completed_at: record.completed_at ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function jobDraftToInsertRow(draft: JobDraft | Partial<JobDraft>): Partial<JobRow> {
  const row: Partial<JobRow> = {};

  if (draft.id !== undefined) row.id = draft.id;
  if (draft.company_id !== undefined) row.company_id = draft.company_id;

  if (draft.customer_id !== undefined) {
    row.customer_id = draft.customer_id ?? draft.contact?.customer_id ?? null;
  } else if (draft.contact !== undefined) {
    row.customer_id = draft.contact?.customer_id ?? null;
  }

  if (draft.property_id !== undefined) {
    row.property_id = draft.property_id ?? null;
  }

  if (draft.job_name !== undefined) {
    row.job_name = normalizeNullableString(draft.job_name);
  }

  if (draft.stage !== undefined) row.stage = draft.stage;
  if (draft.status !== undefined) row.status = draft.status;
  if (draft.source !== undefined) row.source = draft.source;
  if (draft.priority !== undefined) row.priority = draft.priority ?? "normal";

  if (draft.contact !== undefined) {
    row.customer_name = normalizeNullableString(draft.contact?.customer_name);
    row.customer_email = normalizeNullableString(draft.contact?.customer_email);
    row.customer_phone = normalizeNullableString(draft.contact?.customer_phone);
  }

  if (draft.address !== undefined) {
    const address = draft.address;
    const formatted =
      normalizeNullableString(address?.formatted) ?? buildFormattedAddress(address ?? null);
    row.address_line1 = normalizeNullableString(address?.line1);
    row.address_line2 = normalizeNullableString(address?.line2);
    row.address_city = normalizeNullableString(address?.city);
    row.address_state = normalizeNullableString(address?.state);
    row.address_zip = normalizeNullableString(address?.zip);
    row.address_country = normalizeNullableString(address?.country) ?? "US";
    row.address_formatted = formatted;
  }

  if (draft.assigned_to !== undefined) row.assigned_to = draft.assigned_to ?? null;
  if (draft.created_by !== undefined) row.created_by = draft.created_by ?? null;
  if (draft.updated_by !== undefined) row.updated_by = draft.updated_by ?? null;
  if (draft.notes !== undefined) row.notes = normalizeNullableString(draft.notes);
  if (draft.summary !== undefined) row.summary = normalizeNullableString(draft.summary);
  if (draft.last_activity_at !== undefined) row.last_activity_at = draft.last_activity_at ?? null;
  if (draft.stage_entered_at !== undefined) row.stage_entered_at = draft.stage_entered_at ?? null;
  if (draft.archived !== undefined) row.archived = draft.archived ?? false;
  if (draft.deleted_at !== undefined) row.deleted_at = draft.deleted_at ?? null;
  // Measurement selection is written only through select_job_measurement_v1.
  // Generic job updates must not mutate selected_measurement_id.
  if (draft.active_proposal_id !== undefined) {
    row.active_proposal_id = draft.active_proposal_id ?? null;
  }
  if (draft.latest_estimate_id !== undefined) {
    row.latest_estimate_id = normalizeNullableString(draft.latest_estimate_id);
  }
  if (draft.latest_proposal_id !== undefined) {
    row.latest_proposal_id = draft.latest_proposal_id ?? null;
  }
  if (draft.source_metadata !== undefined) row.source_metadata = draft.source_metadata ?? null;
  if (draft.custom_fields !== undefined) row.custom_fields = draft.custom_fields ?? null;
  if (draft.created_at !== undefined) row.created_at = draft.created_at;
  if (draft.updated_at !== undefined) row.updated_at = draft.updated_at;

  return compactObject(row as Record<string, unknown>) as Partial<JobRow>;
}

// ---------------------------------------------------------------------------
// Supabase reads / writes
// ---------------------------------------------------------------------------

export async function createJob(draft: JobDraft): Promise<JobRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[jobStore] createJob: Supabase client unavailable");
    return null;
  }
  if (!normalizeNullableString(draft.company_id)) {
    console.error("[jobStore] createJob: company_id is required");
    return null;
  }

  const nowIso = new Date().toISOString();
  const row = jobDraftToInsertRow({
    ...draft,
    stage: "intake",
    status: draft.status === "active" || draft.status === "on_hold" || draft.status === "lost" || draft.status === "closed"
      ? draft.status
      : "active",
    stage_entered_at: draft.stage_entered_at ?? nowIso,
    last_activity_at: draft.last_activity_at ?? nowIso,
    updated_at: draft.updated_at ?? nowIso,
    created_at: draft.created_at ?? nowIso,
  });

  try {
    const { data, error } = await supabase
      .from("jobs")
      .insert(row)
      .select(JOB_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[jobStore] createJob failed:", error.message);
      return null;
    }
    if (!data) return null;
    return rowToJobRecord(data as JobRow);
  } catch (err) {
    console.error("[jobStore] createJob error:", err);
    return null;
  }
}

export async function getJobById(jobId: string): Promise<JobRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[jobStore] getJobById: Supabase client unavailable");
    return null;
  }
  const sessionReady = await ensureBrowserAuthSession();
  if (!sessionReady) {
    console.error("[jobStore] getJobById: browser auth session not ready");
    return null;
  }
  const id = String(jobId || "").trim();
  if (!isUuidLike(id)) {
    console.error("[jobStore] getJobById: invalid job id");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[jobStore] getJobById failed:", error.message, { jobId: id });
      return null;
    }
    if (!data) return null;
    return rowToJobRecord(data as JobRow);
  } catch (err) {
    console.error("[jobStore] getJobById error:", err);
    return null;
  }
}

export async function updateJob(
  jobId: string,
  patch: Partial<JobDraft>
): Promise<JobRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[jobStore] updateJob: Supabase client unavailable");
    return null;
  }
  const id = String(jobId || "").trim();
  if (!isUuidLike(id)) {
    console.error("[jobStore] updateJob: invalid job id");
    return null;
  }

  const row = jobDraftToInsertRow({
    ...patch,
    updated_at: patch.updated_at ?? new Date().toISOString(),
    last_activity_at: patch.last_activity_at ?? new Date().toISOString(),
  });
  delete (row as { id?: string }).id;
  delete (row as { created_at?: string }).created_at;
  delete (row as { stage?: string }).stage;
  delete (row as { status?: string }).status;
  delete (row as { stage_entered_at?: string | null }).stage_entered_at;
  delete (row as { production_started_at?: string | null }).production_started_at;
  delete (row as { completed_at?: string | null }).completed_at;

  if (Object.keys(row).length === 0) {
    return getJobById(id);
  }

  try {
    const { data, error } = await supabase
      .from("jobs")
      .update(row)
      .eq("id", id)
      .select(JOB_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[jobStore] updateJob failed:", error.message, { jobId: id });
      return null;
    }
    if (!data) return null;
    return rowToJobRecord(data as JobRow);
  } catch (err) {
    console.error("[jobStore] updateJob error:", err);
    return null;
  }
}

async function fetchJobByLatestEstimateId(
  estimateId: string,
  companyId: string
): Promise<JobRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const estId = String(estimateId || "").trim();
  const cid = String(companyId || "").trim();
  if (!isUuidLike(estId) || !cid) return null;

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_SELECT_COLUMNS)
      .eq("company_id", cid)
      .eq("latest_estimate_id", estId)
      .eq("archived", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[jobStore] fetchJobByLatestEstimateId:", error.message);
      return null;
    }
    if (!data) return null;
    return rowToJobRecord(data as JobRow);
  } catch {
    return null;
  }
}

async function fetchEstimateJobIdFromDb(
  estimateId: string,
  companyId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("estimates")
      .select("job_id")
      .eq("id", estimateId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      console.warn("[jobStore] fetchEstimateJobIdFromDb:", error.message);
      return null;
    }
    const jobId = data?.job_id;
    return jobId && isUuidLike(String(jobId)) ? String(jobId) : null;
  } catch {
    return null;
  }
}

export type EstimateJobResolution =
  | { status: "linked"; job: JobRecord }
  | { status: "unlinked"; job: null; reason: "invalid" | "not_found" | "link_failed" };

/** Resolve an estimate's existing job without making estimates a job-birth path. */
export async function resolveJobForEstimate(
  estimate: EstimateSnapshotForJob,
  companyId: string
): Promise<EstimateJobResolution> {
  const estId = normalizeNullableString(estimate.id);
  if (!estId || !isUuidLike(estId)) {
    console.error("[jobStore] resolveJobForEstimate: invalid estimate id");
    return { status: "unlinked", job: null, reason: "invalid" };
  }
  const cid = normalizeNullableString(companyId);
  if (!cid || !isUuidLike(cid)) {
    console.error("[jobStore] resolveJobForEstimate: valid company_id is required");
    return { status: "unlinked", job: null, reason: "invalid" };
  }

  const fromEstimate =
    normalizeNullableString(estimate.job_id) ?? normalizeNullableString(estimate.jobId);
  if (fromEstimate && isUuidLike(fromEstimate)) {
    const existing = await getJobById(fromEstimate);
    if (existing?.company_id === cid) return { status: "linked", job: existing };
  }

  const fromDb = await fetchEstimateJobIdFromDb(estId, cid);
  if (fromDb) {
    const existing = await getJobById(fromDb);
    if (existing?.company_id === cid) return { status: "linked", job: existing };
  }

  const fromLatestEstimate = await fetchJobByLatestEstimateId(estId, cid);
  if (fromLatestEstimate) {
    // Soft historical claim may identify an existing job, but opening must not
    // mutate estimates.job_id (duplicate soft claims can point at the wrong twin).
    return { status: "linked", job: fromLatestEstimate };
  }

  return { status: "unlinked", job: null, reason: "not_found" };
}

export async function getJobsByCompany(companyId: string): Promise<JobSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[jobStore] getJobsByCompany: Supabase client unavailable");
    return [];
  }
  const cid = String(companyId || "").trim();
  if (!cid) {
    console.error("[jobStore] getJobsByCompany: company_id is required");
    return [];
  }
  const sessionReady = await ensureBrowserAuthSession();
  if (!sessionReady) {
    console.error("[jobStore] getJobsByCompany: browser auth session not ready");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_SELECT_COLUMNS)
      .eq("company_id", cid)
      .eq("archived", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[jobStore] getJobsByCompany failed:", error.message, { companyId: cid });
      return [];
    }
    const rows = (data ?? []) as JobRow[];
    return rows.map(rowToJobSummary);
  } catch (err) {
    console.error("[jobStore] getJobsByCompany error:", err);
    return [];
  }
}

/** Server-side job lookup for authenticated deep links (RLS + company guard). */
export async function getJobRecordForCompany(
  supabase: SupabaseClient,
  jobId: string,
  companyId: string
): Promise<JobRecord | null> {
  const id = String(jobId || "").trim();
  const cid = String(companyId || "").trim();
  if (!isUuidLike(id) || !isUuidLike(cid)) return null;

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[jobStore] getJobRecordForCompany failed:", error.message, {
        jobId: id,
      });
      return null;
    }
    if (!data) return null;
    if (String(data.company_id || "").trim() !== cid) return null;
    return rowToJobRecord(data as JobRow);
  } catch (err) {
    console.error("[jobStore] getJobRecordForCompany error:", err);
    return null;
  }
}
