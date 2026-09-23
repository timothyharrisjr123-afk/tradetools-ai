/**
 * Phase 6 final — durable packet create idempotency (lost-response).
 * Run: npx tsx --test app/lib/packetCreateIdempotency.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildPacketCreateFingerprint,
  createJobWithIdempotency,
  ensurePacketCreateOperation,
  markPacketCreateOperationComplete,
  PACKET_CREATE_OP_STORAGE_KEY,
  readCreateIdempotencyKeyFromMetadata,
  withJobCreateIdempotencyMetadata,
} from "./packetIdentityEntry";

const OP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPANY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function memoryStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    raw: map,
  };
}

describe("packet create durable idempotency", () => {
  test("operation key is written to storage before any job id exists", () => {
    const storage = memoryStorage();
    const fingerprint = buildPacketCreateFingerprint({
      companyId: COMPANY,
      customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      addressLine: "123 Main",
    });
    const first = ensurePacketCreateOperation(fingerprint, storage, 1_000, () => OP);
    assert.equal(first.existingJobId, null);
    assert.equal(first.operationKey, OP);
    const stored = JSON.parse(storage.getItem(PACKET_CREATE_OP_STORAGE_KEY)!);
    assert.equal(stored.operationKey, OP);
    assert.equal(stored.jobId, null);

    // Lost response: retry reuses same operation key (no second UUID).
    const second = ensurePacketCreateOperation(fingerprint, storage, 2_000, () => {
      throw new Error("must not mint a second key");
    });
    assert.equal(second.operationKey, OP);
    assert.equal(second.existingJobId, null);
  });

  test("lost-response createJobWithIdempotency returns the same durable job", async () => {
    let inserts = 0;
    const rows = new Map<string, { id: string }>();

    const findExisting = async (_companyId: string, key: string) =>
      rows.get(key) ?? null;

    const insertOnce = async () => {
      inserts += 1;
      if (inserts === 1) {
        rows.set(OP, { id: JOB1 });
        return { ok: true as const, record: { id: JOB1 } };
      }
      // Simulate unique violation if a second insert is attempted.
      return { ok: false as const, uniqueViolation: true };
    };

    // Request 1: server commits, client "loses" response (caller discards).
    const committed = await createJobWithIdempotency({
      companyId: COMPANY,
      createIdempotencyKey: OP,
      findExisting,
      insert: insertOnce,
    });
    assert.equal(committed?.id, JOB1);
    assert.equal(inserts, 1);

    // Request 2: same key — findExisting returns committed job; no second insert.
    const retried = await createJobWithIdempotency({
      companyId: COMPANY,
      createIdempotencyKey: OP,
      findExisting,
      insert: insertOnce,
    });
    assert.equal(retried?.id, JOB1);
    assert.equal(inserts, 1);
  });

  test("concurrent unique-violation path re-fetches the winning row", async () => {
    const rows = new Map<string, { id: string }>([[OP, { id: JOB1 }]]);
    let inserts = 0;
    const record = await createJobWithIdempotency({
      companyId: COMPANY,
      createIdempotencyKey: OP,
      findExisting: async (_c, key) => rows.get(key) ?? null,
      insert: async () => {
        inserts += 1;
        return { ok: false as const, uniqueViolation: true };
      },
    });
    // First find returns existing before insert when key already present.
    assert.equal(record?.id, JOB1);
    assert.equal(inserts, 0);

    // Empty find then unique violation then re-find:
    const race = await createJobWithIdempotency({
      companyId: COMPANY,
      createIdempotencyKey: OP,
      findExisting: async () => {
        // First call empty, second (after conflict) returns winner.
        if (inserts === 0) return null;
        return { id: JOB1 };
      },
      insert: async () => {
        inserts += 1;
        return { ok: false as const, uniqueViolation: true };
      },
    });
    assert.equal(race?.id, JOB1);
    assert.equal(inserts, 1);
  });

  test("metadata helpers round-trip create_idempotency_key", () => {
    const meta = withJobCreateIdempotencyMetadata({ source: "job_packet" }, OP);
    assert.equal(meta.source, "job_packet");
    assert.equal(readCreateIdempotencyKeyFromMetadata(meta), OP);
  });

  test("mark complete lets refresh navigate to existing job id", () => {
    const storage = memoryStorage();
    const fingerprint = "fp-1";
    ensurePacketCreateOperation(fingerprint, storage, 1, () => OP);
    markPacketCreateOperationComplete(fingerprint, OP, JOB1, storage, 2);
    const again = ensurePacketCreateOperation(fingerprint, storage, 3, () => {
      throw new Error("no new key");
    });
    assert.equal(again.existingJobId, JOB1);
    assert.equal(again.operationKey, OP);
  });

  test("jobStore createJob uses durable idempotency orchestration", () => {
    const src = read("app/lib/jobStore.ts");
    assert.match(src, /createJobWithIdempotency/);
    assert.match(src, /create_idempotency_key/);
    assert.match(src, /23505/);
  });

  test("RoofingClient writes operation key before createJob", () => {
    const src = read("app/tools/roofing/RoofingClient.tsx");
    const ensureIdx = src.indexOf("ensurePacketCreateOperation");
    const createIdx = src.indexOf("await createJob(draft)");
    assert.ok(ensureIdx > 0 && createIdx > ensureIdx);
    assert.match(src, /withJobCreateIdempotencyMetadata/);
    assert.doesNotMatch(src, /fielddive\.packetCreateDedup/);
  });

  test("migration unique index ships for company+create_idempotency_key", () => {
    const sql = read(
      "supabase/migrations/20260923180000_jobs_packet_create_idempotency.sql"
    );
    assert.match(sql, /idx_jobs_company_create_idempotency_key/);
    assert.match(sql, /create_idempotency_key/);
    assert.match(sql, /unique index/i);
  });
});
