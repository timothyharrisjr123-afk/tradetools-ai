/**
 * Job attachment upload helpers — camera capability.
 * Run: npx tsx --test app/lib/jobAttachmentUpload.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canUseCameraCapture } from "@/app/lib/jobAttachmentUpload";

describe("canUseCameraCapture", () => {
  test("desktop mouse/trackpad is not camera-capable", () => {
    assert.equal(
      canUseCameraCapture({
        captureAttr: true,
        hoverCapable: true,
        finePointer: true,
        coarsePointer: false,
        maxTouchPoints: 0,
        ontouch: false,
        touchFirst: false,
      }),
      false
    );
  });

  test("touch-first mobile is camera-capable", () => {
    assert.equal(
      canUseCameraCapture({
        captureAttr: true,
        touchFirst: true,
        coarsePointer: true,
        finePointer: false,
        hoverCapable: false,
        maxTouchPoints: 5,
        ontouch: true,
      }),
      true
    );
  });

  test("tablet with touch points stays camera-capable", () => {
    assert.equal(
      canUseCameraCapture({
        captureAttr: true,
        hoverCapable: true,
        finePointer: true,
        coarsePointer: false,
        maxTouchPoints: 10,
        ontouch: true,
        touchFirst: false,
      }),
      true
    );
  });

  test("without capture attribute support, camera menu is off", () => {
    assert.equal(
      canUseCameraCapture({
        captureAttr: false,
        touchFirst: true,
        coarsePointer: true,
        maxTouchPoints: 5,
        ontouch: true,
      }),
      false
    );
  });
});
