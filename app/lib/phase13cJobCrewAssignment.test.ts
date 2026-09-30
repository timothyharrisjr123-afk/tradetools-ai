/**
 * Phase 13C durable Job → Crew assignment foundation: static SQL contract (the migration
 * is not applied by this suite), read model, persistence, route, and Activity.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyJobActivityEvent, composeJobActivityChronology, composeJobCrewActivity } from "./jobActivityChronology";
import {
  activeAssignments,
  endReasonLabel,
  parseJobCrewAssignments,
  primaryActiveAssignment,
  rosterLabel,
} from "./jobCrewAssignmentModel";
import {
  JobCrewAssignmentHttpError,
  endJobCrewAssignment,
  loadJobCrewAssignments,
  setPrimaryJobCrew,
} from "./jobCrewAssignmentPersistence";
import { JOB_ACTIVITY_EVENT_TYPES } from "./jobLifecycleTypes";
import { TEAM_BOARD_MESSAGES, runTeamBoardAction } from "./team/teamBoardPersistence";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const MIGRATION_NAME = "20260930120000_phase13c_job_crew_assignments.sql";
const SQL = read(`supabase/migrations/${MIGRATION_NAME}`);
const TEAM_SQL = read("supabase/migrations/20260929130000_phase13c_team_board_people_crews.sql");
const CODE = SQL.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

function fn(sql: string, name: string): string {
  const header = `create or replace function ${name}(`;
  const start = sql.indexOf(header);
  assert.ok(start >= 0, `missing ${name}`);
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start, `unterminated ${name}`);
  return sql.slice(start, end + 4);
}

const SET_PRIMARY = fn(SQL, "public.set_primary_job_crew_v1");
const END = fn(SQL, "public.end_job_crew_assignment_v1");
const READ = fn(SQL, "public.get_job_crew_assignments_v1");
const REPLAY = fn(SQL, "private.job_crew_replay_v1");
const RESULT = fn(SQL, "private.job_crew_set_result_v1");
const IMMUTABLE = fn(SQL, "private.job_crew_assignments_immutable_trg_v1");
const ARCHIVE_PERSON = fn(SQL, "public.archive_company_person_v1");
const ARCHIVE_CREW = fn(SQL, "public.archive_crew_v1");
const stripTsComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ROUTE = stripTsComments(read("app/api/jobs/[jobId]/crew-assignment/route.ts"));
const PERSISTENCE = stripTsComments(read("app/lib/jobCrewAssignmentPersistence.ts"));
const MODEL = stripTsComments(read("app/lib/jobCrewAssignmentModel.ts"));

const JOB = "11111111-1111-4111-8111-111111111111";
const CREW_A = "22222222-2222-4222-8222-222222222222";
const CREW_B = "33333333-3333-4333-8333-333333333333";
const PERSON = "44444444-4444-4444-8444-444444444444";
const ASSIGN_A = "55555555-5555-4555-8555-555555555555";
const ASSIGN_B = "66666666-6666-4666-8666-666666666666";
const BOB = "77777777-7777-4777-8777-777777777777";

function order(source: string, markers: string[]) {
  let last = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, last + 1);
    assert.ok(index > last, `${marker} must follow the previous step`);
    last = index;
  }
}

describe("migration identity", () => {
  test("follows the Team Board foundation and avoids reserved 038/039 names", () => {
    const names = readdirSync(join(ROOT, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();
    assert.ok(names.indexOf(MIGRATION_NAME) > names.indexOf("20260929140000_phase13c_team_board_person_details.sql"));
    assert.doesNotMatch(MIGRATION_NAME, /038|039/);
  });
});

describe("storage", () => {
  test("assignment carries every approved field", () => {
    for (const column of [
      "id uuid primary key", "company_id uuid not null", "job_id uuid not null", "crew_id uuid not null",
      "is_primary boolean not null", "assignment_lead_person_id uuid,", "crew_name_snapshot text not null",
      "assignment_lead_name_snapshot text,", "started_at timestamptz not null", "started_by uuid not null",
      "ended_at timestamptz,", "ended_by uuid,", "end_reason text,", "request_id text,", "supersedes_assignment_id uuid,",
    ]) {
      assert.ok(SQL.includes(column), column);
    }
    const table = SQL.slice(SQL.indexOf("create table public.job_crew_assignments ("), SQL.indexOf("comment on table public.job_crew_assignments"));
    assert.doesNotMatch(table, /\bstatus\b|row_version/);
  });

  test("every reference is company-scoped by composite foreign key", () => {
    assert.match(SQL, /foreign key \(job_id, company_id\) references public\.jobs \(id, company_id\)/);
    assert.match(SQL, /foreign key \(crew_id, company_id\) references public\.crews \(id, company_id\)/);
    assert.match(SQL, /foreign key \(assignment_lead_person_id, company_id\) references public\.company_people \(id, company_id\)/);
    assert.match(SQL, /foreign key \(supersedes_assignment_id, company_id\) references public\.job_crew_assignments \(id, company_id\)/);
    assert.match(SQL, /foreign key \(assignment_id, company_id\) references public\.job_crew_assignments \(id, company_id\)/);
    assert.match(SQL, /foreign key \(person_id, company_id\) references public\.company_people \(id, company_id\)/);
  });

  test("the Assignment Lead is optional and its snapshot follows it", () => {
    assert.match(SQL, /check \(\(assignment_lead_person_id is null\) = \(assignment_lead_name_snapshot is null\)\)/);
    assert.doesNotMatch(CODE, /assignment_lead_person_id uuid not null|lead_required/);
  });

  test("end reasons are the approved four, and end fields move together", () => {
    assert.match(SQL, /end_reason in \('replaced', 'lead_changed', 'ended', 'job_closed'\)/);
    assert.match(SQL, /\(ended_at is null\) = \(ended_by is null\) and \(ended_at is null\) = \(end_reason is null\)/);
  });

  test("only an active PRIMARY assignment is unique per job; concurrent non-primary rows stay possible", () => {
    assert.match(SQL, /create unique index job_crew_assignments_one_active_primary_uidx\s+on public\.job_crew_assignments \(job_id\)\s+where is_primary and ended_at is null;/);
    const uniques = [...SQL.matchAll(/create unique index (\w+)\s+on public\.job_crew_assignments \(([^)]*)\)\s*(where [^;]+)?;/g)];
    for (const [, name, columns, where] of uniques) {
      if (columns.trim() === "job_id") {
        assert.equal(name, "job_crew_assignments_one_active_primary_uidx");
        assert.match(where ?? "", /is_primary/);
      }
    }
    assert.doesNotMatch(SQL, /check \(is_primary\)|is_primary = true\)/);
  });

  test("request ids are unique per company for replay", () => {
    assert.match(SQL, /job_crew_assignments_request_uidx\s+on public\.job_crew_assignments \(company_id, request_id\)\s+where request_id is not null/);
  });

  test("roster snapshot table is immutable and keyed to the assignment", () => {
    assert.match(SQL, /create table public\.job_crew_assignment_roster/);
    assert.match(SQL, /primary key \(assignment_id, person_id\)/);
    assert.match(fn(SQL, "private.job_crew_assignment_roster_immutable_trg_v1"), /roster snapshot is immutable/);
    assert.match(SQL, /before update on public\.job_crew_assignment_roster/);
  });

  test("no client table privileges", () => {
    assert.match(SQL, /alter table public\.job_crew_assignments enable row level security;/);
    assert.match(SQL, /alter table public\.job_crew_assignment_roster enable row level security;/);
    assert.match(SQL, /revoke all on table public\.job_crew_assignments, public\.job_crew_assignment_roster\s+from public, anon, authenticated;/);
    assert.doesNotMatch(CODE, /grant [a-z, ]+ on (table )?public\.job_crew_assignment/i);
  });

  test("write functions are executable by authenticated only through explicit grants", () => {
    for (const sig of [
      "public.set_primary_job_crew_v1(uuid, uuid, uuid, uuid, text)",
      "public.end_job_crew_assignment_v1(uuid, uuid)",
      "public.get_job_crew_assignments_v1(uuid)",
    ]) {
      assert.ok(SQL.includes(`revoke all on function ${sig} from public, anon, authenticated;`), sig);
      assert.ok(SQL.includes(`grant execute on function ${sig} to authenticated, service_role;`), sig);
    }
    for (const sig of [
      "private.job_crew_set_result_v1(public.job_crew_assignments, boolean)",
      "private.job_crew_replay_v1(uuid, text, uuid, uuid, uuid)",
    ]) {
      assert.ok(SQL.includes(`revoke all on function ${sig} from public;`), sig);
      assert.ok(!SQL.includes(`grant execute on function ${sig}`), sig);
    }
  });
});

describe("immutability", () => {
  test("ended rows are immutable", () => {
    assert.match(IMMUTABLE, /if old\.ended_at is not null then\s+raise exception 'job_crew_assignments: ended assignment is immutable'/);
  });

  test("identity, Lead, snapshots, started fields, request id and supersedes link never change", () => {
    for (const column of [
      "id", "company_id", "job_id", "crew_id", "is_primary", "assignment_lead_person_id", "crew_name_snapshot",
      "assignment_lead_name_snapshot", "started_at", "started_by", "request_id", "supersedes_assignment_id",
    ]) {
      assert.match(IMMUTABLE, new RegExp(`new\\.${column} is distinct from old\\.${column}`), column);
    }
  });

  test("the only update allowed sets all end fields", () => {
    assert.match(IMMUTABLE, /if new\.ended_at is null or new\.ended_by is null or new\.end_reason is null then/);
    assert.match(SQL, /before update on public\.job_crew_assignments/);
  });
});

describe("set_primary_job_crew_v1", () => {
  test("exact step order with replay before every current-state check", () => {
    order(SET_PRIMARY, [
      "'unauthorized'",
      "private.crew_manager_company_v1()",
      "'invalid_payload'",
      "private.job_crew_replay_v1(",
      "from public.jobs j",
      "for update",
      "'disposition_blocks_assignment'",
      "'stale_assignment'",
      "'crew_not_eligible'",
      "'lead_not_eligible'",
      "insert into public.job_crew_assignments",
    ]);
    const firstReplay = SET_PRIMARY.indexOf("private.job_crew_replay_v1(");
    assert.ok(firstReplay < SET_PRIMARY.indexOf("disposition_blocks_assignment"));
    assert.ok(firstReplay < SET_PRIMARY.indexOf("stale_assignment"));
  });

  test("a request id is required", () => {
    assert.match(SET_PRIMARY, /p_request_id is null\s+or char_length\(p_request_id\) not between 1 and 120/);
  });

  test("replay is re-checked after the Job lock so a concurrent identical request resolves to one mutation", () => {
    const lock = SET_PRIMARY.indexOf("for update");
    const secondReplay = SET_PRIMARY.indexOf("private.job_crew_replay_v1(", lock);
    assert.ok(secondReplay > lock && secondReplay < SET_PRIMARY.indexOf("disposition_blocks_assignment"));
    assert.match(SET_PRIMARY, /when unique_violation then\s+v_replay := private\.job_crew_replay_v1\(/);
  });

  test("replay returns the original committed row with changed=false, or request_id_conflict", () => {
    assert.match(REPLAY, /where a\.company_id = p_company_id and a\.request_id = p_request_id/);
    assert.match(REPLAY, /v_prior\.job_id is distinct from p_job_id\s+or v_prior\.crew_id is distinct from p_crew_id\s+or v_prior\.assignment_lead_person_id is distinct from p_assignment_lead_person_id/);
    assert.match(REPLAY, /'code', 'request_id_conflict'/);
    assert.match(REPLAY, /return private\.job_crew_set_result_v1\(v_prior, false\);/);
    assert.doesNotMatch(REPLAY, /stale_assignment|disposition_blocks_assignment|status/);
  });

  test("the replayed result is the original identity: same assignment and supersedes link", () => {
    assert.match(RESULT, /'assignment_id', p_row\.id/);
    assert.match(RESULT, /'supersedes_assignment_id', p_row\.supersedes_assignment_id/);
    assert.match(RESULT, /'changed', p_changed/);
    assert.match(RESULT, /case when v_previous_crew_id = p_row\.crew_id then 'lead_changed' else 'replaced' end/);
  });

  test("assign/replace/lead change are blocked on on_hold, lost and closed jobs", () => {
    assert.match(SET_PRIMARY, /if v_job\.status in \('on_hold', 'lost', 'closed'\) then\s+return jsonb_build_object\('ok', false, 'code', 'disposition_blocks_assignment'\);/);
  });

  test("stale expected primary is rejected with the current id", () => {
    assert.match(SET_PRIMARY, /is distinct from p_expected_primary_assignment_id then/);
    assert.match(SET_PRIMARY, /'current_primary_assignment_id', case when v_has_current then v_current\.id end/);
  });

  test("Crew and Lead are resolved inside the server-resolved company; archived Crew/Lead rejected", () => {
    assert.match(SET_PRIMARY, /where c\.id = p_crew_id and c\.company_id = v_company_id and c\.archived_at is null/);
    assert.match(SET_PRIMARY, /where p\.id = p_assignment_lead_person_id and p\.company_id = v_company_id and p\.archived_at is null/);
    assert.match(SET_PRIMARY, /where j\.id = p_job_id and j\.company_id = v_company_id and j\.deleted_at is null/);
    assert.doesNotMatch(SET_PRIMARY, /p_company_id/);
  });

  test("leaderless Crew and optional Lead: the Lead is only checked when one is chosen", () => {
    assert.match(SET_PRIMARY, /p_assignment_lead_person_id uuid default null/);
    assert.match(SET_PRIMARY, /if p_assignment_lead_person_id is not null then/);
    assert.doesNotMatch(SET_PRIMARY, /usual_lead_person_id/);
  });

  test("Assignment Lead needs neither Crew membership nor a login", () => {
    const leadCheck = SET_PRIMARY.slice(SET_PRIMARY.indexOf("if p_assignment_lead_person_id is not null then"), SET_PRIMARY.indexOf("'lead_not_eligible'"));
    assert.doesNotMatch(leadCheck, /crew_members|linked_user_id|company_memberships/);
  });

  test("roster snapshot lists actual active members only; usual Lead is never injected; no login needed", () => {
    const roster = SET_PRIMARY.slice(SET_PRIMARY.indexOf("insert into public.job_crew_assignment_roster"), SET_PRIMARY.indexOf("get diagnostics"));
    assert.match(roster, /from public\.crew_members cm/);
    assert.match(roster, /cm\.removed_at is null/);
    assert.doesNotMatch(roster, /usual_lead|linked_user_id|company_memberships/);
  });

  test("replace and lead change end the current row then insert a linked successor, atomically", () => {
    order(SET_PRIMARY, [
      "update public.job_crew_assignments\n      set ended_at = v_now, ended_by = v_uid, end_reason = v_kind",
      "insert into public.job_crew_assignments",
      "case when v_has_current then v_current.id end\n    )",
      "insert into public.job_crew_assignment_roster",
      "perform public.job_lifecycle_insert_activity(",
    ]);
    assert.match(SET_PRIMARY, /when not v_has_current then 'assigned'\s+when v_current\.crew_id <> p_crew_id then 'replaced'\s+else 'lead_changed'/);
  });

  test("the same Crew and Lead again is a no-op, not a new row", () => {
    assert.match(SET_PRIMARY, /v_current\.crew_id = p_crew_id\s+and v_current\.assignment_lead_person_id is not distinct from p_assignment_lead_person_id then\s+return private\.job_crew_set_result_v1\(v_current, false\);/);
  });

  test("snapshots come from the Crew and Person at write time", () => {
    assert.match(SET_PRIMARY, /v_crew\.name, v_lead_name, v_now, v_uid/);
  });

  test("activity is written in the same transaction with the approved event types", () => {
    for (const type of ["job_crew_assigned", "job_crew_replaced", "job_crew_assignment_lead_changed"]) {
      assert.ok(SET_PRIMARY.includes(`'${type}'`), type);
    }
    assert.match(END, /'job_crew_assignment_ended'/);
  });
});

describe("end_job_crew_assignment_v1", () => {
  test("allowed in every disposition", () => {
    assert.doesNotMatch(END, /status|disposition_blocks_assignment/);
  });

  test("idempotent: an already ended assignment returns changed=false", () => {
    assert.match(END, /if v_row\.ended_at is not null then\s+return jsonb_build_object\(\s+'ok', true, 'changed', false/);
  });

  test("company and job scoped", () => {
    assert.match(END, /where a\.id = p_assignment_id and a\.company_id = v_company_id and a\.job_id = p_job_id/);
    assert.match(END, /private\.crew_manager_company_v1\(\)/);
  });

  test("ends with reason ended", () => {
    assert.match(END, /set ended_at = v_now, ended_by = v_uid, end_reason = 'ended'/);
  });
});

describe("get_job_crew_assignments_v1", () => {
  test("gated by jobs.read on the job and company", () => {
    assert.match(READ, /private\.member_can_v1\('jobs\.read', p_job_id\)/);
    assert.match(READ, /private\.current_active_company_id\(\)/);
  });

  test("field allow-list is exact", () => {
    const keys = [...READ.matchAll(/'([a-z_]+)',\s/g)].map((m) => m[1]);
    const allowed = new Set([
      "ok", "code", "job_id", "primary_active_assignment_id", "assignments", "id", "crew_id", "is_primary",
      "started_at", "ended_at", "end_reason", "supersedes_assignment_id", "crew_name_snapshot", "crew_current_name",
      "crew_archived", "assignment_lead_person_id", "assignment_lead_name_snapshot", "assignment_lead_archived",
      "roster", "person_id", "display_name_snapshot", "roster_listed_count", "jobs.read",
    ]);
    for (const key of keys) assert.ok(allowed.has(key), `unexpected read field ${key}`);
    assert.doesNotMatch(READ, /phone|email|linked_user_id|started_by|ended_by|company_memberships|role|assigned_to|crew_members/);
  });

  test("history comes from snapshots, not the current roster or current Lead", () => {
    assert.match(READ, /from public\.job_crew_assignment_roster r/);
    assert.match(READ, /'crew_name_snapshot', a\.crew_name_snapshot/);
    assert.match(READ, /'assignment_lead_name_snapshot', a\.assignment_lead_name_snapshot/);
  });

  test("archived Lead remains visible by snapshot with an archived flag", () => {
    assert.match(READ, /left join public\.company_people lp on lp\.id = a\.assignment_lead_person_id/);
    assert.match(READ, /'assignment_lead_archived', case when a\.assignment_lead_person_id is null then null else lp\.archived_at is not null end/);
  });

  test("newest first, all assignments (not only one)", () => {
    assert.match(READ, /order by a\.started_at desc, a\.id desc/);
    assert.doesNotMatch(READ, /limit 1/);
  });
});

describe("snapshot stability", () => {
  test("renames, roster changes and usual Lead changes do not touch assignments", () => {
    for (const name of ["update_crew_v1", "add_crew_member_v1", "remove_crew_member_v1", "create_crew_v1", "update_company_person_v1"]) {
      assert.ok(!SQL.includes(`function public.${name}(`), name);
    }
    for (const name of ["update_crew_v1", "add_crew_member_v1", "remove_crew_member_v1"]) {
      assert.doesNotMatch(fn(TEAM_SQL, `public.${name}`), /job_crew_assignment/);
    }
  });
});

describe("Person archival", () => {
  test("an active Assignment Lead cannot be archived", () => {
    assert.match(ARCHIVE_PERSON, /a\.assignment_lead_person_id = p_person_id and a\.ended_at is null\s+\) then\s+return jsonb_build_object\('ok', false, 'code', 'person_active_assignment_lead'\);/);
  });

  test("archival never clears the Lead, ends, or creates assignments, and never rewrites history", () => {
    assert.doesNotMatch(ARCHIVE_PERSON, /update public\.job_crew_assignments|insert into public\.job_crew_assignments|job_crew_assignment_roster/);
  });

  test("only ACTIVE assignments block; ended ones allow archival after the Lead is resolved", () => {
    assert.match(ARCHIVE_PERSON, /a\.ended_at is null/);
  });

  test("otherwise identical to the Team Board definition", () => {
    const stripped = ARCHIVE_PERSON.replace(
      /  -- An active assignment cannot keep[\s\S]*?'person_active_assignment_lead'\);\n  end if;\n/,
      ""
    );
    assert.equal(stripped, fn(TEAM_SQL, "public.archive_company_person_v1"));
  });

  test("the check runs after the existing guards", () => {
    order(ARCHIVE_PERSON, ["'stale_revision'", "'linked_login_active'", "'person_active_assignment_lead'", "update public.crew_members"]);
  });
});

describe("Crew archival", () => {
  test("a Crew with any active assignment cannot be archived", () => {
    assert.match(ARCHIVE_CREW, /a\.crew_id = p_crew_id and a\.ended_at is null\s+\) then\s+return jsonb_build_object\('ok', false, 'code', 'crew_actively_assigned'\);/);
    assert.doesNotMatch(ARCHIVE_CREW, /update public\.job_crew_assignments/);
  });

  test("otherwise identical to the Team Board definition", () => {
    const stripped = ARCHIVE_CREW.replace(
      /  if exists \(\n    select 1 from public\.job_crew_assignments[\s\S]*?'crew_actively_assigned'\);\n  end if;\n/,
      ""
    );
    assert.equal(stripped, fn(TEAM_SQL, "public.archive_crew_v1"));
  });
});

describe("boundaries", () => {
  test("no job access grant, Calendar, Coordinator, crew_label, Start or Complete changes", () => {
    assert.doesNotMatch(CODE, /job_access_grants|company_member_access_rules/);
    assert.doesNotMatch(CODE, /job_schedules|schedule_job_v1|reschedule_job_v1|unschedule_job_v1/);
    assert.doesNotMatch(CODE, /assigned_to|crew_label/);
    assert.doesNotMatch(CODE, /start_job_work_v1|complete_job_work_v1/);
  });

  test("the only jobs update is the copied disposition status write", () => {
    const updates = [...CODE.matchAll(/update public\.jobs\b/g)];
    assert.equal(updates.length, 1);
  });

  test("server code never writes grants, the Coordinator, crew_label, or best-effort activity", () => {
    for (const source of [ROUTE, PERSISTENCE, MODEL]) {
      assert.doesNotMatch(source, /job_access_grants|assigned_to|crew_label|createAdminClient|job_lifecycle_insert_activity|from\("jobs"\)/);
    }
  });
});

describe("activity", () => {
  test("the SQL constraint is the final statement and matches TypeScript", () => {
    const tail = SQL.slice(SQL.search(/add constraint job_activity_events_type_check/));
    const values = [...tail.matchAll(/'([a-z_]+)'(?:::text)?/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(values)].sort(), [...JOB_ACTIVITY_EVENT_TYPES].sort());
    assert.match(tail, /\);\n$/);
  });

  test("new events are contractor-visible Activity", () => {
    for (const type of ["job_crew_assigned", "job_crew_replaced", "job_crew_assignment_ended", "job_crew_assignment_lead_changed"] as const) {
      assert.ok(JOB_ACTIVITY_EVENT_TYPES.includes(type));
      assert.equal(
        classifyJobActivityEvent({ id: "e", company_id: "c", job_id: JOB, event_type: type, occurred_at: "2026-09-30T12:00:00Z" }),
        "contractor_visible"
      );
    }
  });

  test("messages use the event's own snapshots and never say Crew Lead, Coordinator, or worked", () => {
    const assigned = composeJobCrewActivity("job_crew_assigned", { crew_name: "Harris Crew" });
    assert.deepEqual(assigned, { title: "Crew assigned", detail: "Harris Crew" });
    assert.deepEqual(composeJobCrewActivity("job_crew_assigned", { crew_name: "Harris Crew", assignment_lead_name: "Tim" }), {
      title: "Crew assigned",
      detail: "Harris Crew · Assignment Lead: Tim",
    });
    assert.deepEqual(composeJobCrewActivity("job_crew_replaced", { crew_name: "Harris Crew", previous_crew_name: "Carlos Crew" }), {
      title: "Crew replaced",
      detail: "Carlos Crew → Harris Crew",
    });
    assert.deepEqual(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "ended" }), {
      title: "Crew assignment ended",
      detail: "Harris Crew",
    });
    assert.deepEqual(composeJobCrewActivity("job_crew_assignment_ended", { crew_name: "Harris Crew", end_reason: "job_closed" }), {
      title: "Crew assignment ended",
      detail: "Harris Crew · Job closed",
    });
    assert.deepEqual(
      composeJobCrewActivity("job_crew_assignment_lead_changed", { crew_name: "Harris Crew", previous_assignment_lead_name: "Tim" }),
      { title: "Assignment Lead changed", detail: "Harris Crew · Tim → No Lead" }
    );
    for (const type of ["job_crew_assigned", "job_crew_replaced", "job_crew_assignment_ended", "job_crew_assignment_lead_changed"]) {
      const item = composeJobCrewActivity(type, { crew_name: "X", previous_crew_name: "Y", assignment_lead_name: "Z" });
      assert.doesNotMatch(`${item?.title} ${item?.detail}`, /Crew Lead|Coordinator|worked|onsite/i);
    }
    assert.equal(composeJobCrewActivity("production_lead_assigned", {}), null);
  });

  test("chronology renders crew events with the actor kept separate", () => {
    const rows = composeJobActivityChronology({
      jobActivityEvents: [
        {
          id: "e1",
          company_id: "c",
          job_id: JOB,
          event_type: "job_crew_assigned",
          actor_user_id: PERSON,
          payload_json: { crew_name: "Harris Crew", assignment_id: ASSIGN_A },
          occurred_at: "2026-09-30T12:00:00Z",
        },
      ],
    });
    const row = rows.find((entry) => entry.title === "Crew assigned");
    assert.ok(row);
    assert.equal(row.detail, "Harris Crew");
  });
});

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSIGN_B,
    crew_id: CREW_B,
    is_primary: true,
    started_at: "2026-09-30T12:00:00Z",
    ended_at: null,
    end_reason: null,
    supersedes_assignment_id: ASSIGN_A,
    crew_name_snapshot: "Harris Crew",
    crew_current_name: "Harris Crew",
    crew_archived: false,
    assignment_lead_person_id: null,
    assignment_lead_name_snapshot: null,
    assignment_lead_archived: null,
    roster: [],
    roster_listed_count: 0,
    ...overrides,
  };
}

const ended = assignment({
  id: ASSIGN_A,
  crew_id: CREW_A,
  started_at: "2026-09-29T12:00:00Z",
  ended_at: "2026-09-30T12:00:00Z",
  end_reason: "replaced",
  supersedes_assignment_id: null,
  crew_name_snapshot: "Carlos Crew",
  crew_current_name: "Carlos Roofing",
  assignment_lead_person_id: PERSON,
  assignment_lead_name_snapshot: "Carlos Rivera",
  assignment_lead_archived: true,
  roster: [{ person_id: BOB, display_name_snapshot: "Bob" }],
  roster_listed_count: 1,
});

describe("read model", () => {
  test("parses leaderless, empty-roster primary plus preserved history", () => {
    const model = parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: ASSIGN_B, assignments: [assignment(), ended] });
    assert.ok(model);
    const primary = primaryActiveAssignment(model);
    assert.equal(primary?.crewNameSnapshot, "Harris Crew");
    assert.equal(primary?.assignmentLeadPersonId, null);
    assert.equal(rosterLabel(primary!), "Members not listed");
    const history = model.assignments[1];
    assert.equal(history.crewNameSnapshot, "Carlos Crew");
    assert.equal(history.crewCurrentName, "Carlos Roofing");
    assert.equal(history.assignmentLeadNameSnapshot, "Carlos Rivera");
    assert.equal(history.assignmentLeadArchived, true);
    assert.equal(rosterLabel(history), "Listed at assignment");
    assert.equal(endReasonLabel(history.endReason), "Replaced");
  });

  test("readers get every active assignment, not a single-Crew assumption", () => {
    const concurrent = assignment({ id: ASSIGN_A, crew_id: CREW_A, is_primary: false, supersedes_assignment_id: null });
    const model = parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: ASSIGN_B, assignments: [assignment(), concurrent] });
    assert.ok(model);
    assert.equal(activeAssignments(model).length, 2);
  });

  test("no primary is a valid state", () => {
    const model = parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: null, assignments: [] });
    assert.deepEqual(model, { jobId: JOB, primaryActiveAssignmentId: null, assignments: [] });
  });

  test("malformed data is null, never an empty history", () => {
    assert.equal(parseJobCrewAssignments({ ok: false }), null);
    assert.equal(parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: null }), null);
    assert.equal(parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: null, assignments: [assignment({ roster_listed_count: 2 })] }), null);
    assert.equal(parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: null, assignments: [assignment({ end_reason: "fired" })] }), null);
    assert.equal(parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: ASSIGN_A, assignments: [ended] }), null);
    assert.equal(parseJobCrewAssignments({ ok: true, job_id: JOB, primary_active_assignment_id: null, assignments: [assignment({ assignment_lead_person_id: PERSON })] }), null);
  });

  test("model exposes no phone, email, login or access fields", () => {
    assert.doesNotMatch(MODEL, /phone|email|linkedUserId|linked_user_id|role|access/i);
  });
});

type RpcCall = { fn: string; args: Record<string, unknown> };

function fakeClient(response: { data?: unknown; error?: unknown }) {
  const calls: RpcCall[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: response.data ?? null, error: response.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("persistence", () => {
  test("lost-response retry: replay result is a success with the original identity, not a stale error", async () => {
    const { client, calls } = fakeClient({
      data: {
        ok: true,
        changed: false,
        kind: "replaced",
        job_id: JOB,
        assignment_id: ASSIGN_B,
        supersedes_assignment_id: ASSIGN_A,
        current_primary_assignment_id: ASSIGN_B,
      },
    });
    const result = await setPrimaryJobCrew(client, {
      jobId: JOB,
      crewId: CREW_B,
      expectedPrimaryAssignmentId: ASSIGN_A,
      requestId: "req-R",
    });
    assert.deepEqual(result, {
      changed: false,
      kind: "replaced",
      assignmentId: ASSIGN_B,
      supersedesAssignmentId: ASSIGN_A,
      currentPrimaryAssignmentId: ASSIGN_B,
    });
    assert.deepEqual(calls[0], {
      fn: "set_primary_job_crew_v1",
      args: {
        p_job_id: JOB,
        p_crew_id: CREW_B,
        p_assignment_lead_person_id: null,
        p_expected_primary_assignment_id: ASSIGN_A,
        p_request_id: "req-R",
      },
    });
  });

  test("domain codes map to stable HTTP errors", async () => {
    for (const [code, status] of [
      ["stale_assignment", 409],
      ["disposition_blocks_assignment", 409],
      ["request_id_conflict", 409],
      ["crew_not_eligible", 409],
      ["lead_not_eligible", 409],
      ["capability_denied", 403],
      ["not_found", 404],
    ] as const) {
      const { client } = fakeClient({ data: { ok: false, code } });
      await assert.rejects(
        setPrimaryJobCrew(client, { jobId: JOB, crewId: CREW_A, requestId: "r" }),
        (error: unknown) => error instanceof JobCrewAssignmentHttpError && error.code === code && error.status === status
      );
    }
  });

  test("a request id is required and malformed ids never reach the database", async () => {
    const { client, calls } = fakeClient({ data: { ok: true } });
    await assert.rejects(setPrimaryJobCrew(client, { jobId: JOB, crewId: CREW_A, requestId: "" }));
    await assert.rejects(setPrimaryJobCrew(client, { jobId: JOB, crewId: "Harris Crew", requestId: "r" }));
    await assert.rejects(setPrimaryJobCrew(client, { jobId: JOB, crewId: CREW_A, assignmentLeadPersonId: "Tim", requestId: "r" }));
    await assert.rejects(endJobCrewAssignment(client, { jobId: JOB, assignmentId: "x" }));
    assert.equal(calls.length, 0);
  });

  test("end is idempotent at the client boundary", async () => {
    const { client } = fakeClient({ data: { ok: true, changed: false, assignment_id: ASSIGN_A, end_reason: "job_closed" } });
    assert.deepEqual(await endJobCrewAssignment(client, { jobId: JOB, assignmentId: ASSIGN_A }), {
      changed: false,
      assignmentId: ASSIGN_A,
      endReason: "job_closed",
    });
  });

  test("an RPC error is unavailable, never an empty history", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    await assert.rejects(loadJobCrewAssignments(client, JOB), (error: unknown) =>
      error instanceof JobCrewAssignmentHttpError && error.status === 503
    );
  });
});

describe("route", () => {
  test("writes require company-scope jobs.assign; job-scoped readers cannot write", () => {
    assert.match(ROUTE, /export async function POST[\s\S]*requireAccess\(supabase, user\.id, "jobs\.assign"\)/);
    assert.doesNotMatch(ROUTE.slice(0, ROUTE.indexOf("export async function POST")), /requireAccess\(/);
  });

  test("the company always comes from the server session", () => {
    assert.doesNotMatch(ROUTE, /companyId|company_id/);
  });
});

describe("Team error copy", () => {
  test("archival blocks explain the explicit resolution", async () => {
    assert.match(TEAM_BOARD_MESSAGES.person_active_assignment_lead, /Change or clear the Assignment Lead, or end that assignment/);
    assert.match(TEAM_BOARD_MESSAGES.crew_actively_assigned, /Replace or end that assignment/);
    for (const code of ["person_active_assignment_lead", "crew_actively_assigned"]) {
      const { client } = fakeClient({ data: { ok: false, code } });
      await assert.rejects(
        runTeamBoardAction(client, {
          action: code === "crew_actively_assigned" ? "archive_crew" : "archive_person",
          crewId: CREW_A,
          personId: PERSON,
          expectedRowVersion: 1,
        }),
        (error: unknown) => (error as { status?: number; code?: string }).status === 409 && (error as { code?: string }).code === code
      );
    }
  });
});
