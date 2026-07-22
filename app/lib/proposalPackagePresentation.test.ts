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
    assert.equal(meta.bullets[0], "Architectural shingles");
  });

  test("returns default meta for unknown labels", () => {
    const meta = resolvePackageMeta("Custom Package");
    assert.equal(meta.accent, "default");
    assert.match(meta.description, /complete roofing package/i);
  });

  test("authored description beats known-label fallback", () => {
    const meta = resolvePackageMeta("Standard", "  Contractor-authored Standard copy.  ");
    assert.equal(meta.description, "Contractor-authored Standard copy.");
    assert.equal(meta.accent, "standard");
    assert.equal(meta.bullets[0], "Architectural shingles");
  });

  test("authored description beats default fallback for unknown labels", () => {
    const meta = resolvePackageMeta("Custom Package", "Authored custom package story.");
    assert.equal(meta.description, "Authored custom package story.");
    assert.equal(meta.accent, "default");
  });

  test("blank authored description keeps fallback", () => {
    const meta = resolvePackageMeta("Premium", "   ");
    assert.match(meta.description, /Highest-protection|premium shingles/i);
    assert.equal(meta.accent, "premium");
  });
});
