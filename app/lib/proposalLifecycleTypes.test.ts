/**
 * 3J0b — lifecycle type contract smoke tests (no DB).
 *
 * Run: npx tsx --test app/lib/proposalLifecycleTypes.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  PROPOSAL_EVENT_TYPES,
  PROPOSAL_IMMUTABLE_VERSION_KINDS,
  PROPOSAL_STATUSES,
  PROPOSAL_VERSION_KINDS,
  isDraftEditableProposalStatus,
  isImmutableProposalVersionKind,
} from "./proposalLifecycleTypes";

describe("proposalLifecycleTypes", () => {
  test("PROPOSAL_STATUSES includes all approved lifecycle values", () => {
    const expected = [
      "draft",
      "previewed",
      "sent",
      "viewed",
      "signed",
      "declined",
      "revised",
      "archived",
      "deleted",
    ];
    assert.deepEqual([...PROPOSAL_STATUSES].sort(), [...expected].sort());
  });

  test("PROPOSAL_VERSION_KINDS includes draft sent signed superseded", () => {
    assert.deepEqual([...PROPOSAL_VERSION_KINDS].sort(), [
      "draft",
      "sent",
      "signed",
      "superseded",
    ].sort());
  });

  test("immutable version kinds exclude draft", () => {
    assert.ok(isImmutableProposalVersionKind("sent"));
    assert.ok(isImmutableProposalVersionKind("signed"));
    assert.ok(!isImmutableProposalVersionKind("draft"));
  });

  test("draft-editable statuses include draft and revised", () => {
    assert.ok(isDraftEditableProposalStatus("draft"));
    assert.ok(isDraftEditableProposalStatus("revised"));
    assert.ok(!isDraftEditableProposalStatus("signed"));
  });

  test("PROPOSAL_EVENT_TYPES includes payment events", () => {
    assert.ok(PROPOSAL_EVENT_TYPES.includes("payment_requested"));
    assert.ok(PROPOSAL_EVENT_TYPES.includes("payment_recorded"));
  });
});
