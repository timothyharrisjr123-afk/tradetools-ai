/**
 * Job attachment types — documentation photos/files V1.
 * Generic file spine metadata. Not measurement acquisition.
 */

export const JOB_ATTACHMENTS_BUCKET = "job-attachments";

export const JOB_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const JOB_ATTACHMENT_SIGNED_UPLOAD_SECONDS = 900;
export const JOB_ATTACHMENT_SIGNED_READ_SECONDS = 600;

export const JOB_ATTACHMENT_KINDS = ["image", "document"] as const;
export type JobAttachmentKind = (typeof JOB_ATTACHMENT_KINDS)[number];

export const JOB_ATTACHMENT_CAPTURE_SOURCES = [
  "camera",
  "library",
  "file",
  "unknown",
] as const;
export type JobAttachmentCaptureSource =
  (typeof JOB_ATTACHMENT_CAPTURE_SOURCES)[number];

export const JOB_ATTACHMENT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const JOB_ATTACHMENT_DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

export const JOB_ATTACHMENT_ALLOWED_MIME_TYPES = [
  ...JOB_ATTACHMENT_IMAGE_MIME_TYPES,
  ...JOB_ATTACHMENT_DOCUMENT_MIME_TYPES,
] as const;

export type JobAttachmentAllowedMime =
  (typeof JOB_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

export type JobAttachmentRecord = {
  id: string;
  company_id: string;
  job_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  kind: JobAttachmentKind;
  mime_type: string;
  byte_size: number;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  width_px: number | null;
  height_px: number | null;
  capture_source: string;
  job_stage_at_upload: string | null;
  caption: string | null;
  visibility: "internal";
  listed_in_job_gallery: boolean;
};

export type JobAttachmentListItem = {
  id: string;
  jobId: string;
  kind: JobAttachmentKind;
  mimeType: string;
  byteSize: number;
  originalFilename: string;
  caption: string | null;
  captureSource: string;
  jobStageAtUpload: string | null;
  createdAt: string;
  createdBy: string | null;
  listedInJobGallery: boolean;
  widthPx: number | null;
  heightPx: number | null;
  previewUrl: string | null;
};

export type JobAttachmentPendingStatus = "uploading" | "failed";

export type JobAttachmentPendingItem = {
  localId: string;
  filename: string;
  kind: JobAttachmentKind;
  previewUrl: string | null;
  progress: number;
  status: JobAttachmentPendingStatus;
  error: string | null;
};

export const JOB_ATTACHMENTS_EMPTY = "No photos or files yet";
export const JOB_ATTACHMENTS_ADD_LABEL = "Add";
export const JOB_ATTACHMENTS_TAKE_PHOTO = "Take photo";
export const JOB_ATTACHMENTS_CHOOSE_PHOTOS = "Choose photos";
export const JOB_ATTACHMENTS_UPLOAD_FILE = "Upload file";
export const JOB_ATTACHMENTS_PHOTOS_LABEL = "Photos";
export const JOB_ATTACHMENTS_FILES_LABEL = "Files";
export const JOB_ATTACHMENTS_UNSUPPORTED_FORMAT =
  "This format isn't supported. Use JPEG, PNG, WebP, or PDF.";
export const JOB_ATTACHMENTS_FILE_TOO_LARGE =
  "That file is too large. Max size is 20 MB.";
export const JOB_ATTACHMENTS_HEIC_UNSUPPORTED =
  "HEIC isn't supported yet. Use JPEG, PNG, or WebP.";
