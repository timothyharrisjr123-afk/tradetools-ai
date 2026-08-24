/**
 * R3H-PERF-1 — Job Card secondary effect settlement contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobCardPerfBoundary.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  beginJobCardScheduleSettlement,
  createIdleJobCardScheduleSettlement,
  isJobCardScheduleSettledForJob,
  preserveOrBeginJobCardScheduleSettlement,
  settleJobCardScheduleError,
  settleJobCardScheduleNotApplicable,
  settleJobCardScheduleSuccess,
  shouldEnableJobCardSecondaryEffects,
} from "./jobCardPerfBoundary";

const ROOT = process.cwd();
const ROOFING_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
  "utf8"
);
const BOUNDARY = readFileSync(
  join(ROOT, "app/lib/jobCardPerfBoundary.ts"),
  "utf8"
);
const SCHEDULE_SECTION = readFileSync(
  join(ROOT, "app/tools/roofing/jobCard/JobCardScheduleSection.tsx"),
  "utf8"
);

const JOB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const JOB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";

describe("jobCardPerfBoundary settlement ownership", () => {
  test("A: secondary effects do NOT enable from a timer; no defer-ms constant remains", () => {
    assert.doesNotMatch(BOUNDARY, /JOB_CARD_SECONDARY_DEFER_MS/);
    assert.doesNotMatch(BOUNDARY, /2500/);
    assert.doesNotMatch(ROOFING_CLIENT, /JOB_CARD_SECONDARY_DEFER_MS/);
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /setTimeout\(\s*\(\)\s*=>\s*setJobCardSecondaryEnabled\(true\)/
    );
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: { status: "loading", jobId: JOB_A },
        secondaryEnabled: false,
      }),
      false
    );
  });

  test("B: Job ready + schedule still loading → secondary remains deferred", () => {
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: beginJobCardScheduleSettlement(JOB_A),
        secondaryEnabled: false,
      }),
      false
    );
  });

  test("C: Job ready + schedule success settled → secondary enables", () => {
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: settleJobCardScheduleSuccess(JOB_A),
        secondaryEnabled: false,
      }),
      true
    );
  });

  test("D: Job ready + schedule error settled → secondary enables", () => {
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: settleJobCardScheduleError(JOB_A),
        secondaryEnabled: false,
      }),
      true
    );
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: settleJobCardScheduleNotApplicable(JOB_A),
        secondaryEnabled: false,
      }),
      true
    );
  });

  test("E: schedule error settlement does not replace Complete planned-schedule guard", () => {
    assert.match(
      SCHEDULE_SECTION,
      /canComplete\s*=\s*\r?\n\s*isProduction && Boolean\(planned\)/
    );
    assert.match(
      ROOFING_CLIENT,
      /onCompleteJob=\{\s*\r?\n\s*canonicalJobStage === "production"/
    );
    assert.match(
      ROOFING_CLIENT,
      /\(hydratedJobRecord\?\.status \?\? "active"\) === "active"/
    );
    assert.equal(
      isJobCardScheduleSettledForJob(settleJobCardScheduleError(JOB_A), JOB_A),
      true
    );
  });

  test("F: Job A settlement cannot leak to Job B", () => {
    const settledA = settleJobCardScheduleSuccess(JOB_A);
    assert.equal(isJobCardScheduleSettledForJob(settledA, JOB_B), false);
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_B,
        scheduleSettlement: settledA,
        secondaryEnabled: false,
      }),
      false
    );
    assert.deepEqual(
      preserveOrBeginJobCardScheduleSettlement(settledA, JOB_B),
      { status: "loading", jobId: JOB_B }
    );
  });

  test("G: no-seed / client-hydrate path still reaches settlement (loading→ready)", () => {
    let settlement = createIdleJobCardScheduleSettlement();
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "loading",
        currentJobId: JOB_A,
        scheduleSettlement: settlement,
        secondaryEnabled: false,
      }),
      false
    );
    settlement = beginJobCardScheduleSettlement(JOB_A);
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: settlement,
        secondaryEnabled: false,
      }),
      false
    );
    settlement = settleJobCardScheduleSuccess(JOB_A);
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: JOB_A,
        scheduleSettlement: settlement,
        secondaryEnabled: false,
      }),
      true
    );
  });

  test("H: non-job-card behavior unchanged (immediate secondary)", () => {
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "packet",
        jobHydrateStatus: "idle",
        currentJobId: null,
        scheduleSettlement: { status: "idle" },
        secondaryEnabled: false,
      }),
      true
    );
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "manual",
        jobHydrateStatus: "idle",
        currentJobId: null,
        scheduleSettlement: { status: "idle" },
        secondaryEnabled: false,
      }),
      true
    );
  });

  test("I: RoofingClient wires settlement ownership; timer ownership removed", () => {
    assert.match(ROOFING_CLIENT, /scheduleSettlement/);
    assert.match(ROOFING_CLIENT, /settleJobCardScheduleSuccess/);
    assert.match(ROOFING_CLIENT, /settleJobCardScheduleError/);
    assert.match(
      ROOFING_CLIENT,
      /preserveOrBeginJobCardScheduleSettlement|beginJobCardScheduleSettlement/
    );
    assert.match(ROOFING_CLIENT, /shouldEnableJobCardSecondaryEffects/);
    assert.doesNotMatch(ROOFING_CLIENT, /JOB_CARD_SECONDARY_DEFER_MS/);
    assert.match(
      ROOFING_CLIENT,
      /secondaryEffectsEnabled=\{jobCardSecondaryEffectsEnabled\}/
    );
  });

  test("background retry preserves settled error/ready for same job", () => {
    const err = settleJobCardScheduleError(JOB_A);
    assert.deepEqual(
      preserveOrBeginJobCardScheduleSettlement(err, JOB_A),
      err
    );
    const ready = settleJobCardScheduleSuccess(JOB_A);
    assert.deepEqual(
      preserveOrBeginJobCardScheduleSettlement(ready, JOB_A),
      ready
    );
  });
});
