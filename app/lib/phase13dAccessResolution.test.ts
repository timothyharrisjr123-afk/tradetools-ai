import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  parseAccessResolution,
  parseCreateBusinessResult,
  RESOLVE_CURRENT_USER_ACCESS_RPC_V1,
  BOOTSTRAP_COMPANY_RPC_V2,
} from "./access/resolveAccess";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const SQL = read("supabase/migrations/20260927200000_phase13b_d_access_resolver_bootstrap_v2.sql");

const ENTRY_POINTS = [
  "app/admin/layout.tsx",
  "app/admin/customers/page.tsx",
  "app/tools/settings/page.tsx",
  "app/tools/settings/pricing/page.tsx",
  "app/tools/roofing/page.tsx",
  "app/tools/roofing/saved/page.tsx",
  "app/tools/roofing/calendar/page.tsx",
  "app/tools/roofing/catalog/page.tsx",
  "app/tools/roofing/templates/page.tsx",
  "app/tools/roofing/usual-roof/page.tsx",
  "app/tools/roofing/proposals/builder/page.tsx",
  "app/tools/roofing/proposals/preview/page.tsx",
  "app/tools/roofing/customers/[customerId]/page.tsx",
  "app/tools/roofing/properties/[propertyId]/page.tsx",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

describe("Phase 13B-D resolver contract", () => {
  test("a read failure or unknown payload is unavailable, never no_access or creator_eligible", () => {
    for (const data of [null, undefined, {}, { ok: false, code: "unauthorized" }, { ok: true, state: "nope" }, { ok: true }]) {
      const parsed = parseAccessResolution(data);
      assert.equal(parsed.state, "authorization_unavailable");
      assert.equal(parsed.creatorEligible, false);
      assert.deepEqual(parsed.invitations, []);
    }
  });

  test("active requires a company and a role; pending requires at least one invitation", () => {
    assert.equal(parseAccessResolution({ ok: true, state: "active", role: "owner" }).state, "authorization_unavailable");
    assert.equal(
      parseAccessResolution({ ok: true, state: "pending_invitation", invitations: [], creator_eligible: true }).state,
      "authorization_unavailable"
    );
    const pending = parseAccessResolution({
      ok: true,
      state: "pending_invitation",
      creator_eligible: true,
      invitations: [
        { id: "i1", company_label: "North", role: "field_user", expires_at: "2026-10-01T00:00:00Z" },
        { id: "i2", company_label: "South", role: "office_sales", expires_at: "2026-10-02T00:00:00Z" },
      ],
    });
    assert.equal(pending.state, "pending_invitation");
    assert.equal(pending.creatorEligible, true);
    assert.deepEqual(pending.invitations.map((i) => i.companyLabel), ["North", "South"]);
    assert.equal(pending.companyId, null);
  });

  test("disabled, invalid role, creator, and no access stay distinct", () => {
    assert.equal(parseAccessResolution({ ok: true, state: "disabled", company_label: "North" }).state, "disabled");
    assert.equal(parseAccessResolution({ ok: true, state: "invalid_role" }).state, "invalid_role");
    assert.equal(parseAccessResolution({ ok: true, state: "creator_eligible" }).state, "creator_eligible");
    assert.equal(parseAccessResolution({ ok: true, state: "no_access" }).state, "no_access");
    assert.equal(parseAccessResolution({ ok: true, state: "active", company_id: "c", role: "owner" }).companyId, "c");
  });

  test("create-business denials are not successes, and a replay keeps the company id", () => {
    assert.deepEqual(parseCreateBusinessResult({ status: "created", company_id: "c" }), {
      ok: true,
      status: "created",
      companyId: "c",
    });
    assert.equal(parseCreateBusinessResult({ status: "admission_required" }).ok, false);
    assert.equal(parseCreateBusinessResult({ status: "pending_invitation" }).ok, false);
    assert.equal(RESOLVE_CURRENT_USER_ACCESS_RPC_V1, "resolve_current_user_access_v1");
    assert.equal(BOOTSTRAP_COMPANY_RPC_V2, "bootstrap_current_user_company_v2");
  });
});

describe("Phase 13B-D database authority", () => {
  test("the shared lock keeps the frozen 0A key and both create paths use it", () => {
    assert.match(SQL, /hashtextextended\('fielddive\.bootstrap_current_user_company_v1:' \|\| p_user_id::text, 0\)/);
    const v2 = SQL.slice(SQL.indexOf("bootstrap_current_user_company_v2"));
    assert.match(v2, /perform private\.lock_user_membership\(v_uid\)/);
    const lockAt = v2.indexOf("perform private.lock_user_membership(v_uid)");
    const readAt = v2.indexOf("for update");
    const insertAt = v2.indexOf("insert into public.companies (name, owner_user_id)");
    assert.ok(lockAt > 0 && lockAt < readAt && readAt < insertAt);
  });

  test("bootstrap v2 checks admission inside the transaction and always creates an owner", () => {
    assert.match(SQL, /p_intent is distinct from 'create_business'/);
    assert.match(SQL, /'pending_invitation'::text/);
    assert.match(SQL, /'admission_required'::text/);
    assert.match(SQL, /'removed'::text/);
    assert.match(SQL, /status = 'issued'/);
    assert.match(SQL, /set status = 'consumed'/);
    const v2 = SQL.slice(SQL.indexOf("bootstrap_current_user_company_v2"));
    const consumeAt = v2.indexOf("set status = 'consumed'");
    const insertAt = v2.indexOf("insert into public.companies (name, owner_user_id)");
    assert.ok(insertAt > 0 && insertAt < consumeAt);
    assert.match(SQL, /values \(v_uid, v_company_id, 'owner'\)/);
    assert.doesNotMatch(SQL, /p_company_id|p_role/);
  });

  test("resolver precedence is membership, then invitation, then admission, and invitations are not chosen by company", () => {
    const disabledAt = SQL.indexOf("'state', 'disabled'");
    const invalidAt = SQL.indexOf("'state', 'invalid_role'");
    const activeAt = SQL.indexOf("'state', 'active'");
    const pendingAt = SQL.indexOf("'state', 'pending_invitation'");
    const creatorAt = SQL.indexOf("'state', 'creator_eligible'");
    const noneAt = SQL.indexOf("'state', 'no_access'");
    assert.ok(disabledAt < invalidAt && invalidAt < activeAt && activeAt < pendingAt && pendingAt < creatorAt && creatorAt < noneAt);
    assert.match(SQL, /email_confirmed_at/);
    assert.match(SQL, /order by i\.expires_at, i\.id/);
    assert.doesNotMatch(SQL, /order by i\.company_id/);
  });

  test("v1 is retired and client roles cannot read admissions or invitations", () => {
    assert.match(SQL, /raise exception 'bootstrap_v1_retired'/);
    assert.match(SQL, /revoke all on function public\.bootstrap_current_user_company_v1\(\) from public, anon, authenticated;/);
    assert.doesNotMatch(SQL, /grant execute on function public\.bootstrap_current_user_company_v1\(\)/);
    assert.match(SQL, /revoke all on table public\.company_creator_admissions from public, anon, authenticated;/);
    assert.match(SQL, /revoke all on table public\.company_invitations from public, anon, authenticated;/);
    const fk = read("supabase/migrations/20260927201000_phase13b_d_admission_company_fk.sql");
    assert.match(fk, /on delete cascade/i);
    assert.match(SQL, /enable row level security/);
  });
});

describe("Phase 13B-D callers", () => {
  test("protected entry points resolve access and do not bootstrap", () => {
    for (const rel of ENTRY_POINTS) {
      const src = read(rel);
      assert.match(src, /requireActiveCompanyPage\(supabase, user\)/, rel);
      assert.doesNotMatch(src, /ensureUserIdentity|bootstrap_current_user_company|getUserCompanyId/, rel);
    }
  });

  test("bootstrap v2 is called only from the explicit create-business path", () => {
    const callers = walk(join(ROOT, "app")).filter((path) => readFileSync(path, "utf8").includes(BOOTSTRAP_COMPANY_RPC_V2));
    const rels = callers.map((path) => path.slice(ROOT.length + 1).replaceAll("\\", "/")).sort();
    assert.deepEqual(rels, ["app/lib/access/resolveAccess.ts"]);
    const route = read("app/api/access/create-business/route.ts");
    assert.match(route, /createBusiness\(supabase/);
    assert.match(route, /authorization_unavailable/);
    assert.doesNotMatch(read("app/lib/ensureUserIdentity.ts"), /\.rpc\(/);
  });

  test("the public customer route and auth callback do not resolve or create a company", () => {
    const pub = read("app/p/[token]/page.tsx");
    assert.doesNotMatch(pub, /resolveCurrentUserAccess|bootstrap_current_user_company|requireActiveCompanyPage/);
    const callback = read("app/auth/callback/route.ts");
    assert.doesNotMatch(callback, /bootstrap_current_user_company|resolveCurrentUserAccess/);
    assert.match(callback, /resolveAuthReturnPath\(redirectCandidate, "\/start"\)/);
  });

  test("the start screen keeps the states distinct and does not accept an invitation", () => {
    const page = read("app/start/page.tsx");
    for (const state of ["disabled", "invalid_role", "pending_invitation", "creator_eligible", "no_access", "authorization_unavailable"]) {
      assert.match(page, new RegExp(`state === "${state}"`), state);
    }
    assert.doesNotMatch(page, /accept_company_invitation|invitation token/i);
    assert.match(page, /acknowledgePendingInvitations=\{false\}/);
    assert.match(page, /acknowledgePendingInvitations(?![=])/);
  });
});
