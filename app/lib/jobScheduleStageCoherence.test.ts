/**
 * A4 schedule/stage coherence + Board schedule-read fail-closed contracts.
 *
 * Run: npx tsx --test app/lib/jobScheduleStageCoherence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  classifyJobStageLifecycle,
  expectedPlannedScheduleCount,
  plannedScheduleIntegrityLabel,
  plannedScheduleReadIsAuthoritative,
  resolvePlannedScheduleCoherence,
} from "./jobScheduleStageCoherence";
import { resolveCanonicalJobActionEligibilityFromFacts } from "./jobLifecycleActionEligibility";
import { resolveBoardGuardedMovement } from "./boardGuardedMovement";

const ROOT = process.cwd();
const MIGRATION = join(
  ROOT,
  "supabase/migrations/20260910214259_schedule_stage_convergence.sql"
);
const REMEDIATION = join(
  ROOT,
  "scripts/ops/20260910_production_schedule_stage_orphan_remediation.sql"
);

describe("stage lifecycle classification", () => {
  test("classifies modern / legacy / invalid", () => {
    assert.equal(classifyJobStageLifecycle("scheduled"), "MODERN_OPERATIONAL");
    assert.equal(
      classifyJobStageLifecycle("measurement"),
      "LEGACY_READABLE_NONOPERATIONAL"
    );
    assert.equal(
      classifyJobStageLifecycle("estimating"),
      "LEGACY_READABLE_NONOPERATIONAL"
    );
    assert.equal(classifyJobStageLifecycle("bogus"), "INVALID");
  });

  test("expected planned counts match A4 cardinality", () => {
    assert.equal(expectedPlannedScheduleCount("intake"), 0);
    assert.equal(expectedPlannedScheduleCount("approved"), 0);
    assert.equal(expectedPlannedScheduleCount("scheduled"), 1);
    assert.equal(expectedPlannedScheduleCount("production"), 1);
    assert.equal(expectedPlannedScheduleCount("complete"), 1);
    assert.equal(expectedPlannedScheduleCount("measurement"), 0);
    assert.equal(expectedPlannedScheduleCount("estimating"), 0);
    assert.equal(expectedPlannedScheduleCount("nope"), null);
  });
});

describe("Board schedule read fail-closed", () => {
  test("LOADING/ERROR are not authoritative", () => {
    assert.equal(plannedScheduleReadIsAuthoritative("loading"), false);
    assert.equal(plannedScheduleReadIsAuthoritative("error"), false);
    assert.equal(plannedScheduleReadIsAuthoritative("ready"), true);
  });

  test("SUCCESS empty is coherent for Approved and distinct from unread", () => {
    assert.equal(
      resolvePlannedScheduleCoherence({
        stage: "approved",
        plannedScheduleCount: 0,
        readStatus: "ready",
      }),
      "coherent"
    );
    assert.equal(
      resolvePlannedScheduleCoherence({
        stage: "scheduled",
        plannedScheduleCount: 0,
        readStatus: "error",
      }),
      "unknown"
    );
    assert.match(
      plannedScheduleIntegrityLabel("unknown") ?? "",
      /unavailable/i
    );
  });

  test("orphan Scheduled is missing_planned_schedule when ready", () => {
    assert.equal(
      resolvePlannedScheduleCoherence({
        stage: "scheduled",
        plannedScheduleCount: 0,
        readStatus: "ready",
      }),
      "missing_planned_schedule"
    );
  });

  test("eligibility ignores stale map while LOADING/ERROR", () => {
    const stalePlanned = { kind: "work" as const, status: "scheduled" as const };
    for (const status of ["loading", "error"] as const) {
      const result = resolveCanonicalJobActionEligibilityFromFacts({
        stage: "scheduled",
        disposition: "active",
        schedule: stalePlanned,
        scheduleReadStatus: status,
      });
      assert.equal(result.canStartWork, false);
      assert.equal(result.canReschedule, false);
      assert.equal(result.canUnschedule, false);
      assert.equal(result.canSchedule, false);
    }
  });

  test("ready + planned unlocks Start; ready empty does not", () => {
    const planned = { kind: "work" as const, status: "scheduled" as const };
    assert.equal(
      resolveCanonicalJobActionEligibilityFromFacts({
        stage: "scheduled",
        disposition: "active",
        schedule: planned,
        scheduleReadStatus: "ready",
      }).canStartWork,
      true
    );
    assert.equal(
      resolveCanonicalJobActionEligibilityFromFacts({
        stage: "scheduled",
        disposition: "active",
        schedule: null,
        scheduleReadStatus: "ready",
      }).canStartWork,
      false
    );
  });

  test("movement fails closed when schedule read is unavailable", () => {
    const blocked = resolveBoardGuardedMovement({
      fromStage: "scheduled",
      toStage: "production",
      dispositionActive: true,
      canApproveJob: false,
      hasActivePlannedSchedule: true,
      scheduleReadStatus: "loading",
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.reason, "schedule_unavailable");
  });
});

describe("A4 SQL artifacts", () => {
  test("migration uses deferred constraint triggers and legacy-readable zero planned", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    assert.match(sql, /deferrable initially deferred/i);
    assert.match(sql, /job_stage_planned_schedule_assert_v1/);
    assert.match(sql, /'measurement', 'estimating', 'archived'/);
    assert.match(sql, /cancelled job_schedules rows are immutable/i);
    assert.match(sql, /job_schedules_job_company_fkey/);
    assert.match(sql, /revoke all on function public\.transition_job_stage_v1/i);
    assert.doesNotMatch(
      sql,
      /when j\.stage in \('intake', 'proposal', 'approved'\) then coalesce\(planned\.planned_count, 0\) <> 0\s+when j\.stage in \('scheduled'/
    );
  });

  test("remediation is bounded to known orphan intake rewrite", () => {
    const sql = readFileSync(REMEDIATION, "utf8");
    assert.match(sql, /366afed3-2eee-4558-8630-63e4f0dda99e/);
    assert.match(sql, /stage = 'intake'/);
    assert.match(sql, /a4_known_orphan_has_schedule_truth/);
    assert.match(sql, /a4_remediation_must_not_fabricate_activity/);
  });
});
