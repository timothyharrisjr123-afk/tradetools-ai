/**
 * Core Flow 1 / Slice 1 (D) — New Job partial-failure retry must not create a second customer.
 * Run: npx tsx --test app/lib/packetIntakeCustomerRetry.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCustomer } from "./customerStore";
import {
  buildPacketCustomerFingerprint,
  buildPacketIntakeFingerprint,
  ensurePacketCreateOperation,
  markPacketCreateOperationComplete,
  PACKET_CREATE_OP_STORAGE_KEY,
} from "./packetIdentityEntry";

const COMPANY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_COMPANY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUST = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUST2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const JOB1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

function keys(...values: string[]) {
  const queue = [...values];
  return () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected key mint");
    return next;
  };
}

function newCustomerIntake(overrides: Partial<{ name: string; email: string; phone: string; address: string }> = {}) {
  const customerFingerprint = buildPacketCustomerFingerprint({
    companyId: COMPANY,
    name: overrides.name ?? "Dana  Reyes",
    email: overrides.email ?? "Dana@Example.com",
    phone: overrides.phone ?? "(555) 010-2000",
  });
  return {
    customerFingerprint,
    fingerprint: buildPacketIntakeFingerprint({
      customerFingerprint,
      addressLine: overrides.address ?? "12 Oak St, Denver, CO, 80202",
    }),
  };
}

/** Minimal customers-table fake: primary key on id, company scope on read (RLS). */
function fakeCustomersDb(opts: { visibleCompany: string }) {
  const rows = new Map<string, { id: string; company_id: string }>();
  let inserts = 0;
  let generated = 0;
  const supabase = {
    from(table: string) {
      assert.equal(table, "customers");
      return {
        insert(row: { id?: string; company_id: string }) {
          return {
            select() {
              return {
                async single() {
                  inserts += 1;
                  const id = row.id ?? `00000000-0000-4000-8000-${String(++generated).padStart(12, "0")}`;
                  if (rows.has(id)) {
                    return { data: null, error: { code: "23505", message: "duplicate key" } };
                  }
                  rows.set(id, { id, company_id: row.company_id });
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
        select() {
          const filters: Record<string, string> = {};
          const chain = {
            eq(col: string, value: string) {
              filters[col] = value;
              return chain;
            },
            async maybeSingle() {
              const row = rows.get(filters.id);
              const visible =
                row && row.company_id === filters.company_id && row.company_id === opts.visibleCompany;
              return { data: visible ? { id: row.id } : null, error: null };
            },
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  return {
    supabase,
    rows,
    get inserts() {
      return inserts;
    },
  };
}

describe("packet intake fingerprint is computed before any write", () => {
  test("new customer fingerprint normalizes name, email and phone", () => {
    const a = buildPacketCustomerFingerprint({
      companyId: COMPANY,
      name: "Dana  Reyes",
      email: "Dana@Example.com",
      phone: "(555) 010-2000",
    });
    const b = buildPacketCustomerFingerprint({
      companyId: COMPANY,
      name: "dana reyes",
      email: " dana@example.com ",
      phone: "555-010-2000",
    });
    assert.equal(a, b);
  });

  test("selected existing customer fingerprint is keyed by id", () => {
    const fp = buildPacketCustomerFingerprint({ companyId: COMPANY, selectedCustomerId: CUST, name: "Anyone" });
    assert.equal(fp, `${COMPANY}|existing|${CUST}`);
  });

  test("fingerprints are tenant-scoped", () => {
    const a = buildPacketCustomerFingerprint({ companyId: COMPANY, name: "Dana" });
    const b = buildPacketCustomerFingerprint({ companyId: OTHER_COMPANY, name: "Dana" });
    assert.notEqual(a, b);
  });
});

describe("pre-generated customer id survives partial failure", () => {
  test("retry after property/job failure reuses the same customer id and op key", () => {
    const storage = memoryStorage();
    const intake = newCustomerIntake();
    const first = ensurePacketCreateOperation(intake.fingerprint, storage, 1, keys(OP, CUST), {
      newCustomerFingerprint: intake.customerFingerprint,
    });
    assert.equal(first.operationKey, OP);
    assert.equal(first.customerId, CUST);
    assert.equal(first.existingJobId, null);
    const stored = JSON.parse(storage.getItem(PACKET_CREATE_OP_STORAGE_KEY)!);
    assert.equal(stored.customerId, CUST);

    const retry = ensurePacketCreateOperation(intake.fingerprint, storage, 2, keys(), {
      newCustomerFingerprint: intake.customerFingerprint,
    });
    assert.equal(retry.operationKey, OP);
    assert.equal(retry.customerId, CUST);
  });

  test("fixing the address keeps the customer id (no second customer)", () => {
    const storage = memoryStorage();
    const before = newCustomerIntake({ address: "12 Oak" });
    ensurePacketCreateOperation(before.fingerprint, storage, 1, keys(OP, CUST), {
      newCustomerFingerprint: before.customerFingerprint,
    });
    const after = newCustomerIntake({ address: "12 Oak St, Denver, CO, 80202" });
    const NEW_OP = "11111111-1111-4111-8111-111111111111";
    const next = ensurePacketCreateOperation(after.fingerprint, storage, 2, keys(NEW_OP), {
      newCustomerFingerprint: after.customerFingerprint,
    });
    assert.equal(next.operationKey, NEW_OP);
    assert.equal(next.customerId, CUST);
  });

  test("a different customer gets a different id", () => {
    const storage = memoryStorage();
    const a = newCustomerIntake({ name: "Dana Reyes" });
    ensurePacketCreateOperation(a.fingerprint, storage, 1, keys(OP, CUST), {
      newCustomerFingerprint: a.customerFingerprint,
    });
    const b = newCustomerIntake({ name: "Sam Ortiz" });
    const NEW_OP = "11111111-1111-4111-8111-111111111111";
    const next = ensurePacketCreateOperation(b.fingerprint, storage, 2, keys(NEW_OP, CUST2), {
      newCustomerFingerprint: b.customerFingerprint,
    });
    assert.equal(next.customerId, CUST2);
  });

  test("selected existing customer never mints a customer id", () => {
    const storage = memoryStorage();
    const customerFingerprint = buildPacketCustomerFingerprint({ companyId: COMPANY, selectedCustomerId: CUST });
    const fp = buildPacketIntakeFingerprint({ customerFingerprint, addressLine: "12 Oak" });
    const op = ensurePacketCreateOperation(fp, storage, 1, keys(OP), { newCustomerFingerprint: null });
    assert.equal(op.customerId, null);
  });

  test("completion keeps the replay path to the same job", () => {
    const storage = memoryStorage();
    const intake = newCustomerIntake();
    ensurePacketCreateOperation(intake.fingerprint, storage, 1, keys(OP, CUST), {
      newCustomerFingerprint: intake.customerFingerprint,
    });
    markPacketCreateOperationComplete(intake.fingerprint, OP, JOB1, storage, 2);
    const replay = ensurePacketCreateOperation(intake.fingerprint, storage, 3, keys(), {
      newCustomerFingerprint: intake.customerFingerprint,
    });
    assert.equal(replay.existingJobId, JOB1);
  });
});

describe("createCustomer with a pre-generated id", () => {
  test("lost response then retry reuses the committed row (one customer)", async () => {
    const db = fakeCustomersDb({ visibleCompany: COMPANY });
    const first = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana", id: CUST });
    assert.equal(first, CUST);
    // Client lost the response / later step failed → user presses Continue again.
    const retry = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana", id: CUST });
    assert.equal(retry, CUST);
    assert.equal(db.rows.size, 1);
  });

  test("conflict with a row the company cannot see fails instead of linking it", async () => {
    const db = fakeCustomersDb({ visibleCompany: COMPANY });
    db.rows.set(CUST, { id: CUST, company_id: OTHER_COMPANY });
    const result = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana", id: CUST });
    assert.equal(result, null);
    assert.equal(db.rows.get(CUST)?.company_id, OTHER_COMPANY);
  });

  test("malformed id is refused without writing", async () => {
    const db = fakeCustomersDb({ visibleCompany: COMPANY });
    const result = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana", id: "not-a-uuid" });
    assert.equal(result, null);
    assert.equal(db.inserts, 0);
  });

  test("without an id it still always creates a new row", async () => {
    const db = fakeCustomersDb({ visibleCompany: COMPANY });
    const a = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana" });
    const b = await createCustomer({ supabase: db.supabase, companyId: COMPANY, name: "Dana" });
    assert.ok(a && b && a !== b);
    assert.equal(db.rows.size, 2);
  });
});

describe("RoofingClient intake order", () => {
  test("operation + customer id are resolved before createCustomer and createJob", () => {
    const src = readFileSync(join(process.cwd(), "app/tools/roofing/RoofingClient.tsx"), "utf8");
    const handler = src.slice(src.indexOf("const handleContinueToJobCard = useCallback"));
    const ensureIdx = handler.indexOf("ensurePacketCreateOperation(");
    const customerIdx = handler.indexOf("await createCustomer(");
    const jobIdx = handler.indexOf("await createJob(draft)");
    assert.ok(ensureIdx > 0, "ensure op in handler");
    assert.ok(customerIdx > ensureIdx, "customer created after op is ensured");
    assert.ok(jobIdx > customerIdx, "job created after customer");
    assert.match(handler.slice(customerIdx, jobIdx), /id: plannedCustomerId/);
  });
});
