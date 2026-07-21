/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupTrustFlowPage.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates setup trust flow (Reusable proposal setup)", () => {
  test("Quiet link adjust and Open Jobs remain available without dominating", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const review = read("TemplatesQuoteSetupReview.tsx");
    assert.ok(setup.includes("TemplatesQuoteSetupReview") || setup.includes("TemplatesSelectedWorkspace"));
    assert.ok(setup.includes("deriveTemplateCatalogLinkReadiness"));
    assert.ok(setup.includes("handleFixIssues"));
    assert.ok(review.includes("data-templates-fix-links"));
    assert.ok(review.includes("data-templates-open-jobs"));
    assert.ok(
      review.includes("TEMPLATES_OPEN_JOBS_ACTION") || review.includes("Open Jobs")
    );
    assert.ok(review.includes("Review links") || review.includes("data-templates-fix-links"));
  });

  test("no fake Create Proposal action on Templates page", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(!review.includes("There is no Create proposal button on this page"));
    assert.ok(
      review.includes("TEMPLATES_NEXT_USE_COPY") ||
        review.includes("Use this template from a Job Card")
    );
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(review + setup), false);
  });

  test("Fix issues stays on reusable setup and opens Replace when needed", () => {
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(setup.includes('setWorkspaceMode("review")'));
    assert.ok(setup.includes("handleOpenRelinkCatalogItem"));
  });
});
