import { describe, test } from "node:test";
import assert from "node:assert/strict";

import type { RoofingEstimate } from "./estimateStore";
import type { JobSummary } from "./jobTypes";
import {
  buildDbJobCardHref,
  buildJobCardRecoveryHref,
  filterBoardEntriesByLaneStatus,
  filterDbJobsForBoard,
  getDbJobIdFromBoardEntry,
  isDbBoardJobEntry,
  mapDbJobToBoardCard,
  mapDbJobToBoardEstimate,
  mapDbJobStageToBoardColumnKey,
  mergeDbJobsIntoBoardEstimates,
  searchBoardEntries,
} from "./jobBoardAdapter";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const ESTIMATE_ID = "22222222-2222-4222-8222-222222222222";
const LINKED_JOB_ID = "33333333-3333-4333-8333-333333333333";

function baseDbJob(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: JOB_ID,
    company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customer_name: "Sabreena",
    customer_email: "sabreena@example.com",
    customer_phone: null,
    job_name: "Sabreena — roofing",
    address: {
      line1: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
      formatted: "123 Main St, Austin, TX 78701",
    },
    stage: "measurement",
    status: "active",
    source: "intake",
    priority: "normal",
    selected_measurement_id: null,
    active_proposal_id: null,
    latest_estimate_id: null,
    latest_proposal_id: null,
    last_activity_at: "2026-06-06T12:00:00.000Z",
    created_at: "2026-06-06T10:00:00.000Z",
    updated_at: "2026-06-06T12:00:00.000Z",
    ...overrides,
  };
}

