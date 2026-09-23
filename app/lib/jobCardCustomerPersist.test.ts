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

function makeDeps(overrides: Partial<EnsureJobCustomerPersistedDeps> = {}): {
  deps: EnsureJobCustomerPersistedDeps;
  calls: { find: number; update: number };
} {
  const calls = { find: 0, update: 0 };
  const deps: EnsureJobCustomerPersistedDeps = {
    findOrCreateCustomer: async () => {
      calls.find += 1;
      return CUSTOMER_ID;
    },
    updateJob: async (_jobId, patch) => {
      calls.update += 1;
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

describe("ensureJobCustomerPersisted (Phase 6 no silent email collapse)", () => {
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

  test("missing customer_id does not call findOrCreate even with email", async () => {
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

    assert.equal(result.reason, "explicit_selection_required");
    assert.equal(result.customerId, null);
    assert.equal(result.updated, false);
    assert.equal(calls.find, 0);
    assert.equal(calls.update, 0);
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
});
