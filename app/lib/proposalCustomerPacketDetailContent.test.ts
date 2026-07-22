/**
 * proposalCustomerPacketDetailContent tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerPacketDetailContent.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  finalizeCustomerPacketDetailBody,
  isCustomerPacketMeaningfulDetailBody,
  normalizeCustomerPacketDetailBody,
} from "./proposalCustomerPacketDetailContent";

describe("proposalCustomerPacketDetailContent", () => {
  test("strips trailing Yes artifact from overview copy", () => {
    const body =
      "This proposal outlines a roof replacement scope based on field measurements, selected options, and the contractor's catalog setup. Yes";
    assert.equal(
      normalizeCustomerPacketDetailBody(body),
      "This proposal outlines a roof replacement scope based on field measurements, selected options, and the contractor's catalog setup."
    );
    assert.equal(isCustomerPacketMeaningfulDetailBody(body), true);
  });

  test("upgrades known weak overview boilerplate at finalize", () => {
    const body =
      "This proposal outlines a roof replacement scope based on field measurements, selected options, and the contractor's catalog setup.";
    const finalized = finalizeCustomerPacketDetailBody("project_overview", body);
    assert.match(finalized, /prepared this roofing proposal for your home/i);
    assert.doesNotMatch(finalized, /this proposal outlines/i);
  });

  test("omits contractor-review warranty boilerplate", () => {
    const body =
      "Warranty details should be reviewed and completed by the contractor before sending the proposal.";
    assert.equal(isCustomerPacketMeaningfulDetailBody(body), false);
  });

  test("omits contractor-review terms boilerplate", () => {
    const body =
      "Payment terms, exclusions, and project schedule should be reviewed and completed by the contractor before sending.";
    assert.equal(isCustomerPacketMeaningfulDetailBody(body), false);
  });

  test("keeps meaningful custom detail copy", () => {
    assert.equal(isCustomerPacketMeaningfulDetailBody("Manufacturer limited lifetime warranty applies."), true);
  });
});
