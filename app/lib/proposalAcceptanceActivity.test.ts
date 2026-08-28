/**
 * R3C acceptance Activity composition — chronology owner is accepted_at.
 *
 * Run:
 * npx tsx --test app/lib/proposalAcceptanceActivity.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import { composeProposalAcceptanceActivityItems } from "./proposalAcceptanceActivity";
import { composeProposalSignatureActivityItems } from "./proposalSignatureActivity";

const ROOT = process.cwd();
const ACCEPTANCE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const ACCEPTANCE_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02";

describe("composeProposalAcceptanceActivityItems", () => {
  test("exposes accepted_at and acceptance id for composer chronology", () => {
    const items = composeProposalAcceptanceActivityItems([
      {
        id: ACCEPTANCE_A,
        accepted_at: "2026-08-16T14:31:20.000Z",
        accepted_option_label: "Premium",
        confirmed_at: null,
        confirmed_by_user_id: null,
        guard_result: "valid_clean",
      },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.label, "Proposal accepted");
    assert.equal(items[0]?.note, "Premium package");
    assert.equal(items[0]?.acceptanceId, ACCEPTANCE_A);
    assert.equal(items[0]?.acceptedAt, "2026-08-16T14:31:20.000Z");
    assert.equal(typeof items[0]?.when, "string");
  });

  test("confirmed_at / Acknowledge does not add a second Activity item", () => {
    const items = composeProposalAcceptanceActivityItems([
      {
        id: ACCEPTANCE_A,
        accepted_at: "2026-08-16T14:31:20.000Z",
        accepted_option_label: "Premium",
        confirmed_at: "2026-08-16T14:32:46.000Z",
        confirmed_by_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        guard_result: "valid_clean",
      },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.label, "Proposal accepted");
    assert.equal(
      items.some((item) => /acknowledge|acceptance confirmed/i.test(item.label)),
      false
    );
    assert.equal(
      items.some((item) => /acknowledge|acceptance confirmed/i.test(item.note)),
      false
    );
  });

  test("two rows with the same package remain two items", () => {
    const items = composeProposalAcceptanceActivityItems([
      {
        id: ACCEPTANCE_A,
        accepted_at: "2026-08-16T14:25:15.000Z",
        accepted_option_label: "Premium",
        confirmed_at: "2026-08-16T14:25:16.000Z",
        confirmed_by_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        guard_result: "valid_clean",
      },
      {
        id: ACCEPTANCE_B,
        accepted_at: "2026-08-16T14:28:45.000Z",
        accepted_option_label: "Premium",
        confirmed_at: null,
        confirmed_by_user_id: null,
        guard_result: "valid_review_required",
      },
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.acceptanceId, ACCEPTANCE_A);
    assert.equal(items[1]?.acceptanceId, ACCEPTANCE_B);
    assert.equal(items[0]?.note, items[1]?.note);
  });
});

describe("acceptance Activity through Job Card composer", () => {
  test("later historical acceptance appears at its accepted_at, not the bottom", () => {
    const acceptanceItems = composeProposalAcceptanceActivityItems([
      {
        id: ACCEPTANCE_A,
        accepted_at: "2026-08-16T14:25:15.000Z",
        accepted_option_label: "Premium",
        confirmed_at: "2026-08-16T14:25:16.000Z",
        confirmed_by_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        guard_result: "valid_clean",
      },
      {
        id: ACCEPTANCE_B,
        accepted_at: "2026-08-16T14:28:45.000Z",
        accepted_option_label: "Premium",
        confirmed_at: null,
        confirmed_by_user_id: null,
        guard_result: "valid_review_required",
      },
    ]);
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      jobActivityEvents: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          job_id: "11111111-1111-4111-8111-111111111111",
          event_type: "stage_changed",
          occurred_at: "2026-08-16T14:25:16.000Z",
          payload_json: {
            from_stage: "proposal",
            to_stage: "approved",
            reason: "contractor_approved",
          },
        },
      ],
      acceptanceItems,
    });
    assert.deepEqual(
      items.map((item) => item.label),
      [
        "Proposal accepted",
        "Work approved",
        "Proposal accepted",
        "Job created",
      ]
    );
  });
});

describe("signature Activity through Job Card composer", () => {
  test("Proposal signed stays out of contractor Activity", () => {
    const SIGNATURE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
    const SIGNATURE_B = "cccccccc-cccc-4ccc-8ccc-cccccccccc02";
    const signatureItems = composeProposalSignatureActivityItems([
      {
        id: SIGNATURE_A,
        proposal_id: "22222222-2222-4222-8222-222222222222",
        proposal_version_id: "55555555-5555-4555-8555-555555555555",
        signed_at: "2026-08-16T14:26:00.000Z",
        signer_printed_name: "Jane Homeowner",
      },
      {
        id: SIGNATURE_B,
        proposal_id: "22222222-2222-4222-8222-222222222222",
        proposal_version_id: "66666666-6666-4666-8666-666666666666",
        signed_at: "2026-08-16T14:29:00.000Z",
        signer_printed_name: "Jane Homeowner",
      },
    ]);
    const items = composeJobActivityItems({
      jobCreatedAt: "2026-08-16T14:25:14.000Z",
      signatureItems: [...signatureItems, ...signatureItems],
    });
    assert.deepEqual(
      items.map((item) => item.label),
      ["Job created"]
    );
    assert.equal(items.some((item) => item.label === "Proposal signed"), false);
  });
});

describe("Job Card Activity wiring", () => {
  test("panel composes acceptances into Job Card Activity without Acknowledge events", () => {
    const panel = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"),
      "utf8"
    );
    assert.match(panel, /composeProposalAcceptanceActivityItems/);
    assert.match(panel, /acceptanceItems/);
    assert.match(panel, /composeProposalSignatureActivityItems/);
    assert.match(panel, /signatureItems/);
    assert.match(panel, /composeJobActivityItems/);
    assert.doesNotMatch(panel, /Acceptance confirmed/);
    assert.doesNotMatch(panel, /label:\s*"Acknowledge"/);
  });

  test("acknowledge RPC does not insert Activity", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260816_040_proposal_formal_acceptance.sql"),
      "utf8"
    );
    const ackFn = sql.slice(
      sql.indexOf(
        "create or replace function public.acknowledge_proposal_acceptance_attention_v1"
      )
    );
    assert.match(ackFn, /later_acceptance_acknowledged/);
    assert.doesNotMatch(ackFn, /job_activity_events/);
    assert.doesNotMatch(ackFn, /record_job_activity_v1/);
  });
});
