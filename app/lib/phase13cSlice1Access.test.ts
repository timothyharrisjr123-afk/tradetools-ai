/**
 * Phase 13C Slice 1 — access vocabulary, Lead preset, Start/Complete authority split.
 *
 * D-S1 (locked 2026-09-29): only the active assignment Lead may use Lead-scoped Start
 * work. Job access is not job responsibility. Assignment truth arrives in Slice 4, so
 * until then Start work is offered and authorized only to company-scope holders; a
 * Lead can neither Start nor Complete. No role-name check, no jobs.assigned_to, no
 * crew_label.
 *
 * Run: npx tsx --test app/lib/phase13cSlice1Access.test.ts
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  ACCESS_PACKAGES,
  ACCESS_ROLE_PROFILES,
  LEGACY_CAPABILITY_CROSSWALK,
  getCapabilityDefinition,
  validateAccessRegistry,
} from "./access/registry";
import { buildAccessRegistrySyncSql, extractRegistrySync } from "./access/registrySql";
import {
  TEAM_ACCESS_PRESETS,
  TEAM_OWNER_SUMMARY,
  packageKeysForSave,
  teamAccessLabel,
  teamAccessPreset,
  teamAccessSummary,
  teamAssignedJobCount,
  teamJobReach,
  teamPackageChoices,
  teamPresetChoices,
  teamPresetForAccess,
  teamSpecialAccessSummary,
} from "./access/teamAccessPresentation";
import { mapViewerAccess, NO_VIEWER_ACCESS } from "./access/viewerAccess";
import {
  BOARD_MOVEMENT_NOT_PERMITTED_COPY,
  boardDropTargetValidity,
  resolveBoardGuardedMovement,
} from "./boardGuardedMovement";
import { COMPANY_MEMBERSHIP_ROLE_LABELS } from "./companyMembershipRoles";
import { validateLiveCompanyMember } from "./companyMemberValidation";
import { roleLabel, plainAccessSummary } from "./invitations/invitationModel";
import {
  resolveCanonicalJobActionEligibilityFromFacts,
  withLifecycleActionAuthority,
} from "./jobLifecycleActionEligibility";
import { taskAssigneeCandidates } from "../tools/roofing/jobCard/useCompanyMembers";

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const MIG = "supabase/migrations/";
const S1 = read(`${MIG}20260929120000_phase13c_s1_access_vocabulary_completion_split.sql`);

const COMPANY = "33333333-3333-4333-8333-333333333333";
const JOB = "55555555-5555-4555-8555-555555555555";
const LEAD = "66666666-6666-4666-8666-666666666666";
const COORD = "77777777-7777-4777-8777-777777777777";
const STRANGER = "88888888-8888-4888-8888-888888888888";

const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

function fnBody(sql: string, qualifiedName: string): string {
  const start = sql.toLowerCase().indexOf(`create or replace function ${qualifiedName}(`);
  assert.ok(start >= 0, qualifiedName);
  const end = sql.slice(start).search(/\n\$(function)?\$;/);
  return sql.slice(start, end < 0 ? undefined : start + end);
}

function profileCaps(role: string): Set<string> {
  const profile = ACCESS_ROLE_PROFILES.find((p) => p.role === role);
  assert.ok(profile, role);
  return new Set(profile.entries.map((e) => e.capability));
}

function pkg(key: string) {
  const found = ACCESS_PACKAGES.find((p) => p.key === key);
  assert.ok(found, key);
  return found;
}

/** Capabilities a Lead holds: Field profile plus the Lead package. */
function leadCaps(): Set<string> {
  return new Set([...profileCaps("field_user"), ...pkg("lead_assigned_work").capabilities]);
}

