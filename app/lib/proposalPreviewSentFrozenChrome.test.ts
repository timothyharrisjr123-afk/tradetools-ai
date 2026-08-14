/**
 * V2C4 — Preview sent/frozen chrome truth.
 *
 * Run: npx tsx --test app/lib/proposalPreviewSentFrozenChrome.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CUSTOMER_PREVIEW_DRAFT_STATUS,
  CUSTOMER_PREVIEW_LAST_SENT_PREFIX,
  CUSTOMER_PREVIEW_SENT_VERSION_STATUS,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  buildProposalPreviewSentFrozenChrome,
  formatProposalPreviewLastSentAt,
  hasLatestSentProposalVersionId,
} from "@/app/lib/proposalPreviewSentFrozenChrome";

const SENT_VERSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("proposalPreviewSentFrozenChrome", () => {
  test("unsent draft status is Draft only", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: null,
      lastSentFrozenAt: null,
    });
    assert.equal(chrome.kind, "unsent_draft");
    assert.equal(chrome.statusLabel, CUSTOMER_PREVIEW_DRAFT_STATUS);
    assert.equal(chrome.hasLatestSentVersion, false);
    assert.equal(chrome.lastSentAtLabel, null);
  });

  test("latest_sent_version_id drives draft-after-sent without claiming Sent version document", () => {
    assert.ok(hasLatestSentProposalVersionId(SENT_VERSION_ID));
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: "2026-07-22T21:31:00.000Z",
    });
    assert.equal(chrome.kind, "draft_after_sent");
    assert.equal(chrome.hasLatestSentVersion, true);
    assert.match(chrome.statusLabel, new RegExp(`^${CUSTOMER_PREVIEW_DRAFT_STATUS} —`));
    assert.match(chrome.statusLabel, new RegExp(CUSTOMER_PREVIEW_LAST_SENT_PREFIX));
    assert.doesNotMatch(chrome.statusLabel, new RegExp(CUSTOMER_PREVIEW_SENT_VERSION_STATUS));
    assert.ok(chrome.lastSentAtLabel);
  });

  test("presence without frozen_at still avoids Draft-only chrome", () => {
    const chrome = buildProposalPreviewSentFrozenChrome({
      latestSentVersionId: SENT_VERSION_ID,
      lastSentFrozenAt: null,
    });
    assert.equal(chrome.kind, "draft_after_sent");
    assert.equal(
      chrome.statusLabel,
      `${CUSTOMER_PREVIEW_DRAFT_STATUS} — ${CUSTOMER_PREVIEW_LAST_SENT_PREFIX}`
    );
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
