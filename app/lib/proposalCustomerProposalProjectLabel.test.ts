/**
 * Run: npx tsx --test app/lib/proposalCustomerProposalProjectLabel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveCustomerProposalProjectLabel } from "./proposalCustomerProposalProjectLabel";

describe("resolveCustomerProposalProjectLabel", () => {
  test("prefers proposal title and strips trailing proposal", () => {
    assert.equal(
      resolveCustomerProposalProjectLabel({
        proposalTitle: "Roof replacement proposal",
        jobName: "4558 Babby RD",
        propertyAddress: "4558 Babby RD, Tulsa, OK, 74110",
      }),
      "Roof replacement"
    );
  });

  test("does not derive project from property/address job_name", () => {
    assert.equal(
      resolveCustomerProposalProjectLabel({
        proposalTitle: null,
        jobName: "4558 Babby RD",
        propertyAddress: "4558 Babby RD, Tulsa, OK, 74110",
      }),
      null
    );
  });

  test("keeps real job names that are not the property address", () => {
    assert.equal(
      resolveCustomerProposalProjectLabel({
        proposalTitle: null,
        jobName: "Babby D roof",
        propertyAddress: "4558 Babby RD, Tulsa, OK, 74110",
      }),
      "Babby D roof"
    );
  });
});
