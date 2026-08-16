/**
 * Run: npx tsx --test app/lib/proposalJobCardSentHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  buildJobCardSentHistoryView,
  formatJobCardCompactDeliveryStatusLabel,
  formatJobCardSentAtLabel,
} from "./proposalJobCardSentHistory";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";

describe("proposalJobCardSentHistory", () => {
  test("sorts newest first and marks Current from latest_sent pointer", () => {
    const view = buildJobCardSentHistoryView({
      latestSentVersionId: V2,
      versions: [
        {
          versionId: V1,
          frozenAt: "2026-07-01T12:00:00.000Z",
          packageLabel: "Standard",
          deliveryStatus: "delivered",
        },
        {
          versionId: V3,
          frozenAt: "2026-07-20T12:00:00.000Z",
          packageLabel: "Premium",
          deliveryStatus: "failed",
        },
        {
          versionId: V2,
          frozenAt: "2026-07-22T16:31:00.000Z",
          packageLabel: "Enhanced",
          deliveryStatus: "provider_accepted",
        },
      ],
    });
    assert.equal(view.rows.length, 3);
    assert.equal(view.rows[0]?.isCurrent, true);
    assert.equal(view.rows[0]?.packageLabel, "Enhanced");
    assert.equal(view.rows[1]?.isCurrent, false);
    assert.equal(view.rows[2]?.isCurrent, false);
    assert.equal(view.latestSentFrozenAt, "2026-07-22T16:31:00.000Z");
    const joined = view.rows.map((row) => row.sentAtLabel).join(" ");
    assert.doesNotMatch(joined, /[0-9a-f]{8}-[0-9a-f]{4}/i);
    assert.doesNotMatch(JSON.stringify(view.rows), /version_kind|composition_role|superseded/i);
  });

  test("does not treat a newer frozen row as Current unless it is latest_sent", () => {
    const view = buildJobCardSentHistoryView({
      latestSentVersionId: V1,
      versions: [
        { versionId: V2, frozenAt: "2026-08-01T12:00:00.000Z", packageLabel: "Enhanced" },
        { versionId: V1, frozenAt: "2026-07-01T12:00:00.000Z", packageLabel: "Standard" },
      ],
    });
    assert.equal(view.rows[0]?.packageLabel, "Enhanced");
    assert.equal(view.rows[0]?.isCurrent, false);
    assert.equal(view.rows[1]?.isCurrent, true);
  });

  test("compact last-sent stamp omits year so mobile meta stays one line", () => {
    const label = formatJobCardSentAtLabel("2026-07-22T16:31:00.000Z");
    assert.ok(label);
    assert.doesNotMatch(label!, /2026/);
    assert.match(label!, /Jul/);
    assert.match(label!, /22/);
  });

  test("compact delivery labels omit prepared and stay contractor-safe", () => {
    assert.equal(formatJobCardCompactDeliveryStatusLabel("delivered"), "Delivered");
    assert.equal(formatJobCardCompactDeliveryStatusLabel("failed"), "Failed");
    assert.equal(formatJobCardCompactDeliveryStatusLabel("bounced"), "Bounced");
    assert.equal(formatJobCardCompactDeliveryStatusLabel("attempted"), "Sending");
    assert.equal(formatJobCardCompactDeliveryStatusLabel("provider_accepted"), "Emailed");
    assert.equal(formatJobCardCompactDeliveryStatusLabel("prepared"), null);
    assert.equal(formatJobCardCompactDeliveryStatusLabel("snapshot_frozen"), null);
  });

  test("source stays read-only presentation", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/lib/proposalJobCardSentHistory.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /jobs\.stage/);
    assert.doesNotMatch(source, /proposals\.status/);
    assert.doesNotMatch(source, /event_type/);
    assert.doesNotMatch(source, /persist_proposal_send_freeze/);
  });
});
