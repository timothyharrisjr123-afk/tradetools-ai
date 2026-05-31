/**
 * FieldDive Job Store — client-side data layer for public.jobs.
 *
 * Uses getSupabaseClient() with RLS (same pattern as estimateStore / customerStore).
 * No React, UI, pricing, payment, or approval logic.
 *
 * Stage 3D1: foundation only — not wired from RoofingClient or SavedClient yet.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
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
  "id, company_id, customer_id, job_name, stage, status, source, priority, customer_name, customer_email, customer_phone, address_line1, address_line2, address_city, address_state, address_zip, address_country, address_formatted, assigned_to, created_by, updated_by, notes, summary, last_activity_at, archived, deleted_at, selected_measurement_id, active_proposal_id, latest_estimate_id, latest_proposal_id, source_metadata, custom_fields, created_at, updated_at";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

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
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function jobDraftToInsertRow(draft: JobDraft | Partial<JobDraft>): Partial<JobRow> {
  const contact = draft.contact;
  const address = draft.address;
  const formatted =
    normalizeNullableString(address?.formatted) ?? buildFormattedAddress(address ?? null);

  const row: Partial<JobRow> = {
    id: draft.id,
    company_id: draft.company_id,
    customer_id: draft.customer_id ?? contact?.customer_id ?? null,
    job_name: normalizeNullableString(draft.job_name),
    stage: draft.stage,
    status: draft.status,
    source: draft.source,
    priority: draft.priority ?? "normal",
    customer_name: normalizeNullableString(contact?.customer_name),
    customer_email: normalizeNullableString(contact?.customer_email),
    customer_phone: normalizeNullableString(contact?.customer_phone),
    address_line1: normalizeNullableString(address?.line1),
    address_line2: normalizeNullableString(address?.line2),
    address_city: normalizeNullableString(address?.city),
    address_state: normalizeNullableString(address?.state),
    address_zip: normalizeNullableString(address?.zip),
    address_country: normalizeNullableString(address?.country) ?? "US",
    address_formatted: formatted,
    assigned_to: draft.assigned_to ?? null,
    created_by: draft.created_by ?? null,
    updated_by: draft.updated_by ?? null,
    notes: normalizeNullableString(draft.notes),
    summary: normalizeNullableString(draft.summary),
    last_activity_at: draft.last_activity_at ?? null,
    archived: draft.archived ?? false,
    deleted_at: draft.deleted_at ?? null,
    selected_measurement_id: draft.selected_measurement_id ?? null,
    active_proposal_id: draft.active_proposal_id ?? null,
    latest_estimate_id: normalizeNullableString(draft.latest_estimate_id),
    latest_proposal_id: draft.latest_proposal_id ?? null,
    source_metadata: draft.source_metadata ?? null,
    custom_fields: draft.custom_fields ?? null,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
  };

  return compactObject(row as Record<string, unknown>) as Partial<JobRow>;
}

export function estimateSnapshotToJobDraft(
  estimate: EstimateSnapshotForJob,
  companyId: string
): JobDraft {
  const line1 =
    normalizeNullableString(estimate.jobAddress1) ??
    normalizeNullableString(estimate.address);
  const city = normalizeNullableString(estimate.jobCity);
  const state = normalizeNullableString(estimate.jobState);
  const zip =
    normalizeNullableString(estimate.jobZip) ?? normalizeNullableString(estimate.zip);

  const address: JobAddress = {
    line1,
    city,
    state,
    zip,
    country: "US",
    formatted: buildFormattedAddress({ line1, city, state, zip, country: "US" }),
  };

  const customerName = normalizeNullableString(estimate.customerName);
  const roofArea = Number(estimate.roofAreaSqFt) || 0;
  const areaNum = parseFloat(String(estimate.area ?? ""));
  const hasMeasurement = roofArea > 0 || (Number.isFinite(areaNum) && areaNum > 0);

  const jobName =
    line1 ??
    (customerName ? `${customerName} — roofing` : null) ??
    "Roofing job";

  return {
    company_id: companyId,
    customer_id: estimate.customer_id ?? null,
    job_name: jobName,
    stage: hasMeasurement ? "measurement" : "intake",
    status: "active",
    source: "intake",
    priority: "normal",
    contact: {
      customer_id: estimate.customer_id ?? null,
      customer_name: customerName,
      customer_email: normalizeNullableString(estimate.customerEmail),
      customer_phone: normalizeNullableString(estimate.customerPhone),
    },
    address,
    latest_estimate_id: normalizeNullableString(estimate.id),
    source_metadata: {
      source: "estimate_snapshot",
      estimate_status: estimate.status ?? null,
    },
    archived: false,
  };
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

export async function linkEstimateToJob(
  estimateId: string,
  jobId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[jobStore] linkEstimateToJob: Supabase client unavailable");
    return false;
  }
  const estId = String(estimateId || "").trim();
  const jId = String(jobId || "").trim();
  if (!isUuidLike(estId) || !isUuidLike(jId)) {
    console.error("[jobStore] linkEstimateToJob: invalid estimate or job id");
    return false;
  }

  try {
    const { error } = await supabase
      .from("estimates")
      .update({ job_id: jId })
      .eq("id", estId);

    if (error) {
      console.error("[jobStore] linkEstimateToJob failed:", error.message, {
        estimateId: estId,
        jobId: jId,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[jobStore] linkEstimateToJob error:", err);
    return false;
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

async function fetchEstimateJobIdFromDb(estimateId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("estimates")
      .select("job_id")
      .eq("id", estimateId)
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

export async function getOrCreateJobForEstimate(
  estimate: EstimateSnapshotForJob,
  companyId: string
): Promise<JobRecord | null> {
  const estId = normalizeNullableString(estimate.id);
  if (!estId || !isUuidLike(estId)) {
    console.error("[jobStore] getOrCreateJobForEstimate: invalid estimate id");
    return null;
  }
  if (!normalizeNullableString(companyId)) {
    console.error("[jobStore] getOrCreateJobForEstimate: company_id is required");
    return null;
  }

  const fromEstimate =
    normalizeNullableString(estimate.job_id) ?? normalizeNullableString(estimate.jobId);
  if (fromEstimate && isUuidLike(fromEstimate)) {
    const existing = await getJobById(fromEstimate);
    if (existing) return existing;
  }

  const fromDb = await fetchEstimateJobIdFromDb(estId);
  if (fromDb) {
    const existing = await getJobById(fromDb);
    if (existing) return existing;
  }

  const fromLatestEstimate = await fetchJobByLatestEstimateId(estId, companyId);
  if (fromLatestEstimate) {
    const linked = await linkEstimateToJob(estId, fromLatestEstimate.id);
    if (!linked) {
      console.warn("[jobStore] getOrCreateJobForEstimate: reused job but estimate link failed", {
        estimateId: estId,
        jobId: fromLatestEstimate.id,
      });
    }
    return fromLatestEstimate;
  }

  const draft = estimateSnapshotToJobDraft(estimate, companyId);
  const created = await createJob(draft);
  if (!created) return null;

  const linked = await linkEstimateToJob(estId, created.id);
  if (!linked) {
    console.warn("[jobStore] getOrCreateJobForEstimate: job created but estimate link failed", {
      estimateId: estId,
      jobId: created.id,
    });
  }

  return created;
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
