/**
 * 060 — customers tenant isolation (SECURITY P0).
 * Run: npx tsx --test app/lib/customersRls060.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { AFTER_048_MIGRATIONS } from "./jobPaymentBalance054.test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_059 = join(MIGRATIONS, "20260828_059_job_payment_refunds.sql");
const SQL_060 = join(MIGRATIONS, "20260830_060_customers_tenant_isolation.sql");
const SHA_059 = "F14E5EEAA5D407F8D8011D4CA246DD49644C1421985A17BE80B987DF57DA412B";
const SHA_060 = "63273D0B4924E187D273B4D2010592B4C84BD34DFA5D4F28B0C62736EF78865C";

describe("060 — historical files stay locked", () => {
  test("059 SHA unchanged; 060 is customers isolation not identity redesign", () => {
    assert.equal(existsSync(SQL_060), true);
    assert.equal(sha(SQL_059), SHA_059);
    assert.equal(sha(SQL_060), SHA_060);
    assert.ok(!readdirSync(MIGRATIONS).some((name) => name.includes("_039_")));
    const sql = readFileSync(SQL_060, "utf8");
    assert.match(sql, /039 remains reserved/);
    assert.doesNotMatch(sql, /create table public\.properties/i);
    assert.doesNotMatch(sql, /customer workspace/i);
    assert.doesNotMatch(sql, /intake lookup/i);
    assert.doesNotMatch(sql, /create table public\.job_contacts/i);
  });

  test("AFTER_048 payment inventory does not absorb 060", () => {
    const names = readdirSync(MIGRATIONS).filter(
      (n) => n.endsWith(".sql") && /_0(49|5\d)_/.test(n)
    );
    assert.deepEqual(names.sort(), [...AFTER_048_MIGRATIONS].sort());
    assert.ok(!AFTER_048_MIGRATIONS.includes("20260830_060_customers_tenant_isolation.sql"));
  });
});

describe("060 — security contract", () => {
  const sql = readFileSync(SQL_060, "utf8");

  test("enables RLS and membership-scoped policies without USING(true)", () => {
    assert.match(sql, /alter table public\.customers enable row level security/);
    assert.match(sql, /customers_select_company_scope/);
    assert.match(sql, /customers_insert_company_scope/);
    assert.match(sql, /customers_update_company_scope/);
    assert.match(sql, /customers_delete_company_scope/);
    assert.match(sql, /from public\.company_memberships/);
    assert.match(sql, /user_id = auth\.uid\(\)/);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
  });

  test("insert and update require non-null company membership", () => {
    assert.match(sql, /for insert[\s\S]*company_id is not null/);
    assert.match(sql, /for update[\s\S]*with check[\s\S]*company_id is not null/);
  });

  test("revokes anon/public and grants least-privilege authenticated plus service_role", () => {
    assert.match(sql, /revoke all on table public\.customers from public/);
    assert.match(sql, /revoke all on table public\.customers from anon/);
    assert.match(
      sql,
      /grant select, insert, update, delete on table public\.customers to authenticated/
    );
    assert.match(sql, /grant all on table public\.customers to service_role/);
  });

  test("company_id cannot be changed", () => {
    assert.match(sql, /customers_prevent_company_id_change/);
    assert.match(sql, /customers\.company_id is immutable/);
    assert.match(sql, /before update on public\.customers/);
  });

  test("does not rewrite jobs FK or add archive/delete product", () => {
    assert.match(sql, /jobs\.customer_id references customers\(id\) on delete set null/);
    assert.doesNotMatch(sql, /alter table public\.jobs/);
    assert.doesNotMatch(sql, /drop table public\.customers/i);
    assert.doesNotMatch(sql, /create table public\.customers/i);
  });
});

describe("060 — accepted client paths stay company-scoped", () => {
  test("findOrCreateCustomer still keys lookup by company_id + email", () => {
    const source = read("app/lib/customerStore.ts");
    assert.match(source, /\.from\("customers"\)/);
    assert.match(source, /\.eq\("company_id", companyId\)/);
    assert.match(source, /\.eq\("email", emailTrimmed\)/);
  });

  test("proposal context and admin remain company-scoped reads/writes", () => {
    const context = read("app/lib/proposalCustomerContext.ts");
    const admin = read("app/admin/customers/CustomersAdminClient.tsx");
    const persist = read("app/lib/jobCardCustomerPersist.ts");
    assert.match(context, /\.from\("customers"\)/);
    assert.match(context, /\.eq\("company_id", cid\)/);
    assert.match(admin, /\.eq\("company_id", companyId\)/);
    assert.match(persist, /findOrCreateCustomer/);
  });
});
