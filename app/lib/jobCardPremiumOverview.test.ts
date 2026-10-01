/**
 * Premium Job Overview: hierarchy (hero → Coordinator + Crew → work → recent
 * activity), hero truth, people language, collapsible Recent activity, and scope.
 * Run: npx tsx --test app/lib/jobCardPremiumOverview.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  RECENT_ACTIVITY_LIMIT,
  buildJobCardOverviewTimeline,
  calendarDateInTimeZone,
  formatTimelineDate,
  jobCardOverviewHeroLook,
  recentActivitySummary,
} from "./jobCardOverviewPresentation";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SUMMARY = strip(read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx"));
const PEOPLE = strip(read("app/tools/roofing/jobCard/JobCardOverviewPeople.tsx"));
const RECENT = strip(read("app/tools/roofing/jobCard/JobCardOverviewRecentActivity.tsx"));
const PANEL = strip(read("app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"));
const CLIENT = strip(read("app/tools/roofing/jobCard/JobCardClient.tsx"));
const BRIEF = strip(read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx"));
const FACT = strip(read("app/tools/roofing/jobCard/JobCardCrewFact.tsx"));
const READ = strip(read("app/lib/jobActivityReadPersistence.ts"));

const scheduled = {
  kind: "scheduled" as const,
  startsOn: "2026-10-02",
  endsOn: "2026-10-03",
  today: "2026-10-01",
  startedOn: null,
  primaryKind: "start_work",
};

describe("hierarchy", () => {
  test("operational Overview order: hero, Coordinator + Crew, work, money, recent activity", () => {
    const start = SUMMARY.indexOf('data-jobcard-overview-layout="operational"');
    const block = SUMMARY.slice(start, SUMMARY.indexOf("return (", start));
    const order = ["{leadingSection}", "<StateHero", "{people}", "data-jobcard-overview-brief", "data-jobcard-overview-financial", "{recentActivitySummary}"];
    const at = order.map((marker) => block.indexOf(marker));
    assert.ok(at.every((index) => index > 0), `missing marker: ${order[at.findIndex((i) => i <= 0)]}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at);
  });

  test("no Job Details card and no filler on the Overview", () => {
    for (const source of [SUMMARY, PEOPLE, RECENT, BRIEF]) {
      assert.doesNotMatch(source, /Job details|Job Details/);
    }
    assert.doesNotMatch(CLIENT, /View activity →/);
  });

  test("the Overview passes the people row, timeline, and recent activity into the summary", () => {
    assert.match(CLIENT, /people=\{overviewPeople\}/);
    assert.match(CLIENT, /timeline=\{overviewTimeline\}/);
    assert.match(CLIENT, /presentation="recent"/);
  });
});

describe("hero truth", () => {
  test("hero tone is contextual: active stages tinted, hold amber, everything else quiet", () => {
    assert.deepEqual(jobCardOverviewHeroLook("scheduled"), { tone: "active", icon: "calendar" });
    assert.deepEqual(jobCardOverviewHeroLook("production"), { tone: "active", icon: "work" });
    assert.equal(jobCardOverviewHeroLook("on_hold").tone, "hold");
    for (const kind of ["intake", "closed", "lost", "proposal_sent", "complete_settled"] as const) {
      assert.equal(jobCardOverviewHeroLook(kind).tone, "quiet", kind);
    }
  });

  test("scheduled with Start work eligible: Today, planned start, planned finish from real dates", () => {
    const entries = buildJobCardOverviewTimeline(scheduled);
    assert.deepEqual(
      entries.map((entry) => [entry.dateLabel, entry.label, entry.current]),
      [
        ["Today", "Ready to start work", true],
        ["Oct 2", "Planned start", false],
        ["Oct 3", "Planned finish", false],
      ]
    );
  });

  test("Today says nothing when Start work is not the viewer's eligible action", () => {
    const entries = buildJobCardOverviewTimeline({ ...scheduled, primaryKind: null });
    assert.deepEqual(entries.map((entry) => entry.key), ["planned_start", "planned_finish"]);
  });

  test("a same-day start is marked Today, never duplicated", () => {
    const entries = buildJobCardOverviewTimeline({ ...scheduled, today: "2026-10-02" });
    assert.deepEqual(entries.map((entry) => [entry.dateLabel, entry.label]), [
      ["Today", "Planned start"],
      ["Oct 3", "Planned finish"],
    ]);
  });

  test("a one-day schedule has no separate finish line", () => {
    const entries = buildJobCardOverviewTimeline({ ...scheduled, endsOn: "2026-10-02", primaryKind: null });
    assert.deepEqual(entries.map((entry) => entry.key), ["planned_start"]);
  });

  test("production uses the actual start, never a fabricated milestone", () => {
    const entries = buildJobCardOverviewTimeline({
      kind: "production",
      startsOn: "2026-09-30",
      endsOn: "2026-10-03",
      today: "2026-10-01",
      startedOn: "2026-09-30",
      primaryKind: "complete_work",
    });
    assert.deepEqual(entries.map((entry) => [entry.dateLabel, entry.label]), [
      ["Sep 30", "Work started"],
      ["Today", "Work in progress"],
      ["Oct 3", "Planned finish"],
    ]);
  });

  test("other stages and missing dates get no timeline", () => {
    for (const kind of ["approved", "intake", "on_hold", "closed"] as const) {
      assert.deepEqual(buildJobCardOverviewTimeline({ ...scheduled, kind }), [], kind);
    }
    assert.deepEqual(buildJobCardOverviewTimeline({ ...scheduled, startsOn: null, endsOn: null }), []);
    assert.deepEqual(buildJobCardOverviewTimeline({ ...scheduled, startsOn: "Oct 2" , endsOn: null }), []);
  });

  test("no invented readiness, alerts or recommendation language in the hero", () => {
    const words = /readiness|score|recommended|you should|alert|All set/i;
    assert.doesNotMatch(read("app/lib/jobCardOverviewPresentation.ts").replace(/\/\*[\s\S]*?\*\//g, ""), words);
    assert.doesNotMatch(SUMMARY, words);
  });

  test("calendar dates format without timezone drift; Today uses the company timezone", () => {
    assert.equal(formatTimelineDate("2026-10-02"), "Oct 2");
    assert.equal(calendarDateInTimeZone("2026-10-01T03:00:00Z", "America/Denver"), "2026-09-30");
    assert.equal(calendarDateInTimeZone("not a date", "America/Denver"), null);
    assert.match(CLIENT, /useState\(\(\) => new Date\(\)\)/);
  });
});

describe("Coordinator + Crew", () => {
  test("separate cards, subtle icon circle, strong name, a tinted Change", () => {
    assert.match(PEOPLE, /label="Coordinator"/);
    assert.match(PEOPLE, /label=\{view\.label\}/);
    assert.match(PEOPLE, /grid gap-3 md:grid-cols-2/);
    assert.match(CLIENT, /cardTriggerClassName=\{OVERVIEW_SOFT_ACTION\}/);
    assert.doesNotMatch(PEOPLE, /Assigned to|roster|access profile|members?Count/i);
  });

  test("the person under a Crew is a plain name; never a Lead title", () => {
    assert.match(PEOPLE, /\{view\.leadName\}/);
    assert.match(FACT, /view\.leadName/);
    for (const source of [PEOPLE, FACT, BRIEF]) {
      assert.doesNotMatch(source, /· Lead|Assignment Lead/);
    }
  });

  test("the Coordinator context appears only when someone coordinates", () => {
    assert.match(PEOPLE, /"Coordinates this job\."/);
    assert.doesNotMatch(PEOPLE, /runs this job/);
    assert.match(PEOPLE, /unassigned \? null :/);
  });
});

describe("authorized work", () => {
  test("a light card with a quiet empty state and Directions on the right", () => {
    assert.match(BRIEF, /No authorized scope on file\{overviewMode \? "\." : ""\}/);
    assert.match(BRIEF, /const OVERVIEW_ROW_TRAILING = "w-full shrink-0 pl-16 sm:ml-auto sm:w-auto sm:pl-0"/);
    assert.doesNotMatch(BRIEF, /bg-red-|bg-rose-/);
  });

  test("before authorized work exists, the row is a truthful Site card, not an empty box", () => {
    assert.match(BRIEF, /<h3 className=\{OVERVIEW_CARD_HEADING\}>Site<\/h3>/);
    assert.match(BRIEF, /contact\.addressLine \|\| "No service address on file"/);
  });
});

describe("recent activity", () => {
  test("collapsed by default with a real count; the toggle reports its state", () => {
    assert.match(RECENT, /const \[open, setOpen\] = useState\(false\)/);
    assert.match(RECENT, /aria-expanded=\{expanded\}/);
    assert.match(RECENT, /\{expanded \? "Hide" : "Show"\}/);
  });

  test("counts are real, capped, and loading or failure never reads as no activity", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ id: index }));
    assert.deepEqual(recentActivitySummary(items, "ready").items.length, RECENT_ACTIVITY_LIMIT);
    assert.equal(recentActivitySummary(items.slice(0, 3), "ready").countLabel, "3 recent events");
    assert.equal(recentActivitySummary(items.slice(0, 1), "ready").countLabel, "1 recent event");
    assert.equal(recentActivitySummary([], "ready").countLabel, "No activity yet");
    assert.equal(recentActivitySummary(items, "loading").countLabel, "Checking activity…");
    assert.equal(recentActivitySummary(items, "error").countLabel, "Activity couldn't be loaded");
    assert.deepEqual(recentActivitySummary(items, "error").items, []);
  });

  test("one activity system: the same panel and composer feed both Overview and Activity", () => {
    assert.match(PANEL, /presentation === "recent"/);
    assert.match(PANEL, /composeJobActivityItems/);
    assert.match(PANEL, /listJobActivityEventsForJobStrict/);
    assert.doesNotMatch(RECENT, /fetch\(|supabase|listJobActivityEvents/);
    assert.match(RECENT, /See all activity/);
  });

  test("the strict read distinguishes failure from an empty history", () => {
    assert.match(READ, /export async function listJobActivityEventsForJobStrict/);
    assert.match(READ, /\(await listJobActivityEventsForJobStrict\(jobId\)\) \?\? \[\]/);
    assert.match(PANEL, /read\.ok \? "ready" : "error"/);
  });
});

describe("mobile", () => {
  test("people stack on phones, pair from md; the hidden inline CTA leaves no gap", () => {
    assert.match(PEOPLE, /grid gap-3 md:grid-cols-2/);
    assert.match(SUMMARY, /max-\[1199px\]:has-\[>\.hidden:only-child\]:hidden/);
    assert.match(CLIENT, /<div className="hidden min-\[1200px\]:block">/);
  });
});

describe("scope", () => {
  test("the Job Board never renders crew badges, filters, or the Overview people row", () => {
    const boardDir = join(ROOT, "app/tools/roofing/saved");
    for (const name of readdirSync(boardDir).filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))) {
      const source = read(`app/tools/roofing/saved/${name}`);
      assert.doesNotMatch(source, /JobCardOverviewPeople|jobCrewAssignment|crew-assignment|JobCardCrewFact/, name);
    }
  });
});
