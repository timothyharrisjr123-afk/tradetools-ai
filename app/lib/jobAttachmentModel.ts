/**
 * Job attachment workspace view-model helpers.
 * Pure. No I/O. Documentation gallery only.
 */

import type {
  JobAttachmentKind,
  JobAttachmentListItem,
  JobAttachmentPendingItem,
  JobAttachmentRecord,
} from "@/app/lib/jobAttachmentTypes";

export function isListedDocumentationAttachment(
  row: Pick<JobAttachmentRecord, "deleted_at" | "listed_in_job_gallery">
): boolean {
  return row.deleted_at == null && row.listed_in_job_gallery === true;
}

export function sortAttachmentsNewestFirst<
  T extends { createdAt: string; id?: string },
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    if (byTime !== 0) return byTime;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
}

export function toJobAttachmentListItem(
  row: JobAttachmentRecord,
  previewUrl: string | null = null
): JobAttachmentListItem {
  return {
    id: row.id,
    jobId: row.job_id,
    kind: row.kind,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    originalFilename: row.original_filename,
    caption: row.caption,
    captureSource: row.capture_source,
    jobStageAtUpload: row.job_stage_at_upload,
    createdAt: row.created_at,
    createdBy: row.created_by,
    listedInJobGallery: row.listed_in_job_gallery,
    widthPx: row.width_px,
    heightPx: row.height_px,
    previewUrl,
  };
}

export type JobAttachmentWorkspacePhoto = {
  key: string;
  kind: "ready" | "pending";
  attachment?: JobAttachmentListItem;
  pending?: JobAttachmentPendingItem;
};

export type JobAttachmentWorkspaceFile = {
  key: string;
  kind: "ready" | "pending";
  attachment?: JobAttachmentListItem;
  pending?: JobAttachmentPendingItem;
};

export type JobAttachmentWorkspaceView = {
  photos: JobAttachmentWorkspacePhoto[];
  files: JobAttachmentWorkspaceFile[];
  isEmpty: boolean;
};

function isPhotoKind(kind: JobAttachmentKind): boolean {
  return kind === "image";
}

export function buildJobAttachmentWorkspaceView(input: {
  attachments: readonly JobAttachmentListItem[];
  pending?: readonly JobAttachmentPendingItem[];
}): JobAttachmentWorkspaceView {
  const ready = sortAttachmentsNewestFirst(
    input.attachments.filter((row) => row.listedInJobGallery)
  );
  const pending = [...(input.pending ?? [])];

  const photos: JobAttachmentWorkspacePhoto[] = [
    ...pending
      .filter((item) => isPhotoKind(item.kind))
      .map((item) => ({
        key: item.localId,
        kind: "pending" as const,
        pending: item,
      })),
    ...ready
      .filter((row) => isPhotoKind(row.kind))
      .map((row) => ({
        key: row.id,
        kind: "ready" as const,
        attachment: row,
      })),
  ];

  const files: JobAttachmentWorkspaceFile[] = [
    ...pending
      .filter((item) => item.kind === "document")
      .map((item) => ({
        key: item.localId,
        kind: "pending" as const,
        pending: item,
      })),
    ...ready
      .filter((row) => row.kind === "document")
      .map((row) => ({
        key: row.id,
        kind: "ready" as const,
        attachment: row,
      })),
  ];

  return {
    photos,
    files,
    isEmpty: photos.length === 0 && files.length === 0,
  };
}

export function formatAttachmentByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAttachmentCapturedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function neighborAttachmentIds(
  photos: readonly JobAttachmentWorkspacePhoto[],
  currentId: string
): { previousId: string | null; nextId: string | null } {
  const readyIds = photos
    .filter((item) => item.kind === "ready" && item.attachment)
    .map((item) => item.attachment!.id);
  const index = readyIds.indexOf(currentId);
  if (index < 0) return { previousId: null, nextId: null };
  return {
    previousId: index > 0 ? readyIds[index - 1] ?? null : null,
    nextId: index < readyIds.length - 1 ? readyIds[index + 1] ?? null : null,
  };
}
