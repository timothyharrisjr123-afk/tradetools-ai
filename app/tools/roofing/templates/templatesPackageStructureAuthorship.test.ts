/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesPackageStructureAuthorship.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");
const JOB = join(process.cwd(), "app/tools/roofing/jobCard");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("R1 package structure authorship", () => {
  test("Adjust packages exposes guided Add / Move / Remove", () => {
    const editors = read("TemplatesSetupAuthorshipEditors.tsx");
    const review = read("TemplatesQuoteSetupReview.tsx");
    const setup = read("TemplatesSetupClient.tsx");

    assert.ok(editors.includes("data-templates-add-package"));
    assert.ok(editors.includes("Copy existing package"));
    assert.ok(editors.includes("Start blank"));
    assert.ok(editors.includes('data-templates-add-path="copy_existing"'));
    assert.ok(editors.includes('data-templates-add-path="start_blank"'));
    assert.ok(editors.includes("data-templates-copy-summary"));
    assert.ok(editors.includes("Move up"));
    assert.ok(editors.includes("Move down"));
    assert.ok(editors.includes("Remove from setup"));
    assert.match(
      editors.replace(/\s+/g, " "),
      /Existing proposals are not changed/
    );
    assert.ok(editors.includes("Create package shell"));
    assert.doesNotMatch(editors, /clone graph|cascade|template_option/i);

    assert.ok(editors.includes("Rename, reorder, or add packages."));
    assert.ok(editors.includes("Reorder or remove"));
    assert.ok(editors.includes("data-templates-packages-adjust-done"));
    assert.ok(review.includes("onOpenChange={setPackagesAdjustOpen}"));
    assert.ok(review.includes("packagesAdjustOpen"));

    assert.ok(setup.includes("copyExistingTemplatePackage"));
    assert.ok(setup.includes("createBlankTemplatePackageShell"));
    assert.ok(setup.includes("reorderTemplatePackages"));
    assert.ok(setup.includes("removeTemplatePackage"));
    assert.ok(setup.includes("handleCopyPackage"));
    assert.ok(setup.includes("handleRemovePackage"));
  });

  test("blank included empty state is calm and action-led", () => {
    const included = read("TemplatesIncludedItemsManager.tsx");
    assert.ok(included.includes("No included work yet."));
    assert.ok(included.includes("Add included work"));
    assert.ok(included.includes("data-templates-add-included-work-empty"));
    assert.ok(!included.includes("No included work prepared yet."));
  });

  test("actions copy structure and protect drafts via template-only soft-remove", () => {
    const actions = read("templatesPackageStructureActions.ts");
    assert.ok(actions.includes("createProposalTemplateOption"));
    assert.ok(actions.includes("createProposalTemplateSection"));
    assert.ok(actions.includes("createProposalTemplateItem"));
    assert.ok(actions.includes("replaces_template_item_id"));
    assert.ok(actions.includes("sanitizeCopiedOptionMetadata"));
    assert.ok(actions.includes("BLANK_PACKAGE_SHELL_SECTIONS"));
    assert.ok(actions.includes("softRemoveProposalTemplateOption"));
    assert.ok(!actions.includes("proposal_versions"));
    assert.ok(!actions.includes(".delete()"));
  });

  test("Job Card stays selection-only and follows sort_order / default", () => {
    const setup = readFileSync(join(JOB, "jobCardProposalSetup.ts"), "utf8");
    const modal = readFileSync(
      join(JOB, "JobCardCreateProposalModal.tsx"),
      "utf8"
    );
    assert.ok(setup.includes("sortTemplateOptionsByOrder"));
    assert.ok(setup.includes("resolveDefaultPackageOptionId"));
    assert.ok(setup.includes("is_default"));
    assert.doesNotMatch(modal, /Adjust packages|Add package|Remove from setup/);
    assert.doesNotMatch(modal, /onCopyPackage|createBlankTemplatePackage/);
  });
});
