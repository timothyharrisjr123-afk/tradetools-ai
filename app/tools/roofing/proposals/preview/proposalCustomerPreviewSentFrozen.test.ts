/**
 * V2C4 — Preview sent/frozen chrome wiring.
 *
 * Run: npx tsx --test app/tools/roofing/proposals/preview/proposalCustomerPreviewSentFrozen.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_DRAFT_STATUS,
  CUSTOMER_PREVIEW_LAST_SENT_PREFIX,
  CUSTOMER_PREVIEW_SENT_VERSION_STATUS,
} from "@/app/lib/proposalBuilderDocumentIa";

function readPreviewSource(rel: string): string {
  return readFileSync(path.join(process.cwd(), "app/tools/roofing/proposals/preview", rel), "utf8");
}

describe("V2C4 Preview sent/frozen chrome", () => {
  test("Preview still loads draft graph only — no frozen document render path", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /getDraftGraph\(companyId, normalizedProposalId\)/);
    assert.match(client, /buildProposalCustomerPreviewDocument\(persistedGraph/);
    assert.match(client, /getLatestSentProposalVersionGraph/);
    assert.doesNotMatch(client, /buildProposalPublicGraphDto|loadPublicProposalByToken/);
    assert.doesNotMatch(client, /requireSentVersion:\s*true/);
  });

  test("command bar uses sent/frozen chrome from latest_sent_version_id", () => {
    assert.equal(CUSTOMER_PREVIEW_DRAFT_STATUS, "Draft");
    assert.equal(CUSTOMER_PREVIEW_LAST_SENT_PREFIX, "last sent");
    assert.equal(CUSTOMER_PREVIEW_SENT_VERSION_STATUS, "Sent version");
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(client, /buildProposalPreviewSentFrozenChrome/);
    assert.match(client, /latest_sent_version_id/);
    assert.match(client, /lastSentFrozenAt/);
    assert.match(client, /sentFrozenChrome=\{sentFrozenChrome\}/);
    assert.match(header, /sentFrozenChrome\.statusLabel/);
    assert.match(header, /data-preview-sent-frozen-kind=\{sentFrozenChrome\.kind\}/);
    assert.match(drawer, /sentFrozenChrome\.statusLabel/);
    assert.doesNotMatch(header, /CUSTOMER_PREVIEW_SENT_VERSION_STATUS/);
  });

  test("Send action semantics stay Send — not Resend — and chrome refreshes after send", () => {
    const panel = readPreviewSource("ProposalCustomerPreviewSendGatePanel.tsx");
    const actions = readPreviewSource("ProposalPreviewActionGroup.tsx");
    assert.match(panel, /Send proposal/);
    assert.doesNotMatch(panel, /\bResend\b/);
    assert.doesNotMatch(actions, /\bResend\b/);
    assert.match(panel, /onSendCompleted\?\.\(\)/);
    assert.match(panel, /\/api\/proposals\/send/);
  });

  test("delivery status is not used as sent/frozen chrome input", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    const header = readPreviewSource("ProposalPreviewHeader.tsx");
    const chrome = readFileSync(
      path.join(process.cwd(), "app/lib/proposalPreviewSentFrozenChrome.ts"),
      "utf8"
    );
    for (const source of [client, header, chrome]) {
      assert.doesNotMatch(source, /provider_accepted/);
      assert.doesNotMatch(source, /deliveryStatus/);
      assert.doesNotMatch(source, /deliveryAttemptId/);
    }
    assert.match(chrome, /latestSentVersionId/);
    assert.match(chrome, /lastSentFrozenAt/);
  });
});
