/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesReusableSetupLanding.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEMPLATES_INCLUDED_WORK_HEADING,
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
    assert.equal(TEMPLATES_REUSABLE_SETUP_EYEBROW, "Reusable proposal setup");
    assert.ok(review.includes("TEMPLATES_REUSABLE_SETUP_EYEBROW"));
    assert.ok(review.includes("TEMPLATES_REUSABLE_SETUP_SUBCOPY"));
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
    assert.ok(review.includes("sm:grid-cols-3"));
  });

  test("included work is prepared summary with secondary adjust actions", () => {
    const included = read("TemplatesIncludedItemsManager.tsx");
    assert.equal(TEMPLATES_INCLUDED_WORK_HEADING, "Included work");
    assert.ok(included.includes("data-templates-included-work"));
    assert.ok(
      included.includes("TEMPLATES_INCLUDED_WORK_HINT") ||
        included.includes("Adjust only if needed")
    );
    assert.ok(included.includes("data-templates-add-item"));
    assert.ok(included.includes("data-templates-replace-item"));
    assert.ok(included.includes("group-hover:opacity-100"));
  });

  test("proposal content summary is on the main landing", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    assert.equal(TEMPLATES_PROPOSAL_CONTENT_HEADING, "Proposal content");
    assert.ok(review.includes("data-templates-proposal-content"));
    assert.ok(review.includes("buildProposalContentLandingAreas"));
  });

  test("next use is quiet Job Card guidance; boundaries hold", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.equal(
      TEMPLATES_NEXT_USE_COPY,
      "Use this template from a Job Card when creating a proposal."
    );
    assert.ok(review.includes("data-templates-next-use"));
    assert.ok(review.includes("TEMPLATES_OPEN_JOBS_ACTION") || review.includes("Open Jobs"));
    assert.ok(review.includes("TEMPLATES_NEXT_USE_COPY"));
    assert.ok(!review.includes("Open Jobs to create a proposal"));
    assert.equal(setup.includes("createNewProposalDraftEntry"), false);
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
  });
});
