/**
 * Phase 13B-B — enforcement hardening: active-membership RLS, definer RPC checks,
 * grant hardening, Team RPCs, owner consistency, typed access, route gates.
 * Run: npx tsx --test app/lib/phase13bEnforcementHardening.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { COMPANY_CAPABILITY_KEYS } from "./companyMembershipRoles";
import {
  parseCompanyDirectoryRows,
  validateLiveCompanyMember,
  memberValidationStatus,
} from "./companyMemberValidation";
import { mapContractorAccess } from "./contractorCapabilityAuth";
import { userCompanyAccessFromResolution } from "./ensureUserIdentity";
import { mapActiveMembershipGate } from "./requireCapabilitySession";

require.cache[require.resolve("server-only")] = {
  exports: {},
} as NodeModule;

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const MIG = "supabase/migrations/";
const RLS_SQL = read(`${MIG}20260927180000_phase13b_b_active_membership_rls.sql`);
const RPC_SQL = read(`${MIG}20260927181000_phase13b_b_rpc_active_membership_capability.sql`);
const TEAM_SQL = read(`${MIG}20260927182000_phase13b_b_team_directory_and_member_rpcs.sql`);
const GRANT_SQL = read(`${MIG}20260927183000_phase13b_b_function_and_table_grants.sql`);
const STORAGE_SQL = read(`${MIG}20260927184000_phase13b_b_job_attachments_bucket_private.sql`);
const OWNER_SQL = read(`${MIG}20260927185000_phase13b_b_owner_consistency.sql`);

type InventoryPolicy = {
  table: string;
  cmd: string;
  name: string;
  family: "A" | "B" | "C" | "D";
  using: string | null;
  with_check: string | null;
  in_migrations: boolean;
};
const INVENTORY = JSON.parse(read("docs/phase13b-b-policy-inventory.json")) as {
  count: number;
  policies: InventoryPolicy[];
};

const ACTOR = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const OTHER = "44444444-4444-4444-8444-444444444444";
const COMPANY = "33333333-3333-4333-8333-333333333333";

function fakeRpc(resolve: (fn: string, args: unknown) => { data?: unknown; error?: unknown }) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  return {
    calls,
    client: {
      rpc(fn: string, args?: unknown) {
        calls.push({ fn, args });
        return Promise.resolve(resolve(fn, args));
      },
      from() {
        throw new Error("direct table access not expected");
      },
    } as never,
  };
}

function alterStatements(sql: string): Array<{ name: string; table: string; body: string }> {
  const out: Array<{ name: string; table: string; body: string }> = [];
  for (const m of sql.matchAll(/alter policy "([^"]+)" on public\.([a-z_]+)([\s\S]*?);\n/g)) {
    out.push({ name: m[1], table: m[2], body: m[3] });
  }
  return out;
}

describe("Phase 13B-B reviewed policy inventory", () => {
  test("every live policy is classified; only families A and D exist; all are in migrations", () => {
    assert.equal(INVENTORY.count, INVENTORY.policies.length);
    assert.equal(INVENTORY.policies.length, 126);
    for (const p of INVENTORY.policies) {
      assert.ok(p.family === "A" || p.family === "D", `${p.table}.${p.name}`);
      assert.equal(p.in_migrations, true, `${p.table}.${p.name}`);
    }
    const d = INVENTORY.policies.filter((p) => p.family === "D").map((p) => `${p.table}.${p.name}`);
    assert.deepEqual(d.sort(), [
      "companies.Owners can update company",
      "company_memberships.Users can view their memberships",
      "profiles.Users can insert own profile",
      "profiles.Users can update own profile",
      "profiles.Users can view own profile",
      "proposal_version_payment_terms.proposal_version_payment_terms_write_deny",
    ]);
  });

  test("family A = every policy that referenced company_memberships", () => {
    for (const p of INVENTORY.policies) {
      const text = `${p.using ?? ""} ${p.with_check ?? ""}`;
      const references = /company_memberships/.test(text);
      if (p.family === "A") assert.ok(references, `${p.table}.${p.name}`);
      if (references) assert.equal(p.family, "A", `${p.table}.${p.name}`);
    }
  });
});

describe("Phase 13B-B active-membership RLS (policy parity)", () => {
  const alters = alterStatements(RLS_SQL);
  const familyA = INVENTORY.policies.filter((p) => p.family === "A");

  test("every family-A policy is rebuilt exactly once; no family-D policy is touched", () => {
    assert.equal(alters.length, familyA.length);
    assert.equal(alters.length, 120);
    const keys = new Set(alters.map((a) => `${a.table}.${a.name}`));
    assert.equal(keys.size, alters.length);
    for (const p of familyA) assert.ok(keys.has(`${p.table}.${p.name}`), p.name);
    for (const p of INVENTORY.policies.filter((x) => x.family === "D")) {
      assert.equal(keys.has(`${p.table}.${p.name}`), false, p.name);
    }
  });

  test("no rebuilt policy references company_memberships except through the helper", () => {
    for (const a of alters) {
      assert.doesNotMatch(a.body, /company_memberships/, a.name);
      assert.match(a.body, /private\.current_active_company_id\(\)/, a.name);
      assert.match(a.body, /^\s*to authenticated/, a.name);
    }
    assert.doesNotMatch(RLS_SQL, /create policy|drop policy/i);
  });

  test("same-company conjuncts are preserved verbatim", () => {
    const proposalsInsert = alters.find((a) => a.name === "proposals_insert_company_scope");
    assert.ok(proposalsInsert);
    assert.match(proposalsInsert.body, /j\.company_id = proposals\.company_id/);
    assert.match(proposalsInsert.body, /p\.company_id = proposals\.company_id/);
    const attention = alters.find((a) => a.name === "job_attention_user_state_select_own");
    assert.ok(attention);
    assert.match(attention.body, /user_id = auth\.uid\(\)/);
  });

  test("R15: token metadata SELECT additionally requires proposal_author", () => {
    const token = alters.find((a) => a.name === "proposal_public_access_tokens_select_company_scope");
    assert.ok(token);
    assert.match(token.body, /current_member_has_capability_v1\('proposal_author'::text\)/);
  });

  test("helper derives the actor from auth.uid(), requires active + canonical role, fails closed", () => {
    const start = RLS_SQL.indexOf("create or replace function private.current_active_company_id()");
    const fn = RLS_SQL.slice(start, RLS_SQL.indexOf("$$;", start));
    assert.match(fn, /security definer/);
    assert.match(fn, /stable/);
    assert.match(fn, /set search_path = pg_catalog, public/);
    assert.match(fn, /m\.user_id = auth\.uid\(\)/);
    assert.match(fn, /m\.removed_at is null/);
    assert.match(fn, /private\.role_is_valid_v1\(m\.role\)/);
    assert.match(RLS_SQL, /revoke all on schema private from public/);
    assert.match(RLS_SQL, /grant usage on schema private to authenticated, service_role/);
    assert.match(RLS_SQL, /revoke all on function private\.current_active_company_id\(\) from public/);
    assert.doesNotMatch(RLS_SQL, /to anon|anon,/);
  });

  test("DB interim capability map mirrors the app map exactly (Owner only)", () => {
    const start = RLS_SQL.indexOf("create or replace function private.role_has_capability_v1");
    const fn = RLS_SQL.slice(start, RLS_SQL.indexOf("$$;", start));
    const keys = [...fn.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((k) => k !== "owner");
    assert.deepEqual([...keys].sort(), [...COMPANY_CAPABILITY_KEYS].sort());
    assert.match(fn, /p_role = 'owner'/);
  });
});

describe("Phase 13B-B definer RPC active-membership checks", () => {
  const blocks = RPC_SQL.split(/\n-- (?=[a-z_]+_v1: )/).slice(1);
  const byName = new Map(
    blocks
      .map((b) => [b.slice(0, b.indexOf(":")), b] as const)
      .filter(([name]) => name !== "job_contract_total_cents_v1")
  );

  test("all 19 employee RPCs require an active membership", () => {
    assert.equal(byName.size, 19);
    for (const [name, body] of byName) {
      assert.match(body, /cm\.user_id = v_uid\s*\n\s*and cm\.removed_at is null/, name);
      assert.match(body, /SECURITY DEFINER/, name);
      assert.match(body, /SET search_path TO/, name);
    }
  });

  test("capability mirrors the route gate for money, config, acceptance, schedule, lifecycle, authoring", () => {
    const expected: Record<string, string> = {
      confirm_proposal_acceptance_v1: "job_approve",
      acknowledge_proposal_acceptance_attention_v1: "job_approve",
      create_job_payment_request_v1: "payment_request",
      cancel_job_payment_request_v1: "payment_request",
      collect_job_payment_v1: "payment_request",
      reserve_job_payment_refund_v1: "payment_admin",
      upsert_company_payment_settings_v1: "payment_admin",
      set_company_timezone_v1: "company_admin",
      schedule_job_v1: "schedule_mutate",
      reschedule_job_v1: "schedule_mutate",
      unschedule_job_v1: "schedule_mutate",
      start_job_work_v1: "lifecycle_start_complete",
      complete_job_work_v1: "lifecycle_start_complete",
      update_proposal_customer_request_status_v1: "proposal_author",
      upsert_draft_proposal_payment_terms_v1: "proposal_author",
    };
    for (const [name, cap] of Object.entries(expected)) {
      assert.match(byName.get(name) ?? "", new RegExp(`role_has_capability_v1\\(cm\\.role, '${cap}'\\)`), name);
    }
    for (const name of ["ensure_company_payment_settings_v1", "change_job_property_v1", "mark_job_attention_read_v1"]) {
      assert.match(byName.get(name) ?? "", /private\.role_is_valid_v1\(cm\.role\)/, name);
    }
    assert.match(
      byName.get("change_job_disposition_v1") ?? "",
      /'job_pause_resume'\) or private\.role_has_capability_v1\(cm\.role, 'job_disposition_finalize'\)/
    );
  });

  test("contract total returns null for a signed-in caller outside its own active company", () => {
    assert.match(
      RPC_SQL,
      /when auth\.uid\(\) is not null\s*and p_company_id is distinct from private\.current_active_company_id\(\)\s*then null/
    );
  });
});

describe("Phase 13B-B grant hardening", () => {
  test("N13 and unsafe internal helpers lose anon/authenticated EXECUTE", () => {
    for (const sig of [
      "job_scope_change_author_ok_v1\\(uuid, uuid\\)",
      "job_scope_change_member_ok_v1\\(uuid, uuid\\)",
      "job_scope_change_lines_json_v1\\(uuid, uuid\\)",
      "job_scope_change_replace_lines_v1\\(uuid, uuid, jsonb\\)",
      "proposal_payment_terms_seed_from_settings_v1\\(uuid, uuid, uuid\\)",
      "proposal_acceptance_contract_option_v1\\(uuid, uuid\\)",
      "authorize_job_scope_change_v1\\(jsonb\\)",
      "resolve_job_scope_change_public_access_token_v1\\(text\\)",
    ]) {
      assert.match(GRANT_SQL, new RegExp(`revoke execute on function public\\.${sig} from public, anon, authenticated;`), sig);
      assert.match(GRANT_SQL, new RegExp(`grant execute on function public\\.${sig} to service_role;`), sig);
    }
  });

  test("employee scope-change RPCs keep authenticated; anon removed", () => {
    for (const fn of [
      "create_job_scope_change_v1",
      "update_job_scope_change_draft_v1",
      "propose_job_scope_change_v1",
      "void_job_scope_change_v1",
      "decline_job_scope_change_v1",
      "mint_job_scope_change_public_access_token_v1",
    ]) {
      assert.match(GRANT_SQL, new RegExp(`revoke execute on function public\\.${fn}\\(jsonb\\) from public, anon;`), fn);
    }
    assert.match(GRANT_SQL, /job_contract_total_cents_v1\(uuid, uuid\) from public, anon;/);
    assert.doesNotMatch(GRANT_SQL, /^grant [^;]* to (anon|authenticated)/m);
  });

  test("company_memberships loses anon SELECT and authenticated UPDATE only", () => {
    assert.match(GRANT_SQL, /revoke select on table public\.company_memberships from anon;/);
    assert.match(GRANT_SQL, /revoke update on table public\.company_memberships from authenticated;/);
    assert.doesNotMatch(GRANT_SQL, /revoke select on table public\.company_memberships from authenticated/);
  });

  test("public scope-change routes use the service-role client (unchanged by the revoke)", () => {
    for (const rel of [
      "app/api/scope-changes/public/[token]/route.ts",
      "app/api/scope-changes/public/[token]/authorize/route.ts",
    ]) {
      const src = read(rel);
      assert.match(src, /createAdminClient/, rel);
      assert.match(src, /resolveScopeChangePublicAccessTokenViaRpc\(admin/, rel);
    }
  });

  test("attachment bucket stays private without adding object policies", () => {
    assert.match(STORAGE_SQL, /update storage\.buckets\s+set public = false\s+where id = 'job-attachments'/);
    assert.doesNotMatch(STORAGE_SQL, /create policy/i);
  });
});

describe("Phase 13B-B Team RPCs", () => {
  const fn = (name: string) => {
    const start = TEAM_SQL.indexOf(`create or replace function public.${name}(`);
    assert.ok(start >= 0, name);
    return TEAM_SQL.slice(start, TEAM_SQL.indexOf("\n$$;", start));
  };

  test("directory exposes names and roles only for the caller's active company", () => {
    const dir = fn("list_company_directory_v1");
    assert.match(dir, /returns table \(user_id uuid, display_name text, role text\)/);
    assert.doesNotMatch(dir, /email|removed_at is not null|open_/);
    assert.match(dir, /m\.company_id = private\.current_active_company_id\(\)/);
    assert.match(dir, /m\.removed_at is null/);
  });

  test("access-admin projection requires member_admin and derives counts from open work only", () => {
    const admin = fn("list_company_access_admin_v1");
    assert.match(admin, /private\.current_member_has_capability_v1\('member_admin'\)/);
    assert.match(admin, /raise exception 'forbidden' using errcode = '42501'/);
    assert.match(admin, /private\.job_is_open_work_v1\(j\.stage, j\.status, j\.archived, j\.deleted_at\)/);
    assert.match(admin, /t\.status = 'open'/);
  });

  test("open work excludes completed, archived, lost, closed, and deleted jobs", () => {
    const start = TEAM_SQL.indexOf("create or replace function private.job_is_open_work_v1");
    const body = TEAM_SQL.slice(start, TEAM_SQL.indexOf("$$;", start));
    assert.match(body, /p_deleted_at is null/);
    assert.match(body, /coalesce\(p_archived, false\) = false/);
    assert.match(body, /not in \('complete', 'archived'\)/);
    assert.match(body, /not in \('lost', 'closed', 'archived'\)/);
  });

  test("disable is revocation only, idempotent, and never touches assignments", () => {
    const dis = fn("disable_company_member_v1");
    assert.match(dis, /already_disabled', true/);
    assert.match(dis, /set removed_at = v_now/);
    assert.doesNotMatch(dis, /public\.jobs|public\.job_tasks|assigned_to/);
    assert.match(dis, /cannot_remove_self/);
  });

  test("handoff moves only open work of a disabled member to an active same-company member", () => {
    const h = fn("handoff_member_open_work_v1");
    assert.match(h, /v_target\.removed_at is null[\s\S]*member_active/);
    assert.match(h, /r\.company_id = v_company_id\s*and r\.user_id = p_reassign_to_user_id\s*and r\.removed_at is null/);
    assert.match(h, /private\.job_is_open_work_v1\(j\.stage, j\.status, j\.archived, j\.deleted_at\)/);
    assert.match(h, /t\.status = 'open'\s*and t\.deleted_at is null/);
    assert.match(h, /get diagnostics v_jobs = row_count/);
  });

  test("Team RPCs are not executable by anon", () => {
    for (const name of [
      "list_company_directory_v1()",
      "list_company_access_admin_v1()",
      "set_company_member_role_v1(uuid, text)",
      "disable_company_member_v1(uuid)",
      "handoff_member_open_work_v1(uuid, uuid)",
    ]) {
      const esc = name.replace(/[()]/g, "\\$&");
      assert.match(TEAM_SQL, new RegExp(`revoke all on function public\\.${esc} from public, anon, authenticated;`));
      assert.match(TEAM_SQL, new RegExp(`grant execute on function public\\.${esc} to authenticated, service_role;`));
    }
  });
});

describe("Phase 13B-B owner consistency", () => {
  test("partial unique owner index + deferred constraint triggers on both tables", () => {
    assert.match(OWNER_SQL, /on public\.company_memberships \(company_id\)\s*where role = 'owner'/);
    assert.match(OWNER_SQL, /create constraint trigger company_memberships_owner_consistency[\s\S]*deferrable initially deferred/);
    assert.match(OWNER_SQL, /create constraint trigger companies_owner_consistency[\s\S]*after insert or update of owner_user_id on public\.companies[\s\S]*deferrable initially deferred/);
  });

  test("rejects disabled owner, pointer mismatch, ownerless members, and pointer-less new companies", () => {
    for (const msg of [
      "owner membership cannot be disabled",
      "owner membership must match companies.owner_user_id",
      "owner pointer requires an active owner membership",
      "new company requires an owner",
      "company members require an owner",
    ]) {
      assert.match(OWNER_SQL, new RegExp(msg.replace(/\./g, "\\.")), msg);
    }
    assert.doesNotMatch(OWNER_SQL, /update public\.companies|delete from|set not null/i);
  });
});

describe("Phase 13B-B typed access (ERROR != EMPTY)", () => {
  test("typed company access distinguishes every state", () => {
    assert.deepEqual(userCompanyAccessFromResolution({ status: "unavailable" }), { status: "unavailable" });
    assert.deepEqual(userCompanyAccessFromResolution({ status: "removed" }), { status: "disabled" });
    assert.deepEqual(userCompanyAccessFromResolution({ status: "none" }), { status: "none" });
    assert.deepEqual(
      userCompanyAccessFromResolution({ status: "invalid_role", userId: ACTOR, companyId: COMPANY }),
      { status: "invalid_role" }
    );
    assert.deepEqual(
      userCompanyAccessFromResolution({
        status: "active",
        session: { userId: ACTOR, companyId: COMPANY, role: "field_user" },
      }),
      { status: "active", companyId: COMPANY, role: "field_user" }
    );
  });

  test("active gate: unavailable is 503, disabled/none are 403, invalid role is its own code", () => {
    assert.deepEqual(mapActiveMembershipGate({ status: "unavailable" }), {
      ok: false,
      denial: { status: 503, code: "authorization_unavailable" },
    });
    assert.deepEqual(mapActiveMembershipGate({ status: "removed" }), {
      ok: false,
      denial: { status: 403, code: "forbidden" },
    });
    assert.deepEqual(
      mapActiveMembershipGate({ status: "invalid_role", userId: ACTOR, companyId: COMPANY }),
      { ok: false, denial: { status: 403, code: "invalid_role" } }
    );
  });

  test("contractor session: unavailable is 503, disabled is 403", () => {
    assert.deepEqual(mapContractorAccess({ userId: ACTOR, access: { status: "unavailable" } }), {
      ok: false,
      status: 503,
      code: "authorization_unavailable",
    });
    assert.deepEqual(mapContractorAccess({ userId: ACTOR, access: { status: "disabled" } }), {
      ok: false,
      status: 403,
      code: "forbidden",
    });
    assert.deepEqual(
      mapContractorAccess({
        userId: ACTOR,
        access: { status: "active", companyId: COMPANY, role: "owner" },
      }),
      { ok: true, userId: ACTOR, companyId: COMPANY }
    );
  });

  test("legacy helper reads role and fails closed on every non-active state", () => {
    const src = read("app/lib/ensureUserIdentity.ts");
    assert.match(src, /return access\.status === "active" \? access\.companyId : null;/);
    assert.match(src, /resolveLiveMembership\(supabase, userId\)/);
  });
});

describe("Phase 13B-B member validation via directory", () => {
  test("directory read failure is unavailable (503), never member_not_found", async () => {
    const fake = fakeRpc(() => ({ data: null, error: { message: "x" } }));
    const result = await validateLiveCompanyMember(fake.client, COMPANY, TARGET);
    assert.deepEqual(result, { ok: false, code: "member_unavailable" });
    assert.equal(memberValidationStatus("member_unavailable"), 503);
    assert.equal(memberValidationStatus("member_not_found"), 400);
  });

  test("active same-company member validates; anyone else is member_not_found", async () => {
    const fake = fakeRpc(() => ({
      data: [{ user_id: TARGET, display_name: "Pat", role: "field_user" }],
      error: null,
    }));
    const ok = await validateLiveCompanyMember(fake.client, COMPANY, TARGET);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.member.email, null);
      assert.equal(ok.member.companyId, COMPANY);
    }
    const missing = await validateLiveCompanyMember(fake.client, COMPANY, OTHER);
    assert.deepEqual(missing, { ok: false, code: "member_not_found" });
    assert.deepEqual(fake.calls.map((c) => c.fn), ["list_company_directory_v1", "list_company_directory_v1"]);
  });

  test("malformed directory rows invalidate the read", () => {
    assert.equal(parseCompanyDirectoryRows([{ user_id: "nope", role: "owner" }]), null);
    assert.equal(parseCompanyDirectoryRows({}), null);
    assert.deepEqual(parseCompanyDirectoryRows([]), []);
  });
});

describe("Phase 13B-B disable first, handoff second", () => {
  const loadPersistence = () => import("./companyMembershipPersistence");

  test("disable commits even when handoff fails; failure is reported, not zero", async () => {
    const { removeCompanyMember } = await loadPersistence();
    const fake = fakeRpc((fn) => {
      if (fn === "disable_company_member_v1") {
        return { data: { ok: true, already_disabled: false }, error: null };
      }
      return { data: null, error: { message: "timeout" } };
    });
    const result = await removeCompanyMember({
      supabase: fake.client,
      actorUserId: ACTOR,
      targetUserId: TARGET,
    });
    assert.equal(result.removedUserId, TARGET);
    assert.equal(result.handoff.status, "failed");
    assert.deepEqual(fake.calls.map((c) => c.fn), [
      "disable_company_member_v1",
      "handoff_member_open_work_v1",
    ]);
  });

  test("handoff success reports exact counts", async () => {
    const { removeCompanyMember } = await loadPersistence();
    const fake = fakeRpc((fn) =>
      fn === "disable_company_member_v1"
        ? { data: { ok: true, already_disabled: true }, error: null }
        : { data: { ok: true, cleared_job_leads: 2, cleared_task_assignees: 1 }, error: null }
    );
    const result = await removeCompanyMember({
      supabase: fake.client,
      actorUserId: ACTOR,
      targetUserId: TARGET,
    });
    assert.equal(result.alreadyDisabled, true);
    assert.deepEqual(result.handoff, {
      status: "completed",
      clearedJobLeads: 2,
      clearedTaskAssignees: 1,
      reassignedTo: null,
    });
  });

  test("malformed handoff counts are a failure, never zero", async () => {
    const { handoffMemberOpenWork } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: { ok: true, cleared_job_leads: null }, error: null }));
    const outcome = await handoffMemberOpenWork({ supabase: fake.client, targetUserId: TARGET });
    assert.equal(outcome.status, "failed");
  });

  test("invalid reassignment target is rejected before revocation when the directory proves it", async () => {
    const { removeCompanyMember } = await loadPersistence();
    const fake = fakeRpc((fn) =>
      fn === "list_company_directory_v1"
        ? { data: [{ user_id: ACTOR, display_name: null, role: "owner" }], error: null }
        : { data: { ok: true }, error: null }
    );
    await assert.rejects(
      removeCompanyMember({
        supabase: fake.client,
        actorUserId: ACTOR,
        targetUserId: TARGET,
        reassignToUserId: OTHER,
      }),
      (err: { code?: string }) => err.code === "invalid_reassign"
    );
    assert.deepEqual(fake.calls.map((c) => c.fn), ["list_company_directory_v1"]);
  });

  test("disable failure throws and never attempts handoff", async () => {
    const { removeCompanyMember } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: null, error: { message: "x" } }));
    await assert.rejects(
      removeCompanyMember({ supabase: fake.client, actorUserId: ACTOR, targetUserId: TARGET }),
      (err: { status?: number }) => err.status === 503
    );
    assert.deepEqual(fake.calls.map((c) => c.fn), ["disable_company_member_v1"]);
  });
});

describe("Phase 13B-B route gates", () => {
  const gates: Record<string, string> = {
    "app/api/jobs/confirm-acceptance/route.ts": "job_approve",
    "app/api/jobs/acknowledge-acceptance/route.ts": "job_approve",
    "app/api/company/payments/settings/route.ts": "payment_admin",
    "app/api/company/timezone/route.ts": "company_admin",
    "app/api/jobs/payment-requests/route.ts": "payment_request",
    "app/api/jobs/payment-requests/[id]/cancel/route.ts": "payment_request",
    "app/api/jobs/payment-requests/[id]/checkout/route.ts": "payment_request",
    "app/api/jobs/[jobId]/payment-requests/balance/route.ts": "payment_request",
    "app/api/jobs/reschedule/route.ts": "schedule_mutate",
    "app/api/jobs/unschedule/route.ts": "schedule_mutate",
    "app/api/proposals/[proposalId]/payment-terms/route.ts": "proposal_author",
    "app/api/proposals/customer-requests/route.ts": "proposal_author",
    "app/api/proposals/public-review-link/route.ts": "proposal_author",
    "app/api/proposals/send-prep/route.ts": "proposal_author",
    "app/api/jobs/[jobId]/tasks/route.ts": "task_assign",
  };

  test("formerly membership-only mutations require their capability", () => {
    for (const [rel, cap] of Object.entries(gates)) {
      const src = read(rel);
      assert.match(src, new RegExp(`"${cap}"`), rel);
      assert.match(src, /requireCapabilitySession|mapCapabilityGate/, rel);
    }
  });

  test("attachment writes need photo_mutate; reads need an active membership", () => {
    const auth = read("app/lib/jobAttachmentRouteAuth.ts");
    assert.match(auth, /mapCapabilityGate\(resolution, "photo_mutate"\)/);
    assert.match(auth, /mapActiveMembershipGate\(resolution\)/);
    assert.match(read("app/api/jobs/[jobId]/attachments/route.ts"), /requireAuth\("mutate"\)/);
    assert.match(read("app/api/jobs/[jobId]/attachments/[attachmentId]/finalize/route.ts"), /"mutate"/);
    const item = read("app/api/jobs/[jobId]/attachments/[attachmentId]/route.ts");
    assert.match(item, /requireAuth\("read"\)/);
    assert.equal((item.match(/requireAuth\("mutate"\)/g) ?? []).length, 2);
  });

  test("gated mutation routes no longer collapse an outage into 403 via the legacy helper", () => {
    for (const rel of [
      ...Object.keys(gates).filter((r) => !/timezone|payment-terms|customer-requests/.test(r)),
      "app/api/jobs/schedule/route.ts",
      "app/api/jobs/start-work/route.ts",
      "app/api/jobs/complete-work/route.ts",
      "app/api/jobs/change-disposition/route.ts",
      "app/api/jobs/[jobId]/payment-requests/collect/route.ts",
      "app/api/jobs/[jobId]/payment-link/route.ts",
      "app/api/jobs/[jobId]/payments/[paymentId]/refunds/route.ts",
      "app/api/jobs/[jobId]/customer-record-link/route.ts",
      "app/api/company/payments/connect/route.ts",
      "app/api/jobs/[jobId]/tasks/[taskId]/route.ts",
      "app/api/jobs/[jobId]/attachments/route.ts",
    ]) {
      assert.doesNotMatch(read(rel), /getUserCompanyId/, rel);
    }
  });

  test("Team editor shows load failure and handoff failure instead of empty/zero", () => {
    const src = read("app/tools/settings/CompanySettingsTeamEditor.tsx");
    assert.match(src, /data-company-settings-team-unavailable/);
    assert.match(src, /Access removed\. \$\{handoffError\}/);
    assert.match(src, /action: "handoff"/);
  });
});
