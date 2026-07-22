/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupAuthorship.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Template Setup Authorship V1", () => {
  test("landing exposes identity and package authorship editors", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const editors = read("TemplatesSetupAuthorshipEditors.tsx");
    const setup = read("TemplatesSetupClient.tsx");

    assert.ok(review.includes("TemplatesIdentityEditor"));
    assert.ok(review.includes("TemplatesPackagesAdjustPanel"));
    assert.ok(review.includes("data-templates-package-default-badge"));
    assert.ok(editors.includes("data-templates-edit-identity"));
    assert.ok(editors.includes("data-templates-adjust-packages"));
    assert.ok(editors.includes("data-templates-package-name"));
    assert.ok(editors.includes("data-templates-package-description"));
    assert.ok(setup.includes("updateProposalTemplateOption"));
    assert.ok(setup.includes("handleSaveTemplateIdentity"));
    assert.ok(setup.includes("handleSavePackageAuthorship"));
    assert.ok(setup.includes("handleCopyPackage"));
    assert.ok(setup.includes("handleCreateBlankPackage"));
    assert.ok(setup.includes("handleReorderPackage"));
    assert.ok(setup.includes("handleRemovePackage"));
  });

  test("package summary includes isDefault for default badge + Job Card default", () => {
    const flow = read("templatesWorkspaceFlow.ts");
    assert.ok(flow.includes("isDefault:"));
    assert.ok(flow.includes("row.isDefault"));
  });
});
