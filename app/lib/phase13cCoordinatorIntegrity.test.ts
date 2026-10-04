/**
 * Phase 13C slice 2 — Coordinator integrity: database owner RPC, column invariant,
 * revoked direct writes, writer cutover, shared visible name, picker eligibility.
 * Run: npx tsx --test app/lib/phase13cCoordinatorIntegrity.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  COORDINATOR_LOADING,
  COORDINATOR_PICKER_HELP,
  COORDINATOR_UNASSIGNED,
  COORDINATOR_UNAVAILABLE,
  coordinatorCandidates,
  coordinatorDisplay,
} from "./jobCoordinatorView";
import { MEMBER_NAME_NOT_SET } from "./memberDisplayName";
import { PERSON_NAME_NOT_SET } from "./team/teamBoardModel";
import { jobDraftToInsertRow } from "./jobStore";
import { labelForCompanyMember } from "../tools/roofing/jobCard/useCompanyMembers";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sqlStrip = (source: string) => source.replace(/^\s*--.*$/gm, "");

const MIGRATION = sqlStrip(read("supabase/migrations/20261001140000_phase13c_coordinator_integrity.sql"));
const PERSIST = strip(read("app/lib/jobResponsibilityPersistence.ts"));
const ROUTE = strip(read("app/api/jobs/[jobId]/production-lead/route.ts"));
const SCHEDULE = strip(read("app/api/jobs/schedule/route.ts"));
const STORE = strip(read("app/lib/jobStore.ts"));
const CONTROL = strip(read("app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx"));
const SHEET = strip(read("app/tools/roofing/jobCard/JobCardCoordinatorSheet.tsx"));
const VIEW = strip(read("app/lib/jobCoordinatorView.ts"));
const CLIENT = strip(read("app/tools/roofing/jobCard/JobCardClient.tsx"));
const HOOK = strip(read("app/tools/roofing/jobCard/useJobCoordinator.ts"));
const PEOPLE = strip(read("app/tools/roofing/jobCard/JobCardOverviewPeople.tsx"));

function fn(name: string): string {
  const start = MIGRATION.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = MIGRATION.indexOf("\n$$;", start);
  return MIGRATION.slice(start, end);
}

const DANA = "11111111-1111-4111-8111-111111111111";
const FRED = "22222222-2222-4222-8222-222222222222";

describe("set_job_coordinator_v1 contract", () => {
  const rpc = fn("public.set_job_coordinator_v1");

  test("hardened definer with the agreed signature", () => {
    assert.match(rpc, /p_job_id uuid,\s*p_assigned_to uuid,\s*p_expected_previous uuid,\s*p_request_id text/);
    assert.match(rpc, /security definer\s*set search_path = pg_catalog, public/);
  });

  test("authority before payload, replay, and the write", () => {
    const order = [
      "'unauthorized'",
      "private.current_active_company_id()",
      "private.member_can_v1('jobs.assign')",
      "'invalid_payload'",
      "from public.job_coordinator_requests",
      "private.set_job_coordinator_core_v1(",
      "insert into public.job_coordinator_requests",
    ].map((needle) => {
      const at = rpc.indexOf(needle);
      assert.ok(at >= 0, needle);
      return at;
    });
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    // company-scope only: no job argument to the capability check
    assert.doesNotMatch(rpc, /member_can_v1\('jobs\.assign',/);
  });

  test("replay returns the stored result; a reused id with another intent conflicts", () => {
    assert.match(rpc, /'request_id_conflict'/);
    assert.match(rpc, /v_prior\.result \|\| jsonb_build_object\('replay', true\)/);
    assert.match(rpc, /on conflict \(company_id, request_id\) do nothing/);
    assert.match(rpc, /v_result \|\| jsonb_build_object\('replay', false\)/);
  });

  test("ledger has no client privileges", () => {
    assert.match(MIGRATION, /alter table public\.job_coordinator_requests enable row level security/);
    assert.match(MIGRATION, /revoke all on table public\.job_coordinator_requests from public, anon, authenticated/);
  });

  test("execute is granted to authenticated and service_role only", () => {
    assert.match(
      MIGRATION,
      /revoke all on function public\.set_job_coordinator_v1\(uuid, uuid, uuid, text\) from public, anon, authenticated;\s*grant execute on function public\.set_job_coordinator_v1\(uuid, uuid, uuid, text\) to authenticated, service_role;/
    );
  });
});

describe("Coordinator core", () => {
  const core = fn("private.set_job_coordinator_core_v1");

  test("locks the Job, rejects ineligible targets, no-ops same value, rejects stale", () => {
    const steps = [
      "for update",
      "'coordinator_not_eligible'",
      "is not distinct from p_assigned_to",
      "'stale_coordinator'",
      "update public.jobs",
      "public.job_lifecycle_insert_activity(",
    ].map((needle) => {
      const at = core.indexOf(needle);
      assert.ok(at >= 0, needle);
      return at;
    });
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
    assert.match(core, /'changed', false/);
    assert.match(core, /'changed', true/);
  });

  test("event names and payload match existing Coordinator history", () => {
    assert.match(core, /'production_lead_assigned'/);
    assert.match(core, /'production_lead_changed'/);
    assert.match(core, /'production_lead_cleared'/);
    assert.match(core, /'previous_assigned_to', v_job\.assigned_to,\s*'assigned_to', p_assigned_to/);
  });

  test("eligibility is any active same-company member with a valid role, never role-filtered", () => {
    const eligible = fn("private.coordinator_eligible_v1");
    assert.match(eligible, /m\.removed_at is null/);
    assert.match(eligible, /private\.role_is_valid_v1\(m\.role\)/);
    assert.doesNotMatch(eligible, /jobs\.assign|production_lead|'admin'|'owner'|field_user/);
  });
});

describe("column invariant and direct-write revoke", () => {
  const guard = fn("private.jobs_coordinator_guard_trg_v1");

  test("narrow trigger: only when assigned_to is written; unchanged passes", () => {
    assert.match(MIGRATION, /before insert or update of assigned_to on public\.jobs/);
    assert.match(guard, /tg_op = 'UPDATE' and new\.assigned_to is not distinct from old\.assigned_to then\s*return new/);
  });

  test("target integrity always; caller authority for end users; no session GUC", () => {
    assert.match(guard, /private\.coordinator_eligible_v1\(new\.company_id, new\.assigned_to\)/);
    assert.match(guard, /if auth\.uid\(\) is not null then/);
    assert.match(guard, /private\.current_active_company_id\(\) is distinct from new\.company_id/);
    assert.match(guard, /not private\.member_can_v1\('jobs\.assign'\)/);
    assert.doesNotMatch(guard, /current_setting/);
  });

  test("ordinary clients lose direct UPDATE on assigned_to", () => {
    assert.match(MIGRATION, /revoke update \(assigned_to\) on public\.jobs from anon, authenticated;/);
  });

  test("closed Jobs keep their historical Coordinator", () => {
    assert.doesNotMatch(MIGRATION, /set assigned_to = null/);
  });
});

describe("handoff uses the same core", () => {
  const handoff = fn("public.handoff_member_open_work_v1");

  test("per-Job core call with expected = departing member; no bulk jobs update", () => {
    assert.match(
      handoff,
      /private\.set_job_coordinator_core_v1\(\s*v_company_id, v_job_id, p_reassign_to_user_id, p_target_user_id, v_uid, null, 'member_open_work_handoff'\s*\)/
    );
    assert.doesNotMatch(handoff, /update public\.jobs/);
    assert.match(handoff, /private\.job_is_open_work_v1\(j\.stage, j\.status, j\.archived, j\.deleted_at\)/);
  });
});

describe("one visible-name resolver", () => {
  test("linked Person name, then profile name, never the legacy placeholder", () => {
    const resolver = fn("private.member_display_name_v1");
    const person = resolver.indexOf("from public.company_people cp");
    const profile = resolver.indexOf("from public.profiles pr");
    assert.ok(person >= 0 && profile > person);
    assert.match(resolver, /lower\(cp\.display_name\) <> 'team member'/);
  });

  test("directory, access-admin list, Field brief, and Coordinator read all use it", () => {
    for (const name of [
      "public.list_company_directory_v1",
      "public.list_company_access_admin_v1",
      "public.get_job_field_brief_v1",
      "public.get_job_coordinator_v1",
    ]) {
      assert.match(fn(name), /private\.member_display_name_v1\(/, name);
      assert.doesNotMatch(fn(name), /nullif\(btrim\(p\.full_name\), ''\)/, name);
    }
  });

  test("the Coordinator read exposes email only to team.manage and only without a name", () => {
    const get = fn("public.get_job_coordinator_v1");
    assert.match(get, /v_name is null and private\.member_can_v1\('team\.manage'\)/);
    assert.match(get, /private\.member_can_v1\('jobs\.read', p_job_id\)/);
  });
});

describe("app writers cut over", () => {
  test("persistence calls only the RPCs; no direct jobs write, no admin activity insert", () => {
    assert.match(PERSIST, /"set_job_coordinator_v1"/);
    assert.match(PERSIST, /"get_job_coordinator_v1"/);
    assert.doesNotMatch(PERSIST, /\.from\(/);
    assert.doesNotMatch(PERSIST, /validateLiveCompanyMember|createAdminClient|service_role/);
  });

  test("route: jobs.assign gate, required expected + requestId, no crew_label", () => {
    assert.match(ROUTE, /requireAccess\(supabase, user\.id, "jobs\.assign"\)/);
    assert.match(ROUTE, /hasOwnProperty\.call\(body \?\? \{\}, "expectedAssignedTo"\)/);
    assert.match(ROUTE, /!requestId/);
    assert.doesNotMatch(ROUTE, /crew_label|crewLabel|\.from\("jobs"\)/);
    assert.match(ROUTE, /export async function GET/);
  });

  test("scheduling never changes the Coordinator", () => {
    assert.match(SCHEDULE, /"coordinator_not_schedulable"/);
    assert.doesNotMatch(SCHEDULE, /setJobProductionLead|jobResponsibilityPersistence/);
  });

  test("generic job create/update rows never carry assigned_to", () => {
    const row = jobDraftToInsertRow({ assigned_to: DANA, job_name: "Roof" } as never);
    assert.equal("assigned_to" in row, false);
    assert.equal(row.job_name, "Roof");
    assert.doesNotMatch(STORE, /row\.assigned_to\s*=/);
  });
});

describe("Job Card Coordinator presentation", () => {
  test("Person name first, then email, then a neutral read-time label", () => {
    assert.deepEqual(
      coordinatorDisplay({ status: "ready", assignedTo: DANA, displayName: "Dana Wu", email: "d@x.test" }),
      { state: "assigned", label: "Dana Wu", assignedTo: DANA }
    );
    assert.equal(
      coordinatorDisplay({ status: "ready", assignedTo: DANA, displayName: null, email: "d@x.test" }).label,
      "d@x.test"
    );
    assert.equal(
      coordinatorDisplay({ status: "ready", assignedTo: DANA, displayName: null, email: null }).label,
      MEMBER_NAME_NOT_SET
    );
  });

  test("loading and failure are their own states, never Unassigned", () => {
    assert.deepEqual(coordinatorDisplay({ status: "loading" }), {
      state: "loading",
      label: COORDINATOR_LOADING,
      assignedTo: null,
    });
    assert.deepEqual(coordinatorDisplay({ status: "error" }), {
      state: "error",
      label: COORDINATOR_UNAVAILABLE,
      assignedTo: null,
    });
    assert.equal(
      coordinatorDisplay({ status: "ready", assignedTo: null, displayName: null, email: null }).label,
      COORDINATOR_UNASSIGNED
    );
  });

  test("no persisted or rendered Team member placeholder", () => {
    assert.equal(MEMBER_NAME_NOT_SET, "Name not set");
    assert.equal(PERSON_NAME_NOT_SET, MEMBER_NAME_NOT_SET);
    assert.equal(labelForCompanyMember(DANA, [{ userId: DANA, displayName: null, email: null }]), MEMBER_NAME_NOT_SET);
    assert.equal(labelForCompanyMember(DANA, [{ userId: DANA, displayName: "Dana Wu" }]), "Dana Wu");
  });

  test("the card reads the Coordinator from the server, not Team's browser model", () => {
    assert.match(CLIENT, /useJobCoordinator\(currentJobId\)/);
    assert.match(CLIENT, /coordinatorDisplay\(jobCoordinator\.state\)/);
    assert.doesNotMatch(CLIENT, /productionLeadAssignedTo = hydratedJobRecord/);
    assert.doesNotMatch(CLIENT, /teamBoardModel|useTeamBoard/);
    assert.match(HOOK, /\/production-lead`/);
    assert.match(HOOK, /return \{ status: "error" \}/);
  });

  test("the card exposes its state and only offers Change once the read is ready", () => {
    assert.match(PEOPLE, /data-jobcard-coordinator-state=\{coordinatorState\}/);
  });
});

describe("Coordinator picker", () => {
  test("helper copy is the agreed sentence and is announced with the choices", () => {
    assert.equal(COORDINATOR_PICKER_HELP, "Only people with FieldDive access can coordinate a job.");
    assert.match(SHEET, /const helpId = `coordinator-help-\$\{jobId\}`/);
    assert.match(SHEET, /data-jobcard-production-lead-help/);
  });

  test("active software members only; removed and invalid roles absent", () => {
    const members = [
      { userId: DANA, role: "field_user", removedAt: null },
      { userId: FRED, role: "admin", removedAt: "2026-09-30T00:00:00Z" },
      { userId: "33333333-3333-4333-8333-333333333333", role: "invalid_role", removedAt: null },
      { userId: "44444444-4444-4444-8444-444444444444", role: "owner", removedAt: null },
    ];
    assert.deepEqual(
      coordinatorCandidates(members).map((m) => m.userId),
      [DANA, "44444444-4444-4444-8444-444444444444"]
    );
  });

  test("no role labels in options; a former Coordinator is shown disabled, never silently cleared", () => {
    assert.match(CONTROL, /label: labelForCompanyMember\(member\.userId, members\)/);
    assert.doesNotMatch(CONTROL, /teamRoleLabel|teamAccessLabel|member\.role/);
    assert.match(VIEW, /disabled: true,\s*hint: COORDINATOR_FORMER_HINT/);
  });

  test("sends the Coordinator it saw and one request id per intended change", () => {
    assert.match(CONTROL, /expectedAssignedTo: assignedTo/);
    assert.match(CONTROL, /if \(pending\.current\?\.key !== key\) pending\.current = \{ key, requestId: newRequestId\(\) \}/);
    assert.match(CONTROL, /if \(body\.code === "stale_coordinator"\) onStale\?\.\(\)/);
  });
});
