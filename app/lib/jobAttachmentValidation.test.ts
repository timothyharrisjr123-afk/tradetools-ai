/**
 * Job attachment validation + storage path.
 * Run: npx tsx --test app/lib/jobAttachmentValidation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_ATTACHMENT_MAX_BYTES,
  JOB_ATTACHMENTS_FILE_TOO_LARGE,
  JOB_ATTACHMENTS_HEIC_UNSUPPORTED,
  JOB_ATTACHMENTS_UNSUPPORTED_FORMAT,
} from "@/app/lib/jobAttachmentTypes";
import {
  buildJobAttachmentStoragePath,
  parseCaptureSource,
  validateJobAttachmentUpload,
} from "@/app/lib/jobAttachmentValidation";

describe("supported types", () => {
  test("jpeg png webp and pdf pass", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      const result = validateJobAttachmentUpload({
        mimeType: mime,
        filename: mime === "application/pdf" ? "permit.pdf" : "shot.jpg",
        byteSize: 1200,
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.kind, mime === "application/pdf" ? "document" : "image");
      }
    }
  });
});

describe("rejects unsafe or unsupported", () => {
  test("HEIC is explicitly unsupported", () => {
    const result = validateJobAttachmentUpload({
      mimeType: "image/heic",
      filename: "IMG_0001.HEIC",
      byteSize: 2000,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_type");
      assert.equal(result.message, JOB_ATTACHMENTS_HEIC_UNSUPPORTED);
    }
  });

  test("svg html and executables are rejected", () => {
    for (const mime of [
      "image/svg+xml",
      "text/html",
      "application/javascript",
      "application/x-msdownload",
    ]) {
      const result = validateJobAttachmentUpload({
        mimeType: mime,
        filename: "payload",
        byteSize: 100,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.message, JOB_ATTACHMENTS_UNSUPPORTED_FORMAT);
      }
    }
  });

  test("oversize is rejected", () => {
    const result = validateJobAttachmentUpload({
      mimeType: "image/jpeg",
      filename: "big.jpg",
      byteSize: JOB_ATTACHMENT_MAX_BYTES + 1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "file_too_large");
      assert.equal(result.message, JOB_ATTACHMENTS_FILE_TOO_LARGE);
    }
  });
});

describe("path and capture source", () => {
  test("storage path is company/job/id/filename", () => {
    const path = buildJobAttachmentStoragePath({
      companyId: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      attachmentId: "33333333-3333-4333-8333-333333333333",
      filename: "../../evil.jpg",
    });
    assert.equal(
      path,
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/evil.jpg"
    );
  });

  test("unknown capture source stays extensible", () => {
    assert.equal(parseCaptureSource("camera"), "camera");
    assert.equal(parseCaptureSource("roof_capture"), "unknown");
    assert.equal(parseCaptureSource(""), "unknown");
  });
});
