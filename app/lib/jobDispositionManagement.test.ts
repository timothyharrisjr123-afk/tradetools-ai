/**
 * R3I contractor disposition management — domain, API, and UI contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobDispositionManagement.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { composeJobActivityItems } from "./jobActivityComposer";
import {
  applyKnownDispositionToJobRecord,
  composeDispositionChangedActivity,
  dispositionBlockedWorkCopy,
  dispositionConfirmCopy,
  isActiveOperationalDisposition,
  mapDispositionMutationError,
  normalizeDispositionReason,
  resolveDispositionManagementActions,
  visibleDispositionLabel,
} from "./jobDispositionManagement";
import { resolveCanonicalJobActionEligibilityFromFacts } from "./jobLifecycleActionEligibility";
import {
  parseChangeJobDispositionResult,
  buildChangeJobDispositionPayload,
} from "./jobLifecyclePersistence";
import type { CanonicalJobStage } from "./jobLifecycleTypes";
import {
  applyBoardDispositionFilter,
  BOARD_DEFAULT_DISPOSITION_FILTER,
  isBoardFiltersActive,
  type BoardColumnKey,
} from "@/app/tools/roofing/saved/jobsBoardUtils";
import { isDbBoardJobEntry, DB_BOARD_JOB_ID_PREFIX } from "./jobBoardAdapter";
import type { RoofingEstimate } from "./estimateStore";

const ROOT = process.cwd();
const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const planned = {
  kind: "work" as const,
  status: "scheduled" as const,
};

describe("contractor disposition actions mirror RPC reactivation", () => {
  test("active exposes Hold / Lost / Close only", () => {
    const actions = resolveDispositionManagementActions("active");
    assert.deepEqual(
      actions.map((action) => action.target),
      ["on_hold", "lost", "closed"]
    );
    assert.equal(
      actions.some((action) => action.kind === "reactivate"),
      false
    );
  });

  test("on_hold / lost / closed expose Reactivate only", () => {
    for (const current of ["on_hold", "lost", "closed"] as const) {
      const actions = resolveDispositionManagementActions(current);
      assert.deepEqual(
        actions.map((action) => [action.kind, action.target]),
        [["reactivate", "active"]],
        current
      );
    }
  });

  test("legacy won/archived have no contractor menu", () => {
    assert.deepEqual(resolveDispositionManagementActions("won"), []);
    assert.deepEqual(resolveDispositionManagementActions("archived"), []);
    assert.deepEqual(resolveDispositionManagementActions(null), []);
  });
});

describe("paired stage + disposition presentation", () => {
  test("ACTIVE stays visually quiet", () => {
    assert.equal(visibleDispositionLabel("active"), null);
    assert.equal(dispositionBlockedWorkCopy("active"), null);
    assert.equal(isActiveOperationalDisposition("active"), true);
  });

  test("non-active labels and Reactivate copy", () => {
    assert.equal(visibleDispositionLabel("on_hold"), "On hold");
    assert.equal(
      dispositionBlockedWorkCopy("on_hold"),
      "Job is on hold. Reactivate to continue work."
    );
    assert.equal(visibleDispositionLabel("lost"), "Lost");
    assert.equal(
      dispositionBlockedWorkCopy("lost"),
      "Job is lost. Reactivate to continue work."
    );
    assert.equal(visibleDispositionLabel("closed"), "Closed");
    assert.equal(
      dispositionBlockedWorkCopy("closed"),
      "Job is closed. Reactivate to continue work."
    );
  });

  test("Close copy does not claim work was completed", () => {
    const copy = dispositionConfirmCopy({
      target: "closed",
      stage: "scheduled",
    });
    assert.equal(copy.closeDoesNotComplete, true);
    assert.match(copy.body, /does not mean work was completed/i);
    assert.match(copy.body, /Scheduled/);
  });
});

describe("lifecycle eligibility stays authoritative", () => {
  const stages: CanonicalJobStage[] = [
    "proposal",
    "approved",
    "scheduled",
    "production",
    "complete",
  ];

  for (const stage of stages) {
    test(`${stage} + non-active blocks operational CTAs`, () => {
      for (const disposition of ["on_hold", "lost", "closed"]) {
        const result = resolveCanonicalJobActionEligibilityFromFacts({
          stage,
          disposition,
          schedule: planned,
          approvalAcceptancePending: true,
        });
        assert.equal(result.canApproveJob, false, `${stage} ${disposition}`);
        assert.equal(result.canSchedule, false, `${stage} ${disposition}`);
        assert.equal(result.canReschedule, false, `${stage} ${disposition}`);
        assert.equal(result.canUnschedule, false, `${stage} ${disposition}`);
        assert.equal(result.canStartWork, false, `${stage} ${disposition}`);
        assert.equal(result.canCompleteJob, false, `${stage} ${disposition}`);
      }
    });
  }

  test("Scheduled + active + planned schedule restores Start", () => {
    const result = resolveCanonicalJobActionEligibilityFromFacts({
      stage: "scheduled",
      disposition: "active",
      schedule: planned,
    });
    assert.equal(result.canStartWork, true);
  });
});

describe("local known-disposition apply does not invent stage", () => {
  test("applies status only on matching job id", () => {
    const record = {
      id: JOB_ID,
      status: "active",
      stage: "scheduled",
      stage_entered_at: "2026-08-01T00:00:00.000Z",
    };
    const next = applyKnownDispositionToJobRecord(record, JOB_ID, "on_hold");
    assert.equal(next?.status, "on_hold");
    assert.equal(next?.stage, "scheduled");
    assert.equal(next?.stage_entered_at, record.stage_entered_at);
    assert.equal(
      applyKnownDispositionToJobRecord(record, JOB_B, "on_hold")?.status,
      "active"
    );
  });
});

describe("reason persistence is optional RPC string only", () => {
  test("empty reason omits; long reason is truncated", () => {
    assert.equal(normalizeDispositionReason("  "), null);
    assert.equal(normalizeDispositionReason("Need materials"), "Need materials");
    assert.equal(normalizeDispositionReason("x".repeat(300))?.length, 240);
  });

  test("disposition payload omits lifecycle clocks", () => {
    const payload = buildChangeJobDispositionPayload({
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      to_status: "on_hold",
      reason: "Need materials",
    });
    assert.equal("stage" in payload, false);
    assert.equal("stage_entered_at" in payload, false);
    assert.equal("production_started_at" in payload, false);
    assert.equal("completed_at" in payload, false);
    assert.equal(payload.reason, "Need materials");
  });
});

describe("RPC result parse", () => {
  test("success preserves stage_unchanged and to_status", () => {
    const parsed = parseChangeJobDispositionResult({
      ok: true,
      idempotent: false,
      job_id: JOB_ID,
      from_status: "active",
      to_status: "on_hold",
      stage_unchanged: "scheduled",
      stage_entered_at_unchanged: "2026-08-01T00:00:00.000Z",
      activity_id: JOB_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.to_status, "on_hold");
      assert.equal(parsed.stage_unchanged, "scheduled");
      assert.equal(parsed.idempotent, false);
    }
  });

  test("idempotent same-target is success", () => {
    const parsed = parseChangeJobDispositionResult({
      ok: true,
      idempotent: true,
      job_id: JOB_ID,
      from_status: "on_hold",
      to_status: "on_hold",
      stage_unchanged: "scheduled",
      stage_entered_at_unchanged: null,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.idempotent, true);
  });

  test("unsupported / missing job / membership codes", () => {
    assert.equal(
      parseChangeJobDispositionResult({ ok: false, code: "not_found" }).ok,
      false
    );
    assert.equal(
      parseChangeJobDispositionResult({ ok: false, code: "forbidden" }).ok,
      false
    );
    assert.equal(
      parseChangeJobDispositionResult({
        ok: false,
        code: "illegal_disposition_target",
      }).ok,
      false
    );
    assert.match(mapDispositionMutationError("unauthorized"), /Sign in/);
    assert.match(mapDispositionMutationError("forbidden"), /access/);
    assert.match(mapDispositionMutationError("not_found"), /found/);
    assert.match(
      mapDispositionMutationError("illegal_disposition_target"),
      /not allowed/
    );
  });
});

describe("Activity composer uses dedicated disposition events", () => {
  test("one event per disposition_changed; human labels", () => {
    const items = composeJobActivityItems({
      jobActivityEvents: [
        {
          id: "evt-hold",
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          event_type: "disposition_changed",
          occurred_at: "2026-08-26T12:00:00.000Z",
          payload_json: {
            from_status: "active",
            to_status: "on_hold",
            reason: "Waiting on insurance",
            stage_unchanged: "scheduled",
            reopened: false,
          },
        },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.label, "Job put on hold");
    assert.equal(items[0]?.note, "Waiting on insurance");
  });

  test("reactivate / lost / closed labels", () => {
    assert.equal(
      composeDispositionChangedActivity({
        to_status: "active",
        reopened: true,
      })?.label,
      "Job reactivated"
    );
    assert.equal(
      composeDispositionChangedActivity({ to_status: "lost" })?.label,
      "Job marked lost"
    );
    assert.equal(
      composeDispositionChangedActivity({ to_status: "closed" })?.label,
      "Job closed"
    );
  });
});

describe("API ownership", () => {
  const route = read("app/api/jobs/change-disposition/route.ts");

  test("authenticated wrapper around change_job_disposition_v1", () => {
    assert.match(route, /changeJobDispositionViaRpc/);
    assert.match(route, /getUserCompanyId/);
    assert.match(route, /from "@\/app\/lib\/uuid"/);
    assert.doesNotMatch(route, /from "@\/app\/lib\/jobStore"/);
    assert.match(route, /auth\.getUser/);
    assert.match(route, /body\?\.jobId/);
    assert.match(route, /body\?\.toStatus/);
    assert.doesNotMatch(route, /body\?\.companyId/);
    assert.doesNotMatch(route, /stage_entered_at/);
    assert.doesNotMatch(route, /production_started_at/);
    assert.doesNotMatch(route, /completed_at/);
  });
});

describe("Job Card UI contract", () => {
  const header = read("app/tools/roofing/jobCard/JobCardHeader.tsx");
  const control = read(
    "app/tools/roofing/jobCard/JobCardDispositionControl.tsx"
  );
  const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
  const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");

  test("Job actions menu + dialog + refresh (no optimistic fake status)", () => {
    assert.match(client, /JobCardDispositionControl/);
    assert.match(client, /refreshHydratedJobRecord/);
    assert.match(client, /applyKnownDispositionToJobRecord/);
    assert.doesNotMatch(client, /setHydratedJobRecord\(\{[\s\S]*status:/);
    assert.match(control, /aria-haspopup="menu"/);
    assert.match(control, /role="dialog"/);
    assert.match(control, /Escape/);
    assert.match(control, /className="fixed z-\[60\]/);
    assert.match(control, /first\?\.focus\(\)/);
    assert.doesNotMatch(control, /menuOpen && menuBox \?/);
    assert.match(control, /\/api\/jobs\/change-disposition/);
    assert.match(control, /data-jobcard-disposition-action=\{action\.kind\}/);
    assert.match(header, /data-jobcard-disposition/);
    assert.match(header, /dispositionNote/);
    assert.doesNotMatch(overview, /Disposition/);
  });
});

describe("Board disposition visibility + filter", () => {
  const card = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
  const saved = read("app/tools/roofing/saved/SavedClient.tsx");

  test("cards show non-active badge without new lanes", () => {
    assert.match(card, /data-board-disposition/);
    assert.match(saved, /applyBoardDispositionFilter/);
    assert.doesNotMatch(saved, /Hold lane/);
    assert.doesNotMatch(
      read("app/tools/roofing/saved/jobsBoardUtils.ts"),
      /key: "on_hold"/
    );
  });

  test("filter operates on canonical DB jobs and fences legacy", () => {
    const dbJob = {
      id: `${DB_BOARD_JOB_ID_PREFIX}${JOB_ID}`,
      status: "scheduled",
      jobDisposition: "on_hold",
      jobId: JOB_ID,
    } as unknown as RoofingEstimate;
    const legacy = {
      id: "legacy-1",
      status: "scheduled",
    } as unknown as RoofingEstimate;
    assert.equal(isDbBoardJobEntry(dbJob), true);
    assert.equal(isDbBoardJobEntry(legacy), false);
    const held = applyBoardDispositionFilter([dbJob, legacy], "on_hold");
    assert.deepEqual(
      held.map((job) => job.id),
      [`${DB_BOARD_JOB_ID_PREFIX}${JOB_ID}`]
    );
    const all = applyBoardDispositionFilter([dbJob, legacy], "all");
    assert.equal(all.length, 2);
    assert.equal(
      isBoardFiltersActive({
        sortKey: "last_updated",
        visibleColumnKeys: [
          "estimate",
          "leads",
          "approved",
          "scheduled",
          "in_progress",
          "paid",
        ] as BoardColumnKey[],
        updatedOnOrAfter: null,
        dispositionFilter: BOARD_DEFAULT_DISPOSITION_FILTER,
      }),
      false
    );
    assert.equal(
      isBoardFiltersActive({
        sortKey: "last_updated",
        visibleColumnKeys: [
          "estimate",
          "leads",
          "approved",
          "scheduled",
          "in_progress",
          "paid",
        ] as BoardColumnKey[],
        updatedOnOrAfter: null,
        dispositionFilter: "on_hold",
      }),
      true
    );
  });
});
