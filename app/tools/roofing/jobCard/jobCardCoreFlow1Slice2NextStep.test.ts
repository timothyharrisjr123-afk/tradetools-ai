/**
 * Core Flow 1 / Slice 2 — Job Card handoff + next action.
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardCoreFlow1Slice2NextStep.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CURRENT_JOB_PROPOSAL_PATH,
  JOB_CARD_NEXT_STEP_RETRY_CONTEXT,
  jobCardNextStepHeroCopy,
  resolveJobCardNextStep,
  type JobCardNextStep,
  type JobCardNextStepInput,
} from "@/app/lib/jobCardNextStep";
import { buildJobCardStageProgress } from "@/app/lib/jobCardStageProgress";
import { buildJobCardOverviewComposition } from "@/app/lib/jobCardOverviewComposition";
import type { JobCardOverviewSituationKind } from "@/app/lib/jobCardOverviewSituation";
import type { FieldBriefViewModel } from "@/app/lib/fieldBriefModel";
import JobCardOverviewSummary from "./JobCardOverviewSummary";
import JobCardNextStepActions from "./JobCardNextStepActions";
import JobCardHeader from "./JobCardHeader";
import JobCardFieldBrief from "./JobCardFieldBrief";
import type { JobCardDisplayModel } from "./jobCardDisplayTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NEXT_STEP_LIB = strip(read("app/lib/jobCardNextStep.ts"));
const ACTIONS = strip(read("app/tools/roofing/jobCard/JobCardNextStepActions.tsx"));
const PROGRESS = strip(read("app/tools/roofing/jobCard/JobCardStageProgress.tsx"));
const HEADER = strip(read("app/tools/roofing/jobCard/JobCardHeader.tsx"));
const CLIENT = strip(read("app/tools/roofing/jobCard/JobCardClient.tsx"));

const DRAFT = {
  previewHref: "/tools/roofing/proposals/preview?job=j1&proposal=p1",
  builderHref: "/tools/roofing/proposals/builder?job=j1&proposal=p1",
};

function input(overrides: Partial<JobCardNextStepInput> = {}): JobCardNextStepInput {
  return {
    situationKind: "intake",
    jobRead: "ready",
    lifecyclePrimary: null,
    proposalPath: CURRENT_JOB_PROPOSAL_PATH,
    measurement: { status: "none" },
    proposalsRead: "ready",
    draft: null,
    canAuthorProposals: true,
    suppressCommercial: false,
    ...overrides,
  };
}

const resolve = (overrides: Partial<JobCardNextStepInput> = {}) => resolveJobCardNextStep(input(overrides));
const secondaryIds = (step: JobCardNextStep) => step.secondary.map((action) => action.id);

const READY_MEASUREMENT = {
  status: "ready" as const,
  quantityLine: "2,450 sq ft · 12% waste",
  savedOn: "Oct 3, 2026",
};

describe("next step: early states (no proposal yet)", () => {
  test("no measurement on today's measured path: Add measurement leads, Prepare proposal stays reachable", () => {
    const step = resolve();
    assert.equal(step.kind, "add_measurement");
    assert.equal(step.title, "Get this job ready for a proposal");
    assert.equal(step.primary?.label, "Add measurement");
    assert.deepEqual(step.primary?.command, {
      type: "open_measurement_capture",
      mode: "add",
      workspace: "measurements",
    });
    assert.deepEqual(secondaryIds(step), ["prepare_proposal", "add_photos"]);
    assert.equal(step.reason, "measurement_required_none");
  });

  test("measurement present and ready: Prepare proposal with the measurement as context", () => {
    const step = resolve({ measurement: READY_MEASUREMENT });
    assert.equal(step.kind, "prepare_proposal");
    assert.equal(step.title, "Ready to prepare the proposal");
    assert.deepEqual(step.context, ["Measurement · 2,450 sq ft · 12% waste · Saved Oct 3, 2026"]);
    assert.deepEqual(step.primary?.command, { type: "open_prepare_proposal" });
    assert.deepEqual(secondaryIds(step), ["view_measurement", "add_photos"]);
    assert.equal(step.contextShowsMeasurement, true);
  });

  test("an incomplete measurement asks to finish it; non-manual sources open the workspace instead", () => {
    const manual = resolve({ measurement: { status: "incomplete", quantityLine: "Quantities not entered", editable: true } });
    assert.equal(manual.kind, "finish_measurement");
    assert.deepEqual(manual.primary?.command, {
      type: "open_measurement_capture",
      mode: "edit",
      workspace: "measurements",
    });
    assert.ok(secondaryIds(manual).includes("prepare_proposal"));
    const report = resolve({ measurement: { status: "incomplete", quantityLine: "2,000 sq ft", editable: false } });
    assert.deepEqual(report.primary?.command, { type: "open_workspace", tab: "measurements" });
  });

  test("saved measurements with none current: choose one in Measurements, never 'add another'", () => {
    const step = resolve({ measurement: { status: "not_current" } });
    assert.equal(step.kind, "choose_measurement");
    assert.deepEqual(step.primary?.command, { type: "open_workspace", tab: "measurements" });
    assert.notEqual(step.primary?.id, "add_measurement");
  });

  test("the same early logic serves a proposal-stage job with no proposal", () => {
    assert.equal(resolve({ situationKind: "proposal_none" }).kind, "add_measurement");
    assert.equal(resolve({ situationKind: "proposal_none", measurement: READY_MEASUREMENT }).kind, "prepare_proposal");
  });
});

describe("measurement is not universal", () => {
  test("a path that does not need a measurement leads with Prepare proposal in every measurement state", () => {
    const optional = { measurement: "optional" as const };
    for (const measurement of [
      { status: "none" as const },
      { status: "not_current" as const },
      { status: "incomplete" as const, quantityLine: "Quantities not entered", editable: true },
      READY_MEASUREMENT,
    ]) {
      const step = resolve({ proposalPath: optional, measurement });
      assert.equal(step.kind, "prepare_proposal", measurement.status);
      assert.equal(step.primary?.id, "prepare_proposal", measurement.status);
    }
    const none = resolve({ proposalPath: optional });
    assert.ok(secondaryIds(none).includes("add_measurement"), "measurement stays an optional secondary");
  });

  test("the measured requirement comes from one labelled constant, passed in by the Job Card", () => {
    assert.deepEqual(CURRENT_JOB_PROPOSAL_PATH, { measurement: "required" });
    assert.match(read("app/lib/jobCardNextStep.ts"), /Temporary compatibility/);
    assert.match(CLIENT, /proposalPath: CURRENT_JOB_PROPOSAL_PATH/);
    assert.match(NEXT_STEP_LIB, /input\.proposalPath\.measurement === "optional"/);
  });

  test("even on the measured path, Prepare proposal is never hidden behind the measurement", () => {
    for (const measurement of [
      { status: "none" as const },
      { status: "not_current" as const },
      { status: "incomplete" as const, quantityLine: "x", editable: true },
    ]) {
      const step = resolve({ measurement });
      const ids = [step.primary?.id, ...secondaryIds(step)];
      assert.ok(ids.includes("prepare_proposal"), measurement.status);
    }
  });
});

describe("next step: loading and failed reads stay local and truthful", () => {
  test("loading never shows business copy", () => {
    for (const step of [
      resolve({ measurement: { status: "loading" } }),
      resolve({ situationKind: "loading", jobRead: "loading" }),
      resolve({ situationKind: "loading" }),
    ]) {
      assert.equal(step.status, "loading");
      assert.equal(step.title, null);
      assert.equal(step.primary, null);
    }
  });

  test("a failed measurement read is not 'no measurement'", () => {
    const step = resolve({ measurement: { status: "error" } });
    assert.equal(step.kind, "unavailable");
    assert.equal(step.status, "error");
    assert.equal(step.title, "Couldn't load this job's measurement");
    assert.deepEqual(step.context, [JOB_CARD_NEXT_STEP_RETRY_CONTEXT]);
    assert.deepEqual(step.primary?.command, { type: "retry", read: "measurements" });
    assert.notEqual(step.title, "Get this job ready for a proposal");
  });

  test("a failed proposal list read is not 'no proposal yet'", () => {
    const step = resolve({ proposalsRead: "error" });
    assert.equal(step.kind, "unavailable");
    assert.deepEqual(step.primary?.command, { type: "retry", read: "proposals" });
    assert.equal(resolve({ situationKind: "loading", proposalsRead: "error" }).kind, "unavailable");
  });

  test("a failed job read and an unreadable customer response both offer Try again", () => {
    assert.deepEqual(resolve({ jobRead: "error", situationKind: "loading" }).primary?.command, {
      type: "retry",
      read: "job",
    });
    const facts = resolve({ situationKind: "proposal_facts_unavailable" });
    assert.equal(facts.title, "Customer response couldn't be checked");
    assert.deepEqual(facts.primary?.command, { type: "retry", read: "proposal_facts" });
  });
});

describe("next step: proposal states and lifecycle", () => {
  test("draft: Review proposal opens the customer preview; Edit proposal opens the builder", () => {
    const step = resolve({ situationKind: "proposal_draft", draft: DRAFT });
    assert.equal(step.kind, "review_proposal");
    assert.equal(step.title, "Proposal draft in progress");
    assert.deepEqual(step.context, ["Not sent to the customer yet."]);
    assert.deepEqual(step.primary?.command, { type: "navigate", href: DRAFT.previewHref });
    assert.deepEqual(step.secondary[0]?.command, { type: "navigate", href: DRAFT.builderHref });
  });

  test("sent: nothing to push; a quiet way to the proposals", () => {
    const step = resolve({ situationKind: "proposal_sent" });
    assert.equal(step.primary, null);
    assert.equal(step.title, null, "keeps the situation's own copy");
    assert.deepEqual(step.secondary.map((a) => a.command), [{ type: "open_workspace", tab: "proposals" }]);
    const revision = resolve({ situationKind: "proposal_sent", draft: DRAFT });
    assert.deepEqual(secondaryIds(revision), ["review_revision", "view_proposals"]);
  });

  test("normal later-stage Job Card: the existing lifecycle resolver keeps the primary", () => {
    const step = resolve({
      situationKind: "approved",
      lifecyclePrimary: { kind: "schedule", label: "Schedule job", owner: "overview_primary" },
    });
    assert.equal(step.kind, "lifecycle");
    assert.equal(step.lifecycleOwnsPrimary, true);
    assert.equal(step.primary, null);
    assert.equal(step.title, null);
    for (const kind of ["scheduled", "production", "on_hold", "closed"] as const) {
      assert.equal(resolve({ situationKind: kind }).kind, "situation", kind);
    }
  });

  test("restricted viewers get the situation only, never commercial actions", () => {
    assert.equal(resolve({ suppressCommercial: true }).kind, "situation");
    assert.equal(resolve({ canAuthorProposals: false }).primary, null);
    assert.deepEqual(secondaryIds(resolve({ situationKind: "proposal_draft", draft: DRAFT, canAuthorProposals: false })), []);
  });

  test("hero copy: the next step's title replaces the situation headline only when it has one", () => {
    const state = { kind: "proposal_sent" as const, title: "Proposal sent — waiting on the customer", notes: ["n"], facts: [] };
    assert.deepEqual(jobCardNextStepHeroCopy(state, resolve({ situationKind: "proposal_sent" })), {
      title: state.title,
      notes: ["n"],
    });
    assert.equal(jobCardNextStepHeroCopy(null, resolve({ jobRead: "error" }))?.title, "Couldn't load this job");
  });
});

describe("no accidental lifecycle writes", () => {
  test("the next step is pure and its controls only navigate or open existing workspaces", () => {
    for (const source of [NEXT_STEP_LIB, ACTIONS, PROGRESS]) {
      assert.doesNotMatch(source, /fetch\(|\/api\/|supabase|\.rpc\(|router\.|window\.location/);
    }
    const start = CLIENT.indexOf("const runNextStepCommand");
    const block = CLIENT.slice(start, CLIENT.indexOf("const headerStageProgress", start));
    assert.ok(start > 0 && block.length > 0);
    assert.doesNotMatch(block, /fetch\(|\/api\/|persistJobScheduleAction|startCurrentJobWork|completeCurrentJobWork|confirm-acceptance/);
    assert.match(block, /prepare\.openModal\(\)/);
    assert.match(block, /prepare\.openCapture\("tab", command\.mode\)/);
    assert.match(block, /setJobCardTab\(command\.tab\)/);
    assert.match(block, /router\.push\(command\.href\)/);
  });

  test("measurement capture opens on the Measurements workspace, where the capture lives", () => {
    const start = CLIENT.indexOf('case "open_measurement_capture"');
    const block = CLIENT.slice(start, CLIENT.indexOf("return;", start));
    assert.ok(block.indexOf("setJobCardTab(command.workspace)") >= 0);
    assert.ok(block.indexOf("setJobCardTab(command.workspace)") < block.indexOf("prepare.openCapture"));
  });
});

describe("Overview hero presentation", () => {
  const render = (props: Parameters<typeof JobCardOverviewSummary>[0]) =>
    renderToStaticMarkup(createElement(JobCardOverviewSummary, { operationalLayout: true, ...props }));
  const intakeState = {
    kind: "intake" as const,
    title: "Get this job ready for a proposal",
    notes: ["Add a measurement or prepare a proposal when you're ready."],
    facts: [],
  };

  test("loading: a skeleton, no business copy, no authorized-work flash", () => {
    const html = render({ state: intakeState, nextStep: resolve({ measurement: { status: "loading" } }) });
    assert.match(html, /data-jobcard-next-step="loading"/);
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, /Get this job ready|Authorized work|Add measurement/);
    const composition = buildJobCardOverviewComposition({
      situation: { kind: "loading", headline: null, details: [], closeoutLeads: false },
      schedule: { status: "loading", windowLabel: null, timezone: null },
      productionStartedLabel: null,
      completedDateLabel: null,
      productionLeadLabel: "Unassigned",
    });
    assert.equal(composition.showAuthorizedWork, false);
  });

  test("failed read: the hero says so locally with Try again", () => {
    const step = resolve({ measurement: { status: "error" } });
    const html = render({
      state: intakeState,
      nextStep: step,
      primaryAction: createElement(JobCardNextStepActions, { step, onCommand: () => undefined }),
    });
    assert.match(html, /Couldn&#x27;t load this job&#x27;s measurement/);
    assert.match(html, /data-jobcard-next-step-primary="retry_measurements"/);
    assert.match(html, /aria-live="polite"/);
    assert.doesNotMatch(html, /Get this job ready/);
  });

  test("measured: one dominant primary, quiet secondaries, measurement stated once", () => {
    const step = resolve({ measurement: READY_MEASUREMENT });
    const html = render({
      state: intakeState,
      nextStep: step,
      primaryAction: createElement(JobCardNextStepActions, { step, onCommand: () => undefined }),
    });
    assert.match(html, /Ready to prepare the proposal/);
    assert.equal((html.match(/2,450 sq ft/g) ?? []).length, 1);
    assert.equal((html.match(/data-jobcard-next-step-primary=/g) ?? []).length, 1);
    assert.match(html, /data-jobcard-next-step-primary="prepare_proposal"/);
    assert.match(html, /data-jobcard-next-step-secondary="view_measurement"/);
    assert.match(html, /data-jobcard-overview-hero="active"/);
    assert.match(html, /bg-slate-950/);
  });

  test("no actions render nothing extra (sent: quiet link only)", () => {
    const sent = resolve({ situationKind: "proposal_sent" });
    const html = renderToStaticMarkup(createElement(JobCardNextStepActions, { step: sent, onCommand: () => undefined }));
    assert.doesNotMatch(html, /data-jobcard-next-step-primary/);
    assert.match(html, /View proposals/);
    const lifecycle = resolve({ lifecyclePrimary: { kind: "start_work", label: "Start work", owner: "overview_primary" } });
    assert.equal(renderToStaticMarkup(createElement(JobCardNextStepActions, { step: lifecycle, onCommand: () => undefined })), "");
  });

  test("recent activity supports the work beside it on wide screens; never a permanent rail", () => {
    const html = render({
      state: intakeState,
      nextStep: resolve({ measurement: READY_MEASUREMENT }),
      recentActivitySummary: createElement("section", { "data-test-recent": true }),
    });
    assert.match(html, /min-\[1200px\]:grid-cols-\[minmax\(0,1fr\)_minmax\(18rem,22rem\)\]/);
    assert.doesNotMatch(html, /data-jobcard-activity-rail/);
  });
});

describe("header progress", () => {
  const display: JobCardDisplayModel = {
    customerName: "Avery Customer",
    address: "123 Main St, Denver, CO",
    stageLabel: "Proposal",
    dispositionLabel: null,
    valueLabel: null,
    lastUpdatedDisplay: null,
    timeInStage: null,
    timeInStageTone: "neutral",
    reportLabel: "",
    proposalLabel: "",
    tasksLabel: "",
  };
  const renderHeader = (overrides: Partial<Parameters<typeof JobCardHeader>[0]> = {}) =>
    renderToStaticMarkup(createElement(JobCardHeader, { display, isBoardOrigin: false, ...overrides }));

  test("progress maps 1:1 onto canonical stages; dispositions mute it, they do not add steps", () => {
    const progress = buildJobCardStageProgress({ stage: "approved", disposition: "active" });
    assert.deepEqual(progress?.steps.map((s) => [s.stage, s.state]), [
      ["intake", "done"],
      ["proposal", "done"],
      ["approved", "current"],
      ["scheduled", "upcoming"],
      ["production", "upcoming"],
      ["complete", "upcoming"],
    ]);
    assert.equal(progress?.currentLabel, "Approved");
    assert.equal(progress?.muted, false);
    assert.equal(buildJobCardStageProgress({ stage: "production", disposition: "on_hold" })?.muted, true);
    assert.equal(buildJobCardStageProgress({ stage: null, disposition: null }), null);
  });

  test("informational, not a control: no buttons, no step counter, current stage announced", () => {
    const html = renderHeader({ progress: buildJobCardStageProgress({ stage: "proposal", disposition: "active" }) });
    assert.match(html, /data-jobcard-stage="Proposal"/);
    assert.match(html, /Current stage: Proposal/);
    assert.match(html, /data-jobcard-stage-step="complete"/);
    assert.doesNotMatch(PROGRESS, /<button|onClick|href=/);
    assert.doesNotMatch(html, /Step \d+ of \d+/);
    assert.doesNotMatch(HEADER, /stageChipLook/);
  });

  test("no generic Active badge; real dispositions keep their own badge", () => {
    const active = renderHeader({ progress: buildJobCardStageProgress({ stage: "intake", disposition: "active" }) });
    assert.match(active, /<span class="sr-only" data-jobcard-disposition="Active">/);
    const held = renderHeader({
      display: { ...display, dispositionLabel: "On hold" },
      progress: buildJobCardStageProgress({ stage: "scheduled", disposition: "on_hold" }),
    });
    assert.match(held, /data-jobcard-disposition="On hold"/);
    assert.match(held, /data-jobcard-stage-progress="muted"/);
  });

  test("unknown stage: no strip, a quiet truthful line", () => {
    const html = renderHeader({ display: { ...display, stageLabel: "Loading" }, progress: null });
    assert.doesNotMatch(html, /data-jobcard-stage-step/);
    assert.match(html, /Checking stage…/);
  });
});

describe("site card keeps the address", () => {
  test("before authorized work, the Site card leads with the address and lists the measurement separately", () => {
    const model: FieldBriefViewModel = {
      contact: {
        customerName: "Avery Customer",
        phone: null,
        email: null,
        addressLine: "123 Main St, Denver, CO",
        canCall: false,
        canDirections: false,
        mapsUrl: null,
        telUrl: null,
      },
      schedule: { startsOn: null, endsOn: null, timezone: null, windowLabel: null, productionLeadLabel: "Unassigned", crewLabel: null },
      authorizedWork: {
        status: "ready",
        approvedScopeLabel: null,
        approvedChangesLabel: null,
        measurementSummary: "2,450 sq ft · 12% waste",
        accessNotes: null,
        warningProposedVsAuthorized: null,
      },
      tasks: [],
      photoCount: 0,
    };
    const html = renderToStaticMarkup(
      createElement(JobCardFieldBrief, {
        model,
        omitIdentityHero: true,
        overviewMode: "work",
        showAuthorizedWork: false,
        tasksReadStatus: "ready",
      })
    );
    assert.match(html, /data-field-brief-site-address[^>]*>123 Main St, Denver, CO/);
    assert.match(html, /data-field-brief-site-measurement/);
    assert.ok(html.indexOf("123 Main St") < html.indexOf("2,450 sq ft"));
  });
});

describe("unchanged information architecture", () => {
  test("tabs, mobile rail and lifecycle sticky behavior are not rebuilt", () => {
    const kinds: JobCardOverviewSituationKind[] = ["scheduled", "production"];
    for (const kind of kinds) assert.equal(resolve({ situationKind: kind }).primary, null);
    assert.match(CLIENT, /placement="sticky"/);
    assert.match(CLIENT, /<div className="hidden min-\[1200px\]:block">/);
    assert.doesNotMatch(CLIENT, /data-jobcard-activity-rail/);
  });
});
