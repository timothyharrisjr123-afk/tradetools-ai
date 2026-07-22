/**
 * Run: npx tsx --test app/lib/proposalPackagePresentation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolvePackageMeta } from "./proposalPackagePresentation";

describe("resolvePackageMeta", () => {
  test("maps known package labels case-insensitively", () => {
    const meta = resolvePackageMeta("  Standard  ");
    assert.equal(meta.accent, "standard");
    assert.equal(meta.bullets[0], "25 Year Shingles");
  });

  test("returns default meta for unknown labels", () => {
    const meta = resolvePackageMeta("Custom Package");
    assert.equal(meta.accent, "default");
    assert.equal(meta.description, "Customer-facing package option.");
  });

  test("authored description beats known-label fallback", () => {
    const meta = resolvePackageMeta("Standard", "  Contractor-authored Standard copy.  ");
    assert.equal(meta.description, "Contractor-authored Standard copy.");
    assert.equal(meta.accent, "standard");
    assert.equal(meta.bullets[0], "25 Year Shingles");
  });

  test("authored description beats default fallback for unknown labels", () => {
    const meta = resolvePackageMeta("Custom Package", "Authored custom package story.");
    assert.equal(meta.description, "Authored custom package story.");
    assert.equal(meta.accent, "default");
  });

  test("blank authored description keeps fallback", () => {
    const meta = resolvePackageMeta("Premium", "   ");
    assert.equal(meta.description, "Best performance and maximum protection.");
    assert.equal(meta.accent, "premium");
  });
});
