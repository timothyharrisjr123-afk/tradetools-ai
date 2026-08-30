/**
 * 061 — Stage-1 company job search RPC contract.
 * Run: npx tsx --test app/lib/jobSearch061.test.ts
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const SQL_061 = join(MIGRATIONS, "20260830_061_search_company_jobs.sql");
const SQL_060 = join(MIGRATIONS, "20260830_060_customers_tenant_isolation.sql");

describe("061 — historical files stay locked", () => {
  test("060 remains present and 061 is additive", () => {
    assert.equal(existsSync(SQL_060), true);
    assert.equal(existsSync(SQL_061), true);
    assert.ok(readdirSync(MIGRATIONS).some((name) => name.includes("_061_search_company_jobs")));
  });
});

describe("061 — security contract", () => {
  const sql = readFileSync(SQL_061, "utf8");

  test("search is SECURITY INVOKER and membership scoped", () => {
    assert.match(sql, /create or replace function public\.search_company_jobs_v1\(p_query text\)/);
    assert.match(sql, /security invoker/);
    assert.doesNotMatch(sql, /security definer/i);
    assert.match(sql, /from public\.company_memberships cm/);
    assert.match(sql, /cm\.user_id = auth\.uid\(\)/);
    assert.match(sql, /auth\.uid\(\) is not null/);
    assert.doesNotMatch(sql, /p_company_id/);
  });

  test("anon and public cannot execute; authenticated can", () => {
    assert.match(sql, /revoke all on function public\.search_company_jobs_v1\(text\) from public/);
    assert.match(sql, /revoke all on function public\.search_company_jobs_v1\(text\) from anon/);
    assert.match(sql, /grant execute on function public\.search_company_jobs_v1\(text\) to authenticated/);
  });

  test("matches name, email, normalized phone, address, and job id with a hard limit", () => {
    assert.match(sql, /bool_and/);
    assert.match(sql, /concat_ws\(' '/);
    assert.match(sql, /coalesce\(j\.customer_name/);
    assert.match(sql, /coalesce\(j\.customer_email/);
    assert.match(sql, /regexp_replace\(coalesce\(j\.customer_phone/);
    assert.match(sql, /address_formatted/);
    assert.match(sql, /j\.id::text ilike q\.raw \|\| '%'/);
    assert.match(sql, /limit 25/);
    assert.match(sql, /order by j\.updated_at desc/);
  });

  test("does not expose email or phone in the result table", () => {
    const returns = sql.slice(sql.indexOf("returns table"), sql.indexOf("language sql"));
    assert.match(returns, /customer_name/);
    assert.doesNotMatch(returns, /customer_email/);
    assert.doesNotMatch(returns, /customer_phone/);
  });
});
