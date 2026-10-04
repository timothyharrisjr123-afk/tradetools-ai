/**
 * Contractor-facing copy for job attachment failures.
 * Shared by the routes (safe response message) and the client (upload / caption / remove).
 * Never surfaces internal codes such as `internal_error` or `upload_failed`.
 */

export const JOB_ATTACHMENTS_STORAGE_UNAVAILABLE =
  "Photo storage isn't available right now. Try again in a few minutes.";
export const JOB_ATTACHMENTS_UPLOAD_INTERRUPTED =
  "The upload didn't finish. Check your connection and try again.";
export const JOB_ATTACHMENTS_UPLOAD_NOT_SAVED =
  "The file uploaded but couldn't be added to this job. Try again.";
export const JOB_ATTACHMENTS_SIGNED_OUT = "You've been signed out. Sign in again, then try again.";
export const JOB_ATTACHMENTS_NO_PERMISSION = "You don't have permission to change photos on this job.";
export const JOB_ATTACHMENTS_JOB_UNAVAILABLE = "This job or photo is no longer available.";
export const JOB_ATTACHMENTS_SOMETHING_WENT_WRONG = "Something went wrong. Try again.";
export const JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL = "Upload failed";
export const JOB_ATTACHMENTS_CAPTION_NOT_SAVED = "Caption not saved.";
export const JOB_ATTACHMENTS_REMOVE_PHOTO_FAILED = "Couldn't remove this photo.";
export const JOB_ATTACHMENTS_REMOVE_FILE_FAILED = "Couldn't remove this file.";
export const JOB_ATTACHMENTS_RETRY_LABEL = "Try again";

/** Codes whose server message is already contractor copy (validation). */
const MESSAGE_CARRYING_CODES = new Set(["unsupported_type", "file_too_large", "invalid_filename"]);

export type JobAttachmentFailureStage = "prepare" | "transfer" | "finalize" | "caption" | "remove" | "list";

export type JobAttachmentFailure = {
  stage: JobAttachmentFailureStage;
  /** HTTP status when a response was received; null for network failures. */
  status?: number | null;
  code?: string | null;
  message?: string | null;
};

/** True for text that reads like an internal code rather than a sentence. */
export function looksLikeInternalCode(text: string | null | undefined): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return true;
  return /^[a-z0-9_.:-]+$/i.test(trimmed) && !/\s/.test(trimmed);
}

/**
 * Plain-language reason for an attachment failure. Does not assume every
 * storage failure is a missing bucket: storage, transfer, save, auth and
 * permission failures each read differently.
 */
export function resolveJobAttachmentFailureMessage(failure: JobAttachmentFailure): string {
  const code = String(failure.code ?? "").trim();
  const status = failure.status ?? null;

  if (code && MESSAGE_CARRYING_CODES.has(code) && !looksLikeInternalCode(failure.message)) {
    return String(failure.message).trim();
  }
  // The transfer goes straight to storage on a signed URL; its HTTP status is
  // not FieldDive auth, so it never reads as signed-out / no-permission.
  if (failure.stage === "transfer") return JOB_ATTACHMENTS_UPLOAD_INTERRUPTED;
  if (status === 401 || code === "unauthorized") return JOB_ATTACHMENTS_SIGNED_OUT;
  if (status === 403) return JOB_ATTACHMENTS_NO_PERMISSION;
  if (status === 404 || code === "not_found") return JOB_ATTACHMENTS_JOB_UNAVAILABLE;
  if (code === "storage_unavailable" || status === 503) return JOB_ATTACHMENTS_STORAGE_UNAVAILABLE;

  switch (failure.stage) {
    case "finalize":
      return code === "upload_incomplete" ? JOB_ATTACHMENTS_UPLOAD_INTERRUPTED : JOB_ATTACHMENTS_UPLOAD_NOT_SAVED;
    case "caption":
      return JOB_ATTACHMENTS_CAPTION_NOT_SAVED;
    default:
      return JOB_ATTACHMENTS_SOMETHING_WENT_WRONG;
  }
}

/** Error carrying a resolved, contractor-safe message for a failed attachment step. */
export class JobAttachmentClientError extends Error {
  constructor(readonly failure: JobAttachmentFailure) {
    super(resolveJobAttachmentFailureMessage(failure));
  }
}

/**
 * Bounded server log fields for a storage/DB failure. Strips URLs, JWTs and ids
 * so signed URLs, tokens and storage paths never reach logs.
 */
export function summarizeJobAttachmentBackendError(error: unknown): {
  classification: "bucket_not_found" | "storage_auth_rejected" | "backend_unreachable" | "backend_error";
  status: string | number | null;
  code: string | null;
  message: string;
} {
  const raw = (error ?? {}) as { message?: unknown; statusCode?: unknown; status?: unknown; code?: unknown };
  const message = String(raw.message ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .slice(0, 200);
  const status =
    typeof raw.statusCode === "string" || typeof raw.statusCode === "number"
      ? raw.statusCode
      : typeof raw.status === "string" || typeof raw.status === "number"
        ? raw.status
        : null;
  const code = typeof raw.code === "string" ? raw.code.slice(0, 40) : null;
  const lower = message.toLowerCase();
  // Storage reports an object insert into a missing bucket as a 404 foreign-key miss.
  const bucketMissing =
    /bucket not found|bucket.*(does not exist|not exist)/.test(lower) ||
    (String(status) === "404" && /related resource does not exist/.test(lower));
  const classification = bucketMissing
    ? "bucket_not_found"
    : /jwt|unauthori[sz]ed|invalid.*key|signature/.test(lower)
      ? "storage_auth_rejected"
      : /fetch failed|network|timeout|econn|enotfound/.test(lower)
        ? "backend_unreachable"
        : "backend_error";
  return { classification, status, code, message };
}

/** Safe message for a route response: explicit copy when present, else resolved from status/code. */
export function jobAttachmentResponseMessage(input: {
  status: number;
  code: string;
  message?: string | null;
}): string {
  if (!looksLikeInternalCode(input.message) && input.message !== input.code) {
    return String(input.message).trim();
  }
  return resolveJobAttachmentFailureMessage({ stage: "list", status: input.status, code: input.code });
}
