/**
 * V2F Phase B — email-send uses dedicated C4 wrapper; QA/send-prep stay generic.
 * Run: npx tsx --test app/lib/proposalV2fCompletePhaseB.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("V2F Phase B mint ownership", () => {
  test("email send calls the dedicated combined RPC wrapper", () => {
    const source = read("app/lib/proposalEmailDelivery.server.ts");
    assert.match(source, /mintAndSupersedeProposalPublicAccessToken/);
    assert.doesNotMatch(source, /mintProposalPublicAccessToken\(/);
    assert.doesNotMatch(source, /mint_proposal_public_access_token_v1/);
  });

  test("QA and send-prep remain on generic mint", () => {
    const qa = read("app/lib/proposalPublicReviewLink.server.ts");
    const prep = read("app/lib/proposalSendPrep.server.ts");
    assert.match(qa, /mintProposalPublicAccessToken/);
    assert.doesNotMatch(qa, /mintAndSupersedeProposalPublicAccessToken/);
    assert.match(prep, /mintProposalPublicAccessToken/);
    assert.doesNotMatch(prep, /mintAndSupersedeProposalPublicAccessToken/);
  });

  test("generic mint compatibility and migration 038 remain untouched", () => {
    const persistence = read("app/lib/proposalPublicAccessTokenMintPersistence.ts");
    assert.match(persistence, /mint_proposal_public_access_token_v1/);
    assert.match(persistence, /mint_and_supersede_proposal_public_access_token_v1/);
    assert.doesNotMatch(
      read("app/lib/proposalEmailDelivery.server.ts"),
      /038|email_send_not_allowed/
    );
  });

  test("does not write jobs.stage, proposals.status, or change freeze RPC", () => {
    for (const rel of [
      "app/lib/proposalEmailDelivery.server.ts",
      "app/lib/proposalPublicAccessTokenMintPersistence.ts",
      "app/lib/proposalRevisionChangeSummary.ts",
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
    ]) {
      const source = read(rel);
      assert.doesNotMatch(source, /jobs\.stage|stage_entered_at|transitionJobStage/);
      assert.doesNotMatch(source, /proposals\.status\s*=/);
      assert.doesNotMatch(source, /persist_proposal_send_freeze_v1/);
    }
  });
});
