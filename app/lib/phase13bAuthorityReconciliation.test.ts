/**
 * Phase 13B-A — authority reconciliation: fail-closed roles, custody distinct from role,
 * typed membership reads.
 * Run: npx tsx --test app/lib/phase13bAuthorityReconciliation.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES,
  COMPANY_MEMBERSHIP_ROLE_LABELS,
  COMPANY_MEMBERSHIP_ROLE_VALUES,
  capabilitiesForRole,
  hasCompanyCapability,
  isAssignableCompanyMembershipRole,
  isCompanyCustodyOwner,
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
} from "./companyMembershipRoles";
import { mapLiveMembershipRow } from "./companyMembershipSession";
import { mapCapabilityGate } from "./requireCapabilitySession";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

require.cache[require.resolve("server-only")] = {
  exports: {},
} as NodeModule;

type Result = { data?: unknown; error?: unknown };
type RpcCall = { fn: string; args: unknown };

function fakeRpc(resolve: (call: RpcCall) => Result) {
  const calls: RpcCall[] = [];
  const client = {
    rpc(fn: string, args?: unknown) {
      const call = { fn, args };
      calls.push(call);
      return Promise.resolve(resolve(call));
    },
    from() {
      throw new Error("Team persistence must not use direct table access");
    },
  };
  return { client: client as never, calls };
}

const ACTOR = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const TEAM_RPC_SQL =
  "supabase/migrations/20260927182000_phase13b_b_team_directory_and_member_rpcs.sql";

function sqlFunction(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end);
}

async function loadPersistence() {
  return import("./companyMembershipPersistence");
}

describe("Phase 13B-A stable role resolution", () => {
  test("each stable key resolves to itself", () => {
    for (const role of COMPANY_MEMBERSHIP_ROLE_VALUES) {
      assert.equal(resolveCompanyMembershipRole(role), role);
    }
    assert.deepEqual([...COMPANY_MEMBERSHIP_ROLE_VALUES], [
      "owner",
      "admin",
      "office_sales",
      "production_lead",
      "field_user",
    ]);
  });

  test("unknown, null, empty, malformed, legacy, and future roles fail closed", () => {
    const denied: unknown[] = [
      null,
      undefined,
      "",
      "   ",
      "owner_admin",
      "Owner",
      " owner",
      "OWNER",
      "office",
      "sales",
      "Office / Sales",
      "production",
      "prod_lead",
      "field",
      "crew",
      "technician",
      "super_owner",
      "billing_admin",
      42,
      {},
      ["owner"],
    ];
    for (const value of denied) {
      assert.equal(resolveCompanyMembershipRole(value), "invalid_role", String(value));
      assert.equal(capabilitiesForRole(value).size, 0, String(value));
      assert.equal(hasCompanyCapability(value, "member_admin"), false);
      assert.equal(hasCompanyCapability(value, "payment_admin"), false);
      assert.equal(hasCompanyCapability(value, "customers_jobs"), false);
    }
  });

  test("owner_admin never promotes to Owner", () => {
    assert.equal(resolveCompanyMembershipRole("owner_admin"), "invalid_role");
    assert.equal(isAssignableCompanyMembershipRole("owner_admin"), false);
    const roles = read("app/lib/companyMembershipRoles.ts");
    assert.doesNotMatch(roles, /owner_admin/);
    assert.doesNotMatch(roles, /return "owner";/);
  });

  test("Owner retains every capability current single-owner flows consume", () => {
    assert.deepEqual([...capabilitiesForRole("owner")].sort(), [
      "company_admin",
      "customers_jobs",
      "job_approve",
      "job_assign",
      "job_disposition_finalize",
      "job_pause_resume",
      "lifecycle_start_complete",
      "member_admin",
      "payment_admin",
      "payment_request",
      "photo_mutate",
      "proposal_author",
      "schedule_mutate",
      "task_assign",
      "task_complete",
    ]);
  });

  test("interim: non-Owner roles never inherit Owner-equivalent authority", () => {
    for (const role of ["admin", "office_sales", "production_lead", "field_user"]) {
      assert.equal(capabilitiesForRole(role).size, 0, role);
      for (const cap of capabilitiesForRole("owner")) {
        assert.equal(hasCompanyCapability(role, cap), false, `${role}:${cap}`);
      }
    }
    assert.equal(capabilitiesForRole("invalid_role").size, 0);
  });

  test("role recognition is separate from capability possession", () => {
    for (const role of ["admin", "office_sales", "production_lead", "field_user"]) {
      assert.equal(resolveCompanyMembershipRole(role), role);
      assert.notEqual(resolveCompanyMembershipRole(role), "invalid_role");
      assert.equal(capabilitiesForRole(role).size, 0);
    }
    const gate = mapCapabilityGate(
      {
        status: "active",
        session: { userId: ACTOR, companyId: COMPANY, role: "admin" },
      },
      "member_admin"
    );
    assert.deepEqual(gate, {
      ok: false,
      denial: { status: 403, code: "capability_denied" },
    });
  });

  test("custody is separate from capability possession", () => {
    // Capability comes from the owner role; custody additionally needs the pointer.
    assert.equal(hasCompanyCapability("owner", "member_admin"), true);
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "owner", companyOwnerUserId: null }),
      false
    );
    // A custody pointer never grants capabilities to a non-owner role.
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "admin", companyOwnerUserId: ACTOR }),
      false
    );
    assert.equal(hasCompanyCapability("admin", "member_admin"), false);
  });

  test("restricted presentation covers field and invalid roles only", () => {
    assert.equal(isRestrictedFieldRole("field_user"), true);
    assert.equal(isRestrictedFieldRole("garbage"), true);
    for (const role of ["owner", "admin", "office_sales", "production_lead"]) {
      assert.equal(isRestrictedFieldRole(role), false, role);
    }
  });

  test("assignable roles exclude owner and invalid_role", () => {
    assert.deepEqual([...ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES], [
      "admin",
      "office_sales",
      "production_lead",
      "field_user",
    ]);
    assert.equal(isAssignableCompanyMembershipRole("owner"), false);
    assert.equal(isAssignableCompanyMembershipRole("invalid_role"), false);
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.owner, "Owner");
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.admin, "Admin");
  });
});

describe("Phase 13B-A custody is distinct from role", () => {
  test("custody needs owner role and matching owner_user_id", () => {
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "owner", companyOwnerUserId: ACTOR }),
      true
    );
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "owner", companyOwnerUserId: null }),
      false
    );
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "owner", companyOwnerUserId: TARGET }),
      false
    );
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "admin", companyOwnerUserId: ACTOR }),
      false
    );
    assert.equal(
      isCompanyCustodyOwner({ userId: "", role: "owner", companyOwnerUserId: "" }),
      false
    );
  });
});

describe("Phase 13B-A typed membership reads", () => {
  test("read error is unavailable, not no-membership", () => {
    assert.deepEqual(
      mapLiveMembershipRow({ userId: ACTOR, data: null, error: { message: "x" } }),
      { status: "unavailable" }
    );
    assert.deepEqual(mapLiveMembershipRow({ userId: ACTOR, data: null, error: null }), {
      status: "none",
    });
    assert.deepEqual(
      mapLiveMembershipRow({
        userId: ACTOR,
        data: { company_id: "", role: "owner", removed_at: null },
        error: null,
      }),
      { status: "unavailable" }
    );
  });

  test("removed wins over role; invalid role is its own state", () => {
    assert.deepEqual(
      mapLiveMembershipRow({
        userId: ACTOR,
        data: { company_id: COMPANY, role: "owner", removed_at: "2026-01-01" },
        error: null,
      }),
      { status: "removed" }
    );
    assert.deepEqual(
      mapLiveMembershipRow({
        userId: ACTOR,
        data: { company_id: COMPANY, role: null, removed_at: null },
        error: null,
      }),
      { status: "invalid_role", userId: ACTOR, companyId: COMPANY }
    );
    assert.deepEqual(
      mapLiveMembershipRow({
        userId: ACTOR,
        data: { company_id: COMPANY, role: "field_user", removed_at: null },
        error: null,
      }),
      {
        status: "active",
        session: { userId: ACTOR, companyId: COMPANY, role: "field_user" },
      }
    );
  });

  test("capability gate maps every state", () => {
    assert.deepEqual(mapCapabilityGate({ status: "unavailable" }, "member_admin"), {
      ok: false,
      denial: { status: 503, code: "authorization_unavailable" },
    });
    assert.deepEqual(
      mapCapabilityGate(
        { status: "invalid_role", userId: ACTOR, companyId: COMPANY },
        "customers_jobs"
      ),
      { ok: false, denial: { status: 403, code: "invalid_role" } }
    );
    assert.deepEqual(mapCapabilityGate({ status: "none" }, "customers_jobs"), {
      ok: false,
      denial: { status: 403, code: "forbidden" },
    });
    assert.deepEqual(mapCapabilityGate({ status: "removed" }, "customers_jobs"), {
      ok: false,
      denial: { status: 403, code: "forbidden" },
    });
    const session = { userId: ACTOR, companyId: COMPANY, role: "field_user" as const };
    assert.deepEqual(mapCapabilityGate({ status: "active", session }, "payment_admin"), {
      ok: false,
      denial: { status: 403, code: "capability_denied" },
    });
    assert.deepEqual(mapCapabilityGate({ status: "active", session }, "task_complete"), {
      ok: false,
      denial: { status: 403, code: "capability_denied" },
    });
    const owner = { userId: ACTOR, companyId: COMPANY, role: "owner" as const };
    assert.deepEqual(
      mapCapabilityGate({ status: "active", session: owner }, "task_complete"),
      { ok: true, session: owner }
    );
  });

  test("session and gate sources carry no Owner fallback", () => {
    for (const rel of [
      "app/lib/companyMembershipSession.ts",
      "app/lib/companyMembershipPersistence.ts",
      "app/lib/requireCapabilitySession.ts",
      "app/api/company/members/route.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /\?\?\s*"owner"/, rel);
      assert.doesNotMatch(src, /owner_admin/, rel);
    }
  });
});

describe("Phase 13B-A team role writes (DB-authorized since 13B-B)", () => {
  test("rejects owner and owner_admin role writes before calling the RPC", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    for (const role of ["owner", "owner_admin", "invalid_role", "", null]) {
      const fake = fakeRpc(() => ({ data: { ok: true }, error: null }));
      await assert.rejects(
        updateCompanyMemberRole({ supabase: fake.client, targetUserId: TARGET, role }),
        (err: { status?: number; code?: string }) =>
          err.status === 400 && err.code === "invalid_payload"
      );
      assert.equal(fake.calls.length, 0);
    }
  });

  test("role RPC never writes owner, never edits the Owner row, blocks self, needs custody for Admin", () => {
    const fn = sqlFunction(read(TEAM_RPC_SQL), "set_company_member_role_v1");
    assert.match(fn, /p_role not in \('admin', 'office_sales', 'production_lead', 'field_user'\)/);
    assert.match(fn, /p_target_user_id = v_uid[\s\S]*cannot_change_own_role/);
    assert.match(fn, /v_target\.role = 'owner'[\s\S]*owner_role_protected/);
    assert.match(
      fn,
      /\(v_target\.role = 'admin' or p_role = 'admin'\)\s*and not private\.actor_holds_custody_v1\(v_company_id\)[\s\S]*owner_required/
    );
    assert.match(fn, /private\.current_member_has_capability_v1\('member_admin'\)/);
    assert.match(fn, /v_company_id := private\.current_active_company_id\(\)/);
  });

  test("custody helper requires owner role, pointer, and an active owner membership", () => {
    const sql = read(TEAM_RPC_SQL);
    const start = sql.indexOf("create or replace function private.actor_holds_custody_v1");
    const fn = sql.slice(start, sql.indexOf("\n$$;", start));
    assert.match(fn, /c\.owner_user_id = auth\.uid\(\)/);
    assert.match(fn, /m\.role = 'owner'/);
    assert.match(fn, /m\.removed_at is null/);
  });

  test("RPC denials map to their HTTP codes without falling back to success", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    const cases: Array<[string, number]> = [
      ["owner_role_protected", 409],
      ["owner_required", 403],
      ["cannot_change_own_role", 409],
      ["capability_denied", 403],
      ["member_disabled", 409],
      ["not_found", 404],
      ["something_new", 500],
    ];
    for (const [code, status] of cases) {
      const fake = fakeRpc(() => ({ data: { ok: false, code }, error: null }));
      await assert.rejects(
        updateCompanyMemberRole({ supabase: fake.client, targetUserId: TARGET, role: "admin" }),
        (err: { status?: number; code?: string }) =>
          err.status === status && (status === 500 ? err.code === "internal_error" : err.code === code)
      );
    }
  });

  test("RPC transport failure is unavailable, not denial or success", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: null, error: { message: "x" } }));
    await assert.rejects(
      updateCompanyMemberRole({ supabase: fake.client, targetUserId: TARGET, role: "office_sales" }),
      (err: { status?: number; code?: string }) =>
        err.status === 503 && err.code === "team_unavailable"
    );
  });

  test("role write carries the stable key", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    const fake = fakeRpc(() => ({
      data: { ok: true, changed: true, role: "admin" },
      error: null,
    }));
    const result = await updateCompanyMemberRole({
      supabase: fake.client,
      targetUserId: TARGET,
      role: "admin",
    });
    assert.equal(result.role, "admin");
    assert.equal(result.changed, true);
    assert.deepEqual(fake.calls[0], {
      fn: "set_company_member_role_v1",
      args: { p_target_user_id: TARGET, p_role: "admin" },
    });
  });

  test("Owner cannot be removed; Admin removal requires custody (DB-enforced)", async () => {
    const fn = sqlFunction(read(TEAM_RPC_SQL), "disable_company_member_v1");
    assert.match(fn, /v_target\.role = 'owner'[\s\S]*cannot_remove_owner/);
    assert.match(fn, /v_target\.role = 'admin' and not private\.actor_holds_custody_v1/);

    const { removeCompanyMember } = await loadPersistence();
    for (const code of ["cannot_remove_owner", "owner_required"]) {
      const fake = fakeRpc(() => ({ data: { ok: false, code }, error: null }));
      await assert.rejects(
        removeCompanyMember({ supabase: fake.client, actorUserId: ACTOR, targetUserId: TARGET }),
        (err: { code?: string }) => err.code === code
      );
      assert.deepEqual(
        fake.calls.map((c) => c.fn),
        ["disable_company_member_v1"]
      );
    }
  });

  test("self removal is rejected before any RPC", async () => {
    const { removeCompanyMember } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: { ok: true }, error: null }));
    await assert.rejects(
      removeCompanyMember({ supabase: fake.client, actorUserId: ACTOR, targetUserId: ACTOR }),
      (err: { code?: string }) => err.code === "cannot_remove_self"
    );
    assert.equal(fake.calls.length, 0);
  });
});

describe("Phase 13B-A member list read truth (access-admin projection)", () => {
  const row = {
    user_id: TARGET,
    display_name: null,
    email: null,
    role: "garbage",
    removed_at: null,
    created_at: "2026-01-01",
    open_job_lead_count: 2,
    open_task_assignee_count: 0,
  };

  test("unknown stored role lists as invalid_role", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: [row], error: null }));
    const items = await listCompanyAccessAdmin(fake.client);
    assert.equal(items[0].role, "invalid_role");
    assert.equal(items[0].openJobLeadCount, 2);
  });

  test("read error is an error, not an empty team", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: null, error: { message: "x" } }));
    await assert.rejects(
      listCompanyAccessAdmin(fake.client),
      (err: { status?: number; code?: string }) =>
        err.status === 503 && err.code === "team_unavailable"
    );
  });

  test("missing or malformed count is an error, not zero", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    for (const bad of [null, undefined, -1, 1.5, "x"]) {
      const fake = fakeRpc(() => ({
        data: [{ ...row, open_task_assignee_count: bad }],
        error: null,
      }));
      await assert.rejects(
        listCompanyAccessAdmin(fake.client),
        (err: { status?: number }) => err.status === 503
      );
    }
  });

  test("permission denial from the projection is forbidden, not unavailable", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: null, error: { code: "42501", message: "forbidden" } }));
    await assert.rejects(
      listCompanyAccessAdmin(fake.client),
      (err: { status?: number; code?: string }) => err.status === 403 && err.code === "forbidden"
    );
  });
});

describe("Phase 13B-A repo contracts", () => {
  test("company profile save treats a zero-row update as failure", () => {
    const src = read("app/lib/companyProfile.ts");
    assert.match(src, /\.eq\("id", companyId\)\s*\.select\("id"\)/);
    assert.match(src, /updatedRows\.length === 0/);
  });

  test("forward migration drops the owner default and constrains role keys without custody changes", () => {
    const sql = read(
      "supabase/migrations/20260927170000_phase13b_a_membership_role_fail_closed.sql"
    );
    assert.match(sql, /alter column role drop default/);
    assert.match(
      sql,
      /check \(role in \('owner', 'admin', 'office_sales', 'production_lead', 'field_user'\)\)/
    );
    assert.match(sql, /raise exception 'phase13b_a_noncanonical_membership_roles/);
    assert.doesNotMatch(sql, /update public\.company_memberships/i);
    assert.doesNotMatch(sql, /owner_user_id\s*=/i);
  });

  test("scope-change author helper matches interim Owner-only proposal_author", () => {
    const sql = read(
      "supabase/migrations/20260927171000_phase13b_a_scope_change_author_interim_owner_only.sql"
    );
    assert.match(sql, /create or replace function public\.job_scope_change_author_ok_v1/);
    assert.match(sql, /cm\.role = 'owner'/);
    assert.match(sql, /cm\.removed_at is null/);
    assert.match(sql, /security definer/);
    assert.doesNotMatch(sql, /lower\(cm\.role\)|'admin'|'office_sales'/);
    assert.doesNotMatch(sql, /grant [^;]*to (authenticated|anon)/);
  });

  test("members GET returns viewer identity to active members; access-admin list stays capability-gated", () => {
    const src = read("app/api/company/members/route.ts");
    assert.match(src, /resolveLiveMembership/);
    assert.match(src, /viewerRole: session\.role/);
    assert.match(src, /sessionHasCapability\(session, "member_admin"\)/);
    assert.match(src, /canAdmin\s*\?\s*await listCompanyAccessAdmin\(supabase\)/);
    assert.match(src, /requireCapabilitySession\(supabase, user\.id, "member_admin"\)/);
  });

  test("0A bootstrap authority is untouched and still inserts an explicit owner role", () => {
    const sql = read(
      "supabase/migrations/20260925220856_secure_company_bootstrap_authority.sql"
    );
    assert.match(sql, /insert into public\.company_memberships \(user_id, company_id, role\)/);
    assert.match(sql, /values \(v_uid, v_company_id, 'owner'\)/);
    assert.match(sql, /fielddive\.bootstrap_current_user_company_v1:/);
  });

  test("team editor never offers Owner and does not edit the Owner row", () => {
    const src = read("app/tools/settings/CompanySettingsTeamEditor.tsx");
    assert.match(src, /ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES\.map/);
    assert.match(src, /member\.role !== "owner"/);
    assert.doesNotMatch(src, /owner_admin|COMPANY_MEMBERSHIP_PRESETS/);
  });
});