describe("role presentation", () => {
  test("stored roles keep their keys; contractor labels are Office Manager and Production Coordinator", () => {
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.admin, "Office Manager");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.production_lead, "Production Coordinator");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.owner, "Owner");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.office_sales, "Sales");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.field_user, "Field");
  });

  test("primary choices are Office Manager and Lead; Sales, Production Coordinator, Field sit under Other access", () => {
    assert.deepEqual(
      TEAM_ACCESS_PRESETS.filter((p) => p.primary).map((p) => p.key),
      ["office_manager", "lead"]
    );
    assert.deepEqual(
      TEAM_ACCESS_PRESETS.filter((p) => !p.primary).map((p) => p.key).sort(),
      ["field_user", "office_sales", "production_lead"]
    );
  });

  test("Lead is Field plus the Lead package; a plain Field member reads as Field", () => {
    const lead = teamAccessPreset("lead");
    assert.equal(lead.role, "field_user");
    assert.deepEqual([...lead.packages], ["lead_assigned_work"]);
    assert.equal(lead.summary, "Assigned jobs and onsite work");
    assert.equal(teamAccessLabel("field_user", ["lead_assigned_work"]), "Lead");
    assert.equal(teamAccessLabel("field_user", []), "Field");
    assert.equal(teamAccessLabel("admin", []), "Office Manager");
    assert.equal(teamAccessLabel("owner", ["lead_assigned_work"]), "Owner");
    assert.equal(teamPresetForAccess("field_user", ["lead_assigned_work"])?.key, "lead");
    assert.equal(teamAccessSummary("owner", []), TEAM_OWNER_SUMMARY);
  });

  test("copy is truthful: Office Manager never claims full access; nothing claims Start work for a Lead", () => {
    for (const preset of TEAM_ACCESS_PRESETS) {
      assert.doesNotMatch(`${preset.summary} ${preset.detail}`, /full access|everything/i, preset.key);
    }
    const om = teamAccessPreset("office_manager");
    assert.match(om.detail, /Payments, pricing, and money settings stay with the Owner/);
    const lead = teamAccessPreset("lead");
    assert.doesNotMatch(lead.detail, /start|complete|schedule jobs/i);
    assert.match(lead.detail, /No prices, payments, proposals, Calendar changes, or Team/);
  });

  test("job reach is plain words", () => {
    assert.equal(teamJobReach("admin"), "All jobs");
    assert.equal(teamJobReach("production_lead"), "All jobs");
    assert.equal(teamJobReach("field_user"), "Assigned jobs only");
    assert.equal(teamAssignedJobCount(0), "None assigned yet");
    assert.equal(teamAssignedJobCount(1), "1 job now");
    assert.equal(teamAssignedJobCount(3), "3 jobs now");
  });

  test("invitation and email labels use the preset vocabulary", () => {
    assert.equal(roleLabel("field_user", ["lead_assigned_work"]), "Lead");
    assert.equal(roleLabel("admin"), "Office Manager");
    assert.equal(roleLabel("production_lead"), "Production Coordinator");
    assert.doesNotMatch(plainAccessSummary(["lead_assigned_work"]) ?? "", /Lead/);
  });
});