describe("jobBoardAdapter", () => {
  test("maps DB job to board card with job id", () => {
    const card = mapDbJobToBoardCard(baseDbJob());
    assert.equal(card.jobId, JOB_ID);
    assert.equal(card.customerName, "Sabreena");
    assert.match(card.address, /123 Main St/);
  });

  test("DB job card href is /tools/roofing?entry=job-card&job=<jobId>", () => {
    const href = buildDbJobCardHref(JOB_ID);
    assert.equal(href, `/tools/roofing?entry=job-card&job=${encodeURIComponent(JOB_ID)}`);
    assert.equal(mapDbJobToBoardCard(baseDbJob()).href, href);
  });

  test("DB job href does not include loadSaved", () => {
    const href = buildDbJobCardHref(JOB_ID);
    assert.doesNotMatch(href, /loadSaved/);
  });

  test("DB job href does not include from=board", () => {
    const href = buildDbJobCardHref(JOB_ID);
    assert.doesNotMatch(href, /from=board/);
  });

  test("missing customer/name uses safe fallback", () => {
    const card = mapDbJobToBoardCard(
      baseDbJob({ customer_name: null, job_name: null })
    );
    assert.equal(card.customerName, "New roofing job");
  });

  test("missing address uses safe fallback", () => {
    const card = mapDbJobToBoardCard(baseDbJob({ address: null }));
    assert.equal(card.address, "—");
  });

  test("status/stage maps safely to board column", () => {
    assert.equal(mapDbJobStageToBoardColumnKey(baseDbJob({ stage: "measurement" })), "estimate");
    assert.equal(mapDbJobStageToBoardColumnKey(baseDbJob({ stage: "approved" })), "approved");
    assert.equal(mapDbJobStageToBoardColumnKey(baseDbJob({ stage: "complete" })), "paid");
    assert.equal(
      mapDbJobStageToBoardColumnKey(baseDbJob({ stage: "proposal", active_proposal_id: JOB_ID })),
      "leads"
    );
  });

  test("saved estimate open path is unchanged — non-db entries are not db board rows", () => {
    const estimate: RoofingEstimate = {
      id: ESTIMATE_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      customerName: "Legacy Estimate",
      address: "456 Oak",
      zip: "78702",
      roofAreaSqFt: 2400,
      selectedTier: "Core",
      suggestedPrice: 10000,
      status: "estimate",
    };

    assert.equal(isDbBoardJobEntry(estimate), false);
    assert.equal(getDbJobIdFromBoardEntry(estimate), null);
  });

  test("DB-only job is not dropped by merge", () => {
    const estimates: RoofingEstimate[] = [];
    const merged = mergeDbJobsIntoBoardEstimates(estimates, [baseDbJob()]);
    assert.equal(merged.length, 1);
    assert.equal(isDbBoardJobEntry(merged[0]!), true);
    assert.equal(getDbJobIdFromBoardEntry(merged[0]!), JOB_ID);
  });

  test("linked estimate jobId dedupes DB job card", () => {
    const estimates: RoofingEstimate[] = [
      {
        id: ESTIMATE_ID,
        jobId: LINKED_JOB_ID,
        createdAt: "2026-01-01T00:00:00.000Z",
        customerName: "Linked",
        address: "456 Oak",
        zip: "78702",
        roofAreaSqFt: 2400,
        selectedTier: "Core",
        suggestedPrice: 10000,
      },
    ];

    const filtered = filterDbJobsForBoard(
      [baseDbJob({ id: LINKED_JOB_ID }), baseDbJob({ id: JOB_ID })],
      estimates
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, JOB_ID);
  });

  test("mapDbJobToBoardEstimate preserves legacy estimate merge behavior", () => {
    const row = mapDbJobToBoardEstimate(baseDbJob());
    assert.equal(row.jobId, JOB_ID);
    assert.equal(row.customerName, "Sabreena");
    assert.equal(row.status, "estimate");
  });

  test("recovery href returns job= route when lastJobId is a valid uuid", () => {
    const href = buildJobCardRecoveryHref(JOB_ID);
    assert.equal(href, `/tools/roofing?entry=job-card&job=${encodeURIComponent(JOB_ID)}`);
    assert.doesNotMatch(href, /loadSaved/);
    assert.doesNotMatch(href, /from=board/);
  });

  test("recovery href falls back to plain Job Card route when lastJobId missing/invalid", () => {
    assert.equal(buildJobCardRecoveryHref(null), "/tools/roofing?entry=job-card");
    assert.equal(buildJobCardRecoveryHref(""), "/tools/roofing?entry=job-card");
    assert.equal(buildJobCardRecoveryHref("not-a-uuid"), "/tools/roofing?entry=job-card");
  });

  test("DB job mapped to New Lead appears when filtering estimate lane", () => {
    const merged = mergeDbJobsIntoBoardEstimates([], [baseDbJob({ stage: "measurement" })]);
    const lane = filterBoardEntriesByLaneStatus(merged, "estimate");
    assert.equal(lane.length, 1);
    assert.equal(isDbBoardJobEntry(lane[0]!), true);
    assert.equal(lane[0]?.customerName, "Sabreena");
  });

  test("DB job is not dropped when statusFilter is not all", () => {
    const merged = mergeDbJobsIntoBoardEstimates([], [baseDbJob({ stage: "intake" })]);
    for (const filter of ["estimate", "sent_pending", "approved"] as const) {
      const lane = filterBoardEntriesByLaneStatus(merged, filter);
      if (filter === "estimate") {
        assert.equal(lane.length, 1, `expected DB job in ${filter} lane`);
      } else {
        assert.equal(lane.length, 0, `expected no DB job in ${filter} lane`);
      }
    }
  });

  test("DB job search by customer name works", () => {
    const merged = mergeDbJobsIntoBoardEstimates([], [baseDbJob()]);
    const hits = searchBoardEntries(merged, "sabreena");
    assert.equal(hits.length, 1);
  });

  test("DB job search by fallback name works", () => {
    const merged = mergeDbJobsIntoBoardEstimates(
      [],
      [baseDbJob({ customer_name: null, job_name: "Packet Lead — roofing" })]
    );
    const hits = searchBoardEntries(merged, "packet lead");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.customerName, "Packet Lead");
  });

  test("DB job search by address works", () => {
    const merged = mergeDbJobsIntoBoardEstimates([], [baseDbJob()]);
    const hits = searchBoardEntries(merged, "78701");
    assert.equal(hits.length, 1);
  });

  test("DB job href remains job= only after lane filtering", () => {
    const row = mapDbJobToBoardEstimate(baseDbJob());
    const href = buildDbJobCardHref(JOB_ID);
    assert.equal(row.status, "estimate");
    const lane = filterBoardEntriesByLaneStatus([row], "estimate");
    assert.equal(lane.length, 1);
    assert.equal(buildDbJobCardHref(getDbJobIdFromBoardEntry(lane[0]!)!), href);
    assert.doesNotMatch(href, /loadSaved/);
    assert.doesNotMatch(href, /from=board/);
  });

  test("legacy estimate href path is unchanged — not a db board row", () => {
    const estimate: RoofingEstimate = {
      id: ESTIMATE_ID,
      createdAt: "2026-01-01T00:00:00.000Z",
      customerName: "Legacy Estimate",
      address: "456 Oak",
      zip: "78702",
      roofAreaSqFt: 2400,
      selectedTier: "Core",
      suggestedPrice: 10000,
      status: "estimate",
    };
    const lane = filterBoardEntriesByLaneStatus([estimate], "estimate");
    assert.equal(lane.length, 1);
    assert.equal(isDbBoardJobEntry(lane[0]!), false);
  });

  test("DB-only job is never hidden by legacy-only source arrays", () => {
    const estimates: RoofingEstimate[] = [];
    const merged = mergeDbJobsIntoBoardEstimates(estimates, [baseDbJob()]);
    const legacyLane = filterBoardEntriesByLaneStatus(estimates, "estimate");
    const unifiedLane = filterBoardEntriesByLaneStatus(merged, "estimate");
    assert.equal(legacyLane.length, 0);
    assert.equal(unifiedLane.length, 1);
  });
});
