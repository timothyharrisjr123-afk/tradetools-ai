/**
 * Stage AB — shared canonical lifecycle action eligibility.
 *
 * Run:
 * npx tsx --test app/lib/jobLifecycleActionEligibility.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { mapDbJobToBoardEstimate } from "./jobBoardAdapter";
import type { RoofingEstimate } from "./estimateStore";
import {
  buildCanonicalJobActionEligibilityInput,
  hasActivePlannedWorkSchedule,
  isActiveJobDisposition,
  legacyEstimateBlocksCanonicalLifecycleActions,
  resolveCanonicalJobActionEligibility,
  resolveCanonicalJobActionEligibilityFromFacts,
  resolveDbBoardJobActionEligibility,
} from "./jobLifecycleActionEligibility";
import type { JobSchedule } from "./jobScheduleTypes";
import type { JobSummary } from "./jobTypes";

const ROOT = process.cwd();
const ROOFING_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
  "utf8"
);
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const NEXT_ACTION = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/JobCardNextActionPanel.tsx"),
  "utf8"
);
const SCHEDULE_SECTION = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/JobCardScheduleSection.tsx"),
  "utf8"
);

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";

const plannedSchedule: Pick<JobSchedule, "kind" | "status"> = {
  kind: "work",
  status: "scheduled",
};

function eligibility(
  stage: string,
  disposition: string,
  schedule: Pick<JobSchedule, "kind" | "status"> | null = null,
  approvalAcceptancePending = false
) {
  return resolveCanonicalJobActionEligibilityFromFacts({
    stage,
    disposition,
    schedule,
    approvalAcceptancePending,
  });
}

describe("isActiveJobDisposition", () => {
  test("active is active", () => {
    assert.equal(isActiveJobDisposition("active"), true);
    assert.equal(isActiveJobDisposition(null), true);
  });

  test("non-active dispositions are blocked", () => {
    assert.equal(isActiveJobDisposition("on_hold"), false);
    assert.equal(isActiveJobDisposition("lost"), false);
    assert.equal(isActiveJobDisposition("closed"), false);
  });
});

describe("resolveCanonicalJobActionEligibility — Approve", () => {
  test("Proposal + active + accepted → allowed", () => {
    const result = eligibility("proposal", "active", null, true);
    assert.equal(result.canApproveJob, true);
  });

  test("Proposal + on_hold/lost/closed → blocked", () => {
    for (const disposition of ["on_hold", "lost", "closed"]) {
      const result = eligibility("proposal", disposition, null, true);
      assert.equal(result.canApproveJob, false, disposition);
    }
  });

  test("wrong stage blocks Approve", () => {
    assert.equal(eligibility("approved", "active", null, true).canApproveJob, false);
    assert.equal(eligibility("proposal", "active", null, false).canApproveJob, false);
  });
});

describe("resolveCanonicalJobActionEligibility — Schedule", () => {
  test("Approved + active + no schedule → allowed", () => {
    assert.equal(eligibility("approved", "active", null).canSchedule, true);
  });

  test("Approved + non-active → blocked", () => {
    for (const disposition of ["on_hold", "lost", "closed"]) {
      assert.equal(
        eligibility("approved", disposition, null).canSchedule,
        false,
        disposition
      );
    }
  });

  test("Approved + active + existing schedule → blocked", () => {
    assert.equal(
      eligibility("approved", "active", plannedSchedule).canSchedule,
      false
    );
  });

  test("wrong stage blocks Schedule", () => {
    assert.equal(eligibility("scheduled", "active", null).canSchedule, false);
  });
});

describe("resolveCanonicalJobActionEligibility — Start", () => {
  test("Scheduled + active + valid schedule → allowed", () => {
    assert.equal(
      eligibility("scheduled", "active", plannedSchedule).canStartWork,
      true
    );
  });

  test("Scheduled + non-active → blocked", () => {
    for (const disposition of ["on_hold", "lost", "closed"]) {
      assert.equal(
        eligibility("scheduled", disposition, plannedSchedule).canStartWork,
        false,
        disposition
      );
    }
  });

  test("missing schedule blocks Start", () => {
    assert.equal(eligibility("scheduled", "active", null).canStartWork, false);
  });

  test("wrong stage blocks Start", () => {
    assert.equal(
      eligibility("production", "active", plannedSchedule).canStartWork,
      false
    );
  });
});

describe("resolveCanonicalJobActionEligibility — Complete", () => {
  test("Production + active + valid schedule → allowed", () => {
    assert.equal(
      eligibility("production", "active", plannedSchedule).canCompleteJob,
      true
    );
  });

  test("Production + non-active → blocked", () => {
    for (const disposition of ["on_hold", "lost", "closed"]) {
      assert.equal(
        eligibility("production", disposition, plannedSchedule).canCompleteJob,
        false,
        disposition
      );
    }
  });

  test("missing schedule blocks Complete", () => {
    assert.equal(eligibility("production", "active", null).canCompleteJob, false);
  });

  test("wrong stage blocks Complete", () => {
    assert.equal(
      eligibility("scheduled", "active", plannedSchedule).canCompleteJob,
      false
    );
  });
});

describe("resolveCanonicalJobActionEligibility — Reschedule / Unschedule", () => {
  test("Scheduled + active + schedule → allowed", () => {
    const result = eligibility("scheduled", "active", plannedSchedule);
    assert.equal(result.canReschedule, true);
    assert.equal(result.canUnschedule, true);
  });

  test("non-active blocks reschedule/unschedule", () => {
    const result = eligibility("scheduled", "on_hold", plannedSchedule);
    assert.equal(result.canReschedule, false);
    assert.equal(result.canUnschedule, false);
  });
});

describe("Board alias safety", () => {
  test("eligibility ignores paid/in_progress alias strings as stage input", () => {
    const input = buildCanonicalJobActionEligibilityInput({
      stage: "paid",
      disposition: "active",
      schedule: plannedSchedule,
    });
    assert.equal(input.stage, "intake");
    assert.equal(
      resolveCanonicalJobActionEligibility(input).canCompleteJob,
      false
    );
  });

  test("complete stage does not depend on paid alias", () => {
    assert.equal(
      eligibility("complete", "active", plannedSchedule).canCompleteJob,
      false
    );
    assert.equal(eligibility("production", "active", plannedSchedule).canCompleteJob, true);
  });
});

describe("legacy Board fence", () => {
  test("legacy paid status cannot produce canonical Complete eligibility", () => {
    const legacyPaid = {
      id: "legacy-1",
      createdAt: new Date().toISOString(),
      customerName: "Legacy",
      address: "",
      zip: "12345",
      roofAreaSqFt: 1000,
      selectedTier: "Core" as const,
      suggestedPrice: 1000,
      status: "paid" as const,
    } satisfies RoofingEstimate;
    assert.equal(legacyEstimateBlocksCanonicalLifecycleActions(legacyPaid), true);
    assert.equal(
      resolveDbBoardJobActionEligibility(legacyPaid, plannedSchedule),
      null
    );
  });

  test("legacy Completed string cannot produce canonical Complete eligibility", () => {
    const legacyCompleted = {
      id: "legacy-2",
      createdAt: new Date().toISOString(),
      customerName: "Legacy",
      address: "",
      zip: "12345",
      roofAreaSqFt: 1000,
      selectedTier: "Core" as const,
      suggestedPrice: 1000,
      status: "completed",
    } as unknown as RoofingEstimate;
    assert.equal(
      resolveDbBoardJobActionEligibility(legacyCompleted, plannedSchedule),
      null
    );
  });

  test("legacy in_progress cannot produce canonical Start eligibility", () => {
    const legacy = {
      id: "legacy-3",
      createdAt: new Date().toISOString(),
      customerName: "Legacy",
      address: "",
      zip: "12345",
      roofAreaSqFt: 1000,
      selectedTier: "Core" as const,
      suggestedPrice: 1000,
      status: "in_progress" as const,
    } satisfies RoofingEstimate;
    const actions = resolveDbBoardJobActionEligibility(legacy, plannedSchedule);
    assert.equal(actions, null);
  });

  test("DB board rows use canonicalJobStage not estimate status alias", () => {
    const job: JobSummary = {
      id: JOB_ID,
      company_id: COMPANY_ID,
      customer_id: null,
      job_name: "Test",
      stage: "production",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const row = mapDbJobToBoardEstimate(job);
    assert.equal(row.status, "in_progress");
    assert.equal(
      (row as { canonicalJobStage?: string }).canonicalJobStage,
      "production"
    );
    const actions = resolveDbBoardJobActionEligibility(row, plannedSchedule);
    assert.equal(actions?.canCompleteJob, true);
    assert.equal(actions?.canStartWork, false);
  });
});

describe("hasActivePlannedWorkSchedule", () => {
  test("requires work + scheduled", () => {
    assert.equal(hasActivePlannedWorkSchedule(plannedSchedule), true);
    assert.equal(
      hasActivePlannedWorkSchedule({ kind: "work", status: "cancelled" }),
      false
    );
    assert.equal(hasActivePlannedWorkSchedule(null), false);
  });
});

describe("Stage AB surface contracts", () => {
  test("Job Card uses shared eligibility for schedule lifecycle actions", () => {
    assert.match(ROOFING_CLIENT, /resolveCanonicalJobActionEligibilityFromFacts/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canSchedule/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canStartWork/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canCompleteJob/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canReschedule/);
    assert.match(ROOFING_CLIENT, /jobCardActionEligibility\.canUnschedule/);
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /onStartWork=\{\s*\r?\n\s*canonicalJobStage === "scheduled"/
    );
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /onCompleteJob=\{\s*\r?\n\s*canonicalJobStage === "production"/
    );
  });

  test("Job Card Approve uses shared eligibility", () => {
    assert.match(NEXT_ACTION, /resolveCanonicalJobActionEligibilityFromFacts/);
    assert.match(NEXT_ACTION, /approveLifecycleEligible/);
    assert.match(NEXT_ACTION, /canonicalJobStage/);
    assert.match(NEXT_ACTION, /jobDisposition/);
  });

  test("Board DB jobs use shared eligibility helper", () => {
    assert.match(SAVED_CLIENT, /resolveDbBoardJobActionEligibility/);
    assert.match(SAVED_CLIENT, /canonicalActions\?\.canSchedule/);
    assert.match(SAVED_CLIENT, /canonicalActions\?\.canStartWork/);
    assert.match(SAVED_CLIENT, /canonicalActions\?\.canCompleteJob/);
    assert.doesNotMatch(
      SAVED_CLIENT,
      /showScheduleAction: columnKey === "approved"/
    );
  });

  test("Schedule section still supports handler-gated reschedule for harnesses", () => {
    assert.match(SCHEDULE_SECTION, /onReschedule && onUnschedule/);
    assert.match(SCHEDULE_SECTION, /onChangeSchedule/);
  });

  test("Board adapter exposes canonicalJobStage on DB rows", () => {
    const adapter = readFileSync(join(ROOT, "app/lib/jobBoardAdapter.ts"), "utf8");
    assert.match(adapter, /canonicalJobStage: resolveCanonicalJobStage\(job\)/);
  });
});

describe("Board ↔ Job Card parity inputs", () => {
  test("same facts yield same eligibility on Job Card and Board paths", () => {
    const job: JobSummary = {
      id: JOB_ID,
      company_id: COMPANY_ID,
      customer_id: null,
      job_name: "Scheduled hold",
      stage: "scheduled",
      status: "on_hold",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const boardRow = mapDbJobToBoardEstimate(job);
    const board = resolveDbBoardJobActionEligibility(boardRow, plannedSchedule);
    const card = resolveCanonicalJobActionEligibilityFromFacts({
      stage: job.stage,
      disposition: job.status,
      schedule: plannedSchedule,
    });
    assert.deepEqual(board, card);
    assert.equal(board?.canStartWork, false);
    assert.equal(board?.canSchedule, false);
  });
});
