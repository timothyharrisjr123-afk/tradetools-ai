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
});
