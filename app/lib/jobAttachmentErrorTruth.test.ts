/**
 * Core Flow 1 / Slice 1 (E + G) — attachment failures are visible, retryable and in plain language.
 * Run: npx tsx --test app/lib/jobAttachmentErrorTruth.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  JOB_ATTACHMENTS_CAPTION_NOT_SAVED,
  JOB_ATTACHMENTS_JOB_UNAVAILABLE,
  JOB_ATTACHMENTS_NO_PERMISSION,
  JOB_ATTACHMENTS_SIGNED_OUT,
  JOB_ATTACHMENTS_SOMETHING_WENT_WRONG,
  JOB_ATTACHMENTS_STORAGE_UNAVAILABLE,
  JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL,
  JOB_ATTACHMENTS_UPLOAD_INTERRUPTED,
  JOB_ATTACHMENTS_UPLOAD_NOT_SAVED,
  JobAttachmentClientError,
  jobAttachmentResponseMessage,
  looksLikeInternalCode,
  resolveJobAttachmentFailureMessage,
  summarizeJobAttachmentBackendError,
} from "./jobAttachmentErrors";
import type { JobAttachmentPendingItem } from "./jobAttachmentTypes";
import JobCardAttachmentsWorkspace from "@/app/tools/roofing/jobCard/JobCardAttachmentsWorkspace";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("failure copy by stage (G)", () => {
  test("storage unavailable is distinct from transfer, save, auth and permission", () => {
    const messages = new Set([
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 503, code: "storage_unavailable" }),
      resolveJobAttachmentFailureMessage({ stage: "transfer", status: null }),
      resolveJobAttachmentFailureMessage({ stage: "finalize", status: 500, code: "internal_error" }),
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 401, code: "unauthorized" }),
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 403, code: "forbidden" }),
    ]);
    assert.equal(messages.size, 5);
  });

  test("prepare mapping", () => {
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 503, code: "storage_unavailable" }),
      JOB_ATTACHMENTS_STORAGE_UNAVAILABLE
    );
    assert.equal(resolveJobAttachmentFailureMessage({ stage: "prepare", status: 401 }), JOB_ATTACHMENTS_SIGNED_OUT);
    assert.equal(resolveJobAttachmentFailureMessage({ stage: "prepare", status: 403 }), JOB_ATTACHMENTS_NO_PERMISSION);
    assert.equal(resolveJobAttachmentFailureMessage({ stage: "prepare", status: 404 }), JOB_ATTACHMENTS_JOB_UNAVAILABLE);
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 500, code: "internal_error", message: "internal_error" }),
      JOB_ATTACHMENTS_SOMETHING_WENT_WRONG
    );
  });

  test("an unknown prepare failure is no longer reported as an unsupported format", () => {
    const msg = resolveJobAttachmentFailureMessage({ stage: "prepare", status: 500 });
    assert.doesNotMatch(msg, /format|supported/i);
  });

  test("validation messages pass through; validation codes never leak", () => {
    const copy = "That file is too large. Max size is 20 MB.";
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 400, code: "file_too_large", message: copy }),
      copy
    );
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "prepare", status: 400, code: "file_too_large", message: "file_too_large" }),
      JOB_ATTACHMENTS_SOMETHING_WENT_WRONG
    );
  });

  test("signed-URL transfer status never reads as signed out / permission", () => {
    for (const status of [400, 401, 403, 404, 500, null]) {
      assert.equal(resolveJobAttachmentFailureMessage({ stage: "transfer", status }), JOB_ATTACHMENTS_UPLOAD_INTERRUPTED);
    }
  });

  test("finalize: missing object vs save failure", () => {
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "finalize", status: 409, code: "upload_incomplete" }),
      JOB_ATTACHMENTS_UPLOAD_INTERRUPTED
    );
    assert.equal(
      resolveJobAttachmentFailureMessage({ stage: "finalize", status: 500, code: "internal_error" }),
      JOB_ATTACHMENTS_UPLOAD_NOT_SAVED
    );
  });

  test("no resolved message looks like an internal code", () => {
    const stages = ["prepare", "transfer", "finalize", "caption", "remove", "list"] as const;
    for (const stage of stages) {
      for (const status of [400, 401, 403, 404, 409, 500, 503, null]) {
        for (const code of ["internal_error", "upload_failed", "storage_unavailable", "upload_incomplete", null]) {
          const msg = resolveJobAttachmentFailureMessage({ stage, status, code, message: code });
          assert.equal(looksLikeInternalCode(msg), false, `${stage}/${status}/${code} → ${msg}`);
          assert.doesNotMatch(msg, /internal_error|upload_failed|_/);
        }
      }
    }
  });

  test("client error carries the resolved message", () => {
    const err = new JobAttachmentClientError({ stage: "transfer", status: 0 });
    assert.equal(err.message, JOB_ATTACHMENTS_UPLOAD_INTERRUPTED);
  });

  test("route response message replaces bare codes", () => {
    assert.equal(
      jobAttachmentResponseMessage({ status: 500, code: "internal_error", message: "internal_error" }),
      JOB_ATTACHMENTS_SOMETHING_WENT_WRONG
    );
    assert.equal(
      jobAttachmentResponseMessage({ status: 503, code: "storage_unavailable", message: JOB_ATTACHMENTS_STORAGE_UNAVAILABLE }),
      JOB_ATTACHMENTS_STORAGE_UNAVAILABLE
    );
  });
});

describe("safe server logging (G)", () => {
  test("classifies bucket-missing without hard-coding it as the only failure", () => {
    assert.equal(summarizeJobAttachmentBackendError({ message: "Bucket not found", statusCode: "404" }).classification, "bucket_not_found");
    assert.equal(
      summarizeJobAttachmentBackendError({ message: "The related resource does not exist", statusCode: "404", code: "InvalidRequest" }).classification,
      "bucket_not_found"
    );
    assert.equal(
      summarizeJobAttachmentBackendError({ message: "The related resource does not exist", statusCode: "400" }).classification,
      "backend_error"
    );
    assert.equal(summarizeJobAttachmentBackendError({ message: "fetch failed" }).classification, "backend_unreachable");
    assert.equal(summarizeJobAttachmentBackendError({ message: "invalid JWT" }).classification, "storage_auth_rejected");
    assert.equal(summarizeJobAttachmentBackendError({ message: "row violates policy", code: "42501" }).classification, "backend_error");
  });

  test("strips URLs, tokens and ids from log text", () => {
    const summary = summarizeJobAttachmentBackendError({
      message:
        "failed https://x.supabase.co/storage/v1/object/upload/sign/a?token=abc eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl for 11111111-2222-4333-8444-555555555555",
    });
    assert.doesNotMatch(summary.message, /https?:|supabase\.co|eyJ|token=|11111111-2222/);
  });

  test("persistence logs signed-upload failure and returns storage_unavailable, not internal_error", () => {
    const src = read("app/lib/jobAttachmentPersistence.ts");
    const idx = src.indexOf(".createSignedUploadUrl(storagePath)");
    const block = src.slice(idx, idx + 600);
    assert.match(block, /logJobAttachmentBackendFailure\(\s*"create_signed_upload_url"/);
    assert.match(block, /503, "storage_unavailable"/);
    assert.doesNotMatch(block, /"internal_error"\)/);
  });

  test("all attachment routes use the shared safe error body", () => {
    for (const rel of [
      "app/api/jobs/[jobId]/attachments/route.ts",
      "app/api/jobs/[jobId]/attachments/[attachmentId]/route.ts",
      "app/api/jobs/[jobId]/attachments/[attachmentId]/finalize/route.ts",
    ]) {
      const src = read(rel);
      assert.match(src, /jobAttachmentErrorBody\(error, operation\)/, rel);
      assert.doesNotMatch(src, /code: "internal_error" \}/, rel);
      assert.doesNotMatch(src, /message: error\.message/, rel);
    }
  });

  test("client transfer no longer throws a raw upload_failed code", () => {
    const src = read("app/lib/jobAttachmentUpload.ts");
    assert.doesNotMatch(src, /new Error\("upload_failed"\)/);
  });
});

describe("failed upload tile shows the reason and keeps Retry (G)", () => {
  test("photo tile", () => {
    const pending: JobAttachmentPendingItem = {
      localId: "local-1",
      filename: "roof.jpg",
      kind: "image",
      previewUrl: null,
      progress: 0,
      status: "failed",
      error: JOB_ATTACHMENTS_STORAGE_UNAVAILABLE,
    };
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [],
        pending: [pending],
        cameraAvailable: false,
        onAddFiles: () => undefined,
        onRetry: () => undefined,
      })
    );
    assert.match(html, new RegExp(JOB_ATTACHMENTS_UPLOAD_FAILED_LABEL));
    assert.match(html, /data-jobcard-attachment-failed-reason/);
    assert.match(html, /Photo storage isn&#x27;t available right now/);
    assert.match(html, /data-jobcard-attachment-retry/);
  });
});

describe("caption and remove failures are visible (E)", () => {
  const hook = read("app/tools/roofing/jobCard/useJobCardAttachments.ts");
  const ws = read("app/tools/roofing/jobCard/JobCardAttachmentsWorkspace.tsx");

  test("hook reports caption/remove outcome instead of silently returning", () => {
    assert.match(hook, /patchCaption = useCallback\(\s*async \(attachmentId: string, caption: string\): Promise<boolean>/);
    assert.match(hook, /remove = useCallback\(\s*async \(attachmentId: string\): Promise<boolean>/);
    assert.doesNotMatch(hook, /if \(!res\.ok\) return;/);
    assert.doesNotMatch(hook, /body\.ok !== true\) return;/);
  });

  test("viewer closes only after a successful remove", () => {
    const fn = ws.slice(ws.indexOf("const removeFromViewer"), ws.indexOf("const removeFile"));
    const failIdx = fn.indexOf('setViewerRemove({ id: attachmentId, status: "failed" })');
    const closeIdx = fn.indexOf("setViewerId(null)");
    assert.ok(failIdx > 0 && closeIdx > failIdx);
    assert.match(fn, /if \(removed === false\) \{[\s\S]*?return;/);
  });

  test("caption failure keeps the draft and offers retry", () => {
    assert.match(ws, /data-jobcard-attachment-caption-failed/);
    assert.match(ws, /data-jobcard-attachment-caption-retry/);
    assert.match(ws, /JOB_ATTACHMENTS_CAPTION_NOT_SAVED/);
    assert.equal(JOB_ATTACHMENTS_CAPTION_NOT_SAVED, "Caption not saved.");
  });

  test("photo and file remove failures render plain copy with retry", () => {
    assert.match(ws, /data-jobcard-attachment-remove-failed="photo"/);
    assert.match(ws, /data-jobcard-attachment-remove-failed="file"/);
    assert.match(ws, /JOB_ATTACHMENTS_RETRY_LABEL/);
  });
});