describe("Lead package (lead_assigned_work)", () => {
  test("allowed: tasks on granted jobs and job-scoped jobs.progress only", () => {
    const p = pkg("lead_assigned_work");
    assert.equal(p.status, "active");
    assert.equal(p.scope, "granted_jobs");
    assert.deepEqual([...p.eligibleRoles], ["field_user"]);
    assert.deepEqual([...p.capabilities].sort(), ["jobs.progress", "tasks.manage", "tasks.read"]);
  });

  test("denied: completion, schedule mutation, assignment, commercial, team", () => {
    const caps = leadCaps();
    for (const cap of [
      "jobs.complete",
      "schedule.manage",
      "jobs.assign",
      "jobs.hold",
      "jobs.finalize",
      "jobs.approve",
      "jobs.manage",
      "proposals.read",
      "payments.summary.read",
      "pricing.manage",
      "team.manage",
      "customers.read",
    ]) {
      assert.equal(caps.has(cap), false, cap);
    }
  });

  test("delegation ceiling: Owner and Office Manager only; a Production Coordinator cannot hand out Lead", () => {
    assert.deepEqual([...pkg("lead_assigned_work").assignableBy].sort(), ["admin", "owner"]);
    assert.ok(teamPresetChoices("owner").some((p) => p.key === "lead"));
    assert.ok(teamPresetChoices("admin").some((p) => p.key === "lead"));
    assert.equal(teamPresetChoices("admin").some((p) => p.role === "admin"), false);
  });

  test("the Lead package is part of the access label, not special access", () => {
    assert.deepEqual(teamPackageChoices("field_user", "owner"), []);
    assert.equal(teamSpecialAccessSummary(["lead_assigned_work"]), null);
  });

  test("saving Lead adds the package; saving Field drops it; other kept packages survive", () => {
    assert.deepEqual(
      packageKeysForSave({
        role: "field_user",
        existing: [],
        selected: [],
        choices: teamPackageChoices("field_user", "admin"),
        presetPackages: teamAccessPreset("lead").packages,
      }),
      ["lead_assigned_work"]
    );
    assert.deepEqual(
      packageKeysForSave({
        role: "field_user",
        existing: ["lead_assigned_work"],
        selected: [],
        choices: teamPackageChoices("field_user", "admin"),
        presetPackages: teamAccessPreset("field_user").packages,
      }),
      []
    );
    assert.deepEqual(
      packageKeysForSave({
        role: "office_sales",
        existing: ["request_payments", "lead_assigned_work"],
        selected: ["approve_jobs"],
        choices: teamPackageChoices("office_sales", "admin"),
        presetPackages: teamAccessPreset("office_sales").packages,
      }),
      ["approve_jobs", "request_payments"]
    );
  });
});

describe("Complete job capability (jobs.complete)", () => {
  test("company-scoped, depends on jobs.read, active", () => {
    const def = getCapabilityDefinition("jobs.complete");
    assert.ok(def);
    assert.equal(def.status, "active");
    assert.deepEqual([...def.scopeKinds], ["company"]);
    assert.deepEqual([...def.dependsOn], ["jobs.read"]);
    assert.deepEqual(validateAccessRegistry(), []);
  });

  test("holders: Owner, Office Manager, Production Coordinator, coordinate_production", () => {
    for (const role of ["owner", "admin", "production_lead"]) {
      assert.equal(profileCaps(role).has("jobs.complete"), true, role);
    }
    assert.ok((pkg("coordinate_production").capabilities as readonly string[]).includes("jobs.complete"));
  });

  test("denied: Lead, Sales, Field", () => {
    assert.equal(leadCaps().has("jobs.complete"), false);
    assert.equal(profileCaps("office_sales").has("jobs.complete"), false);
    assert.equal(profileCaps("field_user").has("jobs.complete"), false);
  });

  test("every prior completer (company-scope jobs.progress) still completes", () => {
    for (const profile of ACCESS_ROLE_PROFILES) {
      const companyProgress = profile.entries.some(
        (e) => e.capability === "jobs.progress" && e.scope === "company"
      );
      if (companyProgress) assert.equal(profileCaps(profile.role).has("jobs.complete"), true, profile.role);
    }
    for (const p of ACCESS_PACKAGES.filter((x) => x.scope === "company")) {
      const caps = p.capabilities as readonly string[];
      if (caps.includes("jobs.progress")) assert.ok(caps.includes("jobs.complete"), p.key);
    }
  });

  test("legacy crosswalk maps start/complete to both capabilities", () => {
    assert.deepEqual([...LEGACY_CAPABILITY_CROSSWALK.lifecycle_start_complete], [
      "jobs.progress",
      "jobs.complete",
    ]);
  });
});

