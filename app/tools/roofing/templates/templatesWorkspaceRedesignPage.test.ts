/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceRedesignPage.test.ts
 *
 * Source-level assertions for Templates reusable proposal setup landing.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_REMOVE_CONFIRM_COPY,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
} from "@/app/lib/proposalTemplateCatalogLink";
import {
  TEMPLATES_ADVANCED_EDITING_ACTION,
  TEMPLATES_REUSABLE_SETUP_EYEBROW,
} from "./templatesWorkspaceFlow";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates Page — Reusable proposal setup landing", () => {
  test("1–5. default landing is reusable setup with packages, included work, content", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const review = read("TemplatesQuoteSetupReview.tsx");
    const included = read("TemplatesIncludedItemsManager.tsx");

    assert.ok(setup.includes('useState<TemplatesWorkspaceMode>("review")'));
    assert.ok(workspace.includes('mode === "review"'));
    assert.ok(workspace.includes("TemplatesQuoteSetupReview"));
    assert.ok(review.includes("data-templates-reusable-setup"));
    assert.ok(review.includes("data-templates-quote-hero"));
    assert.ok(review.includes("TEMPLATES_REUSABLE_SETUP_EYEBROW"));
    assert.ok(review.includes("data-templates-package-selector"));
    assert.ok(review.includes("data-templates-proposal-content"));
    assert.ok(included.includes("data-templates-included-manager"));
    assert.ok(included.includes("Included work") || included.includes("TEMPLATES_INCLUDED_WORK_HEADING"));
    assert.ok(!review.includes("Quote Setup Review"));
    assert.ok(!review.includes("data-templates-what-this-creates"));
    assert.ok(review.includes("selectedPackageOptionId"));
    assert.ok(review.includes("buildIncludedGroups"));
  });

  test("6–8. Add item discoverable; uses active Catalog picker; duplicates blocked", () => {
    const included = read("TemplatesIncludedItemsManager.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    const picker = read("TemplatesCatalogItemPickerModal.tsx");

    assert.ok(included.includes("data-templates-add-item"));
    assert.equal(TEMPLATE_ADD_FROM_CATALOG_LABEL, "Add item");
    assert.ok(setup.includes("handleQuoteAddItem"));
    assert.ok(setup.includes("TemplatesCatalogItemPickerModal"));
    assert.ok(setup.includes("alreadyLinked.has(catalogItem.id)"));
    assert.ok(picker.includes("listActiveCatalogItemsForPicker"));
  });

  test("9–12. Replace / Remove remain available but are secondary adjust actions", () => {
    const included = read("TemplatesIncludedItemsManager.tsx");
    const removeModal = read("TemplatesRemoveItemConfirmModal.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    const link = readFileSync(
      join(process.cwd(), "app/lib/proposalTemplateCatalogLink.ts"),
      "utf8"
    );

    assert.equal(TEMPLATE_RELINK_CATALOG_LABEL, "Replace item");
    assert.equal(TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL, "Remove from template");
    assert.ok(!included.includes("Change catalog link"));
    assert.ok(included.includes("data-templates-replace-item"));
    assert.ok(included.includes("data-templates-remove-from-template"));
    assert.ok(included.includes("Adjust only if needed") || included.includes("TEMPLATES_INCLUDED_WORK_HINT"));
    assert.ok(removeModal.includes("TEMPLATE_REMOVE_CONFIRM_COPY"));
    assert.match(TEMPLATE_REMOVE_CONFIRM_COPY, /Catalog item will not be deleted/i);
    assert.ok(setup.includes("deleteProposalTemplateItem"));
    assert.ok(setup.includes("handleConfirmRemoveItem"));
    assert.ok(!setup.includes("deleteCatalogItem"));
    assert.ok(link.includes("Inactive in Catalog"));
    assert.ok(link.includes("Catalog item missing"));
  });

  test("13–14. Advanced secondary; quiet next use; no fake Create Proposal", () => {
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const review = read("TemplatesQuoteSetupReview.tsx");
    const setup = read("TemplatesSetupClient.tsx");

    assert.ok(review.includes("data-templates-open-advanced"));
    assert.ok(
      review.includes("TEMPLATES_ADVANCED_EDITING_ACTION") ||
        review.includes(TEMPLATES_ADVANCED_EDITING_ACTION)
    );
    assert.ok(!review.includes("Advanced settings"));
    assert.ok(review.includes("data-templates-next-use"));
    assert.ok(
      review.includes("TEMPLATES_OPEN_JOBS_ACTION") || review.includes("Open Jobs")
    );
    assert.ok(!review.includes("Open Jobs to create a proposal"));
    assert.ok(workspace.includes('data-templates-workspace-mode="advanced"'));
    assert.ok(
      workspace.includes("data-templates-advanced-tabs") ||
        workspace.includes("data-templates-edit-tabs")
    );
    assert.ok(workspace.includes("Back to proposal setup"));
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(setup + review), false);
    assert.ok(!review.includes("There is no Create proposal button"));
  });

  test("setup collapses when complete; recheck remains", () => {
    const zone = read("TemplatesOnboardingZone.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(zone.includes("data-templates-setup-strip"));
    assert.ok(zone.includes("Setup complete"));
    assert.ok(zone.includes("data-templates-setup-recheck"));
    assert.ok(setup.includes("setupComplete="));
    assert.ok(setup.includes("onRecheck={handleInstallStarter}"));
  });

  test("packages and content follow hero before next use; no trust footnote hero", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    assert.ok(!review.includes("data-templates-trust-note"));
    assert.equal(TEMPLATES_REUSABLE_SETUP_EYEBROW, "Reusable proposal setup");
    const heroIdx = review.indexOf("data-templates-quote-hero");
    const pkgIdx = review.indexOf("data-templates-package-selector");
    const contentIdx = review.indexOf("data-templates-proposal-content");
    const nextIdx = review.indexOf("data-templates-next-use");
    assert.ok(heroIdx >= 0 && pkgIdx > heroIdx);
    assert.ok(contentIdx > pkgIdx);
    assert.ok(nextIdx > contentIdx);
    assert.ok(review.includes("<TemplatesIncludedItemsManager"));
  });
});
