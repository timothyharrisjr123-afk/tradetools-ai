import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMPANY_BOOTSTRAP_RPC,
  ensureUserIdentity,
  parseCompanyBootstrapResult,
} from "./ensureUserIdentity";

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

describe("Slice 0A — ensureUserIdentity uses the bootstrap authority", () => {
  test("source no longer inserts companies or memberships directly", () => {
    assert.doesNotMatch(IDENTITY, /from\(\s*["']companies["']\s*\)/);
    assert.doesNotMatch(IDENTITY, /from\(\s*["']company_memberships["']\s*\)\s*\.insert/);
    assert.match(IDENTITY, /supabase\.rpc\(COMPANY_BOOTSTRAP_RPC\)/);
    assert.equal(COMPANY_BOOTSTRAP_RPC, "bootstrap_current_user_company_v1");
  });

  test("created → ready with company id; no direct company/membership writes", async () => {
    const f = fakeSupabase({
      profile: { id: USER.id, full_name: "", email: USER.email },
      rpcData: [{ company_id: COMPANY, status: "created" }],
    });
    const result = await ensureUserIdentity(f.client, USER);
    assert.deepEqual(result, { status: "ready", companyId: COMPANY, created: true });
    assert.deepEqual(f.rpcCalls, ["bootstrap_current_user_company_v1"]);
    assert.ok(!f.calls.some((c) => c.table === "companies"));
    assert.ok(!f.calls.some((c) => c.table === "company_memberships"));
  });

  test("existing → ready (idempotent repeat)", async () => {
    const f = fakeSupabase({
      profile: { id: USER.id, full_name: "A", email: USER.email },
      rpcData: [{ company_id: COMPANY, status: "existing" }],
    });
    const first = await ensureUserIdentity(f.client, USER);
    const second = await ensureUserIdentity(f.client, USER);
    assert.deepEqual(first, { status: "ready", companyId: COMPANY, created: false });
    assert.deepEqual(second, first);
  });

  test("removed → removed (no company)", async () => {
    const f = fakeSupabase({
      profile: { id: USER.id, full_name: "A", email: USER.email },
      rpcData: [{ company_id: null, status: "removed" }],
    });
    assert.deepEqual(await ensureUserIdentity(f.client, USER), { status: "removed" });
  });

  test("RPC error → failed (not silently ready)", async () => {
    const f = fakeSupabase({
      profile: { id: USER.id, full_name: "A", email: USER.email },
      rpcError: { message: "permission denied" },
    });
    assert.deepEqual(await ensureUserIdentity(f.client, USER), {
      status: "failed",
      reason: "bootstrap_failed",
    });
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
    const f = fakeSupabase({
      profile: null,
      rpcData: [{ company_id: COMPANY, status: "created" }],
    });
    await ensureUserIdentity(f.client, USER);
    assert.ok(f.calls.some((c) => c.table === "profiles" && c.op === "insert"));
  });

  test("parser fails closed on unknown shapes", () => {
    assert.deepEqual(parseCompanyBootstrapResult(null), {
      status: "failed",
      reason: "invalid_response",
    });
    assert.deepEqual(parseCompanyBootstrapResult([]), {
      status: "failed",
      reason: "invalid_response",
    });
    assert.deepEqual(parseCompanyBootstrapResult([{ status: "created", company_id: null }]), {
      status: "failed",
      reason: "invalid_response",
    });
    assert.deepEqual(parseCompanyBootstrapResult([{ status: "owner", company_id: COMPANY }]), {
      status: "failed",
      reason: "invalid_response",
    });
    assert.deepEqual(parseCompanyBootstrapResult({ status: "existing", company_id: COMPANY }), {
      status: "ready",
      companyId: COMPANY,
      created: false,
    });
  });
});
