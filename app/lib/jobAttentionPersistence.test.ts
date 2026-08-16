/**
 * R3B4A — Durable attention foundation contract tests.
 *
 * Run:
 * npx tsx --test app/lib/jobAttentionPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  JOB_ATTENTION_DESTINATION_KINDS,
  JOB_ATTENTION_SEVERITIES,
  JOB_ATTENTION_STATUSES,
  JOB_ATTENTION_TYPES,
  JobAttentionPersistenceError,
  MARK_JOB_ATTENTION_READ_RPC_V1,
  markJobAttentionReadViaRpc,
  parseMarkJobAttentionReadResult,
} from "./jobAttentionPersistence";

const ATTENTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260723_035_create_job_attention_foundation.sql"
);
const PUBLIC_API_PATH = join(
  process.cwd(),
  "app/api/proposals/customer-request/route.ts"
);
const PUBLIC_MODAL_PATH = join(
  process.cwd(),
  "app/components/proposal-packet/ProposalPacketRequestModal.tsx"
);

describe("R3B4A TypeScript contracts", () => {
  test("exposes only approved initial attention enums", () => {
    assert.deepEqual(JOB_ATTENTION_TYPES, [
      "customer_package_request",
      "customer_question",
      "acceptance_confirmation_required",
    ]);
    assert.deepEqual(JOB_ATTENTION_STATUSES, [
      "open",
      "acknowledged",
      "resolved",
    ]);
    assert.deepEqual(JOB_ATTENTION_SEVERITIES, [
      "normal",
      "high",
      "critical",
    ]);
    assert.deepEqual(JOB_ATTENTION_DESTINATION_KINDS, [
      "job_card_proposals",
    ]);
  });

  test("parses personal read success without conflating company state", () => {
    const result = parseMarkJobAttentionReadResult({
      ok: true,
      attention_id: ATTENTION_ID,
      user_id: USER_ID,
      read_at: "2026-07-23T12:00:00.000Z",
      last_viewed_at: "2026-07-23T12:00:01.000Z",
      attention_status_unchanged: "open",
      request_status_unchanged: "new",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.attention_status_unchanged, "open");
      assert.equal(result.request_status_unchanged, "new");
    }
  });

  test("calls only the guarded personal-read RPC", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | null = null;
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return {
          data: {
            ok: true,
            attention_id: ATTENTION_ID,
            user_id: USER_ID,
            read_at: "2026-07-23T12:00:00.000Z",
            last_viewed_at: "2026-07-23T12:00:01.000Z",
            attention_status_unchanged: "acknowledged",
            request_status_unchanged: "seen",
          },
          error: null,
        };
      },
    };

    const result = await markJobAttentionReadViaRpc(
      supabase as never,
      ATTENTION_ID
    );

    assert.equal(rpcName, MARK_JOB_ATTENTION_READ_RPC_V1);
    assert.deepEqual(rpcArgs, { p_attention_id: ATTENTION_ID });
    assert.equal(result.ok, true);
  });

  test("rejects invalid attention ids before RPC", async () => {
    await assert.rejects(
      () => markJobAttentionReadViaRpc({} as never, "not-a-uuid"),
      JobAttentionPersistenceError
    );
  });
});

describe("R3B4A migration schema", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates the company attention and personal read tables", () => {
    assert.match(sql, /create table if not exists public\.job_attention_items/);
    assert.match(sql, /create table if not exists public\.job_attention_user_state/);
    assert.match(sql, /attention_type in \('customer_package_request', 'customer_question'\)/);
    assert.match(sql, /status in \('open', 'acknowledged', 'resolved'\)/);
    assert.match(sql, /base_severity in \('normal', 'high', 'critical'\)/);
    assert.match(sql, /destination_kind = 'job_card_proposals'/);
    assert.match(sql, /base_severity[\s\S]*default 'high'/);
    assert.match(
      sql,
      /create unique index if not exists idx_jobs_id_company_unique[\s\S]*\(id, company_id\)/
    );
    assert.match(sql, /foreign key \(job_id, company_id\)/);
    assert.match(sql, /foreign key \(source_id, company_id\)/);
    assert.match(
      sql,
      /references public\.proposal_customer_requests \(id, company_id\)/
    );
  });

  test("does not persist mutable presentation copy or arbitrary hrefs", () => {
    const table = sql.match(
      /create table if not exists public\.job_attention_items \(([\s\S]*?)\n\);/
    )?.[1] ?? "";
    assert.doesNotMatch(table, /\btitle\b/);
    assert.doesNotMatch(table, /\bbutton_text\b/);
    assert.doesNotMatch(table, /\bsummary\b/);
    assert.doesNotMatch(table, /\bhref\b/);
    assert.match(table, /\bdestination_kind\b/);
    assert.match(table, /\bdestination_json\b/);
  });

  test("personal state has no hidden, dismissed, or resolved columns", () => {
    const table = sql.match(
      /create table if not exists public\.job_attention_user_state \(([\s\S]*?)\n\);/
    )?.[1] ?? "";
    assert.match(table, /\bread_at\b/);
    assert.match(table, /\blast_viewed_at\b/);
    assert.match(table, /\blast_notified_at\b/);
    assert.doesNotMatch(table, /\bhidden_at\b/);
    assert.doesNotMatch(table, /\bdismissed_at\b/);
    assert.doesNotMatch(table, /\bresolved_at\b/);
  });

  test("attention rows are durable and resolved rows cannot reopen", () => {
    assert.match(sql, /job_attention_items rows cannot be deleted/);
    assert.match(sql, /resolved job_attention_items cannot be reopened/);
    assert.match(sql, /old\.status = 'resolved' and new\.status <> 'resolved'/);
  });
});

describe("R3B4A source integrity and atomic producer", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("projects from a verified source and derives every binding server-side", () => {
    assert.match(sql, /project_proposal_customer_request_attention_v1/);
    assert.match(sql, /from public\.proposal_customer_requests r/);
    assert.match(sql, /join public\.jobs j/);
    assert.match(sql, /join public\.proposal_versions pv/);
    assert.match(sql, /pv\.proposal_id = p\.id/);
    assert.match(sql, /p\.company_id = v_request\.company_id/);
    assert.match(sql, /v_request\.intent = 'request_package'/);
    assert.match(sql, /v_request\.intent in \('ask_question', 'ask_about_package'\)/);
    assert.doesNotMatch(
      sql,
      /project_proposal_customer_request_attention_v1\([^)]*p_company_id/
    );
    assert.match(sql, /projection does not match verified source truth/);
    assert.match(sql, /new\.destination_json is distinct from v_expected_destination/);
    assert.match(sql, /new\.source_occurred_at is distinct from v_request\.created_at/);
  });

  test("maps ask_about_package to customer_question while retaining intent", () => {
    assert.match(
      sql,
      /v_request\.intent in \('ask_question', 'ask_about_package'\)[\s\S]*v_attention_type := 'customer_question'/
    );
    assert.match(sql, /jsonb_build_object\('intent', v_request\.intent\)/);
    assert.doesNotMatch(sql, /'ask_about_package'\s*\)\s*,?\s*--.*attention_type/);
  });

  test("creates request and attention in one RPC transaction", () => {
    const start = sql.indexOf(
      "create or replace function public.record_proposal_customer_request_v1("
    );
    const end = sql.indexOf(
      "-- 7. Transactional request review -> attention state mapping",
      start
    );
    const createRpc = sql.slice(start, end);
    assert.match(createRpc, /insert into public\.proposal_customer_requests/);
    assert.match(
      createRpc,
      /project_proposal_customer_request_attention_v1\(v_request\.id\)/
    );
    assert.match(
      createRpc,
      /any projection exception rolls back the source insert/i
    );
    assert.doesNotMatch(createRpc, /fetch\(|http|resend|notification_outbox/i);
  });

  test("locks and revalidates token lifecycle before inserting", () => {
    assert.match(sql, /for share of t, pv/);
    assert.match(sql, /v_locked_token\.status = 'revoked'/);
    assert.match(sql, /v_locked_token\.status = 'superseded'/);
    assert.match(sql, /v_locked_token\.expires_at < now\(\)/);
    assert.match(sql, /v_locked_token\.version_kind not in \('sent', 'signed'\)/);
  });

  test("does not create attention from reads or application rendering", () => {
    const appSources = [
      "app/tools/roofing/jobCard/JobCardProposalsTab.tsx",
      "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx",
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewCustomerRequestsSection.tsx",
      "app/tools/roofing/proposals/builder/ProposalBuilderCustomerRequestBanner.tsx",
      "app/lib/useProposalCustomerRequests.ts",
    ].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

    for (const source of appSources) {
      assert.doesNotMatch(source, /job_attention_items/);
      assert.doesNotMatch(source, /project_proposal_customer_request_attention_v1/);
    }
  });
});

describe("R3B4A idempotency and dedupe", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const api = readFileSync(PUBLIC_API_PATH, "utf8");
  const modal = readFileSync(PUBLIC_MODAL_PATH, "utf8");

  test("scopes submission idempotency to token plus client key", () => {
    assert.match(sql, /add column if not exists submission_key uuid/);
    assert.match(
      sql,
      /on public\.proposal_customer_requests \(public_access_token_id, submission_key\)/
    );
    assert.match(sql, /p_submission_key uuid/);
    assert.match(sql, /invalid_submission_key/);
    assert.match(sql, /idempotency_conflict/);
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /'status', v_request\.status/);
    assert.doesNotMatch(
      sql,
      /unique \([^)]*(message|customer_email|requested_option_label|created_at)/
    );
  });

  test("client retains one key across retries and API forwards only that key", () => {
    assert.match(modal, /submissionKeyRef/);
    assert.match(modal, /globalThis\.crypto\.randomUUID\(\)/);
    assert.match(modal, /submissionKey,/);
    assert.match(api, /submissionKey/);
    assert.match(api, /recordProposalCustomerRequest\(token, \{[\s\S]*submissionKey/);
    assert.doesNotMatch(api, /companyId|proposalId|proposalVersionId/);
  });

  test("dedupes one attention item per source occurrence", () => {
    assert.match(
      sql,
      /unique \(company_id, source_type, source_id\)/
    );
    assert.match(sql, /unique \(company_id, dedupe_key\)/);
    assert.match(
      sql,
      /'customer_request:proposal_customer_requests:' \|\| v_request\.id::text/
    );
    assert.match(sql, /on conflict \(company_id, dedupe_key\) do nothing/);
    assert.match(sql, /dismissed idempotent request must retain resolved attention/);
  });
});

describe("R3B4A state mapping and backfill", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("maps request review state transactionally", () => {
    assert.match(
      sql,
      /v_request\.status = 'seen' then 'acknowledged' else 'open'/
    );
    assert.match(
      sql,
      /v_next_status = 'seen'[\s\S]*status = 'acknowledged'/
    );
    assert.match(
      sql,
      /v_next_status = 'dismissed'[\s\S]*status = 'resolved'/
    );
    assert.match(sql, /resolution_reason = coalesce\(resolution_reason, 'request_dismissed'\)/);
    assert.match(sql, /seen request must map to acknowledged attention/);
    assert.match(sql, /dismissed request must map to resolved attention/);
    assert.match(sql, /R3B4A request exists without its required attention item/);
    assert.match(sql, /v_attention_status <> 'resolved'/);
  });

  test("personal read changes only the user's consumption row", () => {
    const start = sql.indexOf(
      "create or replace function public.mark_job_attention_read_v1("
    );
    const end = sql.indexOf(
      "-- 9. Idempotent active-request backfill",
      start
    );
    const readRpc = sql.slice(start, end);
    assert.match(readRpc, /insert into public\.job_attention_user_state/);
    assert.match(readRpc, /read_at = coalesce/);
    assert.match(readRpc, /last_viewed_at = excluded\.last_viewed_at/);
    assert.match(readRpc, /attention_status_unchanged/);
    assert.match(readRpc, /request_status_unchanged/);
    assert.doesNotMatch(readRpc, /update public\.job_attention_items/);
    assert.doesNotMatch(readRpc, /update public\.proposal_customer_requests/);
  });

  test("backfills new and seen, skips dismissed, and is rerunnable", () => {
    const backfill = sql.slice(sql.indexOf("-- 9. Idempotent active-request backfill"));
    assert.match(backfill, /where r\.status in \('new', 'seen'\)/);
    assert.match(
      backfill,
      /project_proposal_customer_request_attention_v1\(v_request_id\)/
    );
    assert.doesNotMatch(backfill, /r\.status = 'dismissed'/);
    assert.match(backfill, /join public\.proposals p/);
    assert.match(backfill, /join public\.jobs j/);
    assert.match(backfill, /join public\.proposal_versions pv/);
    assert.match(backfill, /active-request backfill postcondition failed/);
    assert.match(backfill, /ai\.status is distinct from/);
  });
});

describe("R3B4A permissions and protected truth", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("allows membership-scoped reads but no direct writes", () => {
    assert.match(sql, /alter table public\.job_attention_items enable row level security/);
    assert.match(sql, /alter table public\.job_attention_user_state enable row level security/);
    assert.match(sql, /job_attention_items_select_company_scope/);
    assert.match(sql, /job_attention_user_state_select_own/);
    assert.match(sql, /user_id = auth\.uid\(\)/);
    assert.match(sql, /revoke all on table public\.job_attention_items from authenticated/);
    assert.match(sql, /grant select on table public\.job_attention_items to authenticated/);
    assert.match(sql, /revoke all on table public\.job_attention_user_state from authenticated/);
    assert.match(sql, /grant select on table public\.job_attention_user_state to authenticated/);
  });

  test("keeps producer internal and read/status operations guarded", () => {
    assert.match(
      sql,
      /project_proposal_customer_request_attention_v1\(uuid\)[\s\S]*to service_role/
    );
    assert.doesNotMatch(
      sql,
      /grant execute on function public\.project_proposal_customer_request_attention_v1\(uuid\)\s+to authenticated/
    );
    assert.match(
      sql,
      /update_proposal_customer_request_status_v1\(uuid, text\)[\s\S]*to authenticated/
    );
    assert.match(
      sql,
      /mark_job_attention_read_v1\(uuid\)[\s\S]*to authenticated/
    );
    assert.match(sql, /company_memberships/);
    assert.match(
      sql,
      /where r\.id = p_request_id[\s\S]*company_memberships[\s\S]*for update/
    );
    assert.match(
      sql,
      /where ai\.id = p_attention_id[\s\S]*company_memberships/
    );
  });

  test("never stores raw token material in attention JSON", () => {
    assert.match(sql, /proposal_forbidden_token_json_keys\(new\.destination_json\)/);
    assert.match(sql, /proposal_forbidden_token_json_keys\(new\.metadata_json\)/);
    assert.match(sql, /Never stores raw tokens/);
    assert.doesNotMatch(sql, /destination_json[\s\S]{0,300}'token'/);
  });

  test("proves proposal, package, stage, upgrades, and events unchanged", () => {
    assert.match(sql, /proposal_status_unchanged/);
    assert.match(sql, /selected_option_id_unchanged/);
    assert.match(sql, /job_stage_unchanged/);
    assert.match(sql, /must not mutate proposal\/job\/package\/lifecycle truth/);
    assert.doesNotMatch(sql, /update public\.proposals\b/);
    assert.doesNotMatch(sql, /update public\.jobs\b/);
    assert.doesNotMatch(sql, /update public\.proposal_options\b/);
    assert.doesNotMatch(sql, /update public\.proposal_option_upgrade_choices\b/);
    assert.doesNotMatch(sql, /insert into public\.proposal_events\b/);
    assert.doesNotMatch(sql, /create table[^;]*notification_outbox/i);
    assert.doesNotMatch(sql, /insert into public\.(payments|signatures|schedules)\b/i);
    assert.doesNotMatch(sql, /update public\.(payments|signatures|schedules)\b/i);
  });

  test("uses explicit retention instead of contradictory parent cascades", () => {
    const attentionTable = sql.match(
      /create table if not exists public\.job_attention_items \(([\s\S]*?)\n\);/
    )?.[1] ?? "";
    assert.match(attentionTable, /on delete restrict/);
    assert.doesNotMatch(attentionTable, /on delete cascade/);
  });
});
