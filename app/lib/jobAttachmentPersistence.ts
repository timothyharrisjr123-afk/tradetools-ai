/**
 * Server job-attachment persistence.
 * User JWT + RLS for metadata. Service role for private signed blob access.
 * Does not write jobs.stage, measurements, proposals, payments, or activity.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { probeImageDimensions } from "@/app/lib/jobAttachmentImageMeta";
import {
  isListedDocumentationAttachment,
  sortAttachmentsNewestFirst,
  toJobAttachmentListItem,
} from "@/app/lib/jobAttachmentModel";
import {
  JOB_ATTACHMENTS_BUCKET,
  JOB_ATTACHMENT_SIGNED_READ_SECONDS,
  JOB_ATTACHMENT_SIGNED_UPLOAD_SECONDS,
  type JobAttachmentListItem,
  type JobAttachmentRecord,
} from "@/app/lib/jobAttachmentTypes";
import {
  buildJobAttachmentStoragePath,
  validateJobAttachmentUpload,
} from "@/app/lib/jobAttachmentValidation";
import { isUuidLike } from "@/app/lib/uuid";

const LIST_COLUMNS =
  "id,company_id,job_id,created_by,created_at,updated_at,deleted_at,kind,mime_type,byte_size,original_filename,storage_bucket,storage_path,width_px,height_px,capture_source,job_stage_at_upload,caption,visibility,listed_in_job_gallery";

export type JobAttachmentAuthContext = {
  userId: string;
  companyId: string;
};

export class JobAttachmentHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

type JobRow = { id: string; company_id: string; stage: string | null };

export async function loadOwnedJob(
  supabase: SupabaseClient,
  ctx: JobAttachmentAuthContext,
  jobId: string
): Promise<JobRow> {
  if (!isUuidLike(jobId)) {
    throw new JobAttachmentHttpError(400, "invalid_payload");
  }
  const { data, error } = await supabase
    .from("jobs")
    .select("id,company_id,stage")
    .eq("id", jobId)
    .eq("company_id", ctx.companyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    throw new JobAttachmentHttpError(500, "internal_error");
  }
  if (!data) {
    throw new JobAttachmentHttpError(404, "not_found");
  }
  return data as JobRow;
}

function asRecord(row: Record<string, unknown>): JobAttachmentRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    job_id: String(row.job_id),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
    kind: row.kind === "document" ? "document" : "image",
    mime_type: String(row.mime_type),
    byte_size: Number(row.byte_size),
    original_filename: String(row.original_filename),
    storage_bucket: String(row.storage_bucket),
    storage_path: String(row.storage_path),
    width_px: row.width_px == null ? null : Number(row.width_px),
    height_px: row.height_px == null ? null : Number(row.height_px),
    capture_source: String(row.capture_source ?? "unknown"),
    job_stage_at_upload: row.job_stage_at_upload
      ? String(row.job_stage_at_upload)
      : null,
    caption: row.caption == null ? null : String(row.caption),
    visibility: "internal",
    listed_in_job_gallery: row.listed_in_job_gallery !== false,
  };
}

async function signReadUrl(
  admin: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(JOB_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, JOB_ATTACHMENT_SIGNED_READ_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function prepareJobAttachmentUpload(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
  mimeType: unknown;
  filename: unknown;
  byteSize: unknown;
  captureSource?: unknown;
}): Promise<{
  attachmentId: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  mimeType: string;
  filename: string;
  kind: "image" | "document";
  captureSource: string;
  jobStageAtUpload: string | null;
}> {
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const validated = validateJobAttachmentUpload({
    mimeType: input.mimeType,
    filename: input.filename,
    byteSize: input.byteSize,
    captureSource: input.captureSource,
  });
  if (!validated.ok) {
    throw new JobAttachmentHttpError(400, validated.code, validated.message);
  }

  const attachmentId = randomUUID();
  const storagePath = buildJobAttachmentStoragePath({
    companyId: job.company_id,
    jobId: job.id,
    attachmentId,
    filename: validated.filename,
  });

  const { data, error } = await input.admin.storage
    .from(JOB_ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.signedUrl || !data.token) {
    throw new JobAttachmentHttpError(500, "internal_error");
  }

  return {
    attachmentId,
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    mimeType: validated.mimeType,
    filename: validated.filename,
    kind: validated.kind,
    captureSource: validated.captureSource,
    jobStageAtUpload: job.stage ?? null,
  };
}

async function objectExists(
  admin: SupabaseClient,
  storagePath: string
): Promise<boolean> {
  const { error } = await admin.storage
    .from(JOB_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 30);
  return !error;
}

async function probeStoredImageDimensions(
  admin: SupabaseClient,
  storagePath: string,
  mimeType: string
): Promise<{ width: number; height: number } | null> {
  if (!mimeType.startsWith("image/")) return null;
  const { data, error } = await admin.storage
    .from(JOB_ATTACHMENTS_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  const buffer = new Uint8Array(await data.arrayBuffer());
  return probeImageDimensions(buffer, mimeType);
}

export async function finalizeJobAttachmentUpload(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
  attachmentId: string;
  mimeType: unknown;
  filename: unknown;
  byteSize: unknown;
  captureSource?: unknown;
  jobStageAtUpload?: unknown;
}): Promise<JobAttachmentListItem> {
  if (!isUuidLike(input.attachmentId)) {
    throw new JobAttachmentHttpError(400, "invalid_payload");
  }
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const validated = validateJobAttachmentUpload({
    mimeType: input.mimeType,
    filename: input.filename,
    byteSize: input.byteSize,
    captureSource: input.captureSource,
  });
  if (!validated.ok) {
    throw new JobAttachmentHttpError(400, validated.code, validated.message);
  }

  const storagePath = buildJobAttachmentStoragePath({
    companyId: job.company_id,
    jobId: job.id,
    attachmentId: input.attachmentId,
    filename: validated.filename,
  });

  const exists = await objectExists(input.admin, storagePath);
  if (!exists) {
    throw new JobAttachmentHttpError(409, "upload_incomplete");
  }

  const { data: existing } = await input.supabase
    .from("job_attachments")
    .select(LIST_COLUMNS)
    .eq("id", input.attachmentId)
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) {
    const row = asRecord(existing as Record<string, unknown>);
    const previewUrl =
      row.kind === "image" ? await signReadUrl(input.admin, row.storage_path) : null;
    return toJobAttachmentListItem(row, previewUrl);
  }

  const dims = await probeStoredImageDimensions(
    input.admin,
    storagePath,
    validated.mimeType
  );

  const stageSnapshot =
    typeof input.jobStageAtUpload === "string" && input.jobStageAtUpload.trim()
      ? input.jobStageAtUpload.trim()
      : job.stage ?? null;

  const insert = {
    id: input.attachmentId,
    company_id: job.company_id,
    job_id: job.id,
    created_by: input.ctx.userId,
    kind: validated.kind,
    mime_type: validated.mimeType,
    byte_size: validated.byteSize,
    original_filename: validated.filename,
    storage_bucket: JOB_ATTACHMENTS_BUCKET,
    storage_path: storagePath,
    width_px: dims?.width ?? null,
    height_px: dims?.height ?? null,
    capture_source: validated.captureSource,
    job_stage_at_upload: stageSnapshot,
    caption: null,
    visibility: "internal",
    listed_in_job_gallery: true,
  };

  const { data, error } = await input.supabase
    .from("job_attachments")
    .insert(insert)
    .select(LIST_COLUMNS)
    .single();
  if (error || !data) {
    throw new JobAttachmentHttpError(500, "internal_error");
  }

  const row = asRecord(data as Record<string, unknown>);
  const previewUrl =
    row.kind === "image" ? await signReadUrl(input.admin, row.storage_path) : null;
  return toJobAttachmentListItem(row, previewUrl);
}

export async function listJobAttachments(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
}): Promise<JobAttachmentListItem[]> {
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const { data, error } = await input.supabase
    .from("job_attachments")
    .select(LIST_COLUMNS)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .eq("listed_in_job_gallery", true)
    .order("created_at", { ascending: false });
  if (error) {
    throw new JobAttachmentHttpError(500, "internal_error");
  }

  const rows = (data ?? [])
    .map((row) => asRecord(row as Record<string, unknown>))
    .filter(isListedDocumentationAttachment);

  const items: JobAttachmentListItem[] = [];
  for (const row of rows) {
    const signed = await signReadUrl(input.admin, row.storage_path);
    items.push(toJobAttachmentListItem(row, signed));
  }
  return sortAttachmentsNewestFirst(items);
}

export async function signJobAttachmentReadUrl(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
  attachmentId: string;
}): Promise<{ url: string; filename: string; mimeType: string }> {
  if (!isUuidLike(input.attachmentId)) {
    throw new JobAttachmentHttpError(400, "invalid_payload");
  }
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const { data, error } = await input.supabase
    .from("job_attachments")
    .select(LIST_COLUMNS)
    .eq("id", input.attachmentId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new JobAttachmentHttpError(500, "internal_error");
  if (!data) throw new JobAttachmentHttpError(404, "not_found");
  const row = asRecord(data as Record<string, unknown>);
  const url = await signReadUrl(input.admin, row.storage_path);
  if (!url) throw new JobAttachmentHttpError(500, "internal_error");
  return {
    url,
    filename: row.original_filename,
    mimeType: row.mime_type,
  };
}

export async function patchJobAttachmentCaption(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
  attachmentId: string;
  caption: unknown;
}): Promise<JobAttachmentListItem> {
  if (!isUuidLike(input.attachmentId)) {
    throw new JobAttachmentHttpError(400, "invalid_payload");
  }
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const caption =
    typeof input.caption === "string" ? input.caption.trim().slice(0, 500) : "";
  const { data, error } = await input.supabase
    .from("job_attachments")
    .update({ caption: caption.length > 0 ? caption : null })
    .eq("id", input.attachmentId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error) throw new JobAttachmentHttpError(500, "internal_error");
  if (!data) throw new JobAttachmentHttpError(404, "not_found");
  const row = asRecord(data as Record<string, unknown>);
  const previewUrl =
    row.kind === "image" ? await signReadUrl(input.admin, row.storage_path) : null;
  return toJobAttachmentListItem(row, previewUrl);
}

export async function softDeleteJobAttachment(input: {
  supabase: SupabaseClient;
  ctx: JobAttachmentAuthContext;
  jobId: string;
  attachmentId: string;
}): Promise<void> {
  if (!isUuidLike(input.attachmentId)) {
    throw new JobAttachmentHttpError(400, "invalid_payload");
  }
  const job = await loadOwnedJob(input.supabase, input.ctx, input.jobId);
  const { data, error } = await input.supabase
    .from("job_attachments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.attachmentId)
    .eq("job_id", job.id)
    .eq("company_id", job.company_id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new JobAttachmentHttpError(500, "internal_error");
  if (!data) throw new JobAttachmentHttpError(404, "not_found");
}

export { JOB_ATTACHMENT_SIGNED_UPLOAD_SECONDS };
