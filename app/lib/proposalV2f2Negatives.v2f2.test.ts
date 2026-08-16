/**
 * V2F2 — negative goldens. No Stage C4, token, freeze, status, or board writes.
 * Run: npx tsx --test app/lib/proposalV2f2Negatives.v2f2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();

const TOUCHED = [
  "app/lib/proposalPreviewSentRecord.ts",
  "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
  "app/tools/roofing/proposals/preview/ProposalPreviewHeader.tsx",
  "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts",
  "app/tools/roofing/jobCard/JobCardProposalsTab.tsx",
  "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx",
];

describe("V2F2 negatives", () => {
  test("touched files do not mint tokens, freeze, write status/stage, or change the board", () => {
    for (const rel of TOUCHED) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(source, /mint_proposal_public_access_token/);
      assert.doesNotMatch(source, /persist_proposal_send_freeze/);
      assert.doesNotMatch(source, /jobs\.stage/);
      assert.doesNotMatch(source, /proposal_events/);
      assert.doesNotMatch(source, /event_type:\s*"sent"|event_type:\s*"revised"/);
      assert.doesNotMatch(source, /supersede.*token|redirect.*latest.*token/i);
    }
  });

  test("Jobs Board helpers stay independent of sent-record and Attention chrome", () => {
    const board = readFileSync(join(ROOT, "app/tools/roofing/saved/jobsBoardUtils.ts"), "utf8");
    assert.doesNotMatch(board, /proposalPreviewSentRecord/);
    assert.doesNotMatch(board, /buildProposalPreviewSentHref/);
    assert.doesNotMatch(board, /JobCardNextActionPanel/);
    assert.doesNotMatch(board, /view=sent/);
  });

  test("public token orchestrator is not imported by sent-record Preview", () => {
    const client = readFileSync(
      join(ROOT, "app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx"),
      "utf8"
    );
    assert.doesNotMatch(client, /proposalPublicAccessOrchestrator/);
    assert.doesNotMatch(client, /loadPublicProposalByToken/);
    assert.doesNotMatch(client, /buildProposalPublicGraphDto/);
  });
});
