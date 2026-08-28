/**
 * Pre-2C payment-domain invariant recovery (migration 055).
 *
 * Run: npx tsx --test app/lib/jobPaymentInvariant055.test.ts
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

const SQL_044 = join(MIGRATIONS, "20260816_044_job_payments.sql");
const SQL_048 = join(MIGRATIONS, "20260826_048_proposal_payment_terms_and_job_ledger.sql");
const SQL_049 = join(MIGRATIONS, "20260826_049_proposal_customer_option_choice.sql");
const SQL_050 = join(
  MIGRATIONS,
  "20260827_050_job_payment_request_customer_choice_binding.sql"
);
const SQL_051 = join(MIGRATIONS, "20260827_051_public_deposit_created_by_user.sql");
const SQL_052 = join(
  MIGRATIONS,
  "20260827_052_proposal_public_option_choice_persistence.sql"
);
const SQL_053 = join(
  MIGRATIONS,
  "20260827_053_canonical_stripe_settlement_and_contract_total.sql"
);
const SQL_054 = join(
  MIGRATIONS,
  "20260827_054_job_payment_balance_request_lifecycle.sql"
);
const SQL_055 = join(MIGRATIONS, "20260827_055_payment_domain_invariants.sql");

const SHA_044 = "9E098700C57228442B28C44E6177C5630456912A207CA55B1A5DCB1F7CBDB09F";
const SHA_048 = "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";
const SHA_049 = "36337F5F0032F2CBD6CC43DB6CC708C6FF82BBC78CF010FE5E8992F76FC6E2B4";
const SHA_050 = "719673DCE6147C1899E760AADAE0CEC22333D48E2F2C5855AFCB442D0A43162D";
const SHA_051 = "7384BB14759A4D7C8AA6E7728E71286F5A0D614C3FA383F1D3A18E3F0EF31783";
const SHA_052 = "B5EC89909B1C593E2F5DFD122FB2C40F037EE42B32D7249CF9D754E1158C62ED";
const SHA_053 = "1800F3C89648EB87F9B428A700ECC9F8EE26932BFB70E3CE9A8CAD4AB0B5D29B";
const SHA_054 = "5BBDCBD4394CF9538DA6B941C12E4865CBF3882FE1562281C387DC80ACCF2004";

function sliceFn(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return next >= 0 ? sql.slice(start, next) : sql.slice(start);
}

function functionBody(sqlFn: string): string {
  const start = sqlFn.indexOf("as $$");
  const end = sqlFn.indexOf("$$;");
  assert.ok(start >= 0 && end > start, "missing function body");
  return sqlFn.slice(start, end);
}

/** Documented A–G contract the SQL helper must implement. Not a live money engine. */
function uncoveredDepositCents(input: {
  obligation: number;
  gross: number;
  collectible: number;
}): number {
  const uncovered = Math.max(0, input.obligation - Math.max(0, input.gross));
  const amount = Math.min(uncovered, Math.max(0, input.collectible));
  return amount < 100 ? 0 : amount;
}

describe("055 — historical migrations immutable", () => {
  test("039 remains absent and reserved", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
    assert.match(readFileSync(SQL_055, "utf8"), /039 remains\s+reserved/);
  });

  test("044 and 048-054 SHAs unchanged", () => {
    assert.equal(sha(SQL_044), SHA_044);
    assert.equal(sha(SQL_048), SHA_048);
    assert.equal(sha(SQL_049), SHA_049);
    assert.equal(sha(SQL_050), SHA_050);
    assert.equal(sha(SQL_051), SHA_051);
    assert.equal(sha(SQL_052), SHA_052);
    assert.equal(sha(SQL_053), SHA_053);
    assert.equal(sha(SQL_054), SHA_054);
  });

  test("055 exists; 056 is the next migration after 055", () => {
    assert.equal(existsSync(SQL_055), true);
    const names = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"));
    const above048 = names.filter((n) => /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [...AFTER_048_MIGRATIONS]);
  });

  test("044 cancel historically allowed processing; 055 replaces live cancel", () => {
    const sql044 = readFileSync(SQL_044, "utf8");
    const cancel044 = sliceFn(sql044, "cancel_job_payment_request_v1");
    assert.match(cancel044, /'open', 'processing', 'failed'/);
    const sql055 = readFileSync(SQL_055, "utf8");
    assert.match(sql055, /create or replace function public\.cancel_job_payment_request_v1/);
  });
});

