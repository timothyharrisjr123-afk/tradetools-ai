/**
 * V2C4 / Phase 1 — Preview sent/frozen chrome truth.
 *
 * Run: npx tsx --test app/lib/proposalPreviewSentFrozenChrome.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildProposalPreviewSentFrozenChrome,
  formatProposalPreviewLastSentAt,
  hasLatestSentProposalVersionId,
} from "@/app/lib/proposalPreviewSentFrozenChrome";

const SENT_VERSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OLDER_VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACCEPTANCE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROPOSAL_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("proposalPreviewSentFrozenChrome", () => {
  test("unsent draft status is Draft · Not sent", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: null,
      lastSentFrozenAt: null,
    });
    assert.equal(chrome.kind, "unsent_draft");
    assert.equal(chrome.statusLabel, "Draft · Not sent");
    assert.equal(chrome.hasLatestSentVersion, false);
    assert.equal(chrome.lastSentAtLabel, null);
    assert.equal(chrome.suppressOrdinarySend, false);
  });

  test("latest_sent_version_id drives Sent proposal chrome without Draft — last sent", () => {
    assert.ok(hasLatestSentProposalVersionId(SENT_VERSION_ID));
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: "2026-07-22T21:31:00.000Z",
      latestSentVersionNumber: 2,
    });
    assert.equal(chrome.kind, "current_sent");
    assert.equal(chrome.hasLatestSentVersion, true);
    assert.equal(chrome.statusLabel, "Sent proposal · Version 2");
    assert.doesNotMatch(chrome.statusLabel, /Draft — last sent/i);
    assert.ok(chrome.lastSentAtLabel);
  });

  test("presence without frozen_at still avoids Draft-only chrome", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: null,
      latestSentVersionNumber: 1,
    });
    assert.equal(chrome.statusLabel, "Sent proposal · Version 1");
  });

  test("accepted agreement suppresses ordinary Send", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: "2026-07-22T21:31:00.000Z",
      latestSentVersionNumber: 3,
      acceptance: {
        id: ACCEPTANCE_ID,
        proposalId: PROPOSAL_ID,
        proposalVersionId: SENT_VERSION_ID,
        guardResult: "valid_clean",
        acceptedAt: "2026-07-23T12:00:00.000Z",
      },
    });
    assert.equal(chrome.kind, "accepted");
    assert.equal(chrome.statusLabel, "Accepted proposal · Version 3");
    assert.equal(chrome.suppressOrdinarySend, true);
  });

  test("editing revision after sent uses Last sent Version wording", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: "2026-07-22T21:31:00.000Z",
      latestSentVersionNumber: 2,
      draftContentChangedAt: "2026-07-23T10:00:00.000Z",
    });
    assert.equal(chrome.kind, "editing_revision");
    assert.equal(
      chrome.statusLabel,
      "Editing revision · Last sent: Version 2"
    );
  });

  test("superseded previous version chrome", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: "2026-07-22T21:31:00.000Z",
      latestSentVersionNumber: 5,
      viewingVersionId: OLDER_VERSION_ID,
      viewingVersionNumber: 4,
    });
    assert.equal(chrome.kind, "superseded_previous");
    assert.match(chrome.statusLabel, /Previous version · Replaced by Version 5/);
    assert.equal(chrome.suppressOrdinarySend, true);
  });

  test("delivery failure is not used as sent/frozen input", () => {
    const source = [
      "buildProposalPreviewSentFrozenChrome",
      "latestSentVersionId",
      "lastSentFrozenAt",
    ].join("\n");
    assert.doesNotMatch(source, /provider_accepted|deliveryStatus|deliveryAttempt/);
    assert.equal(formatProposalPreviewLastSentAt("not-a-date"), null);
  });
});
