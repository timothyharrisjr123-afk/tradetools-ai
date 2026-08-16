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
  test("default Preview still loads draft graph; sent-record is an explicit branch", () => {
    const client = readPreviewSource("ProposalCustomerPreviewClient.tsx");
    assert.match(client, /getDraftGraph\(companyId, normalizedProposalId\)/);
    assert.match(client, /buildProposalCustomerPreviewDocument\(persistedGraph/);
    assert.match(client, /getLatestSentProposalVersionGraph/);
    assert.match(client, /sentRequest\.mode === "sent_record"/);
    assert.match(client, /getProposalVersionGraph/);
    assert.match(client, /requireSentVersion:\s*true/);
    assert.doesNotMatch(client, /buildProposalPublicGraphDto|loadPublicProposalByToken/);
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
    assert.match(header, /data-preview-sent-frozen-kind=/);
    assert.match(header, /sentFrozenChrome\.kind/);
    assert.match(drawer, /sentFrozenChrome\.statusLabel/);
    assert.doesNotMatch(header, /CUSTOMER_PREVIEW_SENT_VERSION_STATUS/);
  });

  test("V2C5 Send sheet keeps status and customer as separate readable lines", () => {
    const drawer = readPreviewSource("ProposalCustomerPreviewSendSharingDrawer.tsx");
    assert.match(drawer, /data-preview-send-sheet-context/);
    assert.match(drawer, /data-preview-draft-status/);
    assert.match(drawer, /data-preview-send-sheet-customer/);
    assert.match(drawer, /sentFrozenChrome\.statusLabel/);
    assert.match(drawer, /Customer:/);
    // Authoritative status must not live under a truncate class.
    assert.doesNotMatch(
      drawer,
      /className="[^"]*truncate[^"]*"[\s\S]{0,120}data-preview-draft-status/
    );
    assert.doesNotMatch(
      drawer,
      /data-preview-draft-status[\s\S]{0,120}className="[^"]*truncate/
    );
    // Status + customer must not share one truncated context line.
    assert.doesNotMatch(
      drawer,
      /data-preview-send-sheet-context[\s\S]{0,80}truncate[\s\S]{0,200}data-preview-draft-status[\s\S]{0,200}Customer:/
    );
    assert.doesNotMatch(drawer, /CUSTOMER_PREVIEW_SENT_VERSION_STATUS|\bResend\b/);
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
