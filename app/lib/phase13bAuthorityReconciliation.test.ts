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
  isAssignableCompanyMembershipRole,
  isCompanyCustodyOwner,
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
} from "./companyMembershipRoles";
import { mapLiveMembershipRow } from "./companyMembershipSession";
import { readTeamSurfaceSource } from "./teamSurfaceSource.testSupport";
import { mapActiveMembershipGate } from "./requireCapabilitySession";
import { mapAccessCheck } from "./access/requireAccess";
import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLE_PROFILES,
  ACTIVE_CAPABILITY_KEYS,
} from "./access/registry";

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
  "supabase/migrations/20260927195000_phase13b_c_access_mutations_field_brief.sql";

function profileCaps(role: string): string[] {
  const profile = ACCESS_ROLE_PROFILES.find((p) => p.role === role && p.version === 1);
  assert.ok(profile, role);
  return profile.entries.map((e) => e.capability);
}

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
    }
    // invalid_role has no role profile, so the policy engine grants it nothing.
    assert.equal(
      ACCESS_ROLE_PROFILES.some((p) => (p.role as string) === "invalid_role"),
      false
    );
  });

  test("owner_admin never promotes to Owner", () => {
    assert.equal(resolveCompanyMembershipRole("owner_admin"), "invalid_role");
    assert.equal(isAssignableCompanyMembershipRole("owner_admin"), false);
    const roles = read("app/lib/companyMembershipRoles.ts");
    assert.doesNotMatch(roles, /owner_admin/);
    assert.doesNotMatch(roles, /return "owner";/);
  });

  test("Phase 13B-C: Owner profile holds every active capability explicitly (no wildcard)", () => {
    assert.deepEqual([...profileCaps("owner")].sort(), [...ACTIVE_CAPABILITY_KEYS].sort());
  });

  test("Phase 13B-C: non-Owner profiles hold no sensitive capability by default (Admin: team.manage only)", () => {
    const sensitive = new Set(
      ACCESS_CAPABILITIES.filter((c) => c.sensitive).map((c) => c.key as string)
    );
    for (const role of ["admin", "office_sales", "production_lead", "field_user"]) {
      const held = profileCaps(role).filter((cap) => sensitive.has(cap));
      assert.deepEqual(held, role === "admin" ? ["team.manage"] : [], role);
    }
  });

  test("role recognition is separate from capability possession", () => {
    for (const role of ["admin", "office_sales", "production_lead", "field_user"]) {
      assert.equal(resolveCompanyMembershipRole(role), role);
      assert.notEqual(resolveCompanyMembershipRole(role), "invalid_role");
    }
    // Capability is decided by the database evaluator, not the role key.
    assert.deepEqual(
      mapAccessCheck({
        userId: ACTOR,
        data: { allowed: false, reason: "capability_missing", company_id: COMPANY, role: "admin" },
        error: null,
      }),
      { ok: false, denial: { status: 403, code: "capability_denied" }, reason: "capability_missing" }
    );
  });

  test("custody is separate from capability possession", () => {
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "owner", companyOwnerUserId: null }),
      false
    );
    // A custody pointer never grants capabilities to a non-owner role.
    assert.equal(
      isCompanyCustodyOwner({ userId: ACTOR, role: "admin", companyOwnerUserId: ACTOR }),
      false
    );
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
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.admin, "Office Manager");
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

  test("membership gate maps every state", () => {
    assert.deepEqual(mapActiveMembershipGate({ status: "unavailable" }), {
      ok: false,
      denial: { status: 503, code: "authorization_unavailable" },
    });
    assert.deepEqual(
      mapActiveMembershipGate({ status: "invalid_role", userId: ACTOR, companyId: COMPANY }),
      { ok: false, denial: { status: 403, code: "invalid_role" } }
    );
    assert.deepEqual(mapActiveMembershipGate({ status: "none" }), {
      ok: false,
      denial: { status: 403, code: "forbidden" },
    });
    assert.deepEqual(mapActiveMembershipGate({ status: "removed" }), {
      ok: false,
      denial: { status: 403, code: "forbidden" },
    });
    const session = { userId: ACTOR, companyId: COMPANY, role: "field_user" as const };
    assert.deepEqual(mapActiveMembershipGate({ status: "active", session }), {
      ok: true,
      session,
    });
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

describe("Phase 13B-A team role writes (DB-authorized; set_member_access_v1 since 13B-C)", () => {
  test("rejects owner and owner_admin role writes before calling the RPC", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    for (const role of ["owner", "owner_admin", "invalid_role", "", null]) {
      const fake = fakeRpc(() => ({ data: { ok: true }, error: null }));
      await assert.rejects(
        updateCompanyMemberRole({
          supabase: fake.client,
          targetUserId: TARGET,
          role,
          expectedRevision: 1,
        }),
        (err: { status?: number; code?: string }) =>
          err.status === 400 && err.code === "invalid_payload"
      );
      assert.equal(fake.calls.length, 0);
    }
  });

  test("role write without a valid expected revision is rejected before the RPC", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    for (const expectedRevision of [undefined, null, 0, -1, 1.5, "x"]) {
      const fake = fakeRpc(() => ({ data: { ok: true }, error: null }));
      await assert.rejects(
        updateCompanyMemberRole({
          supabase: fake.client,
          targetUserId: TARGET,
          role: "office_sales",
          expectedRevision,
        }),
        (err: { status?: number; code?: string }) =>
          err.status === 400 && err.code === "invalid_payload"
      );
      assert.equal(fake.calls.length, 0);
    }
  });

  test("access RPC never writes owner, never edits the Owner row, blocks self, needs custody for Admin", () => {
    const fn = sqlFunction(read(TEAM_RPC_SQL), "set_member_access_v1");
    assert.match(fn, /p_role not in \('admin', 'office_sales', 'production_lead', 'field_user'\)/);
    assert.match(fn, /p_target_user_id = v_uid then\s*return jsonb_build_object\('ok', false, 'code', 'cannot_change_own_access'\)/);
    assert.match(fn, /v_target\.role = 'owner' then\s*return jsonb_build_object\('ok', false, 'code', 'owner_role_protected'\)/);
    assert.match(
      fn,
      /v_tier = 'admin' and \(\s*v_target\.role = 'admin' or p_role = 'admin'[\s\S]*?owner_required/
    );
    assert.match(fn, /v_tier := private\.delegation_tier_v1\(\)/);
    assert.match(fn, /v_target\.access_revision <> p_expected_revision[\s\S]*?stale_revision/);
    assert.match(fn, /v_company_id := private\.current_active_company_id\(\)/);
  });

  test("custody helper requires owner role, pointer, and an active owner membership", () => {
    const sql = read(
      "supabase/migrations/20260927182000_phase13b_b_team_directory_and_member_rpcs.sql"
    );
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
      ["cannot_change_own_access", 409],
      ["stale_revision", 409],
      ["packages_incompatible", 409],
      ["package_not_delegable", 403],
      ["capability_denied", 403],
      ["member_disabled", 409],
      ["not_found", 404],
      ["something_new", 500],
    ];
    for (const [code, status] of cases) {
      const fake = fakeRpc(() => ({ data: { ok: false, code }, error: null }));
      await assert.rejects(
        updateCompanyMemberRole({
          supabase: fake.client,
          targetUserId: TARGET,
          role: "admin",
          expectedRevision: 3,
        }),
        (err: { status?: number; code?: string }) =>
          err.status === status && (status === 500 ? err.code === "internal_error" : err.code === code)
      );
    }
  });

  test("RPC transport failure is unavailable, not denial or success", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: null, error: { message: "x" } }));
    await assert.rejects(
      updateCompanyMemberRole({
        supabase: fake.client,
        targetUserId: TARGET,
        role: "office_sales",
        expectedRevision: 1,
      }),
      (err: { status?: number; code?: string }) =>
        err.status === 503 && err.code === "team_unavailable"
    );
  });

  test("role write carries the stable key, expected revision, and keeps packages", async () => {
    const { updateCompanyMemberRole } = await loadPersistence();
    const fake = fakeRpc(() => ({
      data: { ok: true, changed: true, role: "admin", access_revision: 4 },
      error: null,
    }));
    const result = await updateCompanyMemberRole({
      supabase: fake.client,
      targetUserId: TARGET,
      role: "admin",
      expectedRevision: 3,
    });
    assert.equal(result.role, "admin");
    assert.equal(result.changed, true);
    assert.equal(result.accessRevision, 4);
    assert.deepEqual(fake.calls[0], {
      fn: "set_member_access_v1",
      args: {
        p_target_user_id: TARGET,
        p_role: "admin",
        p_expected_revision: 3,
        p_packages: null,
        p_restrictions: null,
        p_request_id: null,
      },
    });
  });

  test("Owner cannot be removed; Admin removal requires custody (DB-enforced)", async () => {
    const fn = sqlFunction(read(TEAM_RPC_SQL), "disable_company_member_v1");
    assert.match(fn, /v_target\.role = 'owner' then\s*return jsonb_build_object\('ok', false, 'code', 'cannot_remove_owner'\)/);
    assert.match(fn, /v_tier = 'admin' and \(\s*v_target\.role = 'admin'/);

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
    access_revision: 1,
    package_keys: [],
    restriction_count: 0,
    granted_job_count: 0,
  };

  test("unknown stored role lists as invalid_role", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    const fake = fakeRpc(() => ({ data: [row], error: null }));
    const items = await listCompanyAccessAdmin(fake.client);
    assert.equal(items[0].role, "invalid_role");
    assert.equal(items[0].openJobLeadCount, 2);
    assert.equal(items[0].accessRevision, 1);
  });

  test("missing or malformed access revision is an error", async () => {
    const { listCompanyAccessAdmin } = await loadPersistence();
    for (const bad of [null, undefined, 0, -1, "x"]) {
      const fake = fakeRpc(() => ({ data: [{ ...row, access_revision: bad }], error: null }));
      await assert.rejects(
        listCompanyAccessAdmin(fake.client),
        (err: { status?: number }) => err.status === 503
      );
    }
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
    assert.match(src, /loadViewerAccess\(supabase/);
    assert.match(src, /viewerAccess\.canAdminMembers\s*\?\s*await listCompanyAccessAdmin\(supabase\)/);
    assert.match(src, /requireAccess\(supabase, user\.id, "team\.manage"\)/);
    assert.doesNotMatch(src, /sessionHasCapability|requireCapabilitySession\(|member_admin/);
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
    const src = readTeamSurfaceSource();
    assert.match(src, /ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES\.map/);
    assert.match(src, /member\.role !== "owner"/);
    assert.doesNotMatch(src, /owner_admin|COMPANY_MEMBERSHIP_PRESETS/);
  });
});
