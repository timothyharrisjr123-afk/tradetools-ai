/**
 * Server job-task persistence.
 * User JWT + RLS. Server owns created_by, completed_by, completed_at.
 * Does not write jobs.stage, schedules, attention, activity, measurements,
 * proposals, or payments.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toJobTaskListItem } from "@/app/lib/jobTaskModel";
import type { JobTaskListItem, JobTaskRecord } from "@/app/lib/jobTaskTypes";
import { validateJobTaskContent } from "@/app/lib/jobTaskValidation";
import { isUuidLike } from "@/app/lib/uuid";

const LIST_COLUMNS =
  "id,company_id,job_id,title,notes,status,due_on,created_by,completed_at,completed_by,created_at,updated_at,deleted_at";

export type JobTaskAuthContext = {
  userId: string;
  companyId: string;
};

export class JobTaskHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

type JobRow = { id: string; company_id: string };

export async function loadOwnedJobForTasks(
  supabase: SupabaseClient,
  ctx: JobTaskAuthContext,
  jobId: string
): Promise<JobRow> {
  if (!isUuidLike(jobId)) {
    throw new JobTaskHttpError(400, "invalid_payload");
  }
  const { data, error } = await supabase
    .from("jobs")
    .select("id,company_id")
    .eq("id", jobId)
    .eq("company_id", ctx.companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new JobTaskHttpError(500, "internal_error");
  }
  if (!data) {
    throw new JobTaskHttpError(404, "not_found");
  }
  return data as JobRow;
}

function asDueOn(value: unknown): string | null {
  if (value == null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : null;
}

function asRecord(row: Record<string, unknown>): JobTaskRecord {
  const status = row.status === "complete" ? "complete" : "open";
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    job_id: String(row.job_id),
    title: String(row.title),
    notes: row.notes == null ? null : String(row.notes),
    status,
    due_on: asDueOn(row.due_on),
    created_by: row.created_by ? String(row.created_by) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    completed_by: row.completed_by ? String(row.completed_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

async function loadOwnedTask(
  supabase: SupabaseClient,
  job: JobRow,
  taskId: string
): Promise<JobTaskRecord> {
  if (!isUuidLike(taskId)) {
    throw new JobTaskHttpError(400, "invalid_payload");
  }
  const { data, error } = await supabase
    .from("job_tasks")
    .select(LIST_COLUMNS)
    .eq("id", taskId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new JobTaskHttpError(500, "internal_error");
  if (!data) throw new JobTaskHttpError(404, "not_found");
  return asRecord(data as Record<string, unknown>);
}

export async function listJobTasks(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
}): Promise<JobTaskListItem[]> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  const { data, error } = await input.supabase
    .from("job_tasks")
    .select(LIST_COLUMNS)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw new JobTaskHttpError(500, "internal_error");
  }
  return (data ?? []).map((row) =>
    toJobTaskListItem(asRecord(row as Record<string, unknown>))
  );
}

export async function createJobTask(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
  title: unknown;
  notes?: unknown;
  dueOn?: unknown;
}): Promise<JobTaskListItem> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  const validated = validateJobTaskContent({
    title: input.title,
    notes: input.notes,
    dueOn: input.dueOn,
  });
  if (!validated.ok) {
    throw new JobTaskHttpError(400, validated.code, validated.message);
  }

  const insert = {
    company_id: job.company_id,
    job_id: job.id,
    title: validated.title,
    notes: validated.notes,
    status: "open",
    due_on: validated.dueOn,
    created_by: input.ctx.userId,
    completed_at: null,
    completed_by: null,
  };

  const { data, error } = await input.supabase
    .from("job_tasks")
    .insert(insert)
    .select(LIST_COLUMNS)
    .single();
  if (error || !data) {
    throw new JobTaskHttpError(500, "internal_error");
  }
  return toJobTaskListItem(asRecord(data as Record<string, unknown>));
}

export async function updateJobTaskContent(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
  taskId: string;
  title: unknown;
  notes?: unknown;
  dueOn?: unknown;
}): Promise<JobTaskListItem> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  await loadOwnedTask(input.supabase, job, input.taskId);
  const validated = validateJobTaskContent({
    title: input.title,
    notes: input.notes,
    dueOn: input.dueOn,
  });
  if (!validated.ok) {
    throw new JobTaskHttpError(400, validated.code, validated.message);
  }

  const { data, error } = await input.supabase
    .from("job_tasks")
    .update({
      title: validated.title,
      notes: validated.notes,
      due_on: validated.dueOn,
    })
    .eq("id", input.taskId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error) throw new JobTaskHttpError(500, "internal_error");
  if (!data) throw new JobTaskHttpError(404, "not_found");
  return toJobTaskListItem(asRecord(data as Record<string, unknown>));
}

export async function completeJobTask(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
  taskId: string;
}): Promise<JobTaskListItem> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  const existing = await loadOwnedTask(input.supabase, job, input.taskId);
  if (existing.status === "complete") {
    return toJobTaskListItem(existing);
  }

  const { data, error } = await input.supabase
    .from("job_tasks")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      completed_by: input.ctx.userId,
    })
    .eq("id", input.taskId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error) throw new JobTaskHttpError(500, "internal_error");
  if (!data) throw new JobTaskHttpError(404, "not_found");
  return toJobTaskListItem(asRecord(data as Record<string, unknown>));
}

export async function reopenJobTask(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
  taskId: string;
}): Promise<JobTaskListItem> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  const existing = await loadOwnedTask(input.supabase, job, input.taskId);
  if (existing.status === "open") {
    return toJobTaskListItem(existing);
  }

  const { data, error } = await input.supabase
    .from("job_tasks")
    .update({
      status: "open",
      completed_at: null,
      completed_by: null,
    })
    .eq("id", input.taskId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error) throw new JobTaskHttpError(500, "internal_error");
  if (!data) throw new JobTaskHttpError(404, "not_found");
  return toJobTaskListItem(asRecord(data as Record<string, unknown>));
}

export async function softDeleteJobTask(input: {
  supabase: SupabaseClient;
  ctx: JobTaskAuthContext;
  jobId: string;
  taskId: string;
}): Promise<void> {
  const job = await loadOwnedJobForTasks(input.supabase, input.ctx, input.jobId);
  await loadOwnedTask(input.supabase, job, input.taskId);
  const { data, error } = await input.supabase
    .from("job_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.taskId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new JobTaskHttpError(500, "internal_error");
  if (!data) throw new JobTaskHttpError(404, "not_found");
}
