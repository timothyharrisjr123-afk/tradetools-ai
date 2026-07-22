/**
 * Run: npx tsx --test app/lib/proposalCustomerPacketInterestAction.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildAskQuestionHref,
  buildPackageInterestHref,
  PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR,
} from "./proposalCustomerPacketInterestAction";

describe("buildPackageInterestHref", () => {
  test("prefers mailto for request intent without mutating truth", () => {
    const href = buildPackageInterestHref(
      { email: "office@anderson.example", phone: "555-0100", companyName: "Anderson Roofing" },
      "Enhanced",
      "request"
    );
    assert.match(href, /^mailto:office@anderson\.example\?/);
    assert.match(href, /Request%20Enhanced%20package/);
    assert.match(href, /interested%20in%20the%20Enhanced%20package/);
    assert.doesNotMatch(href, /Accept|Approve|Sign|Pay/i);
  });

  test("ask-about uses quiet package wording", () => {
    const href = buildPackageInterestHref(
      { email: "office@anderson.example" },
      "Premium",
      "ask-about"
    );
    assert.match(href, /Question%20about%20Premium%20package/);
    assert.doesNotMatch(href, /select|accept|approve/i);
  });

  test("falls back to tel then closeout anchor", () => {
    assert.equal(
      buildPackageInterestHref({ phone: "555-0199" }, "Enhanced", "request"),
      "tel:555-0199"
    );
    assert.equal(
      buildPackageInterestHref(null, "Enhanced", "request"),
      `#${PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR}`
    );
  });

  test("ask question uses generic subject", () => {
    const href = buildAskQuestionHref({ email: "hi@example.com" });
    assert.match(href, /Question%20about%20my%20roofing%20proposal/);
  });
});
