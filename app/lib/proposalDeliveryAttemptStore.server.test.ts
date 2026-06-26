/**
 * R18D3A — proposalDeliveryAttemptStore.server tests.
 *
 * Run: npx tsx --test app/lib/proposalDeliveryAttemptStore.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  buildAttemptedDeliveryInsertPayload,
  createProposalDeliveryAttemptedWithClient,
  findProposalDeliveryAttemptByIdempotencyKeyWithClient,
  listProposalDeliveryAttemptsForProposalWithClient,
  markProposalDeliveryAttemptFailedWithClient,
  markProposalDeliveryAttemptProviderAcceptedWithClient,
  truncateSafeDeliveryErrorMessage,
} from "./proposalDeliveryAttemptPersistence";
import {
  buildRecipientDeliveryFieldsFromEmail,
  hashRecipientEmailForDelivery,
  redactRecipientEmailForDisplay,
} from "./proposalDeliveryAttemptTypes";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const TOKEN_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const IDEMPOTENCY_KEY = "send-attempt-1";
const ATTEMPTED_AT = "2026-06-26T12:00:00.000Z";
const ACCEPTED_AT = "2026-06-26T12:00:01.000Z";
const FAILED_AT = "2026-06-26T12:00:02.000Z";

const RECIPIENT_EMAIL = "jane@example.com";
const RECIPIENT_HASH = hashRecipientEmailForDelivery(RECIPIENT_EMAIL);

function baseCreateInput() {
  return {
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    proposal_public_access_token_id: TOKEN_ID,
    token_prefix: "fd_pabc1",
    recipient_email_hash: RECIPIENT_HASH,
    recipient_email_redacted: redactRecipientEmailForDisplay(RECIPIENT_EMAIL),
    idempotency_key: IDEMPOTENCY_KEY,
    subject_snapshot: "Your roofing proposal",
    body_snapshot: "Please review your proposal.",
    metadata_json: { route_version: "r18d3b-draft" },
    created_by: USER_ID,
  };
}

function baseAttemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTEMPT_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    proposal_public_access_token_id: TOKEN_ID,
    channel: "email",
    provider: "resend",
    recipient_email_hash: RECIPIENT_HASH,
    recipient_email_redacted: "j***@example.com",
    token_prefix: "fd_pabc1",
    idempotency_key: IDEMPOTENCY_KEY,
    status: "attempted",
    subject_snapshot: "Your roofing proposal",
    body_snapshot: "Please review your proposal.",
    provider_message_id: null,
    error_code: null,
    error_message_safe: null,
    metadata_json: { route_version: "r18d3b-draft" },
    created_by: USER_ID,
    created_at: ATTEMPTED_AT,
    updated_at: ATTEMPTED_AT,
    attempted_at: ATTEMPTED_AT,
    provider_accepted_at: null,
    failed_at: null,
    delivered_at: null,
    bounced_at: null,
    complained_at: null,
    ...overrides,
  };
}

describe("R18D3A migration guardrails", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260626_020_create_proposal_delivery_attempts.sql",
      import.meta.url
    ),
    "utf8"
  );

  test("migration file exists with delivery attempts table", () => {
    assert.match(migration, /create table if not exists public\.proposal_delivery_attempts/i);
    assert.match(migration, /enable row level security/i);
  });

  test("status CHECK contains all 7 values", () => {
    for (const status of [
      "prepared",
      "attempted",
      "provider_accepted",
      "failed",
      "delivered",
      "bounced",
      "complained",
    ]) {
      assert.match(migration, new RegExp(`'${status}'`));
    }
  });

  test("channel/provider checks and recipient hash format exist", () => {
    assert.match(migration, /proposal_delivery_attempts_channel_check/i);
    assert.match(migration, /check \(channel in \('email'\)\)/i);
    assert.match(migration, /proposal_delivery_attempts_provider_check/i);
    assert.match(migration, /check \(provider in \('resend'\)\)/i);
    assert.match(migration, /proposal_delivery_attempts_recipient_hash_format_check/i);
    assert.match(migration, /proposal_delivery_attempts_payload_object_check/i);
    assert.match(migration, /jsonb_typeof\(metadata_json\) = 'object'/i);
  });

  test("RLS SELECT policy uses company_memberships without write policies", () => {
    assert.match(migration, /proposal_delivery_attempts_select_company_scope/i);
    assert.match(migration, /company_memberships/i);
    assert.match(migration, /for select/i);
    assert.match(migration, /to authenticated/i);
    assert.doesNotMatch(migration, /for insert/i);
    assert.doesNotMatch(migration, /for update/i);
    assert.doesNotMatch(migration, /for delete/i);
  });

  test("grants revoke broad access and grant SELECT to authenticated", () => {
    assert.match(migration, /revoke all on table public\.proposal_delivery_attempts from public/i);
    assert.match(migration, /revoke all on table public\.proposal_delivery_attempts from anon/i);
    assert.match(migration, /revoke all on table public\.proposal_delivery_attempts from authenticated/i);
    assert.match(migration, /grant select on table public\.proposal_delivery_attempts to authenticated/i);
  });

  test("unique idempotency and provider message indexes exist", () => {
    assert.match(migration, /idx_proposal_delivery_attempts_company_idempotency/i);
    assert.match(migration, /\(company_id, idempotency_key\)/i);
    assert.match(migration, /idx_proposal_delivery_attempts_provider_message/i);
    assert.match(migration, /where provider_message_id is not null/i);
  });

  test("no proposals.status or proposal_events mutation", () => {
    assert.doesNotMatch(migration, /update\s+public\.proposals/i);
    assert.doesNotMatch(migration, /insert\s+into\s+public\.proposal_events/i);
  });

  test("forbidden metadata keys, immutability, and status transition guards exist", () => {
    assert.match(migration, /proposal_delivery_attempt_forbidden_metadata_keys/i);
    assert.match(migration, /raw_token/i);
    assert.match(migration, /rawToken/i);
    assert.match(migration, /token_hash/i);
    assert.match(migration, /recipient_email/i);
    assert.match(migration, /proposal_delivery_attempt_row_guard/i);
    assert.match(migration, /immutable after insert/i);
    assert.match(migration, /invalid proposal_delivery_attempts status transition/i);
    assert.match(migration, /prepared' and new\.status = 'attempted'/i);
    assert.match(migration, /attempted' and new\.status in \('provider_accepted', 'failed'\)/i);
    assert.match(migration, /provider_accepted' and new\.status in \('delivered', 'bounced', 'complained'\)/i);
  });
});

describe("R18D3A persistence behavior", () => {
  test("create attempted insert payload has status attempted + attempted_at", async () => {
    const payload = buildAttemptedDeliveryInsertPayload(baseCreateInput(), ATTEMPTED_AT);
    assert.equal(payload.status, "attempted");
    assert.equal(payload.attempted_at, ATTEMPTED_AT);
    assert.equal(payload.channel, "email");
    assert.equal(payload.provider, "resend");
    assert.ok(!("recipient_email" in payload));
    assert.ok(!("raw_token" in payload));
    assert.ok(!("token_hash" in payload));

    let insertedPayload: Record<string, unknown> | undefined;
    const supabase = {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          insertedPayload = row;
          return {
            select: () => ({
              single: async () => ({ data: { ...row, id: ATTEMPT_ID }, error: null }),
            }),
          };
        },
      }),
    };

    const row = await createProposalDeliveryAttemptedWithClient(
      supabase as never,
      baseCreateInput(),
      () => new Date(ATTEMPTED_AT)
    );

    assert.deepEqual(insertedPayload, payload);
    assert.equal(row.status, "attempted");
    assert.equal(row.attempted_at, ATTEMPTED_AT);
  });

  test("mark provider accepted sets provider_message_id + provider_accepted_at", async () => {
    let updatePayload: Record<string, unknown> | undefined;
    const supabase = {
      from: () => ({
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: baseAttemptRow({
                      status: "provider_accepted",
                      provider_message_id: "resend-msg-1",
                      provider_accepted_at: ACCEPTED_AT,
                    }),
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      }),
    };

    const row = await markProposalDeliveryAttemptProviderAcceptedWithClient(
      supabase as never,
      {
        company_id: COMPANY_ID,
        attempt_id: ATTEMPT_ID,
        provider_message_id: "resend-msg-1",
      },
      () => new Date(ACCEPTED_AT)
    );

    assert.equal(updatePayload?.status, "provider_accepted");
    assert.equal(updatePayload?.provider_message_id, "resend-msg-1");
    assert.equal(updatePayload?.provider_accepted_at, ACCEPTED_AT);
    assert.equal(updatePayload?.error_code, null);
    assert.equal(updatePayload?.error_message_safe, null);
    assert.equal(row.provider_message_id, "resend-msg-1");
    assert.equal(row.provider_accepted_at, ACCEPTED_AT);
  });

  test("mark failed stores safe truncated error", async () => {
    const longError = `x${"y".repeat(600)}`;
    let updatePayload: Record<string, unknown> | undefined;
    const supabase = {
      from: () => ({
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: baseAttemptRow({
                      status: "failed",
                      failed_at: FAILED_AT,
                      error_code: "provider_rejected",
                      error_message_safe: truncateSafeDeliveryErrorMessage(longError),
                    }),
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      }),
    };

    const row = await markProposalDeliveryAttemptFailedWithClient(
      supabase as never,
      {
        company_id: COMPANY_ID,
        idempotency_key: IDEMPOTENCY_KEY,
        error_code: "provider_rejected",
        error_message_safe: longError,
      },
      () => new Date(FAILED_AT)
    );

    assert.equal(updatePayload?.status, "failed");
    assert.equal(updatePayload?.failed_at, FAILED_AT);
    assert.equal(
      String(updatePayload?.error_message_safe).length,
      truncateSafeDeliveryErrorMessage(longError).length
    );
    assert.ok(String(updatePayload?.error_message_safe).length <= 500);
    assert.equal(row.status, "failed");
    assert.equal(row.failed_at, FAILED_AT);
  });

  test("list by proposal orders newest first", async () => {
    let orderArgs: { column: string; ascending: boolean } | undefined;

    const listSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: (column: string, options: { ascending: boolean }) => {
                orderArgs = { column, ascending: options.ascending };
                return Promise.resolve({
                  data: [
                    baseAttemptRow({ id: "newer", created_at: "2026-06-26T13:00:00.000Z" }),
                    baseAttemptRow({ id: "older", created_at: "2026-06-26T11:00:00.000Z" }),
                  ],
                  error: null,
                });
              },
            }),
          }),
        }),
      }),
    };

    const rows = await listProposalDeliveryAttemptsForProposalWithClient(listSupabase as never, {
      company_id: COMPANY_ID,
      proposal_id: PROPOSAL_ID,
    });

    assert.deepEqual(orderArgs, { column: "created_at", ascending: false });
    assert.equal(rows[0]?.id, "newer");
    assert.equal(rows[1]?.id, "older");
  });

  test("find by idempotency key scopes to company and returns row", async () => {
    const eqCalls: string[] = [];

    const lookupSupabase = {
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => {
            eqCalls.push(`${column}:${value}`);
            if (column === "idempotency_key") {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: baseAttemptRow(),
                    error: null,
                  }),
              };
            }
            return {
              eq: (nextColumn: string, nextValue: string) => {
                eqCalls.push(`${nextColumn}:${nextValue}`);
                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: baseAttemptRow(),
                      error: null,
                    }),
                };
              },
            };
          },
        }),
      }),
    };

    const row = await findProposalDeliveryAttemptByIdempotencyKeyWithClient(lookupSupabase as never, {
      company_id: COMPANY_ID,
      idempotency_key: IDEMPOTENCY_KEY,
    });

    assert.equal(row?.id, ATTEMPT_ID);
    assert.ok(eqCalls.some((call) => call === `company_id:${COMPANY_ID}`));
    assert.ok(eqCalls.some((call) => call === `idempotency_key:${IDEMPOTENCY_KEY}`));
  });

  test("find by idempotency key returns null for empty input", async () => {
    const row = await findProposalDeliveryAttemptByIdempotencyKeyWithClient({} as never, {
      company_id: "",
      idempotency_key: "",
    });
    assert.equal(row, null);
  });

  test("recipient helpers hash and redact without persisting raw email in payload", () => {
    const fields = buildRecipientDeliveryFieldsFromEmail("  Jane@Example.COM ");
    assert.equal(fields.recipient_email_hash, hashRecipientEmailForDelivery("jane@example.com"));
    assert.equal(fields.recipient_email_redacted, "j***@example.com");

    const payload = buildAttemptedDeliveryInsertPayload(
      {
        ...baseCreateInput(),
        recipient_email_hash: fields.recipient_email_hash,
        recipient_email_redacted: fields.recipient_email_redacted,
      },
      ATTEMPTED_AT
    );

    assert.ok(!("recipient_email" in payload));
    assert.equal(payload.recipient_email_hash, fields.recipient_email_hash);
    assert.equal(payload.recipient_email_redacted, "j***@example.com");
  });
});

describe("R18D3A server entry guardrails", () => {
  test("server store imports server-only and createAdminClient", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryAttemptStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /createAdminClient/);
    assert.match(source, /findProposalDeliveryAttemptByIdempotencyKey/);
    assert.doesNotMatch(source, /from "resend"|from 'resend'/i);
    assert.doesNotMatch(source, /\/api\/proposals\/send/);
    assert.doesNotMatch(source, /\.from\("proposal_events"\)|\.from\('proposal_events'\)/);
    assert.doesNotMatch(source, /\.from\("proposals"\)[\s\S]*\.update/);
  });

  test("persistence module has no Resend, routes, or lifecycle mutation", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryAttemptPersistence.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /from "resend"|from 'resend'/i);
    assert.doesNotMatch(source, /\/api\/proposals\/send/);
    assert.doesNotMatch(source, /\.from\("proposal_events"\)|\.from\('proposal_events'\)/);
    assert.doesNotMatch(source, /\.from\("proposals"\)[\s\S]*\.update/);
    assert.doesNotMatch(source, /raw_token|token_hash/);
    assert.doesNotMatch(source, /import "server-only"/);
  });

  test("types module has no Resend or lifecycle helpers", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryAttemptTypes.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /from "resend"|from 'resend'/i);
    assert.doesNotMatch(source, /\.from\("proposal_events"\)|\.from\('proposal_events'\)/);
    assert.doesNotMatch(source, /\.from\("proposals"\)[\s\S]*\.update/);
  });
});
