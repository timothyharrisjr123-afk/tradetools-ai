/**
 * Preview missing-job empty state — contractor language + no fixture invent.
 * Run: npx tsx --test app/tools/roofing/proposals/preview/proposalPreviewMissingContext.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  evaluateDbProposalLaunchSpine,
  JOBS_BOARD_HREF,
} from "@/app/lib/productSpine";

describe("Preview missing job context", () => {
  test("no-job gate is contractor-facing and navigable", () => {
    const result = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing/proposals/preview",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "missing_job_context");
    assert.equal(result.normalizeHref, JOBS_BOARD_HREF);
    assert.doesNotMatch(
      result.errorMessage ?? "",
      /clean DB|database|fixture|smoke|harness|prototype|dev\b/i
    );
  });

  test("Preview client renders calm missing-context surface, not a fake proposal", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
      ),
      "utf8"
    );
    assert.match(source, /data-preview-missing-job-context/);
    assert.match(source, /Choose a job first/);
    assert.match(source, /Open Jobs/);
    assert.match(source, /missing_job_context/);
    assert.doesNotMatch(source, /clean DB Job Card/);
    assert.doesNotMatch(source, /A valid DB proposal route is required/);
  });
});
