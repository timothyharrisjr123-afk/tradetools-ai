/**
 * Job attachment workspace model.
 * Run: npx tsx --test app/lib/jobAttachmentModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildJobAttachmentWorkspaceView,
  isListedDocumentationAttachment,
  sortAttachmentsNewestFirst,
} from "@/app/lib/jobAttachmentModel";
import type { JobAttachmentListItem } from "@/app/lib/jobAttachmentTypes";
import {
  appendReadyAttachment,
  createPendingFromFile,
  mergePendingUpdate,
  removePending,
} from "@/app/lib/jobAttachmentUpload";

function item(
  overrides: Partial<JobAttachmentListItem> = {}
): JobAttachmentListItem {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    kind: "image",
    mimeType: "image/jpeg",
    byteSize: 1000,
    originalFilename: "a.jpg",
    caption: null,
    captureSource: "camera",
    jobStageAtUpload: "intake",
    createdAt: "2026-08-28T12:00:00.000Z",
    createdBy: null,
    listedInJobGallery: true,
    widthPx: 100,
    heightPx: 80,
    previewUrl: "https://signed.example/a",
    ...overrides,
  };
}

describe("gallery filtering", () => {
  test("soft-deleted and unlisted rows are not documentation gallery", () => {
    assert.equal(
      isListedDocumentationAttachment({
        deleted_at: null,
        listed_in_job_gallery: true,
      }),
      true
    );
    assert.equal(
      isListedDocumentationAttachment({
        deleted_at: "2026-08-28T12:00:00.000Z",
        listed_in_job_gallery: true,
      }),
      false
    );
    assert.equal(
      isListedDocumentationAttachment({
        deleted_at: null,
        listed_in_job_gallery: false,
      }),
      false
    );
  });

  test("newest first and photos vs files", () => {
    const older = item({
      id: "older",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const newer = item({
      id: "newer",
      createdAt: "2026-08-20T00:00:00.000Z",
    });
    const pdf = item({
      id: "pdf",
      kind: "document",
      mimeType: "application/pdf",
      originalFilename: "permit.pdf",
      createdAt: "2026-08-15T00:00:00.000Z",
    });
    const sorted = sortAttachmentsNewestFirst([older, newer]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      ["newer", "older"]
    );
    const view = buildJobAttachmentWorkspaceView({
      attachments: [older, newer, pdf],
    });
    assert.deepEqual(
      view.photos.map((row) => row.attachment?.id),
      ["newer", "older"]
    );
    assert.equal(view.files[0]?.attachment?.id, "pdf");
    assert.equal(view.isEmpty, false);
  });

  test("empty workspace", () => {
    const view = buildJobAttachmentWorkspaceView({ attachments: [] });
    assert.equal(view.isEmpty, true);
  });
});

describe("upload isolation", () => {
  test("one failed pending does not remove others", () => {
    const file = {
      name: "ok.jpg",
      type: "image/jpeg",
      size: 12,
    } as File;
    const created = createPendingFromFile(file, "one");
    assert.equal(created.pending.status, "uploading");
    let pending = [
      created.pending,
      {
        localId: "two",
        filename: "two.jpg",
        kind: "image" as const,
        previewUrl: null,
        progress: 20,
        status: "uploading" as const,
        error: null,
      },
    ];
    pending = mergePendingUpdate(pending, "two", {
      status: "failed",
      error: "Upload failed.",
    });
    assert.equal(pending[0]?.status, "uploading");
    assert.equal(pending[1]?.status, "failed");
    pending = removePending(pending, "two");
    assert.equal(pending.length, 1);
  });

  test("finalize appends ready attachment at front", () => {
    const existing = [item({ id: "old", createdAt: "2026-08-01T00:00:00.000Z" })];
    const next = item({ id: "new", createdAt: "2026-08-28T00:00:00.000Z" });
    const merged = appendReadyAttachment(existing, next);
    assert.equal(merged[0]?.id, "new");
    assert.equal(merged.length, 2);
  });
});
