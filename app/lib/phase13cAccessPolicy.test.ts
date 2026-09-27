/**
 * Phase 13B-C — deterministic company access policy: registry, profiles, sparse rules,
 * scopes, delegation, Field job access, audit, single evaluator, DB/server parity.
 * Run: npx tsx --test app/lib/phase13cAccessPolicy.test.ts
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ACCESS_CAPABILITIES,
  ACCESS_PACKAGES,
  ACCESS_ROLE_PROFILES,
  ACTIVE_CAPABILITY_KEYS,
  getCapabilityDefinition,
  isActiveCapabilityKey,
  validateAccessRegistry,
} from "./access/registry";
import { buildAccessRegistrySeedSql, extractRegistrySeed } from "./access/registrySql";
import { mapAccessCheck } from "./access/requireAccess";
import { mapViewerAccess, NO_VIEWER_ACCESS } from "./access/viewerAccess";
import { parseJobFieldBrief } from "./jobFieldBrief";
import { COMPANY_MEMBERSHIP_ROLE_LABELS } from "./companyMembershipRoles";

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const MIG = "supabase/migrations/";
const M1 = read(`${MIG}20260927190000_phase13b_c_access_registry.sql`);
const M2 = read(`${MIG}20260927191000_phase13b_c_access_rules_job_grants_audit.sql`);
const M3 = read(`${MIG}20260927192000_phase13b_c_access_evaluator.sql`);
const M4 = read(`${MIG}20260927193000_phase13b_c_rpc_canonical_capabilities.sql`);
const M5 = read(`${MIG}20260927194000_phase13b_c_capability_scoped_rls.sql`);
const M6 = read(`${MIG}20260927195000_phase13b_c_access_mutations_field_brief.sql`);
const PHASE_C = [M1, M2, M3, M4, M5, M6];

const USER = "11111111-1111-4111-8111-111111111111";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const JOB = "55555555-5555-4555-8555-555555555555";

const RESERVED = ACCESS_CAPABILITIES.filter((c) => c.status === "reserved").map(
  (c) => c.key as string
);

function fnBody(sql: string, qualifiedName: string): string {
  const start = sql.toLowerCase().indexOf(`create or replace function ${qualifiedName}(`);
  assert.ok(start >= 0, qualifiedName);
  const end = sql.slice(start).search(/\n\$(function)?\$;/);
  return sql.slice(start, end < 0 ? undefined : start + end);
}

const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(rel);
  }
  return out;
}

describe("Phase 13B-C registry (§5–7, §13–14, §20)", () => {
  test("registry validates: DAG, statuses, scopes, dependency completeness", () => {
    assert.deepEqual(validateAccessRegistry(), []);
  });

  test("exactly five roles, one v1 profile each; display labels Owner/Admin/Sales/Production Lead/Field", () => {
    assert.deepEqual(
      ACCESS_ROLE_PROFILES.map((p) => `${p.role}@${p.version}`).sort(),
      ["admin@1", "field_user@1", "office_sales@1", "owner@1", "production_lead@1"]
    );
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.owner, "Owner");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.admin, "Admin");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.office_sales, "Sales");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.production_lead, "Production Lead");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.field_user, "Field");
  });

  test("reserved capabilities are never granted by a profile or an active package", () => {
    assert.ok(RESERVED.length > 0);
    for (const p of ACCESS_ROLE_PROFILES) {
      for (const e of p.entries) assert.equal(RESERVED.includes(e.capability), false, e.capability);
    }
    for (const pkg of ACCESS_PACKAGES.filter((p) => p.status === "active")) {
      for (const cap of pkg.capabilities) {
        assert.equal(RESERVED.includes(cap), false, `${pkg.key}:${cap}`);
      }
    }
  });

  test("unknown and reserved keys are not active (fail closed)", () => {
    for (const key of ["", "owner", "*", "proposal_author", "jobs.*", ...RESERVED]) {
      assert.equal(isActiveCapabilityKey(key), false, key);
    }
    assert.equal(getCapabilityDefinition("nope"), null);
  });

  test("Owner is explicit, not a wildcard: exactly the active keys", () => {
    const owner = ACCESS_ROLE_PROFILES.find((p) => p.role === "owner")!;
    assert.deepEqual(
      owner.entries.map((e) => e.capability).sort(),
      [...ACTIVE_CAPABILITY_KEYS].sort()
    );
  });

  test("§21 Admin: no money, cost, pricing, or scope-issue authority by default", () => {
    const admin = new Set<string>(
      ACCESS_ROLE_PROFILES.find((p) => p.role === "admin")!.entries.map((e) => e.capability)
    );
    for (const cap of [
      "payments.summary.read",
      "payments.history.read",
      "payments.request",
      "payments.refund",
      "payments.configure",
      "pricing.manage",
      "pricing.cost.read",
      "company_financials.read",
      "scope_changes.issue",
    ]) {
      assert.equal(admin.has(cap), false, cap);
    }
  });

  test("§12 sensitive packages are Owner-assignable only; Field packages are job-scoped", () => {
    for (const pkg of ACCESS_PACKAGES) {
      if (pkg.sensitive) assert.deepEqual([...pkg.assignableBy], ["owner"], pkg.key);
      if ((pkg.eligibleRoles as readonly string[]).includes("field_user")) {
        assert.equal(pkg.scope, "granted_jobs", pkg.key);
      }
    }
  });

  test("Field profile is granted-job / own-task scoped only; no commercial capability", () => {
    const field = ACCESS_ROLE_PROFILES.find((p) => p.role === "field_user")!;
    for (const e of field.entries) {
      assert.ok(e.scope === "granted_jobs" || e.scope === "own_task", e.capability);
      assert.doesNotMatch(e.capability, /^(proposals|payments|pricing|scope_changes|customers|team|company)\./);
    }
  });
});

describe("Phase 13B-C M1 registry tables + generated seed parity (§18)", () => {
  test("migration seed is byte-identical to the TypeScript registry", () => {
    assert.equal(extractRegistrySeed(M1), buildAccessRegistrySeedSql());
  });

  test("registry tables are RLS-on with no policies and no client grants", () => {
    for (const table of [
      "access_capabilities",
      "access_capability_dependencies",
      "access_role_profiles",
      "access_role_profile_capabilities",
      "access_packages",
      "access_package_capabilities",
    ]) {
      assert.match(M1, new RegExp(`alter table public\\.${table} enable row level security`), table);
    }
    const revoke = M1.slice(M1.indexOf("revoke all on table"), M1.indexOf(";", M1.indexOf("revoke all on table")));
    assert.match(revoke, /from public, anon, authenticated, service_role$/);
    for (const table of ["access_capabilities", "access_packages", "access_package_capabilities"]) {
      assert.match(revoke, new RegExp(`public\\.${table}\\b`), table);
    }
    assert.doesNotMatch(M1, /create policy/i);
  });

  test("seed validation runs in the migration and aborts on any violation", () => {
    assert.match(M1, /private\.access_registry_violations_v1\(\)/);
    assert.match(M1, /with recursive/i);
    assert.match(M1, /raise exception/);
  });
});

describe("Phase 13B-C M2 membership revision, sparse rules, job grants, audit (§8, §10, §15–16, §25)", () => {
  test("memberships carry a versioned profile and an access revision", () => {
    assert.match(M2, /add column role_profile_version integer not null default 1/);
    assert.match(M2, /add column access_revision bigint not null default 1/);
    assert.match(M2, /references public\.access_role_profiles \(role_key, version\)/);
  });

  test("rules: exactly one target, grants are packages only, job scope needs a job, validity window", () => {
    const start = M2.indexOf("create table public.company_member_access_rules");
    const table = M2.slice(start, M2.indexOf(");\n", start));
    assert.match(table, /effect text not null check \(effect in \('grant', 'restrict'\)\)/);
    assert.match(table, /\(package_key is null\) <> \(capability_key is null\)/);
    assert.match(table, /effect = 'restrict' or package_key is not null/);
    assert.match(table, /\(scope_kind = 'job'\) = \(scope_job_id is not null\)/);
    assert.match(table, /valid_until is null or valid_until > valid_from/);
    assert.match(table, /references public\.company_memberships \(user_id, company_id\)\s*on delete cascade/);
  });

  test("job_access_grants: one active grant per job/user, tenant-checked", () => {
    assert.match(M2, /create table public\.job_access_grants/);
    assert.match(M2, /on public\.job_access_grants \(job_id, user_id\)\s*where revoked_at is null/);
    assert.match(M2, /source in \('manual', 'task_assignment', 'production_lead_assignment', 'migration'\)/);
  });

  test("audit events are append-only (cascades excepted) and client-inaccessible", () => {
    assert.match(M2, /create table public\.company_access_events/);
    assert.match(M2, /pg_trigger_depth\(\) > 1/);
    for (const table of ["company_member_access_rules", "job_access_grants", "company_access_events"]) {
      assert.match(M2, new RegExp(`alter table public\\.${table} enable row level security`), table);
    }
    assert.doesNotMatch(M2, /create policy/i);
    assert.doesNotMatch(M2, /grant [^;]* on table public\.company_access_events to (anon|authenticated)/);
  });
});

describe("Phase 13B-C M3 single evaluator (§17)", () => {
  const core = fnBody(M3, "private.evaluate_access_core_v1");
  const outer = fnBody(M3, "private.evaluate_access_v1");

  test("precedence: membership → capability → resource → restriction → allow source → dependencies", () => {
    const iMember = outer.indexOf("membership_disabled");
    const iInvalid = outer.indexOf("invalid_role");
    const iResource = outer.indexOf("scope_missing");
    assert.ok(iMember > 0 && iInvalid > iMember && iResource > iInvalid);
    const iUnknown = core.indexOf("'capability_missing'");
    const iRestrict = core.indexOf("'restricted'");
    const iSources = core.indexOf("with sources");
    const iDeps = core.indexOf("'dependency_missing'");
    assert.ok(iUnknown > 0 && iRestrict > iUnknown && iSources > iRestrict && iDeps > iSources);
  });

  test("reserved / unknown capabilities fail closed; bounded recursion is unavailable, not allowed", () => {
    assert.match(core, /if not found or v_cap\.status <> 'active' then\s*return 'capability_missing'/);
    assert.match(core, /if p_depth > 16 then\s*return 'authorization_unavailable'/);
  });

  test("grant rules count only for active packages and eligible roles; validity uses database time", () => {
    assert.match(core, /p\.status = 'active'/);
    assert.match(core, /p_role = any \(p\.eligible_roles\)/);
    const live = fnBody(M3, "private.access_rule_is_live_v1");
    assert.match(live, /p_valid_from <= now\(\)/);
    assert.match(live, /p_valid_until is null or p_valid_until > now\(\)/);
  });

  test("foreign and nonexistent resources are indistinguishable; no different_company reason", () => {
    assert.doesNotMatch(M3.replace(/^--.*$/gm, ""), /'different_company'/);
    assert.match(outer, /j\.company_id = v_member\.company_id/);
  });

  test("delegation tiers: custody Owner, Admin with team.manage, Production Lead with jobs.assign", () => {
    const tier = fnBody(M3, "private.delegation_tier_v1");
    assert.match(tier, /private\.actor_holds_custody_v1\(v_company_id\)[\s\S]*'owner'/);
    assert.match(tier, /v_role = 'admin' and private\.member_can_v1\('team\.manage'\)/);
    assert.match(tier, /v_role = 'production_lead' and private\.member_can_v1\('jobs\.assign'\)/);
  });

  test("internal evaluator is service-role only; actor RPCs are authenticated", () => {
    assert.match(M3, /grant execute on function private\.evaluate_access_v1\(uuid, text, uuid, uuid\) to service_role;/);
    assert.doesNotMatch(M3, /evaluate_access_v1\([^)]*\) to [^;]*authenticated/);
    assert.match(M3, /grant execute on function public\.check_my_access_v1\(text, uuid, uuid\) to authenticated/);
  });
});

describe("Phase 13B-C M4–M6 canonical enforcement + DB/server parity (§18–19)", () => {
  test("legacy capability helpers are gone from every Phase C function and policy", () => {
    for (const sql of [M4, M5]) {
      assert.doesNotMatch(stripComments(sql), /current_member_has_capability_v1|role_has_capability_v1/);
    }
    assert.match(M6, /drop function private\.current_member_has_capability_v1\(text\);/);
    assert.match(M6, /drop function private\.role_has_capability_v1\(text, text\);/);
  });

  test("every capability named in Phase C SQL is an ACTIVE registry capability", () => {
    const named = new Set<string>();
    for (const sql of PHASE_C.slice(2)) {
      for (const m of sql.matchAll(/member_can_v1\('([a-z_.]+)'/g)) named.add(m[1]);
      for (const m of sql.matchAll(/member_job_ids_v1\('([a-z_.]+)'/g)) named.add(m[1]);
      for (const m of sql.matchAll(/evaluate_access_v1\([^,]+, '([a-z_.]+)'/g)) named.add(m[1]);
    }
    assert.ok(named.size > 10);
    for (const cap of named) assert.equal(isActiveCapabilityKey(cap), true, cap);
  });

  test("every route capability is an ACTIVE registry capability; no legacy vocabulary remains in app code", () => {
    const legacy =
      /"(proposal_author|payment_admin|payment_request|schedule_mutate|task_assign|task_complete|lifecycle_start_complete|photo_mutate|job_assign|customers_jobs|member_admin|company_admin|job_pause_resume|job_disposition_finalize|job_approve)"/;
    for (const rel of [...walk("app/api"), ...walk("app/lib"), ...walk("app/tools")]) {
      const src = read(rel);
      assert.doesNotMatch(src, legacy, rel);
      assert.doesNotMatch(src, /requireCapabilitySession\(|mapCapabilityGate|hasCompanyCapability|capabilitiesForRole/, rel);
      for (const m of src.matchAll(/(?:requireAccess|checkAccess)\([^,]+,\s*[^,]+,\s*"([a-z_.]+)"/g)) {
        assert.equal(isActiveCapabilityKey(m[1]), true, `${rel}:${m[1]}`);
      }
    }
  });

  test("Field reads are job-scoped in RLS through member_job_ids_v1", () => {
    assert.match(M5, /private\.member_job_ids_v1\('jobs\.read'::text\)/);
    assert.match(M5, /::uuid\[\]/);
  });

  test("contract totals are hidden from members without proposal or payment-summary read", () => {
    const fn = fnBody(M4, "public.job_contract_total_cents_v1");
    assert.match(fn, /private\.member_can_v1\('proposals\.read'\)/);
    assert.match(fn, /private\.member_can_v1\('payments\.summary\.read'\)/);
  });

  test("scope-change issue is a distinct, sensitive capability in the propose RPC", () => {
    const fn = fnBody(M4, "public.propose_job_scope_change_v1");
    assert.match(fn, /job_scope_change_author_ok_v1/);
    const author = fnBody(M4, "public.job_scope_change_author_ok_v1");
    assert.match(author, /'scope_changes\.issue'/);
  });
});

describe("Phase 13B-C M6 access mutations, revision, audit, delegation (§12, §15–16)", () => {
  const set = fnBody(M6, "public.set_member_access_v1");

  test("expected revision is required and checked under a row lock", () => {
    assert.match(set, /p_expected_revision bigint/);
    assert.match(set, /for update;/);
    assert.match(set, /v_target\.access_revision <> p_expected_revision/);
  });

  test("delegation: sensitive packages need custody; Admin cannot touch Admins or Owner-set restrictions", () => {
    assert.match(set, /not \(v_tier = any \(p\.assignable_by\)\)[\s\S]*package_not_delegable/);
    assert.match(set, /v_tier = 'admin' and \(\s*v_target\.role = 'admin' or p_role = 'admin'/);
    assert.match(set, /authority_source = 'owner'/);
  });

  test("restrictions are never silently cleared; grant/restriction conflicts and missing dependencies refuse", () => {
    assert.match(set, /grant_restriction_conflict/);
    assert.match(set, /dependency_incomplete/);
    assert.match(set, /packages_incompatible/);
  });

  test("state change and audit event are written in the same function (one transaction)", () => {
    assert.match(set, /access_revision = v_new_revision/);
    assert.match(set, /private\.record_access_event_v1\(/);
    for (const name of ["private.change_job_access_v1", "public.disable_company_member_v1"]) {
      assert.match(fnBody(M6, name), /private\.record_access_event_v1\(/, name);
    }
  });

  test("Field job access: tiered, company jobs.assign, active Field target, no self-grant", () => {
    const fn = fnBody(M6, "private.change_job_access_v1");
    assert.match(fn, /private\.delegation_tier_v1\(\)/);
    assert.match(fn, /private\.member_can_v1\('jobs\.assign'\)/);
    assert.match(fn, /target_ineligible/);
    assert.match(fn, /cannot_change_own_access/);
  });

  test("assignment coupling grants Field access; it never revokes", () => {
    const fn = fnBody(M6, "private.job_assignment_access_coupling_trg_v1");
    assert.match(fn, /insert into public\.job_access_grants/);
    assert.doesNotMatch(fn, /revoked_at = /);
  });

  test("Field brief projection contains no money, cost, terms, or payment data", () => {
    const brief = fnBody(M6, "public.get_job_field_brief_v1");
    assert.match(brief, /private\.member_can_v1\('jobs\.read', p_job_id\)/);
    assert.doesNotMatch(
      brief,
      /cents|price|total|margin|cost|payment|terms|deposit|balance|amount|unit_price/i
    );
  });

  test("directory: full list only for company-wide readers or job leads; plain Field sees self", () => {
    const dir = fnBody(M6, "public.list_company_directory_v1");
    assert.match(dir, /m\.user_id = auth\.uid\(\)/);
    assert.match(dir, /private\.member_can_v1\('jobs\.read'\)/);
    assert.match(dir, /private\.member_job_ids_v1\('tasks\.manage'\)/);
  });
});

describe("Phase 13B-C server mapping (requireAccess)", () => {
  const map = (data: unknown, error: unknown = null) => mapAccessCheck({ userId: USER, data, error });

  test("allowed requires a canonical role and company id", () => {
    assert.deepEqual(map({ allowed: true, reason: "allowed", company_id: COMPANY, role: "admin" }), {
      ok: true,
      session: { userId: USER, companyId: COMPANY, role: "admin" },
    });
    for (const bad of [
      { allowed: true, reason: "allowed", company_id: COMPANY, role: "garbage" },
      { allowed: true, reason: "allowed", company_id: "x", role: "owner" },
      { allowed: true, reason: "denied", company_id: COMPANY, role: "owner" },
    ]) {
      assert.equal(map(bad).ok, false);
    }
  });

  test("each evaluator reason maps to one HTTP outcome; unknown and errors are 503", () => {
    const cases: Array<[string, number, string]> = [
      ["not_member", 403, "forbidden"],
      ["membership_disabled", 403, "forbidden"],
      ["invalid_role", 403, "invalid_role"],
      ["capability_missing", 403, "capability_denied"],
      ["scope_missing", 403, "capability_denied"],
      ["restricted", 403, "capability_denied"],
      ["dependency_missing", 403, "capability_denied"],
      ["authorization_unavailable", 503, "authorization_unavailable"],
      ["different_company", 503, "authorization_unavailable"],
      ["something_new", 503, "authorization_unavailable"],
    ];
    for (const [reason, status, code] of cases) {
      const result = map({ allowed: false, reason, company_id: null, role: null });
      assert.equal(result.ok, false, reason);
      if (!result.ok) assert.deepEqual(result.denial, { status, code }, reason);
    }
    for (const data of [null, [], "x", {}]) assert.equal(map(data).ok, false);
    const errored = map({ allowed: true, reason: "allowed", company_id: COMPANY, role: "owner" }, { message: "x" });
    assert.equal(errored.ok, false);
    if (!errored.ok) assert.equal(errored.denial.status, 503);
  });
});

describe("Phase 13B-C viewer flags (no raw capability keys leave the server)", () => {
  test("flags derive from effective access; job-scoped tasks.manage counts at the job", () => {
    const flags = mapViewerAccess({
      ok: true,
      company_capabilities: ["team.manage", "jobs.read", "proposals.read", "scope_changes.write"],
      job_capabilities: ["tasks.manage"],
    });
    assert.ok(flags);
    assert.equal(flags.canAdminMembers, true);
    assert.equal(flags.canAssignTasks, true);
    assert.equal(flags.canWriteScopeChanges, true);
    assert.equal(flags.canIssueScopeChanges, false);
    assert.equal(flags.canReadCommercial, true);
    assert.equal(flags.canAssignJobs, false);
  });

  test("errors and malformed payloads are unavailable (null), never flags", () => {
    for (const data of [null, { ok: false, code: "forbidden" }, { ok: true }, { ok: true, company_capabilities: [1] }]) {
      assert.equal(mapViewerAccess(data), null);
    }
    assert.ok(Object.values(NO_VIEWER_ACCESS).every((v) => v === false));
  });

  test("members route and client hook carry booleans only", () => {
    const route = read("app/api/company/members/route.ts");
    assert.doesNotMatch(route, /company_capabilities|job_capabilities/);
    const hook = read("app/tools/roofing/jobCard/useCompanyMembers.ts");
    assert.doesNotMatch(hook, /company_capabilities|capabilitiesForRole/);
  });
});

describe("Phase 13B-C Field brief client path (§11)", () => {
  test("parser keeps whitelisted operational fields only", () => {
    const brief = parseJobFieldBrief({
      ok: true,
      job: { id: JOB, crew_label: " Crew A ", production_lead_user_id: USER, accepted_total_cents: 1 },
      approved_scope_label: "Better",
      has_accepted_agreement: true,
      scope_changes: [
        { status: "authorized", reason: "Add vent", lines: [{ description: "Vent", change_kind: "add", line_delta_cents: 5 }] },
        { status: "draft", reason: "hidden", lines: [] },
      ],
      people: [{ user_id: USER, display_name: "Pat", email: "x" }],
      price_delta_cents: 99,
    });
    assert.ok(brief);
    assert.deepEqual(brief, {
      jobId: JOB,
      crewLabel: "Crew A",
      productionLeadUserId: USER,
      approvedScopeLabel: "Better",
      hasAcceptedAgreement: true,
      scopeChanges: [
        { status: "authorized", reason: "Add vent", lines: [{ description: "Vent", changeKind: "add" }] },
      ],
      people: [{ userId: USER, displayName: "Pat" }],
    });
  });

  test("malformed brief is rejected", () => {
    for (const data of [null, { ok: false }, { ok: true, job: {} }, { ok: true, job: { id: JOB } }]) {
      assert.equal(parseJobFieldBrief(data), null);
    }
  });

  test("Job Card uses the brief for non-commercial viewers and hides the scope-change panel", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /useJobFieldBrief\(currentJobId, companyMembers\.restrictedFieldRole\)/);
    assert.match(client, /fieldBrief\.brief\?\.approvedScopeLabel/);
    assert.match(client, /hasAcceptedAgreement && !suppressCommercial \? \(/);
    const route = read("app/api/jobs/[jobId]/field-brief/route.ts");
    assert.match(route, /GET_JOB_FIELD_BRIEF_RPC_V1/);
    assert.match(route, /parseJobFieldBrief/);
  });

  test("attachment routes are job-scoped (service-role signing never outruns the gate)", () => {
    const auth = read("app/lib/jobAttachmentRouteAuth.ts");
    assert.match(auth, /checkAccess\(/);
    assert.match(auth, /\{ jobId \}/);
  });
});

describe("Phase 13B-C migration discipline (§27)", () => {
  test("Phase A/B migrations are not edited by Phase C (forward-only)", () => {
    for (const sql of PHASE_C) {
      assert.doesNotMatch(sql, /20260927170000|20260927180000_phase13b_b_active_membership_rls\.sql/);
    }
    const phaseC = readdirSync(join(process.cwd(), MIG)).filter((f) => /phase13b_c_/.test(f));
    assert.deepEqual(phaseC.sort(), [
      "20260927190000_phase13b_c_access_registry.sql",
      "20260927191000_phase13b_c_access_rules_job_grants_audit.sql",
      "20260927192000_phase13b_c_access_evaluator.sql",
      "20260927193000_phase13b_c_rpc_canonical_capabilities.sql",
      "20260927194000_phase13b_c_capability_scoped_rls.sql",
      "20260927195000_phase13b_c_access_mutations_field_brief.sql",
    ]);
  });
});
