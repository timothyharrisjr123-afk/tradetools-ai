/**
 * Run: npx tsx --test app/lib/proposalContractorLifecycle.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  deriveContractorProposalLifecycle,
  formatContractorProposalLifecycleStatusLabel,
  isContractorProposalEditingAllowed,
  isMutableDraftDirtyAfterSentFreeze,
} from "./proposalContractorLifecycle";

const SENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SIGNED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FROZEN_AT = "2026-07-22T16:31:00.000Z";

describe("proposalContractorLifecycle", () => {
  test("no sent pointer → Draft, ignoring header status", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: null,
      signedVersionId: null,
      draftUpdatedAt: "2026-08-01T12:00:00.000Z",
      headerStatus: "sent",
    });
    assert.equal(derived.kind, "draft");
    assert.equal(derived.statusLabel, "Draft");
    assert.equal(derived.editingAllowed, true);
    assert.equal(derived.hasLatestSentVersion, false);
  });

  test("sent + clean draft (equal timestamps) → Sent", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      signedVersionId: null,
      draftUpdatedAt: FROZEN_AT,
      latestSentFrozenAt: FROZEN_AT,
      headerStatus: "draft",
    });
    assert.equal(derived.kind, "sent");
    assert.equal(derived.statusLabel, "Sent");
    assert.equal(derived.isDraftDirtyAfterLatestSent, false);
  });

  test("sent + draft updated_at after frozen_at → Revision in progress", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      signedVersionId: null,
      draftUpdatedAt: "2026-07-22T17:00:00.000Z",
      latestSentFrozenAt: FROZEN_AT,
      headerStatus: "draft",
    });
    assert.equal(derived.kind, "revision_in_progress");
    assert.equal(derived.statusLabel, "Revision in progress");
    assert.equal(derived.isDraftDirtyAfterLatestSent, true);
  });

  test("header status=draft does not override true Sent state", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      signedVersionId: null,
      draftUpdatedAt: FROZEN_AT,
      latestSentFrozenAt: FROZEN_AT,
      headerStatus: "draft",
    });
    assert.equal(derived.kind, "sent");
    assert.notEqual(derived.statusLabel.toLowerCase(), "draft");
  });

  test("multiple sent uses latest_sent pointer, not header status", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      signedVersionId: null,
      draftUpdatedAt: "2026-07-21T12:00:00.000Z",
      latestSentFrozenAt: FROZEN_AT,
      headerStatus: "revised",
    });
    assert.equal(derived.hasLatestSentVersion, true);
    assert.equal(derived.kind, "sent");
    assert.equal(derived.isDraftDirtyAfterLatestSent, false);
  });

  test("signed pointer blocks editing and does not expose Signed as a product badge", () => {
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      signedVersionId: SIGNED_ID,
      draftUpdatedAt: "2026-08-01T12:00:00.000Z",
      latestSentFrozenAt: FROZEN_AT,
      headerStatus: "signed",
    });
    assert.equal(derived.kind, "signed");
    assert.equal(derived.editingAllowed, false);
    assert.equal(isContractorProposalEditingAllowed(derived.kind), false);
    assert.equal(derived.statusLabel, "Sent");
    assert.notEqual(derived.statusLabel, "Signed");
  });

  test("same-transaction freeze equality is not dirty", () => {
    assert.equal(
      isMutableDraftDirtyAfterSentFreeze({
        draftUpdatedAt: FROZEN_AT,
        latestSentFrozenAt: FROZEN_AT,
      }),
      false
    );
  });

  test("missing frozen_at does not invent revision-in-progress", () => {
    assert.equal(
      isMutableDraftDirtyAfterSentFreeze({
        draftUpdatedAt: "2026-08-01T12:00:00.000Z",
        latestSentFrozenAt: null,
      }),
      false
    );
    const derived = deriveContractorProposalLifecycle({
      latestSentVersionId: SENT_ID,
      draftUpdatedAt: "2026-08-01T12:00:00.000Z",
      latestSentFrozenAt: null,
    });
    assert.equal(derived.kind, "sent");
  });

  test("contractor labels stay in the allowed vocabulary", () => {
    assert.equal(formatContractorProposalLifecycleStatusLabel("draft"), "Draft");
    assert.equal(formatContractorProposalLifecycleStatusLabel("sent"), "Sent");
    assert.equal(
      formatContractorProposalLifecycleStatusLabel("revision_in_progress"),
      "Revision in progress"
    );
    assert.equal(formatContractorProposalLifecycleStatusLabel("signed"), "Sent");
  });

  test("does not persist or write lifecycle/status/events", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/lib/proposalContractorLifecycle.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /\.update\(/);
    assert.doesNotMatch(source, /proposal_events/);
    assert.doesNotMatch(source, /event_type.*sent|event_type.*revised/);
    assert.doesNotMatch(source, /\.from\("proposals"\)/);
    assert.doesNotMatch(source, /persist_proposal_send_freeze/);
  });
});
