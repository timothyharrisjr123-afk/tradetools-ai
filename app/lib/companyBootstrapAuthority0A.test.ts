import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureUserIdentity } from "./ensureUserIdentity";
import { parseCreateBusinessResult } from "./access/resolveAccess";

const ROOT = join(__dirname, "..", "..");
const MIGRATION = readFileSync(
  join(ROOT, "supabase/migrations/20260925220856_secure_company_bootstrap_authority.sql"),
  "utf8"
);
const IDENTITY = readFileSync(join(ROOT, "app/lib/ensureUserIdentity.ts"), "utf8");
const SQL = MIGRATION.replace(/--[^\n]*\n/g, "\n");

type Call = { table: string; op: string };

function fakeSupabase(opts: {
  rpcData?: unknown;
  rpcError?: { message: string } | null;
  profile?: Record<string, unknown> | null;
}) {
  const calls: Call[] = [];
  const rpcCalls: string[] = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const record = (op: string) => {
      calls.push({ table, op });
      return chain;
    };
    chain.select = () => record("select");
    chain.eq = () => chain;
    chain.maybeSingle = async () => ({ data: opts.profile ?? null, error: null });
    chain.insert = async () => {
      calls.push({ table, op: "insert" });
      return { error: null };
    };
    chain.update = () => {
      calls.push({ table, op: "update" });
      return { eq: async () => ({ error: null }) };
    };
    return chain;
  };
  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string) => {
      rpcCalls.push(name);
      return { data: opts.rpcData ?? null, error: opts.rpcError ?? null };
    },
  } as unknown as SupabaseClient;
  return { client, calls, rpcCalls };
}

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.com" };
const COMPANY = "22222222-2222-4222-8222-222222222222";

