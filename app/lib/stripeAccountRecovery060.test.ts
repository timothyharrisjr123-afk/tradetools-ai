/**
 * Durable Stripe connected-account recovery architecture.
 *
 * Static migration tests are intentional: this slice authors but does not
 * apply SQL. The live-application gate remains separately authorized.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const SQL = read(
  "supabase/migrations/20260909130935_durable_stripe_account_recovery.sql"
);

function functionSection(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = SQL.indexOf("create or replace function public.", start + 1);
  return next < 0 ? SQL.slice(start) : SQL.slice(start, next);
}

const UPSERT = functionSection("upsert_company_payment_account_from_provider_v1");
const REPLACE = functionSection("replace_company_payment_account_v1");
const OPEN_DEPOSIT = functionSection("open_job_deposit_from_acceptance_v1");
const CREATE_REQUEST = functionSection("create_job_payment_request_v1");
const RESOLVE_CHECKOUT = functionSection("resolve_public_job_payment_checkout_v1");
const COLLECT = functionSection("collect_job_payment_v1");
const REFUND_SQL = read("supabase/migrations/20260828_059_job_payment_refunds.sql");

describe("Stripe recovery schema model", () => {
  test("backfills existing single rows as current active connections", () => {
    assert.match(
      SQL,
      /update public\.company_payment_accounts[\s\S]*is_current = true,[\s\S]*connection_status = 'active',[\s\S]*ended_at = null[\s\S]*where is_current is null[\s\S]*or connection_status is null/
    );
  });

  test("allows history while enforcing one current and one resumable candidate", () => {
    assert.match(SQL, /drop constraint if exists company_payment_accounts_company_provider_unique/);
    assert.match(
      SQL,
      /create unique index if not exists company_payment_accounts_one_current_idx[\s\S]*\(company_id, provider\)[\s\S]*where is_current = true/
    );
    assert.match(
      SQL,
      /company_payment_accounts_one_active_candidate_idx[\s\S]*where is_current = false and connection_status = 'active'/
    );
  });

  test("preserves global provider ownership and immutable row identity", () => {
    const original = read("supabase/migrations/20260816_044_job_payments.sql");
    assert.match(
      original,
      /unique \(provider, provider_account_id\)/
    );
    for (const field of [
      "new.company_id is distinct from old.company_id",
      "new.provider is distinct from old.provider",
      "new.provider_account_id is distinct from old.provider_account_id",
    ]) {
      assert.ok(SQL.includes(field), field);
    }
  });

  test("retains history and forbids delete shortcuts", () => {
    assert.match(SQL, /if tg_op = 'DELETE'[\s\S]*rows cannot be deleted/);
    assert.match(
      SQL,
      /connection_status in \('active', 'replaced', 'access_lost', 'closed'\)/
    );
    assert.match(
      SQL,
      /connection_status <> 'active' and is_current = false and ended_at is not null/
    );
  });
});

describe("Stripe recovery replacement transaction", () => {
  test("is service-only, tenant-bound, provider-validated, locked, and compare-and-swap", () => {
    assert.match(REPLACE, /auth\.jwt\(\)->>'role'[\s\S]*service_role/);
    assert.match(REPLACE, /provider_access_validated/);
    assert.match(REPLACE, /pg_advisory_xact_lock/);
    assert.match(REPLACE, /order by a\.id[\s\S]*for update/);
    assert.match(
      REPLACE,
      /v_next\.company_id is distinct from v_company_id[\s\S]*account_company_mismatch/
    );
    assert.match(REPLACE, /current_account_changed/);
  });

  test("rejects unusable replacements before changing current ownership", () => {
    const rejectAt = REPLACE.indexOf("replacement_not_usable");
    const oldUpdateAt = REPLACE.indexOf("connection_status = 'replaced'");
    assert.ok(rejectAt >= 0 && oldUpdateAt > rejectAt);
    assert.match(REPLACE, /if v_disabled or not v_charges/);
  });

  test("atomically retains old row and activates exactly the replacement", () => {
    assert.match(
      REPLACE,
      /set\s+is_current = false,\s+connection_status = 'replaced',\s+ended_at = v_now/
    );
    assert.match(
      REPLACE,
      /set\s+is_current = true,\s+connection_status = 'active',\s+ended_at = null/
    );
    assert.doesNotMatch(REPLACE, /delete from public\.company_payment_accounts/i);
    assert.doesNotMatch(REPLACE, /job_payment_(requests|transactions|refunds)[\s\S]*provider_account_id\s*=/i);
  });

  test("retries and same-current replacement return an explicit replay", () => {
    assert.match(
      REPLACE,
      /v_current\.provider_account_id = v_replacement[\s\S]*'idempotent_replay', true/
    );
    assert.match(REPLACE, /'idempotent_replay', false/);
  });

  test("provider upsert cannot reassign or reactivate historical ownership", () => {
    assert.match(UPSERT, /auth\.jwt\(\)->>'role'[\s\S]*service_role/);
    assert.match(UPSERT, /account_company_mismatch/);
    const existingUpdate = UPSERT.slice(
      UPSERT.indexOf("if found then"),
      UPSERT.indexOf("else", UPSERT.indexOf("if found then"))
    );
    assert.doesNotMatch(existingUpdate, /is_current\s*=/);
    assert.doesNotMatch(existingUpdate, /connection_status\s*=/);
    assert.match(UPSERT, /v_company_id is null[\s\S]*'not_found'/);
  });
});

describe("Stripe recovery money routing", () => {
  test("every canonical new-money writer requires current active complete charge readiness", () => {
    for (const fn of [OPEN_DEPOSIT, CREATE_REQUEST, RESOLVE_CHECKOUT, COLLECT]) {
      assert.match(fn, /a\.provider = 'stripe'/);
      assert.match(fn, /a\.is_current = true/);
      assert.match(fn, /a\.connection_status = 'active'/);
      assert.match(fn, /a\.onboarding_status = 'complete'/);
      assert.match(fn, /a\.charges_enabled = true/);
    }
  });

  test("application account reads choose current explicitly", () => {
    for (const path of [
      "app/api/company/payments/status/route.ts",
      "app/api/jobs/[jobId]/payment-requests/route.ts",
      "app/lib/jobPaymentClientRead.ts",
      "app/lib/proposalPaymentTermsPersistence.ts",
    ]) {
      const source = read(path);
      assert.match(source, /company_payment_accounts/);
      assert.match(source, /\.eq\("is_current", true\)/, path);
    }
  });

  test("Connect resumes the current account before a single explicit candidate", () => {
    const source = read("app/api/company/payments/connect/route.ts");
    assert.match(source, /\.eq\("is_current", true\)/);
    assert.match(source, /\.eq\("is_current", false\)[\s\S]*\.eq\("connection_status", "active"\)/);
    assert.match(source, /const resumable = existing \?\? candidate/);
    assert.match(source, /replaceCompanyStripeAccountAfterProviderValidation/);
  });
});

describe("Stripe recovery historical routing and refunds", () => {
  test("provider webhook routing remains exact-account and does not require current", () => {
    const webhook = read("app/api/webhooks/stripe/connect/route.ts");
    assert.match(
      webhook,
      /providerAccountId: mapped\.account_update\.provider_account_id/
    );
    assert.doesNotMatch(webhook, /is_current/);
    assert.match(UPSERT, /a\.provider_account_id = v_account_id/);
  });

  test("historical refund authorization uses the request-stamped account without current substitution", () => {
    const start = REFUND_SQL.indexOf(
      "create or replace function public.reserve_job_payment_refund_v1"
    );
    const end = REFUND_SQL.indexOf(
      "revoke all on function public.reserve_job_payment_refund_v1",
      start
    );
    const reserve = REFUND_SQL.slice(start, end);
    assert.match(reserve, /v_request\.provider_account_id/);
    assert.match(
      reserve,
      /a\.company_id = v_company_id[\s\S]*a\.provider_account_id = v_request\.provider_account_id/
    );
    assert.doesNotMatch(reserve, /is_current/);
  });

  test("no recovery code mutates jobs.stage or payment/refund amounts", () => {
    const recoveryPrefix = SQL.slice(0, SQL.indexOf("-- New-money writers"));
    assert.doesNotMatch(recoveryPrefix, /jobs\.stage|update public\.jobs/i);
    assert.doesNotMatch(recoveryPrefix, /amount_cents|contractual_collected/i);
  });
});

describe("Stripe recovery server boundary", () => {
  test("browser input is not forwarded directly to the replacement RPC", () => {
    const helper = read("app/lib/stripeAccountRecovery.server.ts");
    assert.match(helper, /import "server-only"/);
    assert.match(helper, /retrieveConnectedAccount\(input\.replacementProviderAccountId\)/);
    assert.match(helper, /live\.id !== input\.replacementProviderAccountId/);
    assert.match(helper, /state !== "complete"/);
    assert.match(helper, /providerAccountId: live\.id/);
  });

  test("replacement RPC is not granted to browser roles", () => {
    assert.match(
      SQL,
      /revoke all on function public\.replace_company_payment_account_v1\(jsonb\)[\s\S]*from public, anon, authenticated;[\s\S]*grant execute[\s\S]*to service_role;/
    );
  });
});