describe("055 — fail-closed preflight and one-active index", () => {
  const sql = readFileSync(SQL_055, "utf8");

  test("preflight RAISE EXCEPTION exists before the new unique index", () => {
    const raiseAt = sql.search(/raise exception/i);
    const indexAt = sql.indexOf("idx_job_payment_requests_one_active_per_job");
    assert.ok(raiseAt >= 0);
    assert.ok(indexAt > raiseAt);
    assert.match(sql, /do \$\$/);
    assert.match(sql, /fail-closed/);
    assert.match(sql, /status in \('open', 'processing'\)/);
    assert.match(sql, /having count\(\*\) > 1/);
    assert.doesNotMatch(sql.slice(0, indexAt), /update public\.job_payment_requests/i);
  });

  test("new unique index is job-level active only; old per-kind index is dropped after", () => {
    const createAt = sql.indexOf(
      "create unique index if not exists idx_job_payment_requests_one_active_per_job"
    );
    const dropAt = sql.indexOf("drop index if exists public.idx_job_payment_requests_one_active_per_kind");
    assert.ok(createAt >= 0);
    assert.ok(dropAt > createAt);
    assert.match(
      sql,
      /on public\.job_payment_requests \(company_id, job_id\)\s+where status in \('open', 'processing'\)/
    );
    assert.doesNotMatch(
      sql.slice(createAt, dropAt),
      /job_payment_requests \(company_id, job_id, kind\)/
    );
  });

  test("preflight exception reports count and job ids, not amounts or PII", () => {
    const preflight = sql.slice(0, sql.indexOf("idx_job_payment_requests_one_active_per_job"));
    assert.match(preflight, /v_dup_jobs/);
    assert.match(preflight, /job_id/);
    assert.doesNotMatch(preflight, /amount_cents|email|customer_name|accepted_total/i);
  });
});

describe("055 — uncovered deposit formula", () => {
  const sql = readFileSync(SQL_055, "utf8");
  const helper = sliceFn(sql, "job_payment_uncovered_deposit_cents_v1");
  const openFn = sliceFn(sql, "open_job_deposit_from_acceptance_v1");

  test("uses frozen obligation, 053 total, 053 gross, 054 collectible — not net", () => {
    const body = functionBody(helper);
    assert.match(body, /job_payment_resolve_deposit_obligation_cents_v1/);
    assert.match(body, /job_payment_gross_received_cents_v1/);
    assert.match(body, /job_payment_collectible_cents_v1/);
    assert.match(
      body,
      /greatest\(0, coalesce\(v_obligation, 0\) - greatest\(0, coalesce\(v_gross, 0\)\)\)/
    );
    assert.match(body, /least\(v_uncovered, greatest\(0, coalesce\(v_collectible, 0\)\)\)/);
    assert.match(body, /if v_amount < 100 then/);
    assert.doesNotMatch(body, /job_payment_net_received_cents_v1/);
    assert.doesNotMatch(body, /job_payment_additional_deposit_cents_v1/);
    assert.doesNotMatch(body, /job_payment_remaining_cents_v1/);
  });

  test("open_deposit uses uncovered helper and 053 contractual total", () => {
    const body = functionBody(openFn);
    assert.match(body, /job_payment_uncovered_deposit_cents_v1/);
    assert.match(body, /proposal_acceptance_contract_total_cents_v1/);
    assert.doesNotMatch(body, /job_payment_additional_deposit_cents_v1/);
    assert.doesNotMatch(body, /job_payment_net_received_cents_v1/);
    assert.doesNotMatch(body, /v_acceptance\.accepted_total_cents/);
  });

  test("A–G uncovered examples", () => {
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 0, collectible: 2000000 }),
      200000
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 50000, collectible: 1950000 }),
      150000
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 200000, collectible: 1800000 }),
      0
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 250000, collectible: 1750000 }),
      0
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 200000, collectible: 1850000 }),
      0
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 100000, collectible: 1900000 }),
      100000
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 0, collectible: 80000 }),
      80000
    );
    assert.equal(
      uncoveredDepositCents({ obligation: 200000, gross: 199950, collectible: 50 }),
      0
    );
  });
});

