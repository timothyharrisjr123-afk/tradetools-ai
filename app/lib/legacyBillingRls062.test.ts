/**
 * 062 — legacy payments + subscriptions tenant isolation (SECURITY P0).
 * Run: npx tsx --test app/lib/legacyBillingRls062.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_060 = join(MIGRATIONS, "20260830_060_customers_tenant_isolation.sql");
const SQL_061 = join(MIGRATIONS, "20260830_061_search_company_jobs.sql");
const SQL_062 = join(MIGRATIONS, "20260830_062_legacy_billing_tenant_isolation.sql");
const SHA_060 = "63273D0B4924E187D273B4D2010592B4C84BD34DFA5D4F28B0C62736EF78865C";
const SHA_061 = "E2E3383D5B792A57DD0CCFC8576BB264457A635FDBAD8B58E803213E600CF214";

describe("062 — historical files stay locked", () => {
  test("060 and 061 SHA unchanged; 062 is additive", () => {
    assert.equal(existsSync(SQL_062), true);
    assert.equal(sha(SQL_060), SHA_060);
    assert.equal(sha(SQL_061), SHA_061);
    assert.ok(readdirSync(MIGRATIONS).some((n) => n.includes("_062_legacy_billing_tenant_isolation")));
    assert.ok(!readdirSync(MIGRATIONS).some((n) => n.includes("_039_")));
  });

  test("does not touch canonical job_payment_* architecture", () => {
    const sql = readFileSync(SQL_062, "utf8");
    assert.doesNotMatch(sql, /alter table public\.job_payment_/i);
    assert.doesNotMatch(sql, /create table public\.job_payment_/i);
    assert.doesNotMatch(sql, /drop table public\.payments/i);
    assert.doesNotMatch(sql, /create table public\.subscriptions/i);
    assert.match(sql, /Canonical job money remains job_payment_\*/);
  });
});

describe("062 — payments security contract", () => {
  const sql = readFileSync(SQL_062, "utf8");

  test("enables RLS with membership SELECT/INSERT only", () => {
    assert.match(sql, /alter table public\.payments enable row level security/);
    assert.match(sql, /payments_select_company_scope/);
    assert.match(sql, /payments_insert_company_scope/);
    assert.doesNotMatch(sql, /payments_update_company_scope/);
    assert.doesNotMatch(sql, /payments_delete_company_scope/);
    assert.match(sql, /from public\.company_memberships/);
    assert.match(sql, /user_id = auth\.uid\(\)/);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
  });

  test("insert requires non-null company membership", () => {
    assert.match(sql, /for insert[\s\S]*company_id is not null/);
    assert.match(sql, /for select[\s\S]*company_id is not null/);
  });

  test("revokes anon/public; authenticated select+insert; service_role all", () => {
    assert.match(sql, /revoke all on table public\.payments from public/);
    assert.match(sql, /revoke all on table public\.payments from anon/);
    assert.match(sql, /grant select, insert on table public\.payments to authenticated/);
    assert.match(sql, /grant all on table public\.payments to service_role/);
  });

  test("company_id cannot be changed", () => {
    assert.match(sql, /payments_prevent_company_id_change/);
    assert.match(sql, /payments\.company_id is immutable/);
    assert.match(sql, /before update on public\.payments/);
  });
});

describe("062 — subscriptions closed by default", () => {
  const sql = readFileSync(SQL_062, "utf8");

  test("RLS on; no authenticated policies or grants", () => {
    assert.match(sql, /alter table public\.subscriptions enable row level security/);
    assert.doesNotMatch(sql, /create policy[\s\S]*on public\.subscriptions/);
    assert.match(sql, /revoke all on table public\.subscriptions from public/);
    assert.match(sql, /revoke all on table public\.subscriptions from anon/);
    assert.match(sql, /revoke all on table public\.subscriptions from authenticated/);
    assert.match(sql, /grant all on table public\.subscriptions to service_role/);
  });
});

describe("062 — accepted legacy payment code paths stay company-scoped", () => {
  test("paymentsTable and status routes filter by company_id", () => {
    const table = read("app/lib/paymentsTable.ts");
    const status = read("app/api/payments/status/route.ts");
    const batch = read("app/api/payments/status-batch/route.ts");
    assert.match(table, /\.from\("payments"\)/);
    assert.match(table, /\.eq\("company_id", companyId\)/);
    assert.match(status, /getUserCompanyId/);
    assert.match(status, /getDerivedPaymentStateFromSupabase/);
    assert.match(batch, /getUserCompanyId/);
    assert.match(batch, /getDerivedPaymentStateFromSupabase/);
  });

  test("record-offline inserts with membership company_id; webhook uses admin", () => {
    const offline = read("app/api/payments/record-offline/route.ts");
    const webhook = read("app/api/payments/webhook/route.ts");
    const checkout = read("app/api/payments/create-checkout/route.ts");
    assert.match(offline, /getUserCompanyId/);
    assert.match(offline, /\.from\("payments"\)\.insert/);
    assert.match(offline, /company_id: companyId/);
    assert.match(webhook, /createAdminClient/);
    assert.match(webhook, /\.from\("payments"\)\.insert/);
    assert.match(checkout, /getDerivedPaymentStateFromSupabase/);
  });

  test("no product references to public.subscriptions table", () => {
    const rootFiles = [
      "app/lib/paymentsTable.ts",
      "app/api/payments/status/route.ts",
      "app/api/payments/status-batch/route.ts",
      "app/api/payments/record-offline/route.ts",
      "app/api/payments/create-checkout/route.ts",
      "app/api/payments/webhook/route.ts",
    ];
    for (const rel of rootFiles) {
      assert.doesNotMatch(read(rel), /\.from\("subscriptions"\)/);
    }
  });
});