describe("Slice 0A — bootstrap RPC migration contract", () => {
  test("SECURITY DEFINER with pinned search_path and no client-supplied arguments", () => {
    assert.match(SQL, /create or replace function public\.bootstrap_current_user_company_v1\(\)/);
    assert.match(SQL, /security definer/i);
    assert.match(SQL, /set search_path = pg_catalog, public/);
    assert.match(SQL, /returns table \(company_id uuid, status text\)/);
  });

  test("requires auth.uid() and serializes per user with an advisory xact lock", () => {
    assert.match(SQL, /v_uid uuid := auth\.uid\(\)/);
    assert.match(SQL, /if v_uid is null then[\s\S]*raise exception 'not_authenticated'/);
    assert.match(SQL, /pg_advisory_xact_lock\([\s\S]*v_uid::text/);
    const lockAt = SQL.indexOf("pg_advisory_xact_lock");
    assert.ok(lockAt > 0 && lockAt < SQL.indexOf("from public.company_memberships m"));
    assert.ok(lockAt < SQL.indexOf("insert into public.companies"));
  });

  test("existing membership returns it; removed membership creates nothing", () => {
    assert.match(SQL, /if v_existing_removed_at is not null then[\s\S]*'removed'::text;\s*return;/);
    assert.match(SQL, /return query select v_existing_company_id, 'existing'::text;\s*return;/);
    const removedAt = SQL.indexOf("'removed'::text");
    assert.ok(removedAt < SQL.indexOf("insert into public.companies"));
  });

  test("creates one company + one owner membership for auth.uid() only; role set internally", () => {
    assert.match(
      SQL,
      /insert into public\.companies \(name, owner_user_id\)\s*values \('My Company', v_uid\)/
    );
    assert.match(
      SQL,
      /insert into public\.company_memberships \(user_id, company_id, role\)\s*values \(v_uid, v_company_id, 'owner'\)/
    );
    assert.equal((SQL.match(/insert into public\.companies/g) ?? []).length, 1);
    assert.equal((SQL.match(/insert into public\.company_memberships/g) ?? []).length, 1);
    assert.doesNotMatch(SQL, /exception when/i);
  });

  test("EXECUTE: revoked from PUBLIC and anon; granted to authenticated only", () => {
    assert.match(
      SQL,
      /revoke all on function public\.bootstrap_current_user_company_v1\(\) from public, anon;/
    );
    assert.match(
      SQL,
      /grant execute on function public\.bootstrap_current_user_company_v1\(\) to authenticated;/
    );
    assert.doesNotMatch(SQL, /grant execute[^;]*bootstrap_current_user_company_v1[^;]*anon/);
    assert.match(SQL, /owner to postgres/);
  });

  test("drops arbitrary self-membership INSERT policy and adds no permissive replacement", () => {
    assert.match(
      SQL,
      /drop policy if exists "Users can insert their membership" on public\.company_memberships;/
    );
    assert.doesNotMatch(SQL, /create policy/i);
  });

  test("revokes client INSERT/DELETE on companies and memberships; keeps Settings UPDATE", () => {
    assert.match(
      SQL,
      /revoke insert, delete, truncate, references, trigger on table public\.companies from anon, authenticated;/
    );
    assert.match(
      SQL,
      /revoke insert, delete, truncate, references, trigger on table public\.company_memberships from anon, authenticated;/
    );
    assert.match(SQL, /revoke update on table public\.companies from anon;/);
    assert.doesNotMatch(SQL, /revoke[^;]*update[^;]*public\.companies[^;]*authenticated/);
    assert.doesNotMatch(SQL, /revoke[^;]*select/i);
  });

  test("one membership row per user backstop (production preflight: 0 multi-membership users)", () => {
    assert.match(
      SQL,
      /create unique index if not exists company_memberships_one_per_user_uidx\s*on public\.company_memberships \(user_id\);/
    );
  });

  test("touches only companies / company_memberships", () => {
    const tables = new Set(
      [...SQL.matchAll(/(?:on|into|table)\s+public\.([a-z0-9_]+)/g)].map((m) => m[1])
    );
    tables.delete("bootstrap_current_user_company_v1");
    assert.deepEqual([...tables].sort(), ["companies", "company_memberships"]);
  });
});

describe("Slice 0A — ensureUserIdentity no longer bootstraps a company", () => {
  test("source syncs a profile and never calls bootstrap or inserts a company", () => {
    assert.doesNotMatch(IDENTITY, /from\(\s*["']companies["']\s*\)/);
    assert.doesNotMatch(IDENTITY, /from\(\s*["']company_memberships["']\s*\)/);
    assert.doesNotMatch(IDENTITY, /\.rpc\(/);
    assert.doesNotMatch(IDENTITY, /bootstrap_current_user_company/);
  });

  test("a signed-in user is synced without any RPC", async () => {
    const f = fakeSupabase({
      profile: { id: USER.id, full_name: "A", email: USER.email },
    });
    assert.deepEqual(await ensureUserIdentity(f.client, USER), { status: "synced" });
    assert.deepEqual(f.rpcCalls, []);
    assert.ok(!f.calls.some((c) => c.table === "companies" || c.table === "company_memberships"));
  });

  test("missing user → failed not_authenticated; no RPC call", async () => {
    const f = fakeSupabase({});
    assert.deepEqual(await ensureUserIdentity(f.client, { id: "" }), {
      status: "failed",
      reason: "not_authenticated",
    });
    assert.deepEqual(f.rpcCalls, []);
  });

  test("profile insert still happens for a brand-new user", async () => {
    const f = fakeSupabase({ profile: null });
    await ensureUserIdentity(f.client, USER);
    assert.ok(f.calls.some((c) => c.table === "profiles" && c.op === "insert"));
  });

  test("create-business parser fails closed on unknown shapes", () => {
    assert.deepEqual(parseCreateBusinessResult(null), { ok: false, status: "invalid_response" });
    assert.deepEqual(parseCreateBusinessResult([]), { ok: false, status: "invalid_response" });
    assert.deepEqual(parseCreateBusinessResult([{ status: "created", company_id: null }]), {
      ok: false,
      status: "invalid_response",
    });
    assert.deepEqual(parseCreateBusinessResult([{ status: "owner", company_id: COMPANY }]), {
      ok: false,
      status: "invalid_response",
    });
    assert.deepEqual(parseCreateBusinessResult({ status: "existing", company_id: COMPANY }), {
      ok: true,
      status: "existing",
      companyId: COMPANY,
    });
    assert.deepEqual(parseCreateBusinessResult({ status: "removed", company_id: null }), {
      ok: false,
      status: "removed",
    });
  });
});
