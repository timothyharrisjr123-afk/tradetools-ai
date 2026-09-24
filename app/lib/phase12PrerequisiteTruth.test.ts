import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { POST as batchStatusPost } from "../api/approval/batch-status/route";
import { mapDbJobToBoardEstimate, mapDbJobToEstimateStatus } from "@/app/lib/jobBoardAdapter";
import { JOB_ACTIVITY_EVENT_TYPES } from "@/app/lib/jobLifecycleTypes";
import { markPaymentRequestDeliveryAttemptProviderAcceptedWithClient } from "@/app/lib/jobPaymentRequestDeliveryPersistence";
import { reconcileUnresolvedEventsForProviderMessageIdWithClient } from "@/app/lib/proposalDeliveryWebhookPersistence";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

type Row = Record<string, unknown>;

/** Minimal in-memory PostgREST-shaped client for the delivery reconcile paths. */
function createFakeSupabase(tables: Record<string, Row[]>) {
  const updates: Array<{ table: string; patch: Row }> = [];
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let orderKey: string | null = null;
    let ascending = true;
    const matched = () => {
      const list = rows.filter((row) => filters.every((f) => f(row)));
      if (orderKey) {
        const key = orderKey;
        list.sort((a, b) =>
          String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)
        );
      }
      return list;
    };
    const run = () => {
      const list = matched();
      if (patch) {
        for (const row of list) Object.assign(row, patch);
        updates.push({ table, patch });
      }
      return list;
    };
    const builder = {
      select: () => builder,
      update: (next: Row) => {
        patch = next;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        orderKey = column;
        ascending = opts?.ascending ?? true;
        return builder;
      },
      maybeSingle: async () => {
        const list = run();
        return { data: list[0] ?? null, error: null };
      },
      single: async () => {
        const list = run();
        return list.length === 1
          ? { data: list[0], error: null }
          : { data: null, error: { message: `expected 1 row, got ${list.length}`, code: "PGRST116" } };
      },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: run(), error: null }).then(resolve),
    };
    return builder;
  }
  return { client: { from } as unknown as SupabaseClient, updates };
}

const PROVIDER_ID = "re_msg_phase12_early";
const T0 = "2026-09-24T10:00:00.000Z";

function seedEarlyEventWorld() {
  const tables: Record<string, Row[]> = {
    proposal_delivery_attempts: [],
    job_payment_request_delivery_attempts: [
      {
        id: "pay-attempt-1",
        company_id: "company-1",
        job_id: "job-1",
        payment_request_id: "pr-1",
        provider: "resend",
        recipient_email_hash: "hash",
        idempotency_key: "idem-1",
        attempt_number: 1,
        status: "attempted",
        subject_snapshot: "Payment request",
        body_snapshot: "Body",
        provider_message_id: null,
        metadata_json: {},
        created_at: T0,
        updated_at: T0,
        attempted_at: T0,
      },
    ],
    proposal_delivery_provider_events: [
      {
        id: "evt-delivered",
        provider: "resend",
        svix_id: "svix-1",
        provider_email_id: PROVIDER_ID,
        event_type: "email.delivered",
        provider_created_at: "2026-09-24T10:00:05.000Z",
        delivery_attempt_id: null,
        payment_request_delivery_attempt_id: null,
        company_id: null,
        apply_state: "unresolved",
        apply_detail: null,
        safe_metadata: {},
        created_at: "2026-09-24T10:00:06.000Z",
        updated_at: "2026-09-24T10:00:06.000Z",
        applied_at: null,
      },
    ],
  };
  return tables;
}

