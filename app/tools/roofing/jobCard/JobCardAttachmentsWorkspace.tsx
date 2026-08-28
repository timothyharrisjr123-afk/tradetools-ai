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
  onCaption?: (attachmentId: string, caption: string) => void;
  onRemove?: (attachmentId: string) => void;
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
  const camera =
    cameraAvailable ?? canUseCameraCapture();
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [viewerId, setViewerId] = useState<string | null>(initialViewerId);
  const [captionDraft, setCaptionDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
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
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-500" data-jobcard-attachments-empty>
            {JOB_ATTACHMENTS_EMPTY}
          </p>
          {addButton}
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

      {view.photos.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          data-jobcard-attachments-gallery="true"
        >
          {view.photos.map((item) => {
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
                    {pendingItem.status === "failed" ? (
                      <div
                        className="flex flex-col items-center gap-1.5"
                        data-jobcard-attachment-failed-actions="true"
                      >
                        <p className="text-xs font-semibold text-white">Failed</p>
                        <div className="flex w-full flex-col items-center gap-1">
                          {onRetry ? (
                            <button
                              type="button"
                              className="min-h-[44px] min-w-[5rem] rounded px-3 text-sm font-semibold text-white underline decoration-white/80 underline-offset-2"
                              onClick={() => onRetry(pendingItem.localId)}
                              data-jobcard-attachment-retry="true"
                            >
                              Retry
                            </button>
                          ) : null}
                          {onCancelPending ? (
                            <button
                              type="button"
                              className="min-h-[44px] px-3 text-xs font-medium text-white/75"
                              onClick={() => onCancelPending(pendingItem.localId)}
                              data-jobcard-attachment-cancel="true"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-white">
                        {pendingItem.progress > 0
                          ? `${pendingItem.progress}%`
                          : "Uploading"}
                      </p>
                    )}
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
                    <span className="min-w-0 truncate text-slate-700">
                      {pendingItem.filename}
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
                        className="inline-flex min-h-[44px] items-center px-2 text-sm text-slate-500"
                        onClick={() => onRemove(file.id)}
                      >
                        Remove
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
              <input
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                placeholder="Add a caption"
                value={captionDraft}
                maxLength={500}
                data-jobcard-attachment-caption="true"
                onChange={(event) => setCaptionDraft(event.target.value)}
                onBlur={() => {
                  if (captionDraft.trim() !== (viewing.caption ?? "")) {
                    onCaption(viewing.id, captionDraft);
                  }
                }}
              />
            ) : viewing.caption ? (
              <p className="text-sm">{viewing.caption}</p>
            ) : null}
            {onRemove ? (
              confirmRemove ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[44px] text-sm text-white/70"
                    onClick={() => setConfirmRemove(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="min-h-[44px] text-sm font-semibold text-red-300"
                    data-jobcard-attachment-remove-confirm="true"
                    onClick={() => {
                      onRemove(viewing.id);
                      setViewerId(null);
                    }}
                  >
                    Remove
                  </button>
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
