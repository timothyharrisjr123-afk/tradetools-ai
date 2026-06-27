/**
 * Proposal identity echo — pure staleness detection tests.
 *
 * Run: npx tsx --test app/lib/proposalIdentityEcho.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PROPOSAL_IDENTITY_ECHO_KEYS,
  diffProposalIdentityEcho,
  hasProposalIdentityEchoDrift,
  normalizeProposalIdentityEchoValue,
  pickProposalIdentityEchoSnapshot,
} from "./proposalIdentityEcho";

describe("normalizeProposalIdentityEchoValue", () => {
  test("normalizes undefined, null, empty string, and whitespace", () => {
    assert.equal(normalizeProposalIdentityEchoValue(undefined), null);
    assert.equal(normalizeProposalIdentityEchoValue(null), null);
    assert.equal(normalizeProposalIdentityEchoValue(""), null);
    assert.equal(normalizeProposalIdentityEchoValue("   "), null);
    assert.equal(normalizeProposalIdentityEchoValue("  hello  "), "hello");
  });

  test("treats non-string values as null", () => {
    assert.equal(normalizeProposalIdentityEchoValue(42), null);
    assert.equal(normalizeProposalIdentityEchoValue(true), null);
    assert.equal(normalizeProposalIdentityEchoValue({}), null);
  });

  test("preserves meaningful string values without case changes", () => {
    assert.equal(normalizeProposalIdentityEchoValue("AndersonRoofingLOL@gmail.com"), "AndersonRoofingLOL@gmail.com");
    assert.equal(normalizeProposalIdentityEchoValue("  Main St  "), "Main St");
  });
});

describe("pickProposalIdentityEchoSnapshot", () => {
  test("picks only allowlisted identity keys", () => {
    const snapshot = pickProposalIdentityEchoSnapshot({
      company_name: "Summit Roofing",
      company_email: "office@summit.com",
      customer_name: "Jane Smith",
      address_formatted: "1 Main St",
      job_name: "Jones roof",
      template_name: "Standard roof",
      measurement_record_id: "11111111-1111-4111-8111-111111111111",
      measurement_quantities_display: "24 SQ",
      customer_total_cents: 10800,
      status: "draft",
      pricing_policy_id: "policy-1",
      random_key: "ignored",
    });

    assert.deepEqual(snapshot, {
      company_name: "Summit Roofing",
      company_email: "office@summit.com",
      customer_name: "Jane Smith",
      address_formatted: "1 Main St",
      job_name: "Jones roof",
      template_name: "Standard roof",
    });
    assert.equal(Object.keys(snapshot).length, 6);
  });

  test("ignores pricing, measurement, status, and random keys", () => {
    const snapshot = pickProposalIdentityEchoSnapshot({
      unit_cost: 100,
      sales_tax_rate_pct: 8.25,
      measurement_quantities_display: "24 SQ",
      measurement_record_id: "abc",
      proposal_status: "sent",
      payment_enabled: true,
      scope_decisions: [],
    });

    assert.deepEqual(snapshot, {});
  });

  test("handles null and undefined context_echo safely", () => {
    assert.deepEqual(pickProposalIdentityEchoSnapshot(null), {});
    assert.deepEqual(pickProposalIdentityEchoSnapshot(undefined), {});
    assert.deepEqual(pickProposalIdentityEchoSnapshot([]), {});
  });

  test("omits keys whose normalized value is null", () => {
    const snapshot = pickProposalIdentityEchoSnapshot({
      company_name: "Summit Roofing",
      company_phone: "",
      company_email: "   ",
      customer_email: null,
    });

    assert.deepEqual(snapshot, {
      company_name: "Summit Roofing",
    });
  });

  test("does not mutate input objects", () => {
    const input = {
      company_name: "  Summit Roofing  ",
      measurement_record_id: "keep-me",
    };
    const before = structuredClone(input);

    pickProposalIdentityEchoSnapshot(input);

    assert.deepEqual(input, before);
  });
});

describe("diffProposalIdentityEcho", () => {
  test("no drift when values match", () => {
    const echo = {
      company_name: "Summit Roofing",
      company_email: "office@summit.com",
      customer_name: "Jane Smith",
      address_formatted: "1 Main St",
    };

    const result = diffProposalIdentityEcho(echo, echo);

    assert.equal(result.isStale, false);
    assert.deepEqual(result.changedFields, []);
    assert.equal(hasProposalIdentityEchoDrift(echo, echo), false);
  });

  test("no drift for null vs empty string", () => {
    const draft = { company_phone: null };
    const live = { company_phone: "" };

    const result = diffProposalIdentityEcho(draft, live);

    assert.equal(result.isStale, false);
    assert.deepEqual(result.changedFields, []);
  });

  test("no drift when both sides missing key", () => {
    const result = diffProposalIdentityEcho({}, {});

    assert.equal(result.isStale, false);
    assert.deepEqual(result.changedFields, []);
  });

  test("detects company_email change", () => {
    const result = diffProposalIdentityEcho(
      { company_email: "old@example.com" },
      { company_email: "new@example.com" }
    );

    assert.equal(result.isStale, true);
    assert.deepEqual(result.changedFields, [
      {
        key: "company_email",
        draftValue: "old@example.com",
        liveValue: "new@example.com",
      },
    ]);
  });

  test("detects company_phone added", () => {
    const result = diffProposalIdentityEcho(
      { company_phone: null },
      { company_phone: "918-555-0100" }
    );

    assert.equal(result.isStale, true);
    assert.deepEqual(result.changedFields, [
      {
        key: "company_phone",
        draftValue: null,
        liveValue: "918-555-0100",
      },
    ]);
  });

  test("detects company_website removed", () => {
    const result = diffProposalIdentityEcho(
      { company_website: "https://summit.example.com" },
      { company_website: null }
    );

    assert.equal(result.isStale, true);
    assert.deepEqual(result.changedFields, [
      {
        key: "company_website",
        draftValue: "https://summit.example.com",
        liveValue: null,
      },
    ]);
  });

  test("detects customer_email change", () => {
    const result = diffProposalIdentityEcho(
      { customer_email: "jane@example.com" },
      { customer_email: "jane.smith@example.com" }
    );

    assert.equal(result.isStale, true);
    assert.equal(result.changedFields[0]?.key, "customer_email");
  });

  test("detects property address change", () => {
    const result = diffProposalIdentityEcho(
      { address_formatted: "1 Main St, Tulsa OK" },
      { address_formatted: "2 Oak Ave, Tulsa OK" }
    );

    assert.equal(result.isStale, true);
    assert.deepEqual(result.changedFields, [
      {
        key: "address_formatted",
        draftValue: "1 Main St, Tulsa OK",
        liveValue: "2 Oak Ave, Tulsa OK",
      },
    ]);
  });

  test("detects job_name change", () => {
    const result = diffProposalIdentityEcho(
      { job_name: "Jones roof" },
      { job_name: "Jones roof replacement" }
    );

    assert.equal(result.isStale, true);
    assert.equal(result.changedFields[0]?.key, "job_name");
  });

  test("detects multiple fields in stable allowlist order", () => {
    const result = diffProposalIdentityEcho(
      {
        company_email: "old@example.com",
        company_phone: "918-555-0100",
        customer_name: "Jane Smith",
        job_name: "Jones roof",
      },
      {
        company_email: "new@example.com",
        company_phone: "918-555-0199",
        customer_name: "Jane Doe",
        job_name: "Jones roof replacement",
      }
    );

    assert.equal(result.isStale, true);
    assert.deepEqual(
      result.changedFields.map((field) => field.key),
      ["company_phone", "company_email", "customer_name", "job_name"]
    );
    assert.deepEqual(result.changedFields.map((field) => field.key), [
      ...PROPOSAL_IDENTITY_ECHO_KEYS.filter((key) =>
        ["company_phone", "company_email", "customer_name", "job_name"].includes(key)
      ),
    ]);
  });

  test("does not mutate input objects", () => {
    const draft = { company_name: "Summit Roofing" };
    const live = { company_name: "Summit Roofing LLC" };
    const draftBefore = structuredClone(draft);
    const liveBefore = structuredClone(live);

    diffProposalIdentityEcho(draft, live);

    assert.deepEqual(draft, draftBefore);
    assert.deepEqual(live, liveBefore);
  });
});
