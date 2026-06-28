import test from "node:test";

import assert from "node:assert/strict";

import { deriveJobsBoardOverviewMetrics } from "./jobsBoardOverviewMetrics";

import type { RoofingEstimate } from "@/app/lib/estimateStore";



function makeJob(overrides: Partial<RoofingEstimate> = {}): RoofingEstimate {

  return {

    id: overrides.id ?? "job-1",

    status: overrides.status ?? "estimate",

    customerName: overrides.customerName ?? "Test Customer",

    createdAt: "2026-06-01T00:00:00.000Z",

    lastSavedAt: "2026-06-20T00:00:00.000Z",

    ...overrides,

  } as RoofingEstimate;

}



test("deriveJobsBoardOverviewMetrics counts active jobs always", () => {

  const result = deriveJobsBoardOverviewMetrics([]);

  assert.equal(result.activeJobs, 0);

  const active = result.metrics.find((m) => m.id === "active_jobs");

  assert.ok(active);

  assert.equal(active!.value, 0);

  assert.equal(active!.alwaysShow, true);

  assert.equal(result.insight, null);

});



test("deriveJobsBoardOverviewMetrics omits redundant chips and adds insight", () => {

  const jobs = [

    makeJob({ id: "a", status: "estimate", roofAreaSqFt: 0 }),

    makeJob({ id: "b", status: "estimate", roofAreaSqFt: 0 }),

  ] as RoofingEstimate[];



  const result = deriveJobsBoardOverviewMetrics(jobs);

  assert.equal(result.activeJobs, 2);

  assert.equal(result.metrics.some((m) => m.id === "reports_missing"), false);

  assert.match(result.insight ?? "", /All 2 active jobs need a measurement report/);

});



test("deriveJobsBoardOverviewMetrics shows subset metrics and stalled count", () => {

  const jobs = [

    makeJob({ id: "a", status: "estimate", roofAreaSqFt: 0, createdAt: "2026-01-01T00:00:00.000Z" }),

    makeJob({ id: "b", status: "estimate", roofAreaSqFt: 1500, createdAt: "2026-06-20T00:00:00.000Z" }),

    makeJob({ id: "c", status: "sent_pending", roofAreaSqFt: 1500, createdAt: "2026-06-22T00:00:00.000Z" }),

  ] as RoofingEstimate[];



  const result = deriveJobsBoardOverviewMetrics(jobs);

  assert.equal(result.activeJobs, 3);



  const missing = result.metrics.find((m) => m.id === "reports_missing");

  const stalled = result.metrics.find((m) => m.id === "stalled_30d");



  assert.equal(missing?.value, 1);

  assert.ok((stalled?.value ?? 0) >= 1);

  assert.notEqual(result.insight, "All 3 active jobs need a measurement report");

});


