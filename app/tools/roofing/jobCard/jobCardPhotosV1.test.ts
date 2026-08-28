/**
 * Photos / Attachments V1 — Job Card workspace UI.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardPhotosV1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  JobAttachmentListItem,
  JobAttachmentPendingItem,
} from "@/app/lib/jobAttachmentTypes";
import {
  JOB_ATTACHMENTS_ADD_LABEL,
  JOB_ATTACHMENTS_CHOOSE_PHOTOS,
  JOB_ATTACHMENTS_EMPTY,
  JOB_ATTACHMENTS_TAKE_PHOTO,
  JOB_ATTACHMENTS_UPLOAD_FILE,
} from "@/app/lib/jobAttachmentTypes";
import JobCardAttachmentsWorkspace from "@/app/tools/roofing/jobCard/JobCardAttachmentsWorkspace";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PHOTO: JobAttachmentListItem = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  kind: "image",
  mimeType: "image/jpeg",
  byteSize: 2048,
  originalFilename: "roof.jpg",
  caption: "North slope",
  captureSource: "camera",
  jobStageAtUpload: "intake",
  createdAt: "2026-08-28T12:00:00.000Z",
  createdBy: "user-1",
  listedInJobGallery: true,
  widthPx: 800,
  heightPx: 600,
  previewUrl: "https://signed.example/roof.jpg",
};

const PDF: JobAttachmentListItem = {
  ...PHOTO,
  id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
  kind: "document",
  mimeType: "application/pdf",
  originalFilename: "permit.pdf",
  caption: null,
  previewUrl: "https://signed.example/permit.pdf",
};

describe("empty and add", () => {
  test("quiet empty state with Add", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [],
        cameraAvailable: false,
        onAddFiles: () => undefined,
      })
    );
    assert.match(html, new RegExp(JOB_ATTACHMENTS_EMPTY));
    assert.match(html, new RegExp(JOB_ATTACHMENTS_ADD_LABEL));
    assert.doesNotMatch(html, /Documentation improves|folder|Capture roof|satellite/i);
  });

  test("390 add menu exposes take / choose / file", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [],
        cameraAvailable: true,
        initialMenuOpen: true,
        onAddFiles: () => undefined,
      })
    );
    assert.match(html, new RegExp(JOB_ATTACHMENTS_TAKE_PHOTO));
    assert.match(html, new RegExp(JOB_ATTACHMENTS_CHOOSE_PHOTOS));
    assert.match(html, new RegExp(JOB_ATTACHMENTS_UPLOAD_FILE));
    assert.match(html, /capture="environment"/);
  });

  test("desktop does not fake Take photo", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [],
        cameraAvailable: false,
        initialMenuOpen: true,
        onAddFiles: () => undefined,
      })
    );
    assert.doesNotMatch(html, new RegExp(JOB_ATTACHMENTS_TAKE_PHOTO));
  });
});

describe("gallery files progress viewer caption", () => {
  test("photos grid and pdf files list", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [PHOTO, PDF],
        cameraAvailable: false,
        onAddFiles: () => undefined,
        onRemove: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-attachments-gallery/);
    assert.match(html, /data-jobcard-attachment-photo/);
    assert.match(html, /data-jobcard-attachments-files/);
    assert.match(html, /permit\.pdf/);
    assert.doesNotMatch(html, /data-jobcard-attachment-viewer/);
  });

  test("uploading and failed retry", () => {
    const pending: JobAttachmentPendingItem[] = [
      {
        localId: "p1",
        filename: "a.jpg",
        kind: "image",
        previewUrl: PHOTO.previewUrl,
        progress: 40,
        status: "uploading",
        error: null,
      },
      {
        localId: "p2",
        filename: "b.jpg",
        kind: "image",
        previewUrl: PHOTO.previewUrl,
        progress: 0,
        status: "failed",
        error: "Upload failed.",
      },
    ];
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [PHOTO],
        pending,
        cameraAvailable: false,
        onAddFiles: () => undefined,
        onRetry: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-attachment-pending="uploading"/);
    assert.match(html, /data-jobcard-attachment-pending="failed"/);
    assert.match(html, /Retry/);
  });

  test("viewer shows caption and meta without EXIF dump", () => {
    const html = renderToStaticMarkup(
      createElement(JobCardAttachmentsWorkspace, {
        attachments: [PHOTO],
        cameraAvailable: false,
        initialViewerId: PHOTO.id,
        currentUserId: "user-1",
        onAddFiles: () => undefined,
        onCaption: () => undefined,
        onRemove: () => undefined,
      })
    );
    assert.match(html, /data-jobcard-attachment-viewer/);
    assert.match(html, /data-jobcard-attachment-caption/);
    assert.match(html, /North slope/);
    assert.doesNotMatch(html, /GPS|EXIF|latitude/i);
  });
});

describe("source contracts", () => {
  test("live Job Card uses the workspace not quiet files placeholder", () => {
    const secondary = read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx");
    assert.match(secondary, /JobCardAttachmentsWorkspace/);
    assert.doesNotMatch(secondary, /quiet\("attachments"/);
    assert.doesNotMatch(secondary, /No files yet/);
  });

  test("no measurement acquisition chrome", () => {
    const workspace = read(
      "app/tools/roofing/jobCard/JobCardAttachmentsWorkspace.tsx"
    );
    assert.doesNotMatch(
      workspace,
      /Capture roof|satellite|aerial|drone|blueprint|LiDAR/i
    );
  });
});