describe("055 — deposit writer state machine", () => {
  const sql = readFileSync(SQL_055, "utf8");
  const openFn = sliceFn(sql, "open_job_deposit_from_acceptance_v1");

  test("none / satisfied / superseded / conflict / replay", () => {
    assert.match(openFn, /'no_deposit'/);
    assert.match(openFn, /deposit_mode = 'none'/);
    assert.match(openFn, /'deposit_satisfied'/);
    assert.match(openFn, /'superseded'/);
    assert.match(openFn, /'conflicting_request'/);
    assert.match(openFn, /idempotent_replay', true/);
    assert.match(openFn, /status in \('open', 'processing'\)/);
  });

  test("failed is not revived in place; retry inserts a new open row", () => {
    const body = functionBody(openFn);
    assert.doesNotMatch(body, /set\s+status = 'open'/);
    assert.doesNotMatch(body, /set\r?\n\s*status = 'open'/);
    assert.match(body, /insert into public\.job_payment_requests/);
    assert.match(body, /when unique_violation then/);
    assert.match(body, /and r\.status = 'failed'/);
  });

  test("advisory lock, no stage write, service_role only", () => {
    assert.match(openFn, /pg_advisory_xact_lock/);
    assert.match(openFn, /job payment request must not change job stage/);
    assert.doesNotMatch(openFn, /update public\.jobs/i);
    assert.match(
      sql,
      /revoke all on function public\.open_job_deposit_from_acceptance_v1\(jsonb\)\s+from public, anon, authenticated/
    );
    assert.match(
      sql,
      /grant execute on function public\.open_job_deposit_from_acceptance_v1\(jsonb\) to service_role/
    );
  });
});

describe("055 — generic create, public resolve, cancel, seed", () => {
  const sql = readFileSync(SQL_055, "utf8");
  const createFn = sliceFn(sql, "create_job_payment_request_v1");
  const resolveFn = sliceFn(sql, "resolve_public_job_payment_checkout_v1");
  const cancelFn = sliceFn(sql, "cancel_job_payment_request_v1");
  const seedFn = sliceFn(sql, "proposal_payment_terms_on_version_insert_v1");

  test("generic create rejects deposit; balance remains Complete-gated collectible", () => {
    assert.match(createFn, /'deposit_not_generic'/);
    assert.match(createFn, /v_kind = 'deposit'/);
    assert.match(createFn, /v_kind is distinct from 'balance'/);
    assert.match(createFn, /v_amount := v_collectible/);
    assert.match(createFn, /'not_complete'/);
    assert.match(createFn, /'nothing_due'/);
    assert.match(createFn, /'conflicting_request'/);
    assert.doesNotMatch(createFn, /job_payment_additional_deposit_cents_v1/);
    assert.doesNotMatch(createFn, /p_payload->>'amount_cents'/);
  });

  test("public resolve considers only open|processing and never revives failed", () => {
    assert.match(resolveFn, /status in \('open', 'processing'\)/);
    assert.doesNotMatch(resolveFn, /'open', 'processing', 'failed'/);
    assert.doesNotMatch(resolveFn, /status = 'open'/);
    assert.doesNotMatch(resolveFn, /checkout_generation = checkout_generation \+ 1/);
    assert.match(resolveFn, /'already_paid'/);
    assert.match(resolveFn, /'superseded'/);
    assert.match(resolveFn, /'not_payable'/);
    assert.doesNotMatch(resolveFn, /insert into public\.job_payment_requests/);
  });

  test("processing cancel is rejected; 044 file still historically allows it", () => {
    assert.match(cancelFn, /'processing_not_cancellable'/);
    assert.match(cancelFn, /v_request\.status = 'processing'/);
    assert.match(cancelFn, /'open', 'failed'/);
    assert.doesNotMatch(
      cancelFn,
      /status not in \('open', 'processing', 'failed'\)/
    );
  });

  test("new drafts seed none and do not call settings seed helper", () => {
    const body = functionBody(seedFn);
    assert.match(body, /version_kind = 'draft'/);
    assert.match(body, /'none'/);
    assert.doesNotMatch(body, /perform public\.proposal_payment_terms_seed_from_settings_v1/);
    assert.match(readFileSync(SQL_048, "utf8"), /create or replace function public\.proposal_payment_terms_seed_from_settings_v1/);
    assert.match(body, /parent_version_id is not null/);
  });
});

describe("055 — app coordination", () => {
  test("public GET/load does not mint deposit", () => {
    const orchestrator = read("app/lib/proposalPublicAccessOrchestrator.server.ts");
    assert.doesNotMatch(orchestrator, /openCanonicalDepositFromAcceptedProposal/);
    assert.doesNotMatch(orchestrator, /openJobDepositFromAcceptanceViaAdmin/);
    assert.doesNotMatch(orchestrator, /open_job_deposit_from_acceptance_v1/);
    assert.match(orchestrator, /buildPublicPaymentViewModel/);
  });

  test("accept, sign, and checkout share the thin obligation helper", () => {
    const helper = read("app/lib/jobPaymentAcceptanceObligation.server.ts");
    assert.match(helper, /openJobDepositFromAcceptanceViaAdmin/);
    assert.match(helper, /must not calculate money/);
    assert.match(
      read("app/api/proposals/accept/route.ts"),
      /openCanonicalDepositFromAcceptedProposal/
    );
    assert.match(
      read("app/api/proposals/sign/route.ts"),
      /openCanonicalDepositFromAcceptedProposal/
    );
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /recordProposalAcceptance/);
    assert.match(checkout, /openCanonicalDepositFromAcceptedProposal/);
    assert.match(checkout, /resolvePublicJobPaymentCheckoutViaRpc/);
  });

  test("generic API cannot mint deposit; persistence rejects deposit kind", () => {
    const route = read("app/api/jobs/payment-requests/route.ts");
    assert.match(route, /deposit_not_generic/);
    assert.doesNotMatch(route, /amountCents,/);
    const persist = read("app/lib/jobPaymentPersistence.ts");
    assert.match(persist, /input\.kind === "deposit"/);
    assert.match(persist, /deposit_not_generic/);
    assert.doesNotMatch(
      persist.slice(
        persist.indexOf("export async function createJobPaymentRequestViaRpc"),
        persist.indexOf("export async function collectJobRemainingBalanceViaRpc")
      ),
      /amount_cents/
    );
  });

  test("Pay-as-first-accept: deposit required uses Pay even when unaccepted", () => {
    const hook = read("app/components/proposal-packet/useProposalPurchaseAction.ts");
    assert.match(hook, /isCustomerPaymentPayableState\(paymentState\)/);
    assert.match(hook, /kind === "pay" \? "\/api\/public\/payment-requests\/checkout"/);
    assert.match(hook, /"\/api\/proposals\/accept"/);
  });

  test("Settings Default deposit UI is removed; Flexible Collect exists", () => {
    const settings = read("app/tools/settings/CompanySettingsPaymentsEditor.tsx");
    assert.doesNotMatch(settings, /Default deposit/);
    assert.doesNotMatch(settings, /starting payment terms for new proposals/);
    const workspace = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(workspace, /JOB_CARD_PAYMENTS_COLLECT_CTA/);
    assert.match(workspace, /JobCardCollectPaymentSheet/);
  });
});
