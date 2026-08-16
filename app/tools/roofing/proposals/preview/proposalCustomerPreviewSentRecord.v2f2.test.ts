/**
 * V2F2 — Preview sent-record wiring goldens.
 * Run: npx tsx --test app/tools/roofing/proposals/preview/proposalCustomerPreviewSentRecord.v2f2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const root = path.join(process.cwd(), "app/tools/roofing/proposals/preview");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2F2 sent-record Preview wiring", () => {
  test("sent mode loads the explicit frozen version and never getDraftGraph in that branch", () => {
    const client = read("ProposalCustomerPreviewClient.tsx");
    const sentBranch = client.slice(
      client.indexOf('if (sentRequest.mode === "sent_record")'),
      client.indexOf("const [jobRecord, graph, catalog]")
    );
    assert.match(sentBranch, /getProposalVersionGraph/);
    assert.match(sentBranch, /requireSentVersion:\s*true/);
    assert.match(sentBranch, /validateProposalSentRecordGraph/);
    assert.match(sentBranch, /asCustomerPreviewGraphFromSentRecord/);
    assert.doesNotMatch(sentBranch, /getDraftGraph/);
    assert.doesNotMatch(sentBranch, /getLatestSentProposalVersionGraph/);
  });

  test("invalid sent mode does not load draft", () => {
    const client = read("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /sent_record_invalid/);
    const invalidBranch = client.slice(
      client.indexOf('if (sentRequest.mode === "sent_record_invalid")'),
      client.indexOf("try {")
    );
    assert.match(invalidBranch, /setLoadError\(sentRequest\.reason\)/);
    assert.doesNotMatch(invalidBranch, /getDraftGraph/);
  });

  test("sent-record chrome hides Send, readiness, and request awareness", () => {
    const client = read("ProposalCustomerPreviewClient.tsx");
    const header = read("ProposalPreviewHeader.tsx");
    assert.match(client, /showSendSharing=\{!isSentRecord\}/);
    assert.match(client, /\{isSentRecord \? null : \(/);
    assert.match(header, /showSendSharing && !isSentRecord/);
    assert.match(header, /PREVIEW_SENT_RECORD_BACK_LABEL/);
    assert.match(header, /data-preview-sent-record/);
    assert.match(header, /sentRecordChrome\?\.statusLabel/);
    assert.doesNotMatch(
      header,
      />[^<]*(snapshot|proposal_version_id|version_kind|superseded)[^<]*</i
    );
  });

  test("does not mint tokens, freeze, or write status/stage", () => {
    const client = read("ProposalCustomerPreviewClient.tsx");
    assert.doesNotMatch(client, /mint_proposal_public_access_token/);
    assert.doesNotMatch(client, /persist_proposal_send_freeze/);
    assert.doesNotMatch(client, /jobs\.stage/);
    assert.doesNotMatch(client, /\.update\(\s*\{\s*status:/);
  });
});
