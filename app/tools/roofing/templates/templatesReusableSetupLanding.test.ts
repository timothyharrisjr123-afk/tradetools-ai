/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesReusableSetupLanding.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEMPLATES_AVAILABLE_UPGRADES_HEADING,
  TEMPLATES_AVAILABLE_UPGRADES_HINT,
  TEMPLATES_INCLUDED_WORK_HEADING,
  TEMPLATES_INCLUDED_WORK_HINT,
  TEMPLATES_NEXT_USE_COPY,
  TEMPLATES_PROPOSAL_CONTENT_HEADING,
  TEMPLATES_REUSABLE_SETUP_EYEBROW,
} from "./templatesWorkspaceFlow";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Template Flow V1 — reusable setup landing", () => {
  test("landing uses Reusable proposal setup framing", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const library = read("TemplatesLibrarySection.tsx");
    assert.equal(TEMPLATES_REUSABLE_SETUP_EYEBROW, "Reusable proposal setup");
    assert.ok(review.includes("TEMPLATES_REUSABLE_SETUP_EYEBROW"));
    assert.ok(review.includes("TEMPLATES_REUSABLE_SETUP_SUBCOPY"));
    assert.ok(library.includes("TEMPLATES_LIBRARY_HEADING"));
    assert.ok(library.includes("TEMPLATES_LIBRARY_HINT"));
    assert.ok(library.includes("data-templates-setup-selector"));
    assert.ok(!/Quote Setup Review/i.test(review));
    assert.ok(!/option row|section kind|seed_key/i.test(review));
  });

  test("packages render as prepared choices; simple hides internal container", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const flow = read("templatesWorkspaceFlow.ts");
    assert.ok(review.includes("resolvePackagePresentation"));
    assert.ok(review.includes("data-templates-packages-landing"));
    assert.ok(flow.includes('mode: "simple"'));
    assert.ok(flow.includes("TEMPLATES_SIMPLE_ESTIMATE_DETAIL"));
    assert.ok(review.includes("data-templates-package-simple"));
    assert.ok(review.includes("packageChoiceGridClass"));
    assert.ok(flow.includes("formatActivePackageSetupSummary"));
    assert.ok(flow.includes("packageChoiceGridClass"));
  });

  test("included work is prepared summary with secondary adjust actions", () => {
    const included = read("TemplatesIncludedItemsManager.tsx");
    const presenter = read("templatesIncludedWorkPresentation.ts");
    assert.equal(TEMPLATES_INCLUDED_WORK_HEADING, "Included work");
    assert.match(TEMPLATES_INCLUDED_WORK_HINT, /Prepared scope/i);
    assert.doesNotMatch(TEMPLATES_INCLUDED_WORK_HINT, /Catalog link|measurement source/i);
    assert.ok(included.includes("data-templates-included-work"));
    assert.ok(
      included.includes("TEMPLATES_INCLUDED_WORK_HINT") ||
        included.includes("Adjust only if needed")
    );
    assert.ok(included.includes("data-templates-included-prepared-view"));
    assert.ok(
      included.includes("TEMPLATES_ADJUST_INCLUDED_ACTION") ||
        included.includes("Adjust included work")
    );
    assert.ok(included.includes("Done adjusting"));
    assert.ok(included.includes("data-templates-prepared-scope-groups"));
    assert.ok(included.includes("data-templates-included-adjust-view"));
    assert.ok(included.includes("data-templates-add-item"));
    assert.ok(included.includes("data-templates-replace-item"));
    assert.ok(included.includes("data-templates-remove-from-template"));
    assert.ok(presenter.includes("buildPreparedIncludedWorkPresentation"));
    assert.ok(presenter.includes("buildPreparedAvailableUpgradesPresentation"));
    assert.ok(!presenter.includes('"optional_upgrades"'));
    assert.equal(included.includes("catalogUnitLabel"), false);
    assert.equal(included.includes("measurementLabel"), false);
    assert.equal(included.includes("proposalVisibility"), false);
  });

  test("available upgrades are a separate surface from included work", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const upgrades = read("TemplatesAvailableUpgradesManager.tsx");
    assert.equal(TEMPLATES_AVAILABLE_UPGRADES_HEADING, "Available upgrades");
    assert.match(TEMPLATES_AVAILABLE_UPGRADES_HINT, /not charged until selected|Not included by default/i);
    assert.ok(review.includes("TemplatesAvailableUpgradesManager"));
    assert.ok(review.includes("onAddUpgradeItem"));
    assert.ok(upgrades.includes("data-templates-available-upgrades"));
    assert.ok(
      upgrades.includes("Optional later") ||
        upgrades.includes("TEMPLATES_AVAILABLE_UPGRADES_HINT")
    );
    assert.doesNotMatch(upgrades, /Included in \$\{|Included in \{/);
    assert.ok(!upgrades.includes("Included in "));
    assert.ok(review.includes("formatPackageScopeCountLine"));
  });

  test("proposal content summary is on the main landing", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    assert.equal(TEMPLATES_PROPOSAL_CONTENT_HEADING, "Proposal packet");
    assert.ok(review.includes("data-templates-proposal-content"));
    assert.ok(review.includes("buildProposalContentLandingAreas"));
  });

  test("next use is quiet Job Card guidance; boundaries hold", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.match(TEMPLATES_NEXT_USE_COPY, /Job Card/i);
    assert.match(TEMPLATES_NEXT_USE_COPY, /Builder/i);
    assert.ok(review.includes("data-templates-next-use"));
    assert.ok(review.includes("TEMPLATES_OPEN_JOBS_ACTION") || review.includes("Open Jobs"));
    assert.ok(review.includes("TEMPLATES_NEXT_USE_COPY"));
    assert.ok(!review.includes("Open Jobs to create a proposal"));
    assert.equal(setup.includes("createNewProposalDraftEntry"), false);
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
  });
});