describe("migration: registry sync + RPC authority", () => {
  test("embedded sync block equals the TypeScript registry", () => {
    assert.equal(extractRegistrySync(S1), buildAccessRegistrySyncSql());
  });

  test("sync refuses unknown DB rows and re-validates the registry", () => {
    const sync = extractRegistrySync(S1)!;
    assert.match(sync, /database holds a capability outside registry\.ts/);
    assert.match(sync, /database holds a package outside registry\.ts/);
    assert.match(sync, /database holds a role profile outside registry\.ts/);
    assert.match(sync, /private\.access_registry_violations_v1\(\)/);
    assert.match(sync, /on conflict \(role_key, version\) do nothing/);
  });

  test("Start work requires jobs.progress at the job AND at company scope (D-S1)", () => {
    const start = stripComments(fnBody(S1, "public.start_job_work_v1"));
    assert.match(start, /private\.member_can_v1\('jobs\.progress', v_job_id\)/);
    assert.match(start, /private\.member_can_v1\('jobs\.progress'\)\s*\)/);
  });

  test("Start work has no role-name check and no assignment stand-in", () => {
    const start = stripComments(fnBody(S1, "public.start_job_work_v1"));
    assert.doesNotMatch(start, /assigned_to|crew_label|production_lead_user_id/);
    assert.doesNotMatch(start, /cm\.role|role\s*=\s*'|role in \(/);
    assert.doesNotMatch(start, /job_access_grants|member_job_ids_v1/);
  });

  test("Complete job requires jobs.complete, not jobs.progress", () => {
    const complete = stripComments(fnBody(S1, "public.complete_job_work_v1"));
    assert.match(complete, /private\.member_can_v1\('jobs\.complete', v_job_id\)/);
    assert.doesNotMatch(complete, /member_can_v1\('jobs\.progress'/);
    assert.doesNotMatch(complete, /cm\.role|assigned_to|crew_label/);
  });

  test("RPC bodies are otherwise the 13B-C bodies (only the authority clause changed)", () => {
    const prior = read(`${MIG}20260927193000_phase13b_c_rpc_canonical_capabilities.sql`);
    const norm = (s: string) =>
      stripComments(s)
        .replace(/private\.member_can_v1\('jobs\.(progress|complete)'(, v_job_id)?\)/g, "AUTH")
        .replace(/(\s*and AUTH)+/g, " and AUTH")
        .replace(/\s+/g, " ");
    for (const fn of ["public.start_job_work_v1", "public.complete_job_work_v1"]) {
      assert.equal(norm(fnBody(S1, fn)), norm(fnBody(prior, fn)), fn);
    }
  });

  test("only complete_job_work_v1 opens the completion guard, in every migration", () => {
    for (const file of readdirSync(join(process.cwd(), MIG)).filter((f) => f.endsWith(".sql"))) {
      const sql = read(`${MIG}${file}`);
      const needle = "set_config('job_lifecycle.allow_job_complete_write'";
      let at = sql.indexOf(needle);
      while (at >= 0) {
        const before = sql.slice(0, at).toLowerCase();
        const fnAt = before.lastIndexOf("create or replace function ");
        const name = before
          .slice(fnAt + 27, before.indexOf("(", fnAt))
          .replace(/"/g, "")
          .trim();
        assert.equal(name, "public.complete_job_work_v1", `${file}@${at}`);
        at = sql.indexOf(needle, at + needle.length);
      }
    }
  });

  test("no app code opens the completion guard or writes jobs.stage directly", () => {
    const files = [
      "app/api/jobs/complete-work/route.ts",
      "app/api/jobs/start-work/route.ts",
      "app/tools/roofing/saved/SavedClient.tsx",
      "app/tools/roofing/jobCard/JobCardClient.tsx",
      "app/tools/roofing/RoofingClient.tsx",
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.doesNotMatch(src, /allow_job_complete_write|allow_stage_write/, rel);
      assert.doesNotMatch(src, /\.update\(\s*\{\s*stage\s*:/, rel);
    }
  });

  test("directory: Leads no longer read the company list through job-scope tasks.manage", () => {
    const dir = stripComments(fnBody(S1, "public.list_company_directory_v1"));
    assert.doesNotMatch(dir, /member_job_ids_v1/);
    assert.match(dir, /m\.user_id = auth\.uid\(\)/);
    assert.match(dir, /private\.member_can_v1\('jobs\.read'\)/);
    assert.match(dir, /m\.company_id = private\.current_active_company_id\(\)/);
    assert.match(dir, /m\.removed_at is null/);
  });

  test("forward-only: no historical migration is edited by Slice 1", () => {
    const m1 = read(`${MIG}20260927190000_phase13b_c_access_registry.sql`);
    assert.doesNotMatch(m1, /jobs\.complete/);
  });
});

describe("routes: Start and Complete authority", () => {
  test("complete-work gates on jobs.complete at the job", () => {
    const route = read("app/api/jobs/complete-work/route.ts");
    assert.match(route, /requireAccess\(supabase, user\.id, "jobs\.complete", \{ jobId \}\)/);
    assert.doesNotMatch(route, /"jobs\.progress"/);
  });

  test("start-work gates on jobs.progress at the job and at company scope", () => {
    const route = read("app/api/jobs/start-work/route.ts");
    assert.match(route, /requireAccess\(supabase, user\.id, "jobs\.progress", \{ jobId \}\)/);
    assert.match(route, /requireAccess\(supabase, user\.id, "jobs\.progress"\);/);
    assert.doesNotMatch(route, /assigned_to|crew_label|role ===|role !==/);
  });
});

describe("viewer flags: job access is not job responsibility", () => {
  test("company operators may Start and Complete", () => {
    const flags = mapViewerAccess({
      ok: true,
      company_capabilities: ["jobs.read", "jobs.progress", "jobs.complete"],
      job_capabilities: ["jobs.read", "jobs.progress", "jobs.complete"],
    });
    assert.ok(flags);
    assert.equal(flags.canStartWork, true);
    assert.equal(flags.canCompleteJob, true);
  });

  test("a Lead (job-scoped jobs.progress) may neither Start nor Complete (D-S1, until Slice 4)", () => {
    const flags = mapViewerAccess({
      ok: true,
      company_capabilities: [],
      job_capabilities: ["jobs.read", "tasks.read", "tasks.manage", "jobs.progress"],
    });
    assert.ok(flags);
    assert.equal(flags.canStartWork, false);
    assert.equal(flags.canCompleteJob, false);
    assert.equal(flags.canManageSchedule, false);
    assert.equal(flags.canAssignTasks, true);
  });

  test("schedule authority is evaluated at the job (restrictions apply)", () => {
    const coordinator = mapViewerAccess({
      ok: true,
      company_capabilities: ["jobs.read", "schedule.manage"],
      job_capabilities: ["jobs.read", "schedule.manage"],
    });
    assert.equal(coordinator?.canManageSchedule, true);
    const restricted = mapViewerAccess({
      ok: true,
      company_capabilities: ["jobs.read", "schedule.manage"],
      job_capabilities: ["jobs.read"],
    });
    assert.equal(restricted?.canManageSchedule, false);
    const board = mapViewerAccess({ ok: true, company_capabilities: ["schedule.manage"] });
    assert.equal(board?.canManageSchedule, true);
  });

  test("a restriction at the job removes Start and Complete even for company holders", () => {
    const flags = mapViewerAccess({
      ok: true,
      company_capabilities: ["jobs.read", "jobs.progress", "jobs.complete"],
      job_capabilities: ["jobs.read"],
    });
    assert.ok(flags);
    assert.equal(flags.canStartWork, false);
    assert.equal(flags.canCompleteJob, false);
  });

  test("Sales without jobs.complete cannot Complete", () => {
    const flags = mapViewerAccess({ ok: true, company_capabilities: ["jobs.read", "proposals.read"] });
    assert.ok(flags);
    assert.equal(flags.canCompleteJob, false);
    assert.equal(flags.canStartWork, false);
  });

  test("error is unavailable (null), and the fallback flags deny", () => {
    assert.equal(mapViewerAccess({ ok: false }), null);
    assert.equal(NO_VIEWER_ACCESS.canStartWork, false);
    assert.equal(NO_VIEWER_ACCESS.canCompleteJob, false);
  });
});

describe("UI: stage alone never enables Start work or Complete job", () => {
  const planned = { kind: "work", status: "scheduled" } as const;
  const scheduled = resolveCanonicalJobActionEligibilityFromFacts({
    stage: "scheduled",
    disposition: "active",
    schedule: planned,
    scheduleReadStatus: "ready",
  });
  const production = resolveCanonicalJobActionEligibilityFromFacts({
    stage: "production",
    disposition: "active",
    schedule: planned,
    scheduleReadStatus: "ready",
  });

  test("stage-eligible facts plus no authority hide both actions", () => {
    assert.equal(scheduled.canStartWork, true);
    assert.equal(production.canCompleteJob, true);
    const none = { canStartWork: false, canCompleteJob: false, canManageSchedule: false };
    assert.equal(withLifecycleActionAuthority(scheduled, none).canStartWork, false);
    assert.equal(withLifecycleActionAuthority(production, none).canCompleteJob, false);
  });

  test("authority without stage eligibility does not enable an action", () => {
    const all = { canStartWork: true, canCompleteJob: true, canManageSchedule: true };
    assert.equal(withLifecycleActionAuthority(production, all).canStartWork, false);
    assert.equal(withLifecycleActionAuthority(scheduled, all).canCompleteJob, false);
  });

  test("authority is split: Start authority does not imply Complete", () => {
    const startOnly = { canStartWork: true, canCompleteJob: false, canManageSchedule: true };
    assert.equal(withLifecycleActionAuthority(scheduled, startOnly).canStartWork, true);
    assert.equal(withLifecycleActionAuthority(production, startOnly).canCompleteJob, false);
  });

  test("schedule changes need schedule authority (the Lead preset has none)", () => {
    assert.equal(scheduled.canReschedule, true);
    assert.equal(scheduled.canUnschedule, true);
    const lead = { canStartWork: false, canCompleteJob: false, canManageSchedule: false };
    const gated = withLifecycleActionAuthority(scheduled, lead);
    assert.equal(gated.canReschedule, false);
    assert.equal(gated.canUnschedule, false);
    assert.equal(gated.canSchedule, false);
    const coordinator = { canStartWork: true, canCompleteJob: true, canManageSchedule: true };
    assert.equal(withLifecycleActionAuthority(scheduled, coordinator).canReschedule, true);
  });

  test("Board movement refuses Start/Complete without authority and says why", () => {
    const base = {
      dispositionActive: true,
      canApproveJob: false,
      hasActivePlannedSchedule: true,
      scheduleReadStatus: "ready" as const,
      canManageSchedule: true,
    };
    const start = resolveBoardGuardedMovement({
      ...base,
      fromStage: "scheduled",
      toStage: "production",
      canStartWork: false,
      canCompleteJob: true,
    });
    assert.equal(start.allowed, false);
    if (!start.allowed) assert.equal(start.message, BOARD_MOVEMENT_NOT_PERMITTED_COPY);
    const complete = resolveBoardGuardedMovement({
      ...base,
      fromStage: "production",
      toStage: "complete",
      canStartWork: true,
      canCompleteJob: false,
    });
    assert.equal(complete.allowed, false);
    if (!complete.allowed) assert.equal(complete.reason, "not_permitted");
    assert.equal(
      boardDropTargetValidity({
        ...base,
        fromStage: "production",
        toStage: "complete",
        canStartWork: true,
        canCompleteJob: false,
      }),
      "invalid"
    );
  });

  test("every surface that offers Start/Complete applies the viewer authority", () => {
    const card = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(card, /withLifecycleActionAuthority\(/);
    assert.match(card, /canFinalizeDisposition && companyMembers\.canCompleteJob|companyMembers\.canCompleteJob/);
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(saved, /withLifecycleActionAuthority\(/);
    assert.match(saved, /canStartWork: viewerCanStartWork/);
    assert.match(saved, /canCompleteJob: viewerCanCompleteJob/);
    const legacy = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(legacy, /withLifecycleActionAuthority\(/);
    assert.match(legacy, /useCompanyMembers\(/);
  });
});

describe("people a Lead can see and assign", () => {
  test("task assignee candidates merge the directory and the job's brief people, deduplicated", () => {
    const merged = taskAssigneeCandidates(
      [{ userId: LEAD, displayName: "Lee", email: null, role: "field_user" } as never],
      [
        { userId: LEAD, displayName: "Lee" },
        { userId: COORD, displayName: "Cora" },
      ]
    );
    assert.deepEqual(
      merged.map((m) => m.userId),
      [LEAD, COORD]
    );
  });

  function fakeSupabase(directory: unknown, brief: unknown, briefError = false) {
    return {
      rpc: async (name: string) => {
        if (name === "list_company_directory_v1") return { data: directory, error: null };
        if (name === "get_job_field_brief_v1") {
          return briefError ? { data: null, error: { message: "x" } } : { data: brief, error: null };
        }
        return { data: null, error: { message: "unknown" } };
      },
    } as never;
  }

  const briefFor = (people: Array<{ user_id: string; display_name: string }>) => ({
    ok: true,
    job: { id: JOB, crew_label: null, production_lead_user_id: COORD },
    approved_scope_label: null,
    has_accepted_agreement: false,
    scope_changes: [],
    people,
  });

  test("a member outside the Lead's directory validates only through that job's brief", async () => {
    const self = [{ user_id: LEAD, display_name: "Lee", role: "field_user" }];
    const sb = fakeSupabase(self, briefFor([{ user_id: COORD, display_name: "Cora" }]));
    const ok = await validateLiveCompanyMember(sb, COMPANY, COORD, { jobId: JOB });
    assert.equal(ok.ok, true);
    const noJob = await validateLiveCompanyMember(sb, COMPANY, COORD);
    assert.equal(noJob.ok, false);
    const stranger = await validateLiveCompanyMember(sb, COMPANY, STRANGER, { jobId: JOB });
    assert.equal(stranger.ok, false);
    if (!stranger.ok) assert.equal(stranger.code, "member_not_found");
  });

  test("an unreadable brief is unavailable, never a pass", async () => {
    const sb = fakeSupabase([{ user_id: LEAD, display_name: "Lee", role: "field_user" }], null, true);
    const result = await validateLiveCompanyMember(sb, COMPANY, COORD, { jobId: JOB });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "member_unavailable");
  });

  test("task assignment passes the job; job responsibility still needs company jobs.assign", () => {
    const tasks = read("app/lib/jobTaskPersistence.ts");
    assert.match(tasks, /validateLiveCompanyMember\([^)]*\{ jobId: job\.id \}\s*\)/);
  });
});

describe("tenancy", () => {
  test("RPC authority never takes the company from the client beyond membership in it", () => {
    for (const fn of ["public.start_job_work_v1", "public.complete_job_work_v1"]) {
      const body = fnBody(S1, fn);
      assert.match(body, /cm\.company_id = v_company_id\s+and cm\.user_id = v_uid\s+and cm\.removed_at is null/, fn);
      assert.match(body, /j\.company_id = v_company_id/, fn);
    }
  });

  test("routes use the session company, not a body company", () => {
    for (const rel of ["app/api/jobs/start-work/route.ts", "app/api/jobs/complete-work/route.ts"]) {
      const src = read(rel);
      assert.match(src, /session\.companyId|gate\.session\.companyId|companyId: gate/, rel);
      assert.doesNotMatch(src, /body\??\.company_?[iI]d/, rel);
    }
  });

  test("a brief read is job-gated by jobs.read in the caller's company", () => {
    const m6 = read(`${MIG}20260927195000_phase13b_c_access_mutations_field_brief.sql`);
    assert.match(fnBody(m6, "public.get_job_field_brief_v1"), /private\.member_can_v1\('jobs\.read', p_job_id\)/);
  });
});
