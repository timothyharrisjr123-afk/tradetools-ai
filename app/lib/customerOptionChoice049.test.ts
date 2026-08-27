/**
 * Premium Cohesion Cut 1 — Phase 0.
 *
 * Canonical customer package selection truth (migration 049).
 *
 * Covers the schema contract, the server-side price authority, the fail-closed
 * interlock that prevents mis-charging when 049 is not applied, and the
 * preservation of every historical migration.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");

const SQL_040 = join(MIGRATIONS, "20260816_040_proposal_formal_acceptance.sql");
const SQL_043 = join(MIGRATIONS, "20260816_043_proposal_signatures.sql");
const SQL_044 = join(MIGRATIONS, "20260816_044_job_payments.sql");
const SQL_047 = join(MIGRATIONS, "20260823_047_job_work_complete.sql");
const SQL_048 = join(
  MIGRATIONS,
  "20260826_048_proposal_payment_terms_and_job_ledger.sql"
);
const SQL_049 = join(
  MIGRATIONS,
  "20260826_049_proposal_customer_option_choice.sql"
);

const SHA_040 = "0C9929393E1662626357E72521792FA0A805E169DE242073F43C5BD75BE81256";
const SHA_043 = "2B7D86548ECB20365F83B8B0882B7F2C4F17A4C6EB7F77A3B30D47FD73BDEF60";
const SHA_044 = "9E098700C57228442B28C44E6177C5630456912A207CA55B1A5DCB1F7CBDB09F";
const SHA_047 = "FFE33FDD562742519BB92568CD5C55528537EA756540D1C6C906F8694B974979";
const SHA_048 = "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";
const SHA_049 = "36337F5F0032F2CBD6CC43DB6CC708C6FF82BBC78CF010FE5E8992F76FC6E2B4";
const SHA_050 = "719673DCE6147C1899E760AADAE0CEC22333D48E2F2C5855AFCB442D0A43162D";
const SHA_051 = "7384BB14759A4D7C8AA6E7728E71286F5A0D614C3FA383F1D3A18E3F0EF31783";
const SHA_052 = "B5EC89909B1C593E2F5DFD122FB2C40F037EE42B32D7249CF9D754E1158C62ED";
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

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("049 — historical migrations untouched", () => {
  test("039 remains absent and reserved", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
  });

  test("040, 043, 044, 047, 048, 049, 050, 051, 052 SHAs unchanged", () => {
    assert.equal(sha(SQL_040), SHA_040);
    assert.equal(sha(SQL_043), SHA_043);
    assert.equal(sha(SQL_044), SHA_044);
    assert.equal(sha(SQL_047), SHA_047);
    assert.equal(sha(SQL_048), SHA_048);
    assert.equal(sha(SQL_049), SHA_049);
    assert.equal(sha(SQL_050), SHA_050);
    assert.equal(sha(SQL_051), SHA_051);
    assert.equal(sha(SQL_052), SHA_052);
  });

  test("049 exists and later live migrations are explicitly inventoried", () => {
    assert.equal(existsSync(SQL_049), true);
    const names = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"));
    const above048 = names.filter((n) => /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [
      "20260826_049_proposal_customer_option_choice.sql",
      "20260827_050_job_payment_request_customer_choice_binding.sql",
      "20260827_051_public_deposit_created_by_user.sql",
      "20260827_052_proposal_public_option_choice_persistence.sql",
      "20260827_053_canonical_stripe_settlement_and_contract_total.sql",
    ]);
    assert.equal(existsSync(SQL_053), true);
  });
});

describe("049 — additive customer choice truth", () => {
  const sql = readFileSync(SQL_049, "utf8");

  test("adds columns without dropping or retyping existing ones", () => {
    assert.match(sql, /add column if not exists customer_chosen_option_id uuid null/);
    assert.match(sql, /add column if not exists customer_chosen_option_label text null/);
    assert.match(sql, /add column if not exists customer_chosen_total_cents integer null/);
    assert.doesNotMatch(sql, /drop column/i);
    assert.doesNotMatch(sql, /alter column/i);
    assert.doesNotMatch(sql, /drop table/i);
  });

  test("does not redefine proposal_option_id semantics", () => {
    // The contractor frozen selection column keeps its meaning and its role in
    // the logical uniqueness key.
    assert.doesNotMatch(sql, /drop constraint proposal_acceptances_logical_unique/);
    assert.doesNotMatch(
      sql,
      /comment on column public\.proposal_acceptances\.proposal_option_id/
    );
  });

  test("choice columns are all-or-nothing and non-negative", () => {
    assert.match(sql, /proposal_acceptances_customer_choice_complete_check/);
    assert.match(sql, /customer_chosen_total_cents >= 0/);
  });

  test("choice is FK-bound to a frozen option in the same company", () => {
    assert.match(
      sql,
      /foreign key \(customer_chosen_option_id, company_id\)\s*\n\s*references public\.proposal_options \(id, company_id\)/
    );
  });

  test("recorded choice is immutable", () => {
    assert.match(
      sql,
      /new\.customer_chosen_option_id is distinct from old\.customer_chosen_option_id/
    );
    assert.match(
      sql,
      /new\.customer_chosen_total_cents is distinct from old\.customer_chosen_total_cents/
    );
    assert.match(sql, /identity and evidence fields are immutable/);
  });
});

describe("049 — option resolution invariants", () => {
  const sql = readFileSync(SQL_049, "utf8");

  test("resolver is scoped to one company and one frozen version", () => {
    assert.match(sql, /proposal_resolve_customer_chosen_option_v1/);
    assert.match(sql, /po\.company_id = p_company_id/);
    assert.match(sql, /po\.proposal_version_id = p_proposal_version_id/);
  });

  test("resolver rejects hidden and unpriced options", () => {
    assert.match(sql, /po\.visible_to_customer is true/);
    assert.match(sql, /po\.customer_total_cents is not null/);
  });

  test("resolver matches on stable template key, not runtime option uuid", () => {
    assert.match(sql, /po\.source_template_option_id::text/);
  });

  test("resolver rejects an empty key", () => {
    assert.match(sql, /trim\(coalesce\(p_option_key, ''\)\) <> ''/);
  });

  test("total is read from frozen truth, never supplied", () => {
    // The resolver returns the frozen total; no parameter carries a price.
    assert.match(
      sql,
      /create or replace function public\.proposal_resolve_customer_chosen_option_v1\(\s*\n\s*p_company_id uuid,\s*\n\s*p_proposal_version_id uuid,\s*\n\s*p_option_key text\s*\n\s*\)/
    );
    assert.doesNotMatch(sql, /p_total_cents|p_amount_cents|p_price/);
  });

  test("invalid choice is rejected with a distinct code", () => {
    assert.match(sql, /'invalid_option_choice'/);
  });
});

describe("049 — money derives from contract truth", () => {
  const sql = readFileSync(SQL_049, "utf8");

  test("contract helper prefers customer choice, falls back to contractor", () => {
    assert.match(sql, /proposal_acceptance_contract_option_v1/);
    assert.match(
      sql,
      /coalesce\(a\.customer_chosen_option_id, a\.proposal_option_id\)/
    );
    assert.match(
      sql,
      /coalesce\(a\.customer_chosen_total_cents, a\.accepted_total_cents\)/
    );
  });

  test("deposit is derived from the contract total", () => {
    assert.match(sql, /job_payment_additional_deposit_cents_v1\(/);
    assert.match(sql, /v_contract_total_cents,\s*\n\s*v_net/);
  });

  test("payment request binds the contract option and total", () => {
    assert.match(sql, /v_contract_option_id,/);
    assert.match(sql, /v_contract_total_cents,/);
    assert.match(sql, /left\(trim\(v_contract_option_label\), 120\)/);
  });

  test("supersession and stage invariants preserved from 048", () => {
    assert.match(sql, /'code', 'superseded'/);
    assert.match(sql, /accepted_at > v_acceptance\.accepted_at/);
    assert.match(sql, /job payment request must not change job stage/);
    assert.match(sql, /status in \('open', 'failed'\)/);
    assert.match(sql, /proposal_acceptance_id is distinct from v_acceptance\.id/);
  });

  test("terms still come from the accepted version", () => {
    assert.match(
      sql,
      /from public\.proposal_version_payment_terms t\s*\n\s*where t\.proposal_version_id = v_acceptance\.proposal_version_id/
    );
  });
});

describe("049 — acceptance stays idempotent and non-mutating", () => {
  const sql = readFileSync(SQL_049, "utf8");

  test("signature of record_proposal_acceptance_v1 is unchanged", () => {
    assert.match(
      sql,
      /create or replace function public\.record_proposal_acceptance_v1\(\s*\n\s*p_token_hash text,\s*\n\s*p_accepted_by_name text default null,\s*\n\s*p_accepted_by_email text default null,\s*\n\s*p_payload_json jsonb default '\{\}'::jsonb\s*\n\s*\)/
    );
  });

  test("choice travels in the existing validated payload", () => {
    assert.match(sql, /v_payload->>'customer_option_key'/);
    assert.match(sql, /proposal_forbidden_token_json_keys\(v_payload\)/);
  });

  test("choice is bound at INSERT, never by a later UPDATE", () => {
    const insertIdx = sql.indexOf("insert into public.proposal_acceptances");
    const choiceIdx = sql.indexOf("customer_chosen_option_id,", insertIdx);
    assert.ok(insertIdx > 0 && choiceIdx > insertIdx);
    assert.doesNotMatch(
      sql,
      /update public\.proposal_acceptances\s*\n\s*set\s*\n\s*customer_chosen/
    );
  });

  test("existing acceptance replays instead of rebinding a new choice", () => {
    assert.match(sql, /v_idempotent_replay := true/);
    assert.match(sql, /when unique_violation then/);
  });

  test("token guards and stage guards preserved", () => {
    assert.match(sql, /'code', 'revoked'/);
    assert.match(sql, /'code', 'superseded'/);
    assert.match(sql, /'code', 'expired'/);
    assert.match(sql, /version_kind not in \('sent', 'signed'\)/);
    assert.match(sql, /formal acceptance must not mutate proposals\.selected_option_id/);
    assert.match(sql, /'job_stage_unchanged', true/);
  });

  test("classifier still runs against the contractor frozen option", () => {
    assert.match(sql, /classify_proposal_acceptance_guard_v1\(/);
    assert.match(sql, /v_frozen\.option_id,\s*\n\s*null\s*\n\s*\)/);
  });
});

describe("049 — grants and exposure", () => {
  const sql = readFileSync(SQL_049, "utf8");

  test("public and anon can never execute acceptance or deposit RPCs", () => {
    assert.match(
      sql,
      /revoke all on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s*\n\s*from public, anon, authenticated/
    );
    assert.match(
      sql,
      /revoke all on function public\.open_job_deposit_from_acceptance_v1\(jsonb\)\s*\n\s*from public, anon, authenticated/
    );
    assert.match(
      sql,
      /revoke all on function public\.proposal_resolve_customer_chosen_option_v1\(uuid, uuid, text\)\s*\n\s*from public, anon, authenticated/
    );
  });

  test("acceptance and deposit remain service_role only", () => {
    assert.match(
      sql,
      /grant execute on function public\.record_proposal_acceptance_v1\(text, text, text, jsonb\)\s*\n\s*to service_role/
    );
    assert.match(
      sql,
      /grant execute on function public\.open_job_deposit_from_acceptance_v1\(jsonb\) to service_role/
    );
  });

  test("all new functions are security definer with pinned search_path", () => {
    const definers = sql.match(/security definer/g) ?? [];
    assert.ok(definers.length >= 4);
    const paths = sql.match(/set search_path = public/g) ?? [];
    assert.ok(paths.length >= 4);
  });
});

describe("Phase 0 — app layer price authority", () => {
  test("checkout route rejects any client amount or binding", () => {
    const route = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(route, /body\?\.amountCents != null/);
    assert.match(route, /body\?\.amount != null/);
    assert.match(route, /body\?\.stripeAccount/);
    assert.match(route, /body\?\.paymentRequestId/);
    assert.match(route, /amount_tamper/);
  });

  test("accept route rejects client amounts too", () => {
    const route = read("app/api/proposals/accept/route.ts");
    assert.match(route, /body\?\.amountCents != null/);
    assert.match(route, /body\?\.totalCents != null/);
    assert.match(route, /amount_tamper/);
  });

  test("both public routes forward only an option key", () => {
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    const accept = read("app/api/proposals/accept/route.ts");
    assert.match(checkout, /customerOptionKey:\s*\n?\s*typeof body\?\.optionKey === "string"/);
    assert.match(accept, /customerOptionKey:\s*\n?\s*typeof body\?\.optionKey === "string"/);
  });

  test("acceptance persistence sends the key only inside the payload", () => {
    const lib = read("app/lib/proposalAcceptancePersistence.ts");
    assert.match(lib, /customer_option_key: commitOptionKey/);
    assert.doesNotMatch(lib, /p_total_cents|p_amount_cents/);
  });

  test("option key length is bounded", () => {
    const lib = read("app/lib/proposalAcceptancePersistence.ts");
    assert.match(lib, /PROPOSAL_ACCEPTANCE_OPTION_KEY_MAX = 200/);
    assert.match(lib, /input\.customerOptionKey,\s*\n\s*PROPOSAL_ACCEPTANCE_OPTION_KEY_MAX/);
  });
});

describe("Phase 0 — fail-closed interlock", () => {
  const lib = read("app/lib/proposalAcceptancePersistence.ts");

  test("a sent choice that did not bind refuses instead of mis-charging", () => {
    assert.match(lib, /option_choice_not_bound/);
    assert.match(lib, /result\.customer_chosen_option_id == null/);
  });

  test("interlock only applies when a choice was actually sent", () => {
    assert.match(
      lib,
      /commitOptionKey &&\s*\n\s*result\.ok &&\s*\n\s*result\.customer_chosen_option_id == null/
    );
  });

  test("contract total is surfaced to callers", () => {
    assert.match(lib, /contract_total_cents: number;/);
    assert.match(lib, /customer_chosen_option_id: string \| null;/);
  });

  test("accept route reports the contract total, not the contractor total", () => {
    const route = read("app/api/proposals/accept/route.ts");
    assert.match(route, /acceptedTotalCents: result\.contract_total_cents/);
    assert.match(
      route,
      /result\.customer_chosen_option_label \?\? result\.accepted_option_label/
    );
  });
});
