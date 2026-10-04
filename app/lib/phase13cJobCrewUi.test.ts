/**
 * Phase 13C Job → Crew contractor UI: Crew fact view, sheet contract, Lead resolution,
 * Coordinator/Crew separation, legacy crew_label note, history, disposition, errors.
 * Run: npx tsx --test app/lib/phase13cJobCrewUi.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { JobCrewAssignment, JobCrewAssignments } from "./jobCrewAssignmentModel";
import { setPrimaryJobCrew, JobCrewAssignmentHttpError } from "./jobCrewAssignmentPersistence";
import {
  EARLIER_CREW_LIMIT,
  buildJobCrewFactView,
  crewPeopleLabel,
  earlierCrewStints,
  isRetryableCrewFailure,
  jobCrewErrorMessage,
  ledByLine,
  listedAtAssignmentLabel,
  readJobCrewAssignments,
  stintDateRange,
} from "./jobCrewAssignmentView";
import { crewIntentSignature } from "../tools/roofing/jobCard/useJobCrewAssignment";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const VIEW = strip(read("app/lib/jobCrewAssignmentView.ts"));
const HOOK = strip(read("app/tools/roofing/jobCard/useJobCrewAssignment.ts"));
const FACT = strip(read("app/tools/roofing/jobCard/JobCardCrewFact.tsx"));
const SHEET = strip(read("app/tools/roofing/jobCard/JobCardCrewSheet.tsx"));
const PEOPLE = strip(read("app/tools/roofing/jobCard/JobCardOverviewPeople.tsx"));
const CLIENT = strip(read("app/tools/roofing/jobCard/JobCardClient.tsx"));
const LEAD_CONTROL = strip(read("app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx"));
const BRIEF = strip(read("app/tools/roofing/jobCard/JobCardFieldBrief.tsx"));
const COMPOSITION = strip(read("app/lib/jobCardOverviewComposition.ts"));
const ROUTE = strip(read("app/api/jobs/[jobId]/crew-assignment/route.ts"));
const PERSISTENCE = strip(read("app/lib/jobCrewAssignmentPersistence.ts"));
const UI_FILES = [VIEW, HOOK, FACT, SHEET];

const JOB = "11111111-1111-4111-8111-111111111111";
const CREW_A = "22222222-2222-4222-8222-222222222222";
const CREW_B = "33333333-3333-4333-8333-333333333333";
const PERSON = "44444444-4444-4444-8444-444444444444";
const USER = "55555555-5555-4555-8555-555555555555";

function assignment(overrides: Partial<JobCrewAssignment> = {}): JobCrewAssignment {
  return {
    id: "a1",
    crewId: CREW_A,
    isPrimary: true,
    active: true,
    startedAt: "2026-09-30T15:00:00Z",
    endedAt: null,
    endReason: null,
    supersedesAssignmentId: null,
    crewNameSnapshot: "Harris Crew",
    crewCurrentName: "Harris Crew",
    crewArchived: false,
    assignmentLeadPersonId: PERSON,
    assignmentLeadNameSnapshot: "Tim Harris",
    assignmentLeadCurrentName: "Tim Harris",
    assignmentLeadArchived: false,
    roster: [],
    rosterListedCount: 0,
    ...overrides,
  };
}

function model(assignments: JobCrewAssignment[]): JobCrewAssignments {
  const primary = assignments.find((a) => a.active && a.isPrimary) ?? null;
  return { jobId: JOB, primaryActiveAssignmentId: primary?.id ?? null, assignments };
}

const ready = (m: JobCrewAssignments, extra: Partial<Parameters<typeof buildJobCrewFactView>[0]> = {}) =>
  buildJobCrewFactView({ status: "ready", model: m, jobStatus: "active", legacyCrewLabel: null, canAssign: true, ...extra });

describe("no crew", () => {
  test("neutral empty state with Assign crew for people who can assign", () => {
    const view = ready(model([]));
    assert.equal(view.label, "Crew");
    assert.equal(view.text, "No crew assigned");
    assert.equal(view.quiet, true);
    assert.equal(view.action, "assign");
    assert.equal(view.actionLabel, "Assign crew");
    assert.doesNotMatch(VIEW, /No crew yet/);
  });

  test("readers without assign authority see no action", () => {
    const view = ready(model([]), { canAssign: false });
    assert.equal(view.text, "No crew assigned");
    assert.equal(view.action, null);
    assert.equal(view.dispositionNote, null);
  });

  test("a failed read is 'couldn't be loaded / Try again', never the empty state", () => {
    const view = buildJobCrewFactView({ status: "error", model: null, jobStatus: "active", legacyCrewLabel: null, canAssign: false });
    assert.equal(view.text, "Crew couldn't be loaded");
    assert.equal(view.action, "retry");
    assert.equal(view.actionLabel, "Try again");
    assert.notEqual(view.text, "No crew assigned");
    const loading = buildJobCrewFactView({ status: "loading", model: null, jobStatus: "active", legacyCrewLabel: null, canAssign: true });
    assert.notEqual(loading.text, "No crew assigned");
    assert.equal(loading.action, null);
  });

  test("legacy crew_label is quoted for every job reader until a durable Crew exists", () => {
    const reader = ready(model([]), { canAssign: false, legacyCrewLabel: "  Mike's guys " });
    assert.equal(reader.legacyNote, 'Earlier crew note: "Mike\'s guys"');
    const withCrew = ready(model([assignment()]), { legacyCrewLabel: "Mike's guys" });
    assert.equal(withCrew.legacyNote, null);
    assert.equal(ready(model([]), { legacyCrewLabel: "   " }).legacyNote, null);
  });

  test("the legacy note is never parsed into or written as a Crew", () => {
    for (const source of [HOOK, SHEET, FACT]) {
      assert.doesNotMatch(source, /crew_label|crewLabel/);
    }
  });
});

describe("current crew", () => {
  test("Crew name with the person leading it as a plain name; Change for people who can assign", () => {
    const view = ready(model([assignment()]));
    assert.equal(view.text, "Harris Crew");
    assert.equal(view.leadName, "Tim Harris");
    assert.equal(view.action, "change");
    assert.equal(view.actionLabel, "Change");
  });

  test("the person line is omitted when no one is leading the crew on the job", () => {
    const view = ready(model([assignment({ assignmentLeadPersonId: null, assignmentLeadNameSnapshot: null, assignmentLeadCurrentName: null })]));
    assert.equal(view.leadName, null);
  });

  test("the leading person is a relationship, never a title suffix", () => {
    const view = ready(model([assignment()]));
    assert.doesNotMatch(view.leadName ?? "", /Lead/);
    assert.equal(ledByLine("Tim Harris"), "Led by Tim Harris");
    for (const source of [FACT, PEOPLE, SHEET]) {
      assert.doesNotMatch(source, /· Lead|Assignment Lead|Lead for this job|"Save lead"|"No lead"/);
    }
  });

  test("the fact never carries a roster count, access, login or history terms", () => {
    const view = ready(model([assignment({ rosterListedCount: 3 })]));
    const rendered = [view.label, view.text, view.leadName, view.legacyNote, view.dispositionNote, view.actionLabel].join(" ");
    assert.doesNotMatch(rendered, /people|person|access|login|snapshot|history|primary|assignment/i);
    assert.doesNotMatch(FACT, /rosterListedCount|memberCount|crewPeopleLabel|phone|email|access|login/i);
  });

  test("a renamed crew shows its current name on the job", () => {
    const view = ready(model([assignment({ crewCurrentName: "Harris Roofing" })]));
    assert.equal(view.text, "Harris Roofing");
  });
});

describe("disposition", () => {
  test("on hold explains Resume and keeps Remove available", () => {
    const view = ready(model([assignment()]), { jobStatus: "on_hold" });
    assert.equal(view.dispositionNote, "Resume this job to change its crew.");
    assert.equal(view.action, "remove");
    assert.equal(view.actionLabel, "Remove crew");
  });

  test("lost shows the Last crew read-only; nobody is still responsible", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "job_lost" });
    const view = ready(model([ended]), { jobStatus: "lost" });
    assert.equal(view.label, "Last crew");
    assert.equal(view.text, "Harris Crew");
    assert.equal(view.action, null);
    assert.equal(view.current, null);
  });

  test("a stale active row on a lost job is never presented as the current crew", () => {
    const view = ready(model([assignment()]), { jobStatus: "lost" });
    assert.equal(view.label, "Last crew");
    assert.equal(view.action, null);
    assert.equal(view.current, null);
  });

  test("complete work shows the Last crew with no assign action, even when the job is active", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "job_completed" });
    const view = ready(model([ended]), { jobStatus: "active", jobStage: "complete" });
    assert.equal(view.label, "Last crew");
    assert.equal(view.action, null);
    const none = ready(model([]), { jobStatus: "active", jobStage: "complete" });
    assert.equal(none.text, "No crew assigned");
    assert.equal(none.action, null);
    assert.equal(none.dispositionNote, null);
  });

  test("history keeps the Lead snapshot; the current crew shows the live Lead name", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "job_closed", assignmentLeadCurrentName: "Timothy Harris" });
    assert.equal(ready(model([ended]), { jobStatus: "closed" }).leadName, "Tim Harris");
    assert.equal(ready(model([assignment({ assignmentLeadCurrentName: "Timothy Harris" })])).leadName, "Timothy Harris");
  });

  test("a job with durable history never falls back to the earlier crew note", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "ended" });
    const view = ready(model([ended]), { legacyCrewLabel: "Mike's guys" });
    assert.equal(view.text, "No crew assigned");
    assert.equal(view.legacyNote, null);
  });

  test("a held job without a crew offers no dead chooser", () => {
    const view = ready(model([]), { jobStatus: "on_hold" });
    assert.equal(view.action, null);
    assert.equal(view.dispositionNote, "Resume this job to assign a crew.");
  });

  test("closed shows the Last crew read-only", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "job_closed" });
    const view = ready(model([ended]), { jobStatus: "closed" });
    assert.equal(view.label, "Last crew");
    assert.equal(view.text, "Harris Crew");
    assert.equal(view.leadName, "Tim Harris");
    assert.equal(view.action, null);
  });

  test("reopen does not restore a crew: active job, ended history → No crew assigned", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-02T15:00:00Z", endReason: "job_closed" });
    const view = ready(model([ended]), { jobStatus: "active" });
    assert.equal(view.text, "No crew assigned");
    assert.equal(view.action, "assign");
  });

  test("the read refreshes when the job's disposition changes", () => {
    assert.match(HOOK, /\}, \[jobId, jobStatus, jobStage\]\);/);
  });
});

describe("history", () => {
  const a1 = assignment({ id: "a1", startedAt: "2026-09-01T15:00:00Z", endedAt: "2026-09-02T15:00:00Z", active: false, endReason: "lead_changed", rosterListedCount: 2 });
  const a2 = assignment({ id: "a2", startedAt: "2026-09-02T15:00:00Z", endedAt: "2026-09-05T15:00:00Z", active: false, endReason: "replaced", assignmentLeadNameSnapshot: "Ana Ruiz", rosterListedCount: 3 });
  const b = (id: string, day: number, end: string | null) =>
    assignment({
      id,
      crewId: CREW_B,
      crewNameSnapshot: `ABC Roofing ${id}`,
      crewCurrentName: "ABC Roofing",
      startedAt: `2026-09-${String(day).padStart(2, "0")}T15:00:00Z`,
      endedAt: end,
      active: end === null,
      endReason: end ? "ended" : null,
      assignmentLeadPersonId: null,
      assignmentLeadNameSnapshot: null,
      assignmentLeadCurrentName: null,
    });

  test("a Lead change continues the same stint; newest first; current excluded", () => {
    const stints = earlierCrewStints(model([a1, a2, b("b1", 6, "2026-09-07T15:00:00Z"), b("b2", 8, null)]));
    assert.equal(stints.length, 2);
    assert.equal(stints[0].crewName, "ABC Roofing b1");
    assert.equal(stints[1].crewName, "Harris Crew");
    assert.equal(stints[1].startedAt, a1.startedAt);
    assert.equal(stints[1].endedAt, a2.endedAt);
    assert.equal(stints[1].leadName, "Ana Ruiz");
    assert.equal(stints[1].rosterListedCount, 3);
    assert.equal(stintDateRange(stints[1], "UTC"), "Sep 1 – Sep 5");
  });

  test("the sheet shows at most three and links to Activity", () => {
    assert.equal(EARLIER_CREW_LIMIT, 3);
    assert.match(SHEET, /earlier\.slice\(0, EARLIER_CREW_LIMIT\)/);
    assert.match(SHEET, /Earlier on this job/);
    assert.match(SHEET, /See all in Activity/);
    assert.match(SHEET, /aria-expanded=\{earlierOpen\}/);
  });

  test("roster wording is a recorded plan, never participation", () => {
    assert.equal(listedAtAssignmentLabel(3), "Listed at assignment: 3 people");
    assert.equal(listedAtAssignmentLabel(1), "Listed at assignment: 1 person");
    assert.equal(listedAtAssignmentLabel(0), "Members not listed");
    for (const source of UI_FILES) assert.doesNotMatch(source, /worked/i);
  });
});

describe("assign sheet", () => {
  test("TeamSheet titled Assign crew with the job as subtitle", () => {
    assert.match(SHEET, /import TeamSheet/);
    assert.match(SHEET, /title=\{current \? "Change crew" : "Assign crew"\}/);
    assert.match(SHEET, /subtitle=\{jobName\}/);
  });

  test("crew rows show name, usual lead, and a people count only in the picker", () => {
    assert.equal(crewPeopleLabel(3), "3 people");
    assert.equal(crewPeopleLabel(1), "1 person");
    assert.equal(crewPeopleLabel(0), "Members not listed");
    assert.match(SHEET, /crewPeopleLabel\(row\.memberCount\)/);
    assert.match(SHEET, /row\.lead\.name/);
    assert.doesNotMatch(SHEET, /\.phone|\.email|roleLabel|\.access\b|login/i);
  });

  test("tap selects; the footer offers Leading this crew and Assign <crew>", () => {
    assert.match(SHEET, /Leading this crew/);
    assert.match(SHEET, /Who's leading this crew on this job\?/);
    assert.match(SHEET, /`Assign \$\{selectedName\}`/);
    assert.match(SHEET, /`Switch to \$\{selectedName\}`/);
    assert.match(SHEET, /\? "Save"/);
    assert.doesNotMatch(SHEET, /Assignment Lead|Lead for this job|"Save lead"/);
  });

  test("the usual person is the quiet default; No one is valid; No one · Add without a warning", () => {
    assert.match(SHEET, /selectedCrew\?\.lead\?\.key \?\? null/);
    assert.match(SHEET, /Usually leads this crew/);
    assert.match(SHEET, /option\(null, "No one"\)/);
    assert.match(SHEET, /effectiveLeadName \?\? "No one"/);
    assert.match(SHEET, /effectiveLeadName \? "Change" : "Add"/);
  });

  test("the person picker lists No one, then the crew's people, then everyone else", () => {
    const noLead = SHEET.indexOf('option(null, "No one")');
    const onCrew = SHEET.indexOf("On {selectedName}");
    const rest = SHEET.indexOf("Everyone else");
    assert.ok(noLead > 0 && noLead < onCrew && onCrew < rest);
  });

  test("inline create lives in the same sheet and returns with the new crew selected", () => {
    assert.match(SHEET, /Create your first crew/);
    assert.match(SHEET, /action: "create_crew"/);
    assert.match(SHEET, /setSelectedCrewId\(body\.crewId\)/);
    assert.match(SHEET, /setStep\("list"\)/);
    assert.match(SHEET, /crews\.length === 0 && !current/);
  });

  test("assign goes through the job crew-assignment route", () => {
    assert.match(HOOK, /\/api\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/crew-assignment/);
    assert.match(HOOK, /action: "set_primary"/);
    assert.match(HOOK, /action: "end"/);
  });
});

describe("lead resolution", () => {
  type Call = { fn: string; args: Record<string, unknown> };
  function client(responses: Record<string, unknown>) {
    const calls: Call[] = [];
    const c = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: responses[fn] ?? null, error: null };
      },
    } as unknown as SupabaseClient;
    return { c, calls };
  }
  const setOk = { ok: true, changed: true, kind: "assigned", assignment_id: "66666666-6666-4666-8666-666666666666" };

  test("a member without a person becomes Lead through ensure_member_person_v1", async () => {
    const { c, calls } = client({
      ensure_member_person_v1: { ok: true, changed: true, person_id: PERSON },
      set_primary_job_crew_v1: setOk,
    });
    await setPrimaryJobCrew(c, { jobId: JOB, crewId: CREW_A, assignmentLeadUserId: USER, requestId: "r1" });
    assert.deepEqual(calls.map((call) => call.fn), ["ensure_member_person_v1", "set_primary_job_crew_v1"]);
    assert.deepEqual(calls[0].args, { p_user_id: USER });
    assert.equal(calls[1].args.p_assignment_lead_person_id, PERSON);
    assert.equal(calls[1].args.p_request_id, "r1");
  });

  test("a login outside the company is not an eligible Lead", async () => {
    const { c, calls } = client({ ensure_member_person_v1: { ok: false, code: "not_found" } });
    await assert.rejects(
      setPrimaryJobCrew(c, { jobId: JOB, crewId: CREW_A, assignmentLeadUserId: USER, requestId: "r" }),
      (error: unknown) => error instanceof JobCrewAssignmentHttpError && error.code === "lead_not_eligible" && error.status === 409
    );
    assert.equal(calls.length, 1);
  });

  test("person and login together, or a name, are rejected before the database", async () => {
    const { c, calls } = client({});
    await assert.rejects(
      setPrimaryJobCrew(c, { jobId: JOB, crewId: CREW_A, assignmentLeadPersonId: PERSON, assignmentLeadUserId: USER, requestId: "r" })
    );
    await assert.rejects(setPrimaryJobCrew(c, { jobId: JOB, crewId: CREW_A, assignmentLeadUserId: "Tim Harris", requestId: "r" }));
    assert.equal(calls.length, 0);
  });

  test("No lead sends neither person nor login", async () => {
    const { c, calls } = client({ set_primary_job_crew_v1: setOk });
    await setPrimaryJobCrew(c, { jobId: JOB, crewId: CREW_A, requestId: "r" });
    assert.deepEqual(calls.map((call) => call.fn), ["set_primary_job_crew_v1"]);
    assert.equal(calls[0].args.p_assignment_lead_person_id, null);
  });

  test("no name matching anywhere on the path", () => {
    for (const source of [PERSISTENCE, ROUTE, SHEET, HOOK]) {
      assert.doesNotMatch(source, /ilike|\.eq\("display_name"|displayName ===|name\.toLowerCase\(\) ===/);
    }
    assert.match(ROUTE, /assignmentLeadUserId: body\.assignmentLeadUserId/);
    assert.match(SHEET, /key\.startsWith\("u:"\)\) return \{ userId: key\.slice\(2\) \}/);
  });

  test("Save lead keeps the crew and never touches membership, usual Lead, Coordinator or access", () => {
    assert.doesNotMatch(SHEET, /update_crew|add_crew_member|remove_crew_member|production-lead|job_access_grants|packageKeys/);
    assert.match(SHEET, /leadChanged = selectedIsCurrent && effectiveLeadKey !== currentLeadKey/);
  });
});

describe("replace and remove", () => {
  test("Switch is atomic with the expected current assignment and no confirm", () => {
    assert.match(SHEET, /expectedPrimaryAssignmentId: current\?\.id \?\? null/);
    assert.doesNotMatch(SHEET, /window\.confirm/);
  });

  test("success closes the sheet, refreshes Activity, and confirms quietly", () => {
    assert.match(SHEET, /`\$\{selectedName\} is now on this job\.`/);
    assert.match(CLIENT, /setCrewSheetOpen\(false\);\s*setCrewToast\(message\);\s*setScheduleActivityTick\(\(n\) => n \+ 1\);/);
  });

  test("the sheet is mounted once, so a disposition change never closes it mid-decision", () => {
    assert.equal((CLIENT.match(/<JobCardCrewLayer/g) ?? []).length, 1);
    assert.match(CLIENT, /\{crewLayer\}/);
    assert.doesNotMatch(FACT, /useState/);
  });

  test("Remove is one inline confirmation, then the end route", () => {
    assert.match(SHEET, /Remove \{current\.crewCurrentName\} from this job\? You can assign a crew again anytime\./);
    assert.match(SHEET, /"Remove crew"/);
    assert.match(SHEET, /Cancel/);
    assert.match(SHEET, /crew\.end\(current\.id\)/);
    assert.equal((SHEET.match(/Remove \{current\.crewCurrentName\} from this job\?/g) ?? []).length, 1);
  });

  test("after Remove the job reads No crew assigned / Assign crew", () => {
    const ended = assignment({ active: false, endedAt: "2026-10-01T15:00:00Z", endReason: "ended" });
    const view = ready(model([ended]));
    assert.equal(view.text, "No crew assigned");
    assert.equal(view.actionLabel, "Assign crew");
  });
});

describe("errors", () => {
  const cases: Array<[string, string | null, string]> = [
    ["stale_assignment", "active", "The crew on this job just changed. Here's the latest."],
    ["disposition_blocks_assignment", "on_hold", "This job is on hold. Resume it to change its crew."],
    ["disposition_blocks_assignment", "lost", "This job is marked lost. Its crew can't be changed."],
    ["disposition_blocks_assignment", "closed", "This job is closed."],
    ["crew_not_eligible", "active", "That crew is no longer available. Pick another."],
    ["lead_not_eligible", "active", "That person can't lead this crew right now. Pick someone else."],
    ["capability_denied", "active", "You don't have access to change the crew on this job."],
    ["forbidden", "active", "You don't have access to change the crew on this job."],
    ["network", "active", "Couldn't save. Try again."],
    ["crew_assignment_unavailable", "active", "Couldn't save. Try again."],
    ["authorization_unavailable", "active", "Couldn't save. Try again."],
  ];
  test("every supported code maps to contractor copy; raw codes never render", () => {
    for (const [code, status, copy] of cases) {
      const message = jobCrewErrorMessage(code, status);
      assert.equal(message, copy, code);
      assert.doesNotMatch(message, /_/);
    }
    assert.doesNotMatch(SHEET, /\{result\.code\}|\{code\}|body\.message|body\.error/);
  });

  test("capability copy is neutral", () => {
    for (const source of [VIEW, PERSISTENCE]) {
      assert.doesNotMatch(source, /people who run production/);
    }
  });

  test("stale refetches and keeps the selection; ineligible crew refetches the list", () => {
    assert.match(HOOK, /result\.code === "stale_assignment" \|\| result\.code === "crew_not_eligible"/);
    assert.match(SHEET, /code === "crew_not_eligible"[\s\S]*?await loadBoard\(\)/);
    assert.match(SHEET, /code === "disposition_blocks_assignment"\) onJobChanged\(\)/);
  });
});

describe("request safety", () => {
  test("the same intent keeps its request id until it settles; only transport failures retry", () => {
    assert.equal(isRetryableCrewFailure("network"), true);
    assert.equal(isRetryableCrewFailure("crew_assignment_unavailable"), true);
    assert.equal(isRetryableCrewFailure("stale_assignment"), false);
    assert.equal(isRetryableCrewFailure("capability_denied"), false);
    assert.match(HOOK, /if \(pendingRef\.current\?\.signature !== signature\)/);
    assert.match(HOOK, /if \(result\.ok \|\| !isRetryableCrewFailure\(result\.code\)\)\s*\{\s*pendingRef\.current = null;/);
  });

  test("the intent signature covers crew, lead and expected current", () => {
    const base = { crewId: CREW_A, lead: { personId: PERSON }, expectedPrimaryAssignmentId: null };
    assert.equal(crewIntentSignature(base), crewIntentSignature({ ...base }));
    assert.notEqual(crewIntentSignature(base), crewIntentSignature({ ...base, crewId: CREW_B }));
    assert.notEqual(crewIntentSignature(base), crewIntentSignature({ ...base, lead: null }));
    assert.notEqual(crewIntentSignature(base), crewIntentSignature({ ...base, lead: { userId: USER } }));
    assert.notEqual(crewIntentSignature(base), crewIntentSignature({ ...base, expectedPrimaryAssignmentId: "x" }));
  });

  test("route reads are strict: malformed is unavailable, never an empty history", () => {
    assert.equal(readJobCrewAssignments(null), null);
    assert.equal(readJobCrewAssignments({ jobId: JOB, primaryActiveAssignmentId: null }), null);
    assert.equal(readJobCrewAssignments({ jobId: JOB, primaryActiveAssignmentId: "a1", assignments: [] }), null);
    const ok = readJobCrewAssignments(model([assignment()]));
    assert.equal(ok?.primaryActiveAssignmentId, "a1");
  });
});

describe("coordinator separation", () => {
  test("the Coordinator control has no Crew label input and never sends crewLabel", () => {
    assert.doesNotMatch(LEAD_CONTROL, /crewLabel|crew_label|Crew label|production-lead-crew/);
    assert.match(
      LEAD_CONTROL,
      /JSON\.stringify\(\{\s*assignedTo: nextAssigned,\s*expectedAssignedTo: assignedTo,\s*requestId: pending\.current\.requestId,\s*\}\)/
    );
  });

  test("no crew_label under the Coordinator and no combined Assigned to", () => {
    assert.doesNotMatch(COMPOSITION, /crewLabel/);
    assert.doesNotMatch(BRIEF, /schedule\.crewLabel/);
    for (const source of [FACT, SHEET, BRIEF]) assert.doesNotMatch(source, /Assigned to/);
    assert.doesNotMatch(CLIENT, /productionLeadCrewLabel|crewLabel=|crew_label: crewLabel/);
  });

  test("Coordinator and Crew stay separate cards; the Overview row is parked (not rendered)", () => {
    assert.doesNotMatch(CLIENT, /<JobCardOverviewPeople|<JobCardOverviewCoordinatorCard|<JobCardOverviewCrewCard/);
    assert.doesNotMatch(CLIENT, /<JobCardCrewActionButton|<JobCardProductionLeadControl/);
    assert.match(CLIENT, /useJobCoordinator\(currentJobId\)/);
    assert.match(CLIENT, /useJobCrewAssignment\(/);
    assert.match(PEOPLE, /kind="coordinator"/);
    assert.match(PEOPLE, /kind="crew"/);
    assert.match(PEOPLE, /data-jobcard-overview-person=\{kind\}/);
    assert.match(PEOPLE, /factState=\{jobCrewFactState\(view\)\}/);
    assert.doesNotMatch(PEOPLE, /Assigned to|rosterListedCount|memberCount|access|login/i);
  });

  test("on the Overview the people live only in the paired row, not again in the Field Brief", () => {
    assert.match(CLIENT, /peopleElsewhere/);
    assert.match(BRIEF, /const recordPeople = overviewMode === "record" && !peopleElsewhere;/);
    assert.match(BRIEF, /crewFact\?: ReactNode/);
    assert.match(BRIEF, /data-field-brief-crew/);
  });

  test("job-scoped readers get the read-only fact (action is gated by company jobs.assign)", () => {
    assert.match(CLIENT, /canAssign: companyMembers\.canAssignJobs/);
    const view = ready(model([assignment()]), { canAssign: false });
    assert.equal(view.text, "Harris Crew");
    assert.equal(view.action, null);
  });
});

describe("scope", () => {
  test("no Job Board, Calendar, or grant code in the Job → Crew UI", () => {
    for (const source of UI_FILES) {
      assert.doesNotMatch(source, /tools\/roofing\/saved|SavedClient|JobBoard|calendar|Calendar/);
      assert.doesNotMatch(source, /job_access_grants|access_grants|grant_job_access|packageKeys:/);
    }
  });
});
