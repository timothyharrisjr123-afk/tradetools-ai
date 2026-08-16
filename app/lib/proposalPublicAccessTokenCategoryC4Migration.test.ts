/**
 * Stage C4 migration 037 contract tests.
 *
 * Static pre-apply verification only:
 * npx tsx --test app/lib/proposalPublicAccessTokenCategoryC4Migration.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260815_037_add_token_category_and_email_send_supersede_rpc.sql"
);
const RESOLVE_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260626_016_create_proposal_public_access_resolve_rpc.sql"
);
const REQUEST_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260723_035_create_job_attention_foundation.sql"
);
const FREEZE_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260626_012_create_proposal_send_freeze_rpc.sql"
);
const PUBLIC_VIEW_MODEL_PATH = join(
  process.cwd(),
  "app/lib/proposalPublicProposalViewModel.ts"
);

const sql = readFileSync(MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");

function withoutLineComments(value: string): string {
  return value.replace(/^\s*--.*$/gm, "");
}

function between(start: string, end: string): string {
  const startIndex = sql.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = sql.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return sql.slice(startIndex, endIndex);
}

const combinedRpc = between(
  "create or replace function public.mint_and_supersede_proposal_public_access_token_v1(",
  "comment on function public.mint_and_supersede_proposal_public_access_token_v1("
);
const genericRpc = between(
  "create or replace function public.mint_proposal_public_access_token_v1(",
  "comment on function public.mint_proposal_public_access_token_v1("
);

describe("Stage C4 token_category schema and backfill", () => {
  test("adds nullable constrained category with only the approved current values", () => {
    assert.match(
      sql,
      /add column if not exists token_category text null/i
    );
    assert.match(sql, /token_category is null/);
    assert.match(
      sql,
      /token_category in \(\s*'contractor_preview_qa',\s*'contractor_send_prep',\s*'contractor_email_send'\s*\)/s
    );
    assert.doesNotMatch(sql, /token_category[\s\S]*customer_sign_accept/i);
    assert.doesNotMatch(sql, /token_category[\s\S]*customer_payment/i);
  });

  test("backfills exact known metadata sources and leaves unknown rows unguessed", () => {
    const backfill = between(
      "update public.proposal_public_access_tokens\nset token_category = metadata_json->>'source'",
      "-- ---------------------------------------------------------------------------\n-- 3."
    );
    assert.match(backfill, /where token_category is null/);
    assert.match(
      backfill,
      /metadata_json->>'source' in \(\s*'contractor_preview_qa',\s*'contractor_send_prep',\s*'contractor_email_send'\s*\)/s
    );
    assert.doesNotMatch(backfill, /\belse\b|\bcoalesce\b/i);
    assert.doesNotMatch(sql, /\b17\b|\b38\b|\b40\b/);
  });

  test("installs category immutability after backfill", () => {
    const backfillIndex = sql.indexOf(
      "update public.proposal_public_access_tokens\nset token_category"
    );
    const guardIndex = sql.indexOf(
      "create or replace function public.proposal_public_access_token_row_guard()"
    );
    assert.ok(backfillIndex >= 0 && guardIndex > backfillIndex);
    assert.match(
      sql,
      /new\.token_category is distinct from old\.token_category/
    );
    assert.match(sql, /new\.proposal_version_id is distinct from old\.proposal_version_id/);
    assert.match(sql, /new\.token_hash is distinct from old\.token_hash/);
    assert.match(sql, /new\.token_prefix is distinct from old\.token_prefix/);
    assert.match(sql, /new\.expires_at is distinct from old\.expires_at/);
  });

  test("adds a non-unique category/status lookup index", () => {
    assert.match(
      sql,
      /create index if not exists idx_proposal_public_access_tokens_category_status\s+on public\.proposal_public_access_tokens \(\s*company_id,\s*proposal_id,\s*token_category,\s*status\s*\)/s
    );
    assert.doesNotMatch(sql, /create unique index[\s\S]*token_category/i);
  });
});

describe("Stage C4 combined email-send RPC", () => {
  test("uses the approved signature and hardened service-role boundary", () => {
    assert.match(combinedRpc, /p_token_hash text/);
    assert.match(combinedRpc, /p_proposal_version_id uuid/);
    assert.match(combinedRpc, /p_metadata_json jsonb default '\{\}'::jsonb/);
    assert.match(combinedRpc, /returns jsonb/);
    assert.match(combinedRpc, /security definer/i);
    assert.match(combinedRpc, /set search_path = public/i);
    assert.doesNotMatch(combinedRpc, /p_raw_token/i);
    assert.doesNotMatch(combinedRpc, /'token_hash'\s*,/i);

    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(
        sql,
        new RegExp(
          `revoke all on function public\\.mint_and_supersede_proposal_public_access_token_v1\\([\\s\\S]*?\\) from ${role}`,
          "i"
        )
      );
    }
    assert.match(
      sql,
      /grant execute on function public\.mint_and_supersede_proposal_public_access_token_v1\([\s\S]*?\) to service_role/i
    );
  });

  test("locks the proposal row and requires the authoritative latest sent pointer", () => {
    assert.match(
      combinedRpc,
      /from public\.proposals p\s+where p\.id = p_proposal_id\s+for update/s
    );
    assert.match(combinedRpc, /v_proposal\.company_id is distinct from p_company_id/);
    assert.match(combinedRpc, /v_proposal\.latest_sent_version_id is null/);
    assert.match(
      combinedRpc,
      /v_proposal\.latest_sent_version_id is distinct from p_proposal_version_id/
    );
    assert.match(combinedRpc, /'not_latest_sent_version'/);
    assert.doesNotMatch(combinedRpc, /pg_advisory/);
  });

  test("accepts current frozen sent truth only, not signed or historical versions", () => {
    assert.match(combinedRpc, /v_version\.version_kind <> 'sent'/);
    assert.match(combinedRpc, /v_version\.frozen_at is null/);
    assert.match(combinedRpc, /'sent_version_not_frozen'/);
    assert.doesNotMatch(combinedRpc, /version_kind not in \('sent', 'signed'\)/);
  });

  test("owns the insert directly and canonicalizes email-send source", () => {
    assert.match(
      combinedRpc,
      /insert into public\.proposal_public_access_tokens/
    );
    assert.match(
      combinedRpc,
      /'customer_view',\s*'contractor_email_send',\s*'active'/s
    );
    assert.match(
      combinedRpc,
      /jsonb_set\(\s*v_metadata,\s*'\{source\}',\s*to_jsonb\('contractor_email_send'::text\),\s*true\s*\)/s
    );
    assert.doesNotMatch(
      combinedRpc,
      /v_metadata\s*:=\s*jsonb_build_object\(\s*'source'/
    );
    assert.doesNotMatch(combinedRpc, /mint_proposal_public_access_token_v1\(/);
  });

  test("supersedes active older-version email tokens only", () => {
    assert.match(
      combinedRpc,
      /update public\.proposal_public_access_tokens\s+set\s+status = 'superseded',\s*superseded_by_token_id = v_inserted\.id\s+where company_id = p_company_id\s+and proposal_id = p_proposal_id\s+and token_category = 'contractor_email_send'\s+and status = 'active'\s+and proposal_version_id <> p_proposal_version_id/s
    );
    assert.doesNotMatch(
      combinedRpc,
      /where[\s\S]*id\s*<>\s*v_inserted\.id/
    );
    assert.match(combinedRpc, /get diagnostics v_superseded_count = row_count/);
    assert.match(
      combinedRpc,
      /'superseded_count', v_superseded_count/
    );
  });

  test("same-version resend remains active and excluded from superseded_count", () => {
    const updateStart = combinedRpc.indexOf(
      "update public.proposal_public_access_tokens"
    );
    const updateEnd = combinedRpc.indexOf(
      "get diagnostics v_superseded_count",
      updateStart
    );
    const update = combinedRpc.slice(updateStart, updateEnd);
    assert.match(update, /proposal_version_id <> p_proposal_version_id/);
    assert.doesNotMatch(update, /proposal_version_id = p_proposal_version_id/);
    assert.doesNotMatch(sql, /unique[\s\S]{0,100}contractor_email_send/i);
  });

  test("insert and supersession are one database function transaction", () => {
    const insertIndex = combinedRpc.indexOf(
      "insert into public.proposal_public_access_tokens"
    );
    const updateIndex = combinedRpc.indexOf(
      "update public.proposal_public_access_tokens"
    );
    assert.ok(insertIndex >= 0 && updateIndex > insertIndex);
    assert.doesNotMatch(combinedRpc, /commit|rollback|http|fetch|resend/i);
  });

  test("shares proposal-row serialization with send freeze without advisory locks", () => {
    const freezeSql = readFileSync(FREEZE_MIGRATION_PATH, "utf8").replace(
      /\r\n/g,
      "\n"
    );
    assert.match(
      combinedRpc,
      /from public\.proposals p\s+where p\.id = p_proposal_id\s+for update/s
    );
    assert.match(
      freezeSql,
      /from public\.proposals p\s+where p\.id = v_proposal_id[\s\S]*?for update/s
    );
    assert.doesNotMatch(combinedRpc, /pg_advisory/);
  });
});

describe("Stage C4 Phase-A generic mint compatibility", () => {
  test("routes deployed email-send callers through combined C4 without recursion", () => {
    assert.match(genericRpc, /if v_source = 'contractor_email_send' then/);
    assert.match(
      genericRpc,
      /return public\.mint_and_supersede_proposal_public_access_token_v1\(/
    );
    assert.doesNotMatch(
      combinedRpc,
      /mint_proposal_public_access_token_v1\(/
    );
    assert.doesNotMatch(genericRpc, /'email_send_not_allowed'/i);
  });

  test("keeps QA/send-prep ordinary inserts and unknown legacy category null", () => {
    assert.match(
      genericRpc,
      /when 'contractor_preview_qa' then 'contractor_preview_qa'/
    );
    assert.match(
      genericRpc,
      /when 'contractor_send_prep' then 'contractor_send_prep'/
    );
    assert.match(genericRpc, /else null/);
    assert.match(
      genericRpc,
      /insert into public\.proposal_public_access_tokens/
    );
    assert.match(genericRpc, /'customer_view',\s*v_category,\s*'active'/s);
    assert.doesNotMatch(
      genericRpc,
      /update public\.proposal_public_access_tokens/
    );
  });

  test("reasserts generic mint service-role-only permissions", () => {
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(
        sql,
        new RegExp(
          `revoke all on function public\\.mint_proposal_public_access_token_v1\\([\\s\\S]*?\\) from ${role}`,
          "i"
        )
      );
    }
    assert.match(
      sql,
      /grant execute on function public\.mint_proposal_public_access_token_v1\([\s\S]*?\) to service_role/i
    );
  });
});

describe("Stage C4 protected contracts", () => {
  test("records the accepted legacy four-token cutover limitation without data mutation", () => {
    assert.match(sql, /four active[\s\S]*contractor_email_send tokens/i);
    assert.match(sql, /four historical sent versions/i);
    assert.match(sql, /first successful combined email-send mint/i);
    assert.doesNotMatch(
      between("begin;", "-- ---------------------------------------------------------------------------\n-- 1."),
      /update|delete|revoke/i
    );
  });

  test("does not mutate versions, proposal/job lifecycle, freeze, or public resolve", () => {
    const executableSql = withoutLineComments(sql);
    assert.doesNotMatch(executableSql, /update\s+public\.proposal_versions/i);
    assert.doesNotMatch(executableSql, /update\s+public\.proposals/i);
    assert.doesNotMatch(
      executableSql,
      /jobs\.stage|stage_entered_at|proposals\.status/i
    );
    assert.doesNotMatch(
      sql,
      /create or replace function public\.persist_proposal_send_freeze_v1/i
    );
    assert.doesNotMatch(
      sql,
      /create or replace function public\.resolve_proposal_public_access_token_v1/i
    );
  });

  test("existing public superseded and request binding contracts remain present", () => {
    const resolveSql = readFileSync(RESOLVE_MIGRATION_PATH, "utf8");
    const requestSql = readFileSync(REQUEST_MIGRATION_PATH, "utf8");
    const publicViewModel = readFileSync(PUBLIC_VIEW_MODEL_PATH, "utf8");

    assert.match(
      resolveSql,
      /if v_token\.status = 'superseded' then\s+return jsonb_build_object\('ok', false, 'code', 'superseded'\)/s
    );
    assert.match(publicViewModel, /A newer proposal is available/);
    assert.doesNotMatch(publicViewModel, /superseded_by_token_id|replacement_url/i);
    assert.match(
      requestSql,
      /v_locked_token\.status = 'superseded'[\s\S]*'code', 'superseded'/s
    );
    assert.match(requestSql, /public_access_token_id/);
    assert.match(requestSql, /proposal_version_id/);
  });
});
