/**
 * Builder header back-link contract — no contradictory Job Card nav without job.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderBackLinkContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import { isUuidLike } from "@/app/lib/uuid";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Builder Back to Job Card contract", () => {
  test("header only renders Back to Job Card when job UUID is valid", () => {
    const header = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx"
    );
    assert.match(header, /isUuidLike\(jobId\)/);
    assert.match(header, /hasValidJobContext/);
    assert.match(header, /backHref \? \(/);
    assert.doesNotMatch(header, /: "\/tools\/roofing\/saved"/);
    assert.match(header, /data-builder-back-to-job-card/);
    assert.match(header, /Back to Job Card/);
  });

  test("no-job blocked state owns Open Jobs and invents no job", () => {
    const blocked = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderBlockedState.tsx"
    );
    assert.match(blocked, /Choose a job first/);
    assert.match(blocked, /Open a job before creating a proposal/);
    assert.match(blocked, /Open Jobs/);
    assert.doesNotMatch(blocked, /Back to Job Card/);
    assert.doesNotMatch(blocked, /clean DB|database|fixture|smoke|harness/i);
  });

  test("valid job context still builds Job Card href", () => {
    assert.equal(isUuidLike(JOB_ID), true);
    assert.match(
      buildJobCardHref(JOB_ID, { tab: "proposals" }),
      new RegExp(`job=${encodeURIComponent(JOB_ID)}`)
    );
  });

  test("Preview missing-job surface has no Back to Job Card", () => {
    const preview = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"
    );
    assert.match(preview, /data-preview-missing-job-context/);
    assert.match(preview, /Open Jobs/);
    // missing-job empty state block must not include Back to Job Card
    const missingBlock = preview.slice(
      preview.indexOf("data-preview-missing-job-context"),
      preview.indexOf("previewSurface.overall")
    );
    assert.doesNotMatch(missingBlock, /Back to Job Card/);
  });
});
