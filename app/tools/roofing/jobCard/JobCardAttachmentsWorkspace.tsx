"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  Plus,
  X,
} from "lucide-react";
import {
  buildJobAttachmentWorkspaceView,
  formatAttachmentByteSize,
  formatAttachmentCapturedAt,
  neighborAttachmentIds,
} from "@/app/lib/jobAttachmentModel";
import type {
  JobAttachmentCaptureSource,
  JobAttachmentListItem,
  JobAttachmentPendingItem,
} from "@/app/lib/jobAttachmentTypes";
import {
  JOB_ATTACHMENTS_ADD_LABEL,
  JOB_ATTACHMENTS_CHOOSE_PHOTOS,
  JOB_ATTACHMENTS_EMPTY,
  JOB_ATTACHMENTS_FILES_LABEL,
  JOB_ATTACHMENTS_PHOTOS_LABEL,
  JOB_ATTACHMENTS_TAKE_PHOTO,
  JOB_ATTACHMENTS_UPLOAD_FILE,
} from "@/app/lib/jobAttachmentTypes";
import { canUseCameraCapture } from "@/app/lib/jobAttachmentUpload";
import {
  JOB_ATTACHMENTS_CAPTION_NOT_SAVED,
  JOB_ATTACHMENTS_REMOVE_FILE_FAILED,
  JOB_ATTACHMENTS_REMOVE_PHOTO_FAILED,
  JOB_ATTACHMENTS_RETRY_LABEL,
  JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL,
} from "@/app/lib/jobAttachmentErrors";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const FILE_ACCEPT = `${IMAGE_ACCEPT},application/pdf,.pdf`;

type JobCardAttachmentsWorkspaceProps = {
  attachments: readonly JobAttachmentListItem[];
  pending?: readonly JobAttachmentPendingItem[];
  loading?: boolean;
  error?: string | null;
  currentUserId?: string | null;
  cameraAvailable?: boolean;
  onAddFiles: (files: FileList | File[], source: JobAttachmentCaptureSource) => void;
  onRetry?: (localId: string) => void;
  onCancelPending?: (localId: string) => void;
  /** Resolve false when the caption was not saved. */
  onCaption?: (attachmentId: string, caption: string) => Promise<boolean> | boolean | void;
  /** Resolve false when the item was not removed. */
  onRemove?: (attachmentId: string) => Promise<boolean> | boolean | void;
  initialViewerId?: string | null;
  initialMenuOpen?: boolean;
};

