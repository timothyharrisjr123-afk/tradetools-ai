/**
 * R3D drawn-mark validation.
 *
 * Run: npx tsx --test app/lib/proposalSignatureMark.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  PROPOSAL_SIGNATURE_MARK_LIMITS,
  proposalSignatureMarkError,
} from "./proposalSignatureMark";

export function validSignatureMark() {
  return {
    version: 1 as const,
    strokes: [
      [
        { x: 0.1, y: 0.2, t: 0 },
        { x: 0.8, y: 0.7, t: 120 },
        { x: 0.4, y: 0.9, t: 240 },
      ],
    ],
  };
}

describe("proposalSignatureMarkError", () => {
  test("accepts a compact versioned stroke mark", () => {
    assert.equal(proposalSignatureMarkError(validSignatureMark()), null);
  });

  test("rejects empty, noise-only, and malformed marks", () => {
    assert.equal(proposalSignatureMarkError(null), "invalid_mark");
    assert.equal(proposalSignatureMarkError([]), "invalid_mark");
    assert.equal(proposalSignatureMarkError("x"), "invalid_mark");
    assert.equal(
      proposalSignatureMarkError({ version: 1, strokes: [], extra: true }),
      "invalid_mark"
    );
    assert.equal(
      proposalSignatureMarkError({ version: 2, strokes: validSignatureMark().strokes }),
      "invalid_mark_version"
    );
    assert.equal(
      proposalSignatureMarkError({ version: 1, strokes: [[{ x: 0.5, y: 0.5 }]] }),
      "invalid_mark"
    );
    assert.equal(
      proposalSignatureMarkError({
        version: 1,
        strokes: [
          [
            { x: 0.5, y: 0.5, t: 0 },
            { x: 0.51, y: 0.5, t: 10 },
          ],
        ],
      }),
      "mark_too_small"
    );
    assert.equal(
      proposalSignatureMarkError({
        version: 1,
        strokes: [
          [
            { x: 1.2, y: 0.2, t: 0 },
            { x: 0.2, y: 0.8, t: 20 },
          ],
        ],
      }),
      "invalid_mark"
    );
  });

  test("rejects oversized stroke counts and serialized bytes", () => {
    const tooManyStrokes = {
      version: 1,
      strokes: Array.from({ length: PROPOSAL_SIGNATURE_MARK_LIMITS.maxStrokes + 1 }, () => [
        { x: 0.1, y: 0.1, t: 0 },
        { x: 0.9, y: 0.9, t: 10 },
      ]),
    };
    assert.equal(proposalSignatureMarkError(tooManyStrokes), "invalid_mark");

    const tooManyPoints = {
      version: 1,
      strokes: Array.from({ length: 8 }, () =>
        Array.from({ length: 200 }, (_, i) => ({
          x: 0.1,
          y: Math.min(1, 0.1 + i / 250),
          t: i,
        }))
      ),
    };
    assert.equal(proposalSignatureMarkError(tooManyPoints), "mark_too_large");
  });

  test("limits are the chosen R3D V1 contract", () => {
    assert.deepEqual(PROPOSAL_SIGNATURE_MARK_LIMITS, {
      maxSerializedBytes: 24576,
      maxStrokes: 24,
      minPointsPerStroke: 2,
      maxPointsPerStroke: 256,
      maxTotalPoints: 1536,
      minExtent: 0.05,
    });
  });
});
