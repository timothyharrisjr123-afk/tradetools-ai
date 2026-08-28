"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobAttachmentListItem } from "@/app/lib/jobAttachmentTypes";
import {
  JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
} from "@/app/lib/jobAttachmentTypes";
import {
  appendReadyAttachment,
  createPendingFromFile,
  mergePendingUpdate,
  newPendingLocalId,
  putFileToSignedUrl,
  removePending,
  type PreparedUpload,
} from "@/app/lib/jobAttachmentUpload";
import type { JobAttachmentCaptureSource } from "@/app/lib/jobAttachmentTypes";
import type { JobAttachmentPendingItem } from "@/app/lib/jobAttachmentTypes";

type UseJobCardAttachmentsArgs = {
  jobId: string | null;
  enabled: boolean;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export function useJobCardAttachments({
  jobId,
  enabled,
}: UseJobCardAttachmentsArgs) {
  const [attachments, setAttachments] = useState<JobAttachmentListItem[]>([]);
  const [pending, setPending] = useState<JobAttachmentPendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortByLocalId = useRef(new Map<string, AbortController>());
  const filesByLocalId = useRef(new Map<string, File>());
  const sourceByLocalId = useRef(new Map<string, JobAttachmentCaptureSource>());

  const refresh = useCallback(async () => {
    if (!jobId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/attachments`,
        { cache: "no-store" }
      );
      const body = await readJson(res);
      if (!res.ok || body.ok !== true) {
        setError("Photos could not be loaded.");
        return;
      }
      setAttachments((body.attachments as JobAttachmentListItem[]) ?? []);
    } catch {
      setError("Photos could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [jobId, enabled]);

  useEffect(() => {
    if (!enabled || !jobId) {
      setAttachments([]);
      return;
    }
    void refresh();
  }, [enabled, jobId, refresh]);

  const uploadOne = useCallback(
    async (localId: string) => {
      if (!jobId) return;
      const file = filesByLocalId.current.get(localId);
      if (!file) return;
      const created = createPendingFromFile(file, localId);
      setPending((prev) => {
        if (prev.some((item) => item.localId === localId)) {
          return mergePendingUpdate(prev, localId, {
            status: created.error ? "failed" : "uploading",
            error: created.error,
            progress: created.error ? 0 : 1,
          });
        }
        return [...prev, created.pending];
      });
      if (created.error) return;

      const controller = new AbortController();
      abortByLocalId.current.set(localId, controller);
      const captureSource = sourceByLocalId.current.get(localId) ?? "unknown";

      try {
        const prepareRes = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/attachments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mimeType:
                file.type ||
                (created.pending.kind === "document"
                  ? "application/pdf"
                  : ""),
              filename: file.name,
              byteSize: file.size,
              captureSource,
            }),
            signal: controller.signal,
          }
        );
        const prepareBody = await readJson(prepareRes);
        if (!prepareRes.ok || prepareBody.ok !== true) {
          throw new Error(
            typeof prepareBody.message === "string"
              ? prepareBody.message
              : JOB_ATTACHMENTS_UNSUPPORTED_FORMAT
          );
        }
        const prepared = prepareBody as unknown as PreparedUpload;

        await putFileToSignedUrl({
          signedUrl: prepared.signedUrl,
          file,
          mimeType: prepared.mimeType,
          signal: controller.signal,
          onProgress: (percent) => {
            setPending((prev) =>
              mergePendingUpdate(prev, localId, {
                progress: Math.max(percent, 1),
                status: "uploading",
              })
            );
          },
        });

        const finalizeRes = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/attachments/${encodeURIComponent(prepared.attachmentId)}/finalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mimeType: prepared.mimeType,
              filename: prepared.filename,
              byteSize: file.size,
              captureSource: prepared.captureSource,
              jobStageAtUpload: prepared.jobStageAtUpload,
            }),
            signal: controller.signal,
          }
        );
        const finalizeBody = await readJson(finalizeRes);
        if (!finalizeRes.ok || finalizeBody.ok !== true) {
          throw new Error(
            typeof finalizeBody.message === "string"
              ? finalizeBody.message
              : "Upload could not be completed."
          );
        }
        const attachment = finalizeBody.attachment as JobAttachmentListItem;
        setAttachments((prev) => appendReadyAttachment(prev, attachment));
        setPending((prev) => {
          const current = prev.find((item) => item.localId === localId);
          if (current?.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(current.previewUrl);
          }
          return removePending(prev, localId);
        });
        filesByLocalId.current.delete(localId);
        sourceByLocalId.current.delete(localId);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setPending((prev) => removePending(prev, localId));
          filesByLocalId.current.delete(localId);
          return;
        }
        setPending((prev) =>
          mergePendingUpdate(prev, localId, {
            status: "failed",
            error:
              err instanceof Error && err.message
                ? err.message
                : "Upload failed.",
          })
        );
      } finally {
        abortByLocalId.current.delete(localId);
      }
    },
    [jobId]
  );

  const uploadFiles = useCallback(
    (files: FileList | File[], captureSource: JobAttachmentCaptureSource) => {
      const list = Array.from(files);
      for (const file of list) {
        const localId = newPendingLocalId();
        filesByLocalId.current.set(localId, file);
        sourceByLocalId.current.set(localId, captureSource);
        const created = createPendingFromFile(file, localId);
        setPending((prev) => [...prev, created.pending]);
        if (!created.error) {
          void uploadOne(localId);
        }
      }
    },
    [uploadOne]
  );

  const retry = useCallback(
    (localId: string) => {
      setPending((prev) =>
        mergePendingUpdate(prev, localId, {
          status: "uploading",
          error: null,
          progress: 1,
        })
      );
      void uploadOne(localId);
    },
    [uploadOne]
  );

  const cancel = useCallback((localId: string) => {
    abortByLocalId.current.get(localId)?.abort();
    setPending((prev) => {
      const current = prev.find((item) => item.localId === localId);
      if (current?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return removePending(prev, localId);
    });
    filesByLocalId.current.delete(localId);
    sourceByLocalId.current.delete(localId);
  }, []);

  const patchCaption = useCallback(
    async (attachmentId: string, caption: string) => {
      if (!jobId) return;
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/attachments/${encodeURIComponent(attachmentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption }),
        }
      );
      const body = await readJson(res);
      if (!res.ok || body.ok !== true) return;
      const attachment = body.attachment as JobAttachmentListItem;
      setAttachments((prev) =>
        prev.map((row) => (row.id === attachment.id ? attachment : row))
      );
    },
    [jobId]
  );

  const remove = useCallback(
    async (attachmentId: string) => {
      if (!jobId) return;
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setAttachments((prev) => prev.filter((row) => row.id !== attachmentId));
    },
    [jobId]
  );

  return {
    attachments,
    pending,
    loading,
    error,
    uploadFiles,
    retry,
    cancel,
    patchCaption,
    remove,
    refresh,
  };
}