function AddMenu({
  cameraAvailable,
  onTake,
  onChoose,
  onUpload,
}: {
  cameraAvailable: boolean;
  onTake: () => void;
  onChoose: () => void;
  onUpload: () => void;
}) {
  return (
    <div
      className="absolute right-0 z-20 mt-1 min-w-[11.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      data-jobcard-attachments-add-menu="true"
      role="menu"
    >
      {cameraAvailable ? (
        <button
          type="button"
          role="menuitem"
          className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm text-slate-800 hover:bg-slate-50"
          onClick={onTake}
          data-jobcard-attachments-take-photo="true"
        >
          <Camera className="h-4 w-4 text-slate-500" />
          {JOB_ATTACHMENTS_TAKE_PHOTO}
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={onChoose}
        data-jobcard-attachments-choose-photos="true"
      >
        <ImageIcon className="h-4 w-4 text-slate-500" />
        {JOB_ATTACHMENTS_CHOOSE_PHOTOS}
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={onUpload}
        data-jobcard-attachments-upload-file="true"
      >
        <FileText className="h-4 w-4 text-slate-500" />
        {JOB_ATTACHMENTS_UPLOAD_FILE}
      </button>
    </div>
  );
}

export default function JobCardAttachmentsWorkspace({
  attachments,
  pending = [],
  loading = false,
  error = null,
  currentUserId = null,
  cameraAvailable,
  onAddFiles,
  onRetry,
  onCancelPending,
  onCaption,
  onRemove,
  initialViewerId = null,
  initialMenuOpen = false,
}: JobCardAttachmentsWorkspaceProps) {
  const view = buildJobAttachmentWorkspaceView({ attachments, pending });
  const failedPhotoUploads = view.photos.filter(
    (item) => item.kind === "pending" && item.pending?.status === "failed"
  );
  const galleryItems = view.photos.filter((item) => !failedPhotoUploads.includes(item));
  const camera =
    cameraAvailable ?? canUseCameraCapture();
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [viewerId, setViewerId] = useState<string | null>(initialViewerId);
  const [captionDraft, setCaptionDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [captionOutcome, setCaptionOutcome] = useState<{ id: string; status: "saving" | "failed" } | null>(null);
  const [viewerRemove, setViewerRemove] = useState<{ id: string; status: "removing" | "failed" } | null>(null);
  const [fileRemove, setFileRemove] = useState<{ id: string; status: "removing" | "failed" } | null>(null);
  const [dragging, setDragging] = useState(false);
  const takeRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  const viewing = attachments.find((row) => row.id === viewerId) ?? null;
  const neighbors = viewing
    ? neighborAttachmentIds(view.photos, viewing.id)
    : { previousId: null, nextId: null };

  useEffect(() => {
    setCaptionDraft(viewing?.caption ?? "");
    setConfirmRemove(false);
  }, [viewing?.id, viewing?.caption]);

  // Outcomes are keyed by attachment id so they never carry over to another photo.
  const captionStatus =
    viewing && captionOutcome?.id === viewing.id ? captionOutcome.status : "idle";
  const viewerRemoveStatus =
    viewing && viewerRemove?.id === viewing.id ? viewerRemove.status : "idle";

  const saveCaption = async (attachmentId: string, caption: string) => {
    if (!onCaption) return;
    setCaptionOutcome({ id: attachmentId, status: "saving" });
    const saved = await onCaption(attachmentId, caption);
    setCaptionOutcome(saved === false ? { id: attachmentId, status: "failed" } : null);
  };

  const removeFromViewer = async (attachmentId: string) => {
    if (!onRemove) return;
    setViewerRemove({ id: attachmentId, status: "removing" });
    const removed = await onRemove(attachmentId);
    if (removed === false) {
      setViewerRemove({ id: attachmentId, status: "failed" });
      setConfirmRemove(true);
      return;
    }
    setViewerRemove(null);
    setViewerId(null);
  };

  const removeFile = async (attachmentId: string) => {
    if (!onRemove) return;
    setFileRemove({ id: attachmentId, status: "removing" });
    const removed = await onRemove(attachmentId);
    setFileRemove(removed === false ? { id: attachmentId, status: "failed" } : null);
  };

  const pick = (source: JobAttachmentCaptureSource, list: FileList | null) => {
    if (!list || list.length === 0) return;
    onAddFiles(list, source);
  };

  const addButton = (
    <div className="relative">
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
        data-jobcard-attachments-add="true"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Plus className="h-4 w-4" />
        {JOB_ATTACHMENTS_ADD_LABEL}
      </button>
      {menuOpen ? (
        <AddMenu
          cameraAvailable={camera}
          onTake={() => {
            setMenuOpen(false);
            takeRef.current?.click();
          }}
          onChoose={() => {
            setMenuOpen(false);
            chooseRef.current?.click();
          }}
          onUpload={() => {
            setMenuOpen(false);
            fileRef.current?.click();
          }}
        />
      ) : null}
    </div>
  );

  return (
    <div
      className="space-y-5"
      data-jobcard-attachments-workspace="true"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files?.length) {
          onAddFiles(event.dataTransfer.files, "file");
        }
      }}
    >
      <input
        ref={takeRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        data-jobcard-attachments-input="camera"
        onChange={(event) => {
          pick("camera", event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={chooseRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        data-jobcard-attachments-input="library"
        onChange={(event) => {
          pick("library", event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        className="hidden"
        data-jobcard-attachments-input="file"
        onChange={(event) => {
          pick("file", event.target.files);
          event.target.value = "";
        }}
      />
      {view.isEmpty && !loading ? (
        <div
          className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200/90 bg-slate-50/40 px-4 py-10 text-center"
          data-jobcard-attachments-empty
        >
          <p className="text-sm font-medium text-slate-800">{JOB_ATTACHMENTS_EMPTY}</p>
          <div className="mt-4">{addButton}</div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {JOB_ATTACHMENTS_PHOTOS_LABEL}
          </p>
          {addButton}
        </div>
      )}

      {error ? (
        <p className="text-sm text-amber-700" data-jobcard-attachments-error>
          {error}
        </p>
      ) : null}

      {dragging ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
          Drop photos or files
        </p>
      ) : null}

      {failedPhotoUploads.length > 0 ? (
        <ul className="space-y-1.5" data-jobcard-attachments-failed-uploads="true">
          {failedPhotoUploads.map((item) => {
            const pendingItem = item.pending;
            if (!pendingItem) return null;
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50/60 py-1.5 pl-1.5 pr-1"
                data-jobcard-attachment-pending="failed"
              >
                {pendingItem.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingItem.previewUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {pendingItem.filename}
                  </p>
                  <p
                    className="text-xs leading-snug text-amber-800"
                    data-jobcard-attachment-failed-reason="true"
                  >
                    {JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL}
                    {pendingItem.error ? ` · ${pendingItem.error}` : ""}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center"
                  data-jobcard-attachment-failed-actions="true"
                >
                  {onRetry ? (
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center rounded-md px-2.5 text-sm font-semibold text-slate-800 hover:bg-amber-100/70"
                      onClick={() => onRetry(pendingItem.localId)}
                      data-jobcard-attachment-retry="true"
                    >
                      Retry
                    </button>
                  ) : null}
                  {onCancelPending ? (
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-center rounded-md px-2.5 text-sm text-slate-500 hover:bg-amber-100/70"
                      onClick={() => onCancelPending(pendingItem.localId)}
                      aria-label={`Remove failed upload ${pendingItem.filename}`}
                      data-jobcard-attachment-cancel="true"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {galleryItems.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          data-jobcard-attachments-gallery="true"
        >
          {galleryItems.map((item) => {
            if (item.kind === "pending" && item.pending) {
              const pendingItem = item.pending;
              return (
                <div
                  key={item.key}
                  className="relative aspect-square overflow-hidden rounded-md bg-slate-100"
                  data-jobcard-attachment-pending={pendingItem.status}
                >
                  {pendingItem.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingItem.previewUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-70"
                    />
                  ) : (
                    <div className="h-full w-full bg-slate-200" />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 px-2 py-2 text-center">
                    <p className="text-xs font-medium text-white">
                      {pendingItem.progress > 0
                        ? `${pendingItem.progress}%`
                        : "Uploading"}
                    </p>
                  </div>
                </div>
              );
            }
            const photo = item.attachment;
            if (!photo) return null;
            return (
              <button
                key={item.key}
                type="button"
                className="relative aspect-square overflow-hidden rounded-md bg-slate-100"
                onClick={() => setViewerId(photo.id)}
                data-jobcard-attachment-photo={photo.id}
              >
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={photo.caption || photo.originalFilename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {view.files.length > 0 ? (
        <div className="space-y-2" data-jobcard-attachments-files="true">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {JOB_ATTACHMENTS_FILES_LABEL}
          </p>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {view.files.map((item) => {
              if (item.kind === "pending" && item.pending) {
                const pendingItem = item.pending;
                return (
                  <li
                    key={item.key}
                    className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2 text-sm"
                    data-jobcard-attachment-file-pending={pendingItem.status}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-700">{pendingItem.filename}</span>
                      {pendingItem.status === "failed" ? (
                        <span
                          className="block text-xs text-amber-700"
                          data-jobcard-attachment-failed-reason="true"
                        >
                          {JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL}
                          {pendingItem.error ? ` · ${pendingItem.error}` : ""}
                        </span>
                      ) : null}
                    </span>
                    {pendingItem.status === "failed" && onRetry ? (
                      <button
                        type="button"
                        className="shrink-0 font-semibold text-slate-800"
                        onClick={() => onRetry(pendingItem.localId)}
                      >
                        Retry
                      </button>
                    ) : (
                      <span className="shrink-0 text-slate-500">
                        {pendingItem.status === "uploading" ? "Uploading" : ""}
                      </span>
                    )}
                  </li>
                );
              }
              const file = item.attachment;
              if (!file) return null;
              return (
                <li
                  key={item.key}
                  className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2"
                  data-jobcard-attachment-file={file.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {file.originalFilename}
                    </p>
                    {fileRemove?.id === file.id && fileRemove.status === "failed" ? (
                      <p className="text-xs text-amber-700" data-jobcard-attachment-remove-failed="file">
                        {JOB_ATTACHMENTS_REMOVE_FILE_FAILED}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      PDF
                      {file.byteSize
                        ? ` · ${formatAttachmentByteSize(file.byteSize)}`
                        : ""}
                      {file.createdAt
                        ? ` · ${formatAttachmentCapturedAt(file.createdAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {file.previewUrl ? (
                      <a
                        href={file.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-slate-800"
                      >
                        Open
                      </a>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center px-2 text-sm text-slate-500 disabled:opacity-60"
                        disabled={fileRemove?.id === file.id && fileRemove.status === "removing"}
                        onClick={() => void removeFile(file.id)}
                      >
                        {fileRemove?.id === file.id && fileRemove.status === "failed"
                          ? JOB_ATTACHMENTS_RETRY_LABEL
                          : fileRemove?.id === file.id && fileRemove.status === "removing"
                            ? "Removing…"
                            : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {viewing ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950"
          data-jobcard-attachment-viewer="true"
          role="dialog"
          aria-modal="true"
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start == null || end == null) return;
            const delta = end - start;
            if (delta > 48 && neighbors.previousId) setViewerId(neighbors.previousId);
            if (delta < -48 && neighbors.nextId) setViewerId(neighbors.nextId);
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
              onClick={() => setViewerId(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1">
              {viewing.previewUrl ? (
                <a
                  href={viewing.previewUrl}
                  download={viewing.originalFilename}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
                  aria-label="Download"
                >
                  <Download className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {neighbors.previousId ? (
              <button
                type="button"
                className="absolute left-1 top-1/2 z-10 hidden min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white sm:flex"
                onClick={() => setViewerId(neighbors.previousId)}
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
            {viewing.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewing.previewUrl}
                alt={viewing.caption || viewing.originalFilename}
                className="h-full w-full object-contain"
              />
            ) : null}
            {neighbors.nextId ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 z-10 hidden min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white sm:flex"
                onClick={() => setViewerId(neighbors.nextId)}
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}
          </div>
          <div className="space-y-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
            <p className="text-xs text-white/70" data-jobcard-attachment-viewer-meta>
              {formatAttachmentCapturedAt(viewing.createdAt)}
              {viewing.createdBy && currentUserId && viewing.createdBy === currentUserId
                ? " · You"
                : viewing.createdBy
                  ? " · Added"
                  : ""}
            </p>
            {onCaption ? (
              <div data-jobcard-attachment-caption-group="true">
                <input
                  className={
                    captionStatus === "failed"
                      ? "w-full rounded-md border border-amber-300/60 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                      : "w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                  }
                  placeholder="Add a caption"
                  value={captionDraft}
                  maxLength={500}
                  data-jobcard-attachment-caption="true"
                  aria-invalid={captionStatus === "failed" || undefined}
                  aria-describedby={captionStatus === "failed" ? "jobcard-attachment-caption-failed" : undefined}
                  onChange={(event) => {
                    setCaptionDraft(event.target.value);
                    if (captionStatus === "failed") setCaptionOutcome(null);
                  }}
                  onBlur={() => {
                    if (captionDraft.trim() !== (viewing.caption ?? "")) {
                      void saveCaption(viewing.id, captionDraft);
                    }
                  }}
                />
                {captionStatus === "failed" ? (
                  <div
                    id="jobcard-attachment-caption-failed"
                    className="flex items-center gap-2 text-xs text-amber-200"
                    data-jobcard-attachment-caption-failed="true"
                    role="alert"
                  >
                    <span>{JOB_ATTACHMENTS_CAPTION_NOT_SAVED}</span>
                    <button
                      type="button"
                      className="min-h-[36px] text-xs font-medium text-white/90 underline underline-offset-2"
                      data-jobcard-attachment-caption-retry="true"
                      onClick={() => void saveCaption(viewing.id, captionDraft)}
                    >
                      {JOB_ATTACHMENTS_RETRY_LABEL}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : viewing.caption ? (
              <p className="text-sm">{viewing.caption}</p>
            ) : null}
            {onRemove ? (
              confirmRemove ? (
                <div
                  className="flex flex-wrap items-center gap-x-3"
                  data-jobcard-attachment-remove-row="true"
                >
                  {viewerRemoveStatus === "failed" ? (
                    <p
                      className="text-xs text-amber-200"
                      data-jobcard-attachment-remove-failed="photo"
                      role="alert"
                    >
                      {JOB_ATTACHMENTS_REMOVE_PHOTO_FAILED}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="min-h-[44px] text-sm text-white/70"
                      onClick={() => {
                        setConfirmRemove(false);
                        setViewerRemove(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="min-h-[44px] text-sm font-semibold text-red-300 disabled:opacity-60"
                      data-jobcard-attachment-remove-confirm="true"
                      disabled={viewerRemoveStatus === "removing"}
                      onClick={() => void removeFromViewer(viewing.id)}
                    >
                      {viewerRemoveStatus === "failed"
                        ? JOB_ATTACHMENTS_RETRY_LABEL
                        : viewerRemoveStatus === "removing"
                          ? "Removing…"
                          : "Remove"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="min-h-[44px] text-sm text-white/70"
                  data-jobcard-attachment-remove="true"
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
