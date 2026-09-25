/**
 * Phase 12.5 — Job Card Overview composition (stage ownership of facts).
 * Run: npx tsx --test app/lib/jobCardOverviewComposition.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildJobCardOverviewComposition,
  JOB_CARD_OVERVIEW_ACCEPTED_WORK_HEADING,
  JOB_CARD_OVERVIEW_AUTHORIZED_WORK_HEADING,
  JOB_CARD_OVERVIEW_SCHEDULE_CHECKING,
  JOB_CARD_OVERVIEW_SCHEDULE_UNAVAILABLE,
  JOB_CARD_OVERVIEW_START_UNAVAILABLE,
  type JobCardOverviewCompositionInput,
} from "./jobCardOverviewComposition";
import type {
  JobCardOverviewSituation,
  JobCardOverviewSituationKind,
} from "./jobCardOverviewSituation";

function situation(
  kind: JobCardOverviewSituationKind,
  overrides: Partial<JobCardOverviewSituation> = {}
): JobCardOverviewSituation {
  return { kind, headline: `Headline ${kind}`, details: [], closeoutLeads: false, ...overrides };
}

function compose(
  kind: JobCardOverviewSituationKind,
  overrides: Partial<JobCardOverviewCompositionInput> = {},
  situationOverrides: Partial<JobCardOverviewSituation> = {}
) {
  return buildJobCardOverviewComposition({
    situation: situation(kind, situationOverrides),
    schedule: { status: "ready", windowLabel: "Aug 27 – Aug 28", timezone: "America/Chicago" },
    productionStartedLabel: "Aug 26, 9:21 AM",
    completedDateLabel: "September 23, 2026",
    productionLeadLabel: "Unassigned",
    crewLabel: null,
    ...overrides,
  });
}

const factKeys = (c: ReturnType<typeof compose>) => c.state?.facts.map((f) => f.key) ?? [];

describe("Job Card Overview composition", () => {
  test("Production: state owns planned, actual start and lead; brief yields that row", () => {
    const c = compose("production");
    assert.deepEqual(factKeys(c), ["planned", "started", "lead"]);
    assert.equal(c.scheduleInState, true);
    assert.equal(c.leadInState, true);
    assert.equal(c.briefShowsScheduleLead, false);
    assert.equal(c.showAuthorizedWork, true);
    assert.equal(c.authorizedWorkHeading, JOB_CARD_OVERVIEW_AUTHORIZED_WORK_HEADING);
    assert.equal(c.money, "supporting");
    const started = c.state?.facts.find((f) => f.key === "started");
    assert.equal(started?.text, "Aug 26, 9:21 AM");
  });

  test("Production: planned and actual start stay distinct facts; missing start is not invented", () => {
    const c = compose("production", { productionStartedLabel: null });
    const started = c.state?.facts.find((f) => f.key === "started");
    assert.equal(started?.text, JOB_CARD_OVERVIEW_START_UNAVAILABLE);
    assert.equal(started?.quiet, true);
    assert.equal(c.state?.facts.find((f) => f.key === "planned")?.text, "Aug 27 – Aug 28");
  });

  test("Unresolved schedule read is Checking / unavailable, never absent", () => {
    const loading = compose("scheduled", {
      schedule: { status: "loading", windowLabel: null, timezone: null },
    });
    assert.equal(loading.state?.facts[0]?.text, JOB_CARD_OVERVIEW_SCHEDULE_CHECKING);
    const failed = compose("scheduled", {
      schedule: { status: "error", windowLabel: null, timezone: null },
    });
    assert.equal(failed.state?.facts[0]?.text, JOB_CARD_OVERVIEW_SCHEDULE_UNAVAILABLE);
  });

  test("Scheduled: planned + lead, no actual start", () => {
    const c = compose("scheduled");
    assert.deepEqual(factKeys(c), ["planned", "lead"]);
    assert.equal(c.scheduleInState, true);
  });

  test("Approved: readiness pairs with lead only; schedule is not claimed", () => {
    const c = compose("approved");
    assert.deepEqual(factKeys(c), ["lead"]);
    assert.equal(c.leadInState, true);
    assert.equal(c.scheduleInState, false);
  });

  test("Unassigned lead reads quiet, not as a blocker", () => {
    const lead = compose("approved").state?.facts.find((f) => f.key === "lead");
    assert.equal(lead?.text, "Unassigned");
    assert.equal(lead?.quiet, true);
    const assigned = compose("approved", { productionLeadLabel: "Dana Ruiz", crewLabel: "Crew A" })
      .state?.facts.find((f) => f.key === "lead");
    assert.equal(assigned?.quiet, false);
    assert.equal(assigned?.meta, "Crew A");
  });

  test("Accepted awaiting approval is 'Accepted work', not authorized", () => {
    const c = compose("accepted_awaiting_approval");
    assert.equal(c.authorizedWorkHeading, JOB_CARD_OVERVIEW_ACCEPTED_WORK_HEADING);
    assert.equal(c.scheduleInState, false);
    assert.equal(c.leadInState, false);
    assert.equal(c.money, "supporting");
  });

  test("Intake and proposal stages show no authorized-work block and no invented facts", () => {
    for (const kind of ["intake", "proposal_draft", "proposal_sent", "proposal_none"] as const) {
      const c = compose(kind);
      assert.equal(c.showAuthorizedWork, false, kind);
      assert.deepEqual(factKeys(c), [], kind);
      assert.equal(c.money, "agreement_only", kind);
    }
  });

  test("Complete: closeout region owns money exactly once", () => {
    const office = compose("complete_balance", {}, { closeoutLeads: true });
    assert.equal(office.state, null);
    assert.equal(office.money, "closeout");
    assert.equal(office.briefShowsPlanned, false);

    const field = compose("complete_settled");
    assert.deepEqual(factKeys(field), ["completed"]);
    assert.equal(field.money, "closeout");
  });

  test("Client renders the supporting money summary only when closeout does not own money", () => {
    const client = readFileSync(
      join(process.cwd(), "app/tools/roofing/jobCard/JobCardClient.tsx"),
      "utf8"
    );
    assert.match(client, /overviewShowsMoneySummary =\s*!suppressCommercial &&\s*!jobCardCloseout &&/);
    assert.match(client, /overviewOwnsPlanSummary=\{overviewComposition\.scheduleInState\}/);
  });
});
