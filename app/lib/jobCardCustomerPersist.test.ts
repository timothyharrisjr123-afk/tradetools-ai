import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  ensureJobCustomerPersisted,
  type EnsureJobCustomerPersistedDeps,
} from "./jobCardCustomerPersist";
import type { JobRecord } from "./jobTypes";

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";

function makeDeps(overrides: Partial<EnsureJobCustomerPersistedDeps> = {}): {
  deps: EnsureJobCustomerPersistedDeps;
  calls: { find: number; update: number; lastUpdatePatch?: { customer_id: string } };
} {
  const calls = { find: 0, update: 0, lastUpdatePatch: undefined as { customer_id: string } | undefined };
  const deps: EnsureJobCustomerPersistedDeps = {
    findOrCreateCustomer: async () => {
      calls.find += 1;
      return CUSTOMER_ID;
    },
    updateJob: async (_jobId, patch) => {
      calls.update += 1;
      calls.lastUpdatePatch = patch;
      return {
        id: JOB_ID,
        company_id: COMPANY_ID,
        customer_id: patch.customer_id,
        stage: "intake",
        status: "active",
        source: "intake",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      } satisfies JobRecord;
    },
    ...overrides,
  };
  return { deps, calls };
}

describe("ensureJobCustomerPersisted", () => {
  test("existing customer_id returns unchanged/no update", async () => {
    const { deps, calls } = makeDeps();
    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      existingCustomerId: CUSTOMER_ID,
      customerEmail: "test@example.com",
      deps,
    });

    assert.equal(result.reason, "unchanged");
    assert.equal(result.customerId, CUSTOMER_ID);
    assert.equal(result.updated, false);
    assert.equal(calls.find, 0);
    assert.equal(calls.update, 0);
  });

  test("insufficient customer identity returns safe no-op when email missing", async () => {
    const { deps, calls } = makeDeps();
    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerName: "Jane Doe",
      customerPhone: "555-0100",
      deps,
    });

    assert.equal(result.reason, "insufficient_customer_identity");
    assert.equal(result.customerId, null);
    assert.equal(result.updated, false);
    assert.equal(calls.find, 0);
    assert.equal(calls.update, 0);
  });

  test("valid customer fields call findOrCreateCustomer", async () => {
    const { deps, calls } = makeDeps();
    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerPhone: "555-0100",
      customerAddress: "123 Main St",
      deps,
    });

    assert.equal(calls.find, 1);
    assert.equal(result.reason, "persisted");
    assert.equal(result.customerId, CUSTOMER_ID);
    assert.equal(result.updated, true);
  });

  test("found/created customer id updates job.customer_id", async () => {
    const { deps, calls } = makeDeps();
    await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(calls.update, 1);
    assert.deepEqual(calls.lastUpdatePatch, { customer_id: CUSTOMER_ID });
  });

  test("matching existing customer id does not update job", async () => {
    const { deps, calls } = makeDeps({
      findOrCreateCustomer: async () => CUSTOMER_ID,
    });

    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      existingCustomerId: CUSTOMER_ID,
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(result.reason, "unchanged");
    assert.equal(calls.update, 0);
  });

  test("update failure returns safe failure", async () => {
    const { deps } = makeDeps({
      updateJob: async () => null,
    });

    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(result.reason, "update_failed");
    assert.equal(result.customerId, CUSTOMER_ID);
    assert.equal(result.updated, false);
  });

  test("invalid company/job returns safe no-op", async () => {
    const { deps, calls } = makeDeps();
    const result = await ensureJobCustomerPersisted({
      companyId: "",
      jobId: "not-a-uuid",
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(result.reason, "invalid_company_or_job");
    assert.equal(calls.find, 0);
    assert.equal(calls.update, 0);
  });

  test("customer lookup failure returns safe no-op", async () => {
    const calls = { find: 0, update: 0 };
    const deps: EnsureJobCustomerPersistedDeps = {
      findOrCreateCustomer: async () => {
        calls.find += 1;
        return null;
      },
      updateJob: async () => {
        calls.update += 1;
        return null;
      },
    };

    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(result.reason, "customer_lookup_failed");
    assert.equal(calls.update, 0);
    assert.equal(calls.find, 1);
  });

  test("helper does not decide board-origin; caller gating remains outside", async () => {
    const { deps, calls } = makeDeps();
    const result = await ensureJobCustomerPersisted({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      customerEmail: "jane@example.com",
      deps,
    });

    assert.equal(result.updated, true);
    assert.equal(calls.find, 1);
  });
});
