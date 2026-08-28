/**
 * Client-side documentation upload helpers.
 * In-session only. No offline queue.
 */

import type {
  JobAttachmentCaptureSource,
  JobAttachmentKind,
  JobAttachmentListItem,
  JobAttachmentPendingItem,
} from "@/app/lib/jobAttachmentTypes";
import { validateJobAttachmentUpload } from "@/app/lib/jobAttachmentValidation";

export type PreparedUpload = {
  attachmentId: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  mimeType: string;
  filename: string;
  kind: JobAttachmentKind;
  captureSource: string;
  jobStageAtUpload: string | null;
};

export function newPendingLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function captureSourceForPicker(
  mode: "camera" | "library" | "file"
): JobAttachmentCaptureSource {
  return mode;
}

function objectUrlForImage(file: File, isImage: boolean): string | null {
  if (!isImage) return null;
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

export function createPendingFromFile(
  file: File,
  localId: string
): { pending: JobAttachmentPendingItem; error: string | null } {
  const validated = validateJobAttachmentUpload({
    mimeType: file.type || guessMimeFromName(file.name),
    filename: file.name,
    byteSize: file.size,
  });
  if (!validated.ok) {
    return {
      pending: {
        localId,
        filename: file.name || "file",
        kind: file.type === "application/pdf" ? "document" : "image",
        previewUrl: objectUrlForImage(
          file,
          file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name)
        ),
        progress: 0,
        status: "failed",
        error: validated.message,
      },
      error: validated.message,
    };
  }
  return {
    pending: {
      localId,
      filename: validated.filename,
      kind: validated.kind,
      previewUrl: objectUrlForImage(file, validated.kind === "image"),
      progress: 0,
      status: "uploading",
      error: null,
    },
    error: null,
  };
}

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "";
}

export function mergePendingUpdate(
  pending: readonly JobAttachmentPendingItem[],
  localId: string,
  patch: Partial<JobAttachmentPendingItem>
): JobAttachmentPendingItem[] {
  return pending.map((item) =>
    item.localId === localId ? { ...item, ...patch } : item
  );
}

export function removePending(
  pending: readonly JobAttachmentPendingItem[],
  localId: string
): JobAttachmentPendingItem[] {
  return pending.filter((item) => item.localId !== localId);
}

export function appendReadyAttachment(
  attachments: readonly JobAttachmentListItem[],
  next: JobAttachmentListItem
): JobAttachmentListItem[] {
  const without = attachments.filter((row) => row.id !== next.id);
  return [next, ...without];
}

export function canUseCameraCapture(
  env: {
    ontouch?: boolean;
    maxTouchPoints?: number;
    coarsePointer?: boolean;
    finePointer?: boolean;
    hoverCapable?: boolean;
    touchFirst?: boolean;
    captureAttr?: boolean;
  } = {}
): boolean {
  const captureAttr =
    env.captureAttr ??
    (typeof document !== "undefined" &&
      "capture" in document.createElement("input"));
  if (!captureAttr) return false;

  const maxTouchPoints =
    env.maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);
  const coarsePointer =
    env.coarsePointer ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches === true);
  const finePointer =
    env.finePointer ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)").matches === true);
  const hoverCapable =
    env.hoverCapable ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover)").matches === true);
  const touchFirst =
    env.touchFirst ??
    (typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ===
        true);
  const ontouch =
    env.ontouch ??
    (typeof window !== "undefined" && "ontouchstart" in window);

  // Primary mouse/trackpad desktop: no meaningful rear-camera capture.
  if (
    hoverCapable &&
    finePointer &&
    !coarsePointer &&
    maxTouchPoints === 0 &&
    !ontouch &&
    !touchFirst
  ) {
    return false;
  }

  return Boolean(touchFirst || coarsePointer || maxTouchPoints > 0 || ontouch);
}

export async function putFileToSignedUrl(input: {
  signedUrl: string;
  file: File;
  mimeType: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", input.signedUrl);
    xhr.setRequestHeader("Content-Type", input.mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && input.onProgress) {
        input.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("upload_failed"));
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    input.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(input.file);
  });
}