describe("Phase 12 Group A — payment email early-event reconciliation", () => {
  test("provider event first, payment attempt accepted later, resolves exactly once", async () => {
    const tables = seedEarlyEventWorld();
    const { client } = createFakeSupabase(tables);
    const event = tables.proposal_delivery_provider_events[0];
    const attempt = tables.job_payment_request_delivery_attempts[0];

    assert.equal(event.apply_state, "unresolved");
    assert.equal(
      await reconcileUnresolvedEventsForProviderMessageIdWithClient(client, PROVIDER_ID),
      0,
      "no attempt carries the provider id yet"
    );
    assert.equal(event.apply_state, "unresolved");

    await markPaymentRequestDeliveryAttemptProviderAcceptedWithClient(
      client,
      { company_id: "company-1", attempt_id: "pay-attempt-1", provider_message_id: PROVIDER_ID },
      () => new Date("2026-09-24T10:00:10.000Z")
    );

    assert.equal(event.apply_state, "applied");
    assert.equal(event.apply_detail, "payment_request_delivery_attempt");
    assert.equal(event.payment_request_delivery_attempt_id, "pay-attempt-1");
    assert.equal(event.delivery_attempt_id, null);
    assert.equal(event.company_id, "company-1");
    assert.equal(attempt.status, "delivered");
    assert.equal(attempt.delivered_at, "2026-09-24T10:00:05.000Z");

    const appliedAt = event.applied_at;
    assert.equal(
      await reconcileUnresolvedEventsForProviderMessageIdWithClient(client, PROVIDER_ID),
      0,
      "second reconcile finds nothing unresolved"
    );
    assert.equal(event.applied_at, appliedAt);
    assert.equal(attempt.status, "delivered");
  });

  test("proposal attempts still take precedence for the same provider id", async () => {
    const tables = seedEarlyEventWorld();
    tables.proposal_delivery_attempts.push({
      id: "prop-attempt-1",
      company_id: "company-1",
      provider: "resend",
      provider_message_id: PROVIDER_ID,
      status: "provider_accepted",
    });
    const { client } = createFakeSupabase(tables);
    await reconcileUnresolvedEventsForProviderMessageIdWithClient(client, PROVIDER_ID);
    assert.equal(
      tables.proposal_delivery_provider_events[0].payment_request_delivery_attempt_id,
      null
    );
    assert.equal(tables.job_payment_request_delivery_attempts[0].status, "attempted");
  });

  test("payment accept path and webhook share the single existing inbox mechanism", () => {
    const paymentPersistence = read("app/lib/jobPaymentRequestDeliveryPersistence.ts");
    const webhook = read("app/lib/proposalDeliveryWebhookProcess.server.ts");
    assert.match(paymentPersistence, /reconcileUnresolvedEventsForProviderMessageIdWithClient/);
    assert.match(webhook, /processProviderEventAgainstPaymentAttemptWithClient/);
    assert.doesNotMatch(webhook, /applyPaymentRequestDeliveryProviderStatusWithClient/);
  });
});

describe("Phase 12 Group A — Activity event-type DB/app parity", () => {
  const migrationsDir = join(ROOT, "supabase/migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  test("latest job_activity_events_type_check matches JOB_ACTIVITY_EVENT_TYPES exactly", () => {
    const defining = migrations.filter((name) =>
      /add constraint job_activity_events_type_check/i.test(read(`supabase/migrations/${name}`))
    );
    assert.ok(defining.length > 0);
    const latest = defining[defining.length - 1];
    const sql = read(`supabase/migrations/${latest}`);
    const body = sql.slice(sql.search(/add constraint job_activity_events_type_check/i));
    const dbValues = [...body.matchAll(/'([a-z_]+)'(?:::text)?/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(dbValues)].sort(), [...JOB_ACTIVITY_EVENT_TYPES].sort());
  });

  test("the legacy duplicate constraint is dropped and never re-added afterwards", () => {
    const dropIndex = migrations.findIndex((name) =>
      /drop constraint if exists job_activity_events_event_type_check/i.test(
        read(`supabase/migrations/${name}`)
      )
    );
    assert.ok(dropIndex >= 0);
    for (const name of migrations.slice(dropIndex + 1)) {
      assert.doesNotMatch(
        read(`supabase/migrations/${name}`),
        /add constraint job_activity_events_event_type_check/i,
        name
      );
    }
  });
});

describe("Phase 12 Group A — /api/approval/batch-status tombstone", () => {
  test("returns 410 and carries no KV approval authority", async () => {
    const response = await batchStatusPost();
    assert.equal(response.status, 410);
    const source = read("app/api/approval/batch-status/route.ts");
    assert.doesNotMatch(source, /getApprovalRecord|@vercel\/kv|kvStore|request\.json/);
  });

  test("no application source calls the retired route", () => {
    const board = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.doesNotMatch(board, /fetch\([^)]*\/api\/approval\/batch-status/);
  });
});

describe("Phase 12 Group A — legacy paid→Completed cannot drive canonical jobs", () => {
  const job = (stage: string, status = "active") =>
    ({
      id: "00000000-0000-4000-8000-000000000001",
      stage,
      status,
      completed_at: stage === "complete" ? T0 : null,
    }) as unknown as Parameters<typeof mapDbJobToEstimateStatus>[0];

  test("canonical 'paid' alias exists only for stage = complete", () => {
    for (const stage of ["intake", "proposal", "approved", "scheduled", "production"]) {
      assert.notEqual(mapDbJobToEstimateStatus(job(stage, "won")), "paid", stage);
      assert.notEqual(mapDbJobToEstimateStatus(job(stage)), "paid", stage);
    }
    assert.equal(mapDbJobToEstimateStatus(job("complete", "won")), "paid");
  });

  test("DB board rows carry canonical lane/stage so legacy status never decides Completed", () => {
    const row = mapDbJobToBoardEstimate(job("production", "won")) as unknown as Row;
    assert.equal(row.canonicalJobStage, "production");
    assert.notEqual(row.canonicalBoardLane, "paid");
    const utils = read("app/tools/roofing/saved/jobsBoardUtils.ts");
    assert.match(
      utils,
      /getBoardColumnKeyForJob[\s\S]*?canonicalBoardLane[\s\S]*?if \(canonical\) return canonical;/
    );
    assert.match(utils, /getBoardStageLabelForJob[\s\S]*?isDbBoardJobEntry\(job\)[\s\S]*?canonicalJobStage/);
  });
});
