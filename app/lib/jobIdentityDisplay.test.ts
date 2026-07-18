/**
 * Run: npx tsx --test app/lib/jobIdentityDisplay.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatJobIdentityReturnLabel,
  resolveJobIdentityDisplay,
} from "./jobIdentityDisplay";
import type { JobRecord } from "./jobTypes";

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    company_id: "22222222-2222-4222-8222-222222222222",
    job_name: "4558 Babby RD",
    contact: {
      customer_name: "Babby D",
      customer_phone: "555",
      customer_email: "a@b.com",
    },
    address: {
      line1: "4558 Babby RD",
      city: "Tulsa",
      state: "OK",
      zip: "74110",
      country: "US",
      formatted: "4558 Babby RD, Tulsa, OK, 74110",
    },
    ...overrides,
  } as JobRecord;
}

describe("resolveJobIdentityDisplay", () => {
  test("customer name is primary; address is secondary", () => {
    const identity = resolveJobIdentityDisplay(job());
    assert.equal(identity.primaryLabel, "Babby D");
    assert.match(identity.secondaryAddress ?? "", /4558 Babby RD/);
  });

  test("falls back to job_name when customer name missing", () => {
    const identity = resolveJobIdentityDisplay(
      job({
        contact: {
          customer_name: "",
          customer_phone: "",
          customer_email: "",
        },
      })
    );
    assert.equal(identity.primaryLabel, "4558 Babby RD");
  });

  test("formatJobIdentityReturnLabel prefers customer name", () => {
    assert.equal(formatJobIdentityReturnLabel(job()), "Babby D");
  });
});
