/**
 * Server-authoritative job attachment validation.
 * Documentation files only. No measurement-source types.
 */

import {
  JOB_ATTACHMENT_ALLOWED_MIME_TYPES,
  JOB_ATTACHMENT_CAPTURE_SOURCES,
  JOB_ATTACHMENT_DOCUMENT_MIME_TYPES,
  JOB_ATTACHMENT_IMAGE_MIME_TYPES,
  JOB_ATTACHMENT_MAX_BYTES,
  JOB_ATTACHMENTS_FILE_TOO_LARGE,
  JOB_ATTACHMENTS_HEIC_UNSUPPORTED,
  JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
  type JobAttachmentAllowedMime,
  type JobAttachmentCaptureSource,
  type JobAttachmentKind,
} from "@/app/lib/jobAttachmentTypes";

export type JobAttachmentValidationError = {
  ok: false;
  code: "unsupported_type" | "file_too_large" | "invalid_filename";
  message: string;
};

export type JobAttachmentValidationOk = {
  ok: true;
  mimeType: JobAttachmentAllowedMime;
  kind: JobAttachmentKind;
  filename: string;
  byteSize: number;
  captureSource: JobAttachmentCaptureSource;
};

const HEIC_MIME = new Set(["image/heic", "image/heif", "image/heic-sequence"]);

const DANGEROUS_MIME = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-msdos-program",
  "application/octet-stream",
]);

function normalizeMime(raw: string): string {
  return raw.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function kindForMime(mimeType: JobAttachmentAllowedMime): JobAttachmentKind {
  if ((JOB_ATTACHMENT_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return "document";
  }
  return "image";
}

export function sanitizeAttachmentFilename(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const trimmed = base.trim().replace(/[^\w.\- ()[\]]+/g, "_");
  const collapsed = trimmed.replace(/\s+/g, " ").slice(0, 180);
  const cleaned = collapsed.replace(/^\.+/, "") || "file";
  return cleaned;
}

export function parseCaptureSource(raw: unknown): JobAttachmentCaptureSource {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (
    (JOB_ATTACHMENT_CAPTURE_SOURCES as readonly string[]).includes(value)
  ) {
    return value as JobAttachmentCaptureSource;
  }
  return "unknown";
}

export function validateJobAttachmentUpload(input: {
  mimeType: unknown;
  filename: unknown;
  byteSize: unknown;
  captureSource?: unknown;
}): JobAttachmentValidationOk | JobAttachmentValidationError {
  const mime = typeof input.mimeType === "string" ? normalizeMime(input.mimeType) : "";
  const filenameRaw = typeof input.filename === "string" ? input.filename : "";
  const size =
    typeof input.byteSize === "number" && Number.isFinite(input.byteSize)
      ? input.byteSize
      : Number(input.byteSize);

  if (HEIC_MIME.has(mime) || /\.hei[cf]$/i.test(filenameRaw)) {
    return {
      ok: false,
      code: "unsupported_type",
      message: JOB_ATTACHMENTS_HEIC_UNSUPPORTED,
    };
  }

  if (!mime || DANGEROUS_MIME.has(mime)) {
    return {
      ok: false,
      code: "unsupported_type",
      message: JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
    };
  }

  if (
    !(JOB_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return {
      ok: false,
      code: "unsupported_type",
      message: JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
    };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return {
      ok: false,
      code: "file_too_large",
      message: JOB_ATTACHMENTS_FILE_TOO_LARGE,
    };
  }

  if (size > JOB_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: JOB_ATTACHMENTS_FILE_TOO_LARGE,
    };
  }

  if (!filenameRaw.trim()) {
    return {
      ok: false,
      code: "invalid_filename",
      message: JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
    };
  }
  const filename = sanitizeAttachmentFilename(filenameRaw);

  const allowed = mime as JobAttachmentAllowedMime;
  return {
    ok: true,
    mimeType: allowed,
    kind: kindForMime(allowed),
    filename,
    byteSize: Math.floor(size),
    captureSource: parseCaptureSource(input.captureSource),
  };
}

export function isJobAttachmentImageMime(mimeType: string): boolean {
  return (JOB_ATTACHMENT_IMAGE_MIME_TYPES as readonly string[]).includes(
    normalizeMime(mimeType)
  );
}

export function buildJobAttachmentStoragePath(input: {
  companyId: string;
  jobId: string;
  attachmentId: string;
  filename: string;
}): string {
  return `${input.companyId}/${input.jobId}/${input.attachmentId}/${sanitizeAttachmentFilename(input.filename)}`;
}
