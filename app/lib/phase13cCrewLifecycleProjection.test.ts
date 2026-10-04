/**
 * Phase 13C Crew integration slice 1: Crew lifecycle (Lost / Complete / Closed end the
 * assignment in one jobs trigger), current-Crew projections, Crew week, Team "This week"
 * per Crew, archive blocking with Job context, live Lead name, crew_label precedence.
 * Live staging behaviour is proven by tmp/phase13c-crew-slice1/matrix.mts.
 * Run: npx tsx --test app/lib/phase13cCrewLifecycleProjection.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CurrentCrewReadError,
  JOB_CURRENT_CREWS_MAX_JOBS,
  crewWeekJobs,
  loadCrewWeek,
  loadJobCurrentCrews,
  parseCrewWeek,
  parseJobCurrentCrews,
  primaryCurrentCrew,
  readCrewWeek,
} from "./crew/currentCrew";
import { CREW_ARCHIVE_BLOCK_COPY, CREW_WEEK_COPY } from "./crew/crewCopy";
import { composeJobCrewActivity } from "./jobActivityChronology";
import { JOB_CREW_END_REASONS, JOB_CREW_LIFECYCLE_END_REASONS, endReasonLabel, parseJobCrewAssignments } from "./jobCrewAssignmentModel";
import { jobCrewErrorMessage } from "./jobCrewAssignmentView";
import { parseCrewArchiveBlock, readCrewArchiveBlock, runTeamBoardAction, TeamBoardHttpError } from "./team/teamBoardPersistence";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NAME = "20261001160000_phase13c_crew_lifecycle_projection.sql";
const PRIOR_NAME = "20260930120000_phase13c_job_crew_assignments.sql";
const SQL = read(`supabase/migrations/${NAME}`);
const PRIOR = read(`supabase/migrations/${PRIOR_NAME}`);
const CODE = SQL.replace(/^\s*--.*$/gm, "");

function fn(sql: string, header: string): string {
  const start = sql.indexOf(header);
  assert.ok(start >= 0, header);
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start, header);
  return sql.slice(start, end + "\n$$;".length);
}

const TRIGGER_FN = fn(SQL, "create or replace function private.job_crew_end_on_job_lifecycle_trg_v1()");
const TRIGGER = SQL.slice(SQL.indexOf("create trigger jobs_crew_assignment_lifecycle"), SQL.indexOf("-- Backfill"));
const BACKFILL = SQL.slice(SQL.indexOf("-- Backfill"), SQL.indexOf("-- change_job_disposition_v1: restored"));
const SET_PRIMARY = fn(SQL, "create or replace function public.set_primary_job_crew_v1(");
const READ = fn(SQL, "create or replace function public.get_job_crew_assignments_v1(");
const ARCHIVE = fn(SQL, "create or replace function public.archive_crew_v1(");
const LIST = fn(SQL, "create or replace function public.list_job_current_crews_v1(");
const WEEK = fn(SQL, "create or replace function public.get_crew_week_v1(");
const MARKED = /[ ]*-- phase13c crew lifecycle: begin\n[\s\S]*?[ ]*-- phase13c crew lifecycle: end\n/g;

const TEAM = strip(read("app/tools/team/TeamBoardClient.tsx"));
const WEEK_ROUTE = strip(read("app/api/team/week/route.ts"));
const CURRENT_ROUTE = strip(read("app/api/jobs/current-crews/route.ts"));
const CURRENT_CREW = strip(read("app/lib/crew/currentCrew.ts"));
const TEAM_WEEK = strip(read("app/lib/team/teamWeek.ts"));

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("migration order", () => {
  test("follows the Job → Crew foundation and the latest prior migration", () => {
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    assert.ok(names.indexOf(NAME) > names.indexOf(PRIOR_NAME));
  });

  test("no later migration redefines the Crew lifecycle trigger or Crew assignment functions", () => {
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    for (const later of names.slice(names.indexOf(NAME) + 1)) {
      assert.doesNotMatch(
        read(`supabase/migrations/${later}`),
        /job_crew_end_on_job_lifecycle_trg_v1|jobs_crew_assignment_lifecycle|function public\.(set_primary_job_crew_v1|get_job_crew_assignments_v1|archive_crew_v1)/i,
        later
      );
    }
  });
});

describe("lifecycle: one durable place, atomic with the transition", () => {
  test("explicit end reasons; no overloaded reason", () => {
    assert.match(SQL, /end_reason in \('replaced', 'lead_changed', 'ended', 'job_lost', 'job_completed', 'job_closed'\)/);
    assert.deepEqual([...JOB_CREW_END_REASONS], ["replaced", "lead_changed", "ended", "job_lost", "job_completed", "job_closed"]);
    assert.deepEqual([...JOB_CREW_LIFECYCLE_END_REASONS], ["job_lost", "job_completed", "job_closed"]);
  });

  test("an AFTER UPDATE OF status, stage trigger on jobs fires only for Lost, Closed, or stage Complete", () => {
    assert.match(TRIGGER, /after update of status, stage on public\.jobs\n  for each row/);
    assert.match(TRIGGER, /\(new\.status is distinct from old\.status and new\.status in \('lost', 'closed'\)\)\n    or \(new\.stage is distinct from old\.stage and new\.stage = 'complete'\)/);
    assert.doesNotMatch(TRIGGER, /on_hold|'active'/, "On hold keeps the Crew; returning to active restores nothing");
  });

  test("reason mapping is semantic; Lost / Closed by status, Complete by stage", () => {
    assert.match(TRIGGER_FN, /new\.status = 'lost' then\n    v_reason := 'job_lost';/);
    assert.match(TRIGGER_FN, /new\.status = 'closed' then\n    v_reason := 'job_closed';/);
    assert.match(TRIGGER_FN, /new\.stage = 'complete' then\n    v_reason := 'job_completed';/);
  });

  test("ends every active row of the Job (primary and not), only rows not already ended", () => {
    assert.match(TRIGGER_FN, /where a\.company_id = new\.company_id\n      and a\.job_id = new\.id\n      and a\.ended_at is null/);
    assert.doesNotMatch(TRIGGER_FN, /is_primary\s*(=|and)|and a\.is_primary/);
    assert.match(TRIGGER_FN, /set ended_at = v_now, ended_by = coalesce\(v_actor, a\.started_by\), end_reason = v_reason/);
  });

  test("one job_crew_assignment_ended event per ended row, carrying the reason", () => {
    assert.match(TRIGGER_FN, /returning a\.\*\n  loop\n    perform public\.job_lifecycle_insert_activity\(/);
    assert.match(TRIGGER_FN, /'job_crew_assignment_ended'/);
    assert.match(TRIGGER_FN, /'end_reason', v_reason/);
  });

  test("never inserts or restores assignments, never touches schedules or the Coordinator", () => {
    assert.doesNotMatch(TRIGGER_FN, /insert into public\.job_crew_assignments|job_schedules|assigned_to|crew_label/);
  });

  test("trigger function is SECURITY DEFINER with a pinned search_path and no public execute", () => {
    assert.match(TRIGGER_FN, /security definer\nset search_path = pg_catalog, public/);
    assert.match(SQL, /revoke all on function private\.job_crew_end_on_job_lifecycle_trg_v1\(\) from public;/);
  });

  test("backfill ends existing active rows on terminal Jobs, marked as a backfill with no actor", () => {
    assert.match(BACKFILL, /and a\.ended_at is null/);
    assert.match(BACKFILL, /\(j\.status in \('lost', 'closed'\) or j\.stage = 'complete'\)/);
    assert.match(BACKFILL, /'source', 'lifecycle_backfill'/);
    assert.match(BACKFILL, /'job_crew_assignment_ended',\n      null,/);
  });

  test("current (provisional) guard: a Job whose CURRENT stage is Complete takes no new Crew; the guard reads no history", () => {
    const added = [...SET_PRIMARY.matchAll(MARKED)].map((m) => m[0]);
    assert.equal(added.length, 1);
    assert.match(added[0], /if v_job\.stage = 'complete' then\n      return jsonb_build_object\('ok', false, 'code', 'work_complete_blocks_assignment'\);/);
    assert.doesNotMatch(added[0], /completed_at|job_activity_events|job_crew_assignments|end_reason|job_completed|production_started_at/);
    assert.ok(SET_PRIMARY.indexOf("for update;") < SET_PRIMARY.indexOf(added[0]), "reads the locked row's current stage");
    assert.equal(jobCrewErrorMessage("work_complete_blocks_assignment", "active"), "Work on this job is complete. It doesn't take a new crew.");
  });
});

// Current behavior only. Crew at Complete is parked Team/Crew work (provisional), not a
// permanent product lock; these pins describe what the shipped RPCs do today.
describe("current behavior: no RPC moves a Complete Job back; Closed reopen changes disposition only", () => {
  const LIFECYCLE = read("supabase/migrations/20260929120000_phase13c_s1_access_vocabulary_completion_split.sql");
  const CAPS = read("supabase/migrations/20261002120000_core_disposition_authority_and_job_write_boundary.sql");
  const START = fn(LIFECYCLE.replace(/\$function\$/g, "$$$$"), "CREATE OR REPLACE FUNCTION public.start_job_work_v1(p_payload jsonb)");
  const BASELINE = read("supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql");
  const TRANSITION = BASELINE.slice(
    BASELINE.indexOf('CREATE OR REPLACE FUNCTION "public"."transition_job_stage_v1"'),
    BASELINE.indexOf('ALTER FUNCTION "public"."transition_job_stage_v1"')
  );
  const DISPOSITION = fn(CAPS.replace(/\$function\$/g, "$$$$"), "CREATE OR REPLACE FUNCTION public.change_job_disposition_v1(p_payload jsonb)");

  test("Start work refuses a Complete Job; the stage RPC (defined once, in the baseline) only writes Intake → Proposal", () => {
    const definers = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => /create or replace function "?public"?\."?transition_job_stage_v1"?\(/i.test(read(`supabase/migrations/${name}`)));
    assert.deepEqual(definers, ["20260909130000_canonical_pre_recovery_baseline.sql"]);
    assert.match(START, /if v_from = 'complete' then\s+return jsonb_build_object\(\s+'ok', false,\s+'code', 'illegal_stage'/);
    assert.match(TRANSITION, /if not \(v_from = 'intake' and v_to = 'proposal'\) then/);
  });

  test("Closed reopen (disposition → active) never writes stage, so a Complete Job stays Complete", () => {
    assert.match(DISPOSITION, /set\n    status = v_to,\n    last_activity_at = v_now\n  where/);
    const writes = [...DISPOSITION.matchAll(/update public\.jobs\n  set\n([\s\S]*?)\n  where/g)].map((m) => m[1]);
    assert.equal(writes.length, 1);
    assert.doesNotMatch(writes[0], /stage/);
  });
});

describe("copied functions are exact except for the marked additions", () => {
  test("set_primary_job_crew_v1 and get_job_crew_assignments_v1", () => {
    for (const header of [
      "create or replace function public.set_primary_job_crew_v1(",
      "create or replace function public.get_job_crew_assignments_v1(",
    ]) {
      const stripped = fn(SQL, header).replace(new RegExp(`${MARKED.source}\\n?`, "g"), "");
      assert.equal(stripped, fn(PRIOR, header), header);
    }
  });

  test("archive_crew_v1 replaces only the active-assignment block", () => {
    const prior = fn(PRIOR, "create or replace function public.archive_crew_v1(");
    const oldBlock = prior.slice(prior.indexOf("  if exists (\n    select 1 from public.job_crew_assignments a"), prior.indexOf("\n\n  update public.crews") + 1);
    assert.match(oldBlock, /'code', 'crew_actively_assigned'\);\n  end if;\n$/);
    assert.equal(ARCHIVE.replace(MARKED, oldBlock), prior);
  });
});

describe("archive blocking names readable Jobs only; terminal Jobs never block", () => {
  test("counts every current Job, names at most five readable ones", () => {
    assert.match(ARCHIVE, /'blocking_job_count', \(\n        select count\(distinct a\.job_id\)/);
    assert.match(ARCHIVE, /private\.member_can_v1\('jobs\.read', a\.job_id\)/);
    assert.match(ARCHIVE, /limit 5/);
    assert.match(ARCHIVE, /'blocking_jobs', coalesce\(/);
  });

  test("server parse keeps valid rows and never under-counts", () => {
    const block = parseCrewArchiveBlock({
      blocking_job_count: 3,
      blocking_jobs: [{ job_id: U(1), label: " Owen Brooks " }, { job_id: "nope", label: "x" }, { job_id: U(2), label: "" }],
    });
    assert.deepEqual(block, { blockingJobs: [{ jobId: U(1), label: "Owen Brooks" }], blockingJobCount: 3 });
    assert.equal(parseCrewArchiveBlock({ blocking_job_count: 0, blocking_jobs: [{ job_id: U(1), label: "A" }] }).blockingJobCount, 1);
  });

  test("client read requires the block code", () => {
    assert.equal(readCrewArchiveBlock({ code: "stale_revision", blockingJobs: [] }), null);
    assert.deepEqual(readCrewArchiveBlock({ code: "crew_actively_assigned", blockingJobs: [{ jobId: U(1), label: "A" }], blockingJobCount: 2 }), {
      blockingJobs: [{ jobId: U(1), label: "A" }],
      blockingJobCount: 2,
    });
  });

  test("runTeamBoardAction carries the blocking Jobs on the 409", async () => {
    const client = {
      rpc: async () => ({
        data: { ok: false, code: "crew_actively_assigned", blocking_job_count: 1, blocking_jobs: [{ job_id: U(1), label: "Owen Brooks" }] },
        error: null,
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(runTeamBoardAction(client, { action: "archive_crew", crewId: U(9), expectedRowVersion: 1 }), (error: unknown) => {
      assert.ok(error instanceof TeamBoardHttpError);
      assert.equal(error.status, 409);
      assert.deepEqual(error.details, { blockingJobs: [{ jobId: U(1), label: "Owen Brooks" }], blockingJobCount: 1 });
      return true;
    });
  });

  test("the actions route returns the details; the Team client renders linked Jobs from centralized copy", () => {
    assert.match(strip(read("app/api/team/actions/route.ts")), /\.\.\.error\.details/);
    assert.match(TEAM, /function ArchiveBlocked/);
    assert.match(TEAM, /CREW_ARCHIVE_BLOCK_COPY\.heading\(crewName\)/);
    assert.match(TEAM, /buildJobCardHref\(job\.jobId\)[\s\S]*data-team-archive-blocking-job/);
    assert.equal(CREW_ARCHIVE_BLOCK_COPY.heading("Harris Crew"), "Harris Crew is still the crew on:");
    assert.match(CREW_ARCHIVE_BLOCK_COPY.help, /Lost and completed jobs never block/);
  });
});

describe("list_job_current_crews_v1", () => {
  test("company-scoped, jobs.read per Job, current rows only, capped", () => {
    assert.match(LIST, /private\.current_active_company_id\(\)/);
    assert.match(LIST, /private\.member_can_v1\('jobs\.read', j\.id\)/);
    assert.match(LIST, /a\.ended_at is null/);
    assert.match(LIST, /cardinality\(p_job_ids\) > 200/);
    assert.equal(JOB_CURRENT_CREWS_MAX_JOBS, 200);
  });

  test("every readable Job is returned with a list; deterministic order; live names", () => {
    assert.match(LIST, /'crews', coalesce\(\([\s\S]*\), '\[\]'::jsonb\)/);
    assert.match(LIST, /order by a\.is_primary desc, a\.started_at, a\.id/);
    assert.match(LIST, /\) order by j\.id\)/);
    assert.match(LIST, /'crew_name', c\.name/);
    assert.match(LIST, /coalesce\(lp\.display_name, a\.assignment_lead_name_snapshot\)/);
  });

  test("no access facts, Coordinator, legacy label, or display words in the logic", () => {
    assert.doesNotMatch(LIST, /phone|email|linked_user_id|role|assigned_to|crew_label|'Crew'|'Lead'|Coordinator/);
  });
});

describe("get_crew_week_v1", () => {
  test("bounded civil range and civil overlap with inclusive ends_on", () => {
    assert.match(WEEK, /p_after_end_on <= p_starts_on or p_after_end_on - p_starts_on > 42/);
    assert.match(WEEK, /s\.starts_on < p_after_end_on\n        and coalesce\(s\.ends_on, s\.starts_on\) >= p_starts_on/);
  });

  test("Calendar work schedules joined to current assignments; both reads checked per Job", () => {
    assert.match(WEEK, /s\.kind = 'work' and s\.status = 'scheduled'/);
    assert.match(WEEK, /a\.ended_at is null/);
    assert.match(WEEK, /private\.member_can_v1\('jobs\.read', j\.id\)\n        and private\.member_can_v1\('schedule\.read', j\.id\)/);
  });

  test("terminal and deleted Jobs never appear", () => {
    assert.match(WEEK, /j\.deleted_at is null\n        and j\.status not in \('lost', 'closed'\)\n        and j\.stage <> 'complete'/);
  });

  test("deterministic order; no Coordinator, login, or access facts", () => {
    assert.match(WEEK, /order by s\.starts_on, lower\(c\.name\), a\.crew_id, j\.id/);
    assert.doesNotMatch(WEEK, /assigned_to|linked_user_id|email|phone|role|crew_label/);
  });

  test("grants: authenticated and service_role only; anon and public revoked", () => {
    for (const sig of ["public.list_job_current_crews_v1(uuid[])", "public.get_crew_week_v1(date, date)"]) {
      assert.ok(SQL.includes(`revoke all on function ${sig} from public, anon, authenticated;`), sig);
      assert.ok(SQL.includes(`grant execute on function ${sig} to authenticated, service_role;`), sig);
    }
    for (const body of [LIST, WEEK]) assert.match(body, /stable\nsecurity definer\nset search_path = pg_catalog, public/);
  });
});

describe("crew_label", () => {
  test("clients cannot write the legacy label", () => {
    assert.match(SQL, /revoke update \(crew_label\) on public\.jobs from anon, authenticated;/);
  });
});

describe("no display words in authority or lifecycle logic", () => {
  test("the migration's logic uses semantic keys only", () => {
    assert.doesNotMatch(CODE, /\b(Coordinator|Project Manager|Foreman|Supervisor)\b/i);
    assert.doesNotMatch(CODE, /'(Crew|Lead|Coordinator|Project Manager)'/);
  });
});

describe("current-Crew read model", () => {
  const crewRow = (n: number, extra: Record<string, unknown> = {}) => ({
    assignment_id: U(100 + n), crew_id: U(200 + n), crew_name: `Crew ${n}`, is_primary: true,
    assignment_lead_person_id: null, assignment_lead_name: null, ...extra,
  });

  test("strict multi-job parse; empty list means no Crew; malformed is null", () => {
    const parsed = parseJobCurrentCrews({ ok: true, jobs: [{ job_id: U(1), crews: [crewRow(1)] }, { job_id: U(2), crews: [] }] });
    assert.deepEqual(parsed?.map((j) => j.crews.length), [1, 0]);
    assert.equal(primaryCurrentCrew(parsed?.[0])?.crewName, "Crew 1");
    assert.equal(primaryCurrentCrew(parsed?.[1]), null);
    assert.equal(parseJobCurrentCrews({ ok: true, jobs: [{ job_id: U(1) }] }), null);
    assert.equal(parseJobCurrentCrews({ ok: true, jobs: [{ job_id: U(1), crews: [crewRow(1, { assignment_lead_person_id: U(3) })] }] }), null, "Lead id without name");
    assert.equal(parseJobCurrentCrews({ ok: false, code: "forbidden" }), null);
  });

  test("Crew week parse and per-Crew jobs: soonest first, each Job once", () => {
    const item = (n: number, crew: number, startsOn: string) => ({
      ...crewRow(crew), assignment_id: U(300 + n), job_id: U(400 + (n % 3)), customer_name: `Job ${n % 3}`, address: "",
      job_status: "active", starts_on: startsOn, ends_on: startsOn,
    });
    const week = parseCrewWeek({ ok: true, starts_on: "2026-09-28", after_end_on: "2026-10-05", items: [item(1, 1, "2026-10-01"), item(2, 1, "2026-09-29"), item(4, 1, "2026-10-02"), item(5, 2, "2026-09-30")] });
    assert.ok(week);
    assert.deepEqual(crewWeekJobs(week, U(201)).map((j) => j.startsOn), ["2026-09-29", "2026-10-01"]);
    assert.deepEqual(crewWeekJobs(week, U(202)).length, 1);
    assert.deepEqual(crewWeekJobs(week, U(299)), []);
    assert.equal(parseCrewWeek({ ok: true, starts_on: "2026-09-28", after_end_on: "2026-10-05", items: [{ job_id: U(1) }] }), null);
    assert.equal(readCrewWeek(JSON.parse(JSON.stringify(week)))?.items.length, 4);
    assert.equal(readCrewWeek({ startsOn: "2026-09-28", afterEndOn: "2026-10-05", jobs: [] }), null);
  });

  test("loaders: cap and bad ids rejected before the RPC; read failures are errors, not empty", async () => {
    let calls = 0;
    const failing = { rpc: async () => ((calls += 1), { data: null, error: { message: "x" } }) } as unknown as SupabaseClient;
    await assert.rejects(loadJobCurrentCrews(failing, Array.from({ length: 201 }, (_, i) => U(i))), (e: unknown) => e instanceof CurrentCrewReadError && e.code === "invalid_payload");
    await assert.rejects(loadJobCurrentCrews(failing, ["nope"]), CurrentCrewReadError);
    assert.equal(calls, 0);
    assert.deepEqual(await loadJobCurrentCrews(failing, []), []);
    await assert.rejects(loadCrewWeek(failing, { startsOn: "2026-09-28", afterEndOn: "2026-10-05" }), (e: unknown) => e instanceof CurrentCrewReadError && e.code === "unavailable");
    const forbidden = { rpc: async () => ({ data: { ok: false, code: "forbidden" }, error: null }) } as unknown as SupabaseClient;
    await assert.rejects(loadCrewWeek(forbidden, { startsOn: "2026-09-28", afterEndOn: "2026-10-05" }), (e: unknown) => e instanceof CurrentCrewReadError && e.code === "forbidden");
  });

  test("never inferred from the Coordinator, a login, a role, or an email", () => {
    for (const source of [CURRENT_CREW, TEAM_WEEK]) {
      assert.doesNotMatch(source.replace(/^.*\*.*$/gm, ""), /assigned_to|linkedUserId|userId|email|role\b/);
    }
  });

  test("current-crews route: authenticated, capped, no direct table reads", () => {
    assert.match(CURRENT_ROUTE, /loadJobCurrentCrews\(/);
    assert.match(CURRENT_ROUTE, /status: 401/);
    assert.doesNotMatch(CURRENT_ROUTE, /\.from\(|assigned_to|crew_label/);
  });
});

describe("live Lead name, snapshot history", () => {
  test("get_job_crew_assignments_v1 adds the live Person name; snapshots stay", () => {
    const added = [...READ.matchAll(MARKED)].map((m) => m[0]);
    assert.equal(added.length, 1);
    assert.match(added[0], /'assignment_lead_current_name', lp\.display_name,/);
    assert.match(READ, /'assignment_lead_name_snapshot', a\.assignment_lead_name_snapshot/);
  });

  test("the parser drops a live name when no one leads", () => {
    const base = {
      id: U(1), crew_id: U(2), is_primary: true, started_at: "2026-10-01T00:00:00Z", ended_at: null, end_reason: null,
      supersedes_assignment_id: null, crew_name_snapshot: "A", crew_current_name: "A", crew_archived: false,
      assignment_lead_archived: null, roster: [], roster_listed_count: 0,
    };
    const led = parseJobCrewAssignments({ ok: true, job_id: U(9), primary_active_assignment_id: U(1), assignments: [{ ...base, assignment_lead_person_id: U(3), assignment_lead_name_snapshot: "Tim", assignment_lead_current_name: "Timothy", assignment_lead_archived: false }] });
    assert.equal(led?.assignments[0].assignmentLeadCurrentName, "Timothy");
    assert.equal(led?.assignments[0].assignmentLeadNameSnapshot, "Tim");
    const none = parseJobCrewAssignments({ ok: true, job_id: U(9), primary_active_assignment_id: U(1), assignments: [{ ...base, assignment_lead_person_id: null, assignment_lead_name_snapshot: null, assignment_lead_current_name: "Ghost" }] });
    assert.equal(none?.assignments[0].assignmentLeadCurrentName, null);
  });
});

describe("activity", () => {
  test("lifecycle endings say why; a manual end adds nothing", () => {
    assert.deepEqual(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "job_lost" }), {
      title: "Crew assignment ended",
      detail: "Harris Crew · Job lost",
    });
    assert.equal(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "job_completed" })?.detail, "Harris Crew · Work complete");
    assert.equal(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "job_closed" })?.detail, "Harris Crew · Job closed");
    assert.equal(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "ended" })?.detail, "Harris Crew");
    assert.equal(endReasonLabel("job_completed"), "Work complete");
  });
});

describe("Team This week per Crew", () => {
  test("the route reads get_crew_week_v1 through the shared loader in the company timezone", () => {
    assert.match(WEEK_ROUTE, /loadCrewWeek\(supabase, teamWeekRange\(todayCivilIso\(timezone\)\)\)/);
    assert.doesNotMatch(WEEK_ROUTE, /assigned_to|job_schedules|\.from\("jobs"\)/);
  });

  test("each Crew shows its own week; no Lead-login or Coordinator week remains", () => {
    assert.match(TEAM, /data-team-crew-week=\{crew\.id\}/);
    assert.match(TEAM, /weekJobsForCrew\(/);
    assert.doesNotMatch(TEAM, /weekJobsFor\(|coordinatorUserId|lead\.userId : null/);
  });

  test("loading, error with retry, then empty only after a successful read", () => {
    const work = TEAM.slice(TEAM.indexOf("function WeekWork"), TEAM.indexOf("function ArchiveBlocked"));
    assert.ok(work.indexOf('data-team-week="loading"') < work.indexOf('data-team-week="error"'));
    assert.ok(work.indexOf('data-team-week="error"') < work.indexOf('data-team-week="none"'));
    assert.match(work, /data-team-week-retry/);
    assert.match(work, /job\.jobStatus === "on_hold"/);
  });

  test("week copy is centralized", () => {
    assert.equal(CREW_WEEK_COPY.count(1), "1 job this week");
    assert.equal(CREW_WEEK_COPY.count(3), "3 jobs this week");
    assert.equal(CREW_WEEK_COPY.none, "No jobs this week");
    assert.equal(CREW_WEEK_COPY.unavailable, "This week couldn't be loaded.");
    const work = TEAM.slice(TEAM.indexOf("function WeekWork"), TEAM.indexOf("function ArchiveBlocked"));
    assert.doesNotMatch(work, />\s*(No jobs this week|View in calendar|Try again|On hold)\s*</);
  });
});
