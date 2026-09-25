/**
 * Job Board card presentation — lane-specific fact priority.
 * Run: npx tsx --test app/tools/roofing/saved/jobsBoardCardPresentation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildJobsBoardCardPresentation } from "./jobsBoardCardPresentation";
import type { BoardColumnKey } from "./jobsBoardUtils";

function present(
  columnKey: BoardColumnKey,
  overrides: Partial<Parameters<typeof buildJobsBoardCardPresentation>[0]> = {}
) {
  return buildJobsBoardCardPresentation({
    columnKey,
    assigneeLabel: "Unassigned",
    scheduleLabel: null,
    productionStartedLabel: null,
    completedAtLabel: null,
    dispositionLabel: null,
    ...overrides,
  });
}

describe("Job Board card presentation", () => {
  test("Scheduled leads with the planned window and keeps responsibility visible", () => {
    const p = present("scheduled", { scheduleLabel: "Aug 24–25 · All day" });
    assert.deepEqual(p.stateFact, { tone: "planned", text: "Aug 24–25 · All day" });
    assert.equal(p.supportingFact, null);
    assert.equal(p.showOwner, true);
    assert.equal(p.showProposalPresence, false);
  });

  test("Scheduled without a trusted schedule read invents no date", () => {
    assert.equal(present("scheduled").stateFact, null);
  });

  test("Production leads with actual start; planned window is supporting", () => {
    const p = present("in_progress", {
      scheduleLabel: "Planned · Aug 27–28 · All day",
      productionStartedLabel: "Aug 26, 9:21 AM CDT",
    });
    assert.deepEqual(p.stateFact, { tone: "active", text: "Started Aug 26, 9:21 AM CDT" });
    assert.equal(p.supportingFact, "Planned Aug 27–28 · All day");
    assert.equal(p.showOwner, true);
  });

  test("Production on hold is not presented as active work", () => {
    const p = present("in_progress", {
      productionStartedLabel: "Aug 17, 7:40 PM CDT",
      dispositionLabel: "On hold",
    });
    assert.equal(p.stateFact?.tone, "paused");
  });

  test("Complete (legacy lane key `paid`) leads with completion and demotes active-work facts", () => {
    const p = present("paid", {
      scheduleLabel: "Planned · Aug 19 · All day",
      productionStartedLabel: "Aug 17, 7:40 PM CDT",
      completedAtLabel: "Aug 23, 1:31 PM CDT",
    });
    assert.deepEqual(p.stateFact, { tone: "complete", text: "Completed Aug 23, 1:31 PM CDT" });
    assert.equal(p.precedingFact, "Started Aug 17, 7:40 PM CDT", "actual start precedes completion");
    assert.equal(p.supportingFact, null, "planned window is not restored on Complete");
    assert.equal(p.showTimeInStage, false);
    assert.equal(p.showOwner, false, "unassigned lead is not a closeout fact");
    assert.equal(present("paid", { assigneeLabel: "Dana Ruiz" }).showOwner, true);
  });

  test("Complete without a completion timestamp still reads finished", () => {
    assert.equal(present("paid").stateFact?.text, "Work complete");
    assert.equal(present("paid").precedingFact, null, "no invented start");
  });

  test("Only Complete carries a preceding fact", () => {
    for (const lane of ["estimate", "leads", "approved", "scheduled", "in_progress"] as const) {
      const p = present(lane, {
        scheduleLabel: "Aug 24–25 · All day",
        productionStartedLabel: "Aug 26, 9:21 AM CDT",
      });
      assert.equal(p.precedingFact, null, lane);
    }
  });

  test("Intake and Proposal show proposal presence, not future-state facts", () => {
    for (const lane of ["estimate", "leads"] as const) {
      const p = present(lane);
      assert.equal(p.stateFact, null, lane);
      assert.equal(p.showProposalPresence, true, lane);
      assert.equal(p.showOwner, false, lane);
      assert.equal(present(lane, { assigneeLabel: "Dana Ruiz" }).showOwner, true, lane);
    }
  });

  test("Approved keeps responsibility and no generic proposal presence", () => {
    const p = present("approved");
    assert.equal(p.stateFact, null);
    assert.equal(p.showOwner, true);
    assert.equal(p.showProposalPresence, false);
  });
});
