/**
 * Phase 6 — exact duplicate-email failure mode for legacy findOrCreateCustomer.
 * Run: npx tsx --test app/lib/customerStoreDuplicateEmail.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  findOrCreateCustomerDetailed,
  type FindOrCreateCustomerOutcome,
} from "./customerStore";

const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_NEW = "33333333-3333-4333-8333-333333333333";

function mockSupabase(opts: {
  selectRows?: { id: string }[];
  selectError?: { message: string } | null;
  insertId?: string | null;
  insertError?: { message: string } | null;
}) {
  const calls = { select: 0, insert: 0 };
  const supabase = {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              return {
                ilike(_col2: string, _email: string) {
                  return {
                    async limit(_n: number) {
                      calls.select += 1;
                      if (opts.selectError) {
                        return { data: null, error: opts.selectError };
                      }
                      return { data: opts.selectRows ?? [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
        insert(_row: unknown) {
          return {
            select(_cols: string) {
              return {
                async single() {
                  calls.insert += 1;
                  if (opts.insertError) {
                    return { data: null, error: opts.insertError };
                  }
                  if (!opts.insertId) return { data: null, error: { message: "no id" } };
                  return { data: { id: opts.insertId }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { supabase: supabase as any, calls };
}

describe("findOrCreateCustomerDetailed duplicate-email failure mode", () => {
  test("empty email → skipped null (no query)", async () => {
    const { supabase, calls } = mockSupabase({});
    const outcome = await findOrCreateCustomerDetailed({
      supabase,
      companyId: COMPANY,
      name: "A",
      email: "   ",
    });
    assert.deepEqual(outcome, {
      status: "skipped",
      customerId: null,
      reason: "empty_email",
    } satisfies FindOrCreateCustomerOutcome);
    assert.equal(calls.select, 0);
    assert.equal(calls.insert, 0);
  });

  test("0 matches → createCustomer (created)", async () => {
    const { supabase, calls } = mockSupabase({ selectRows: [], insertId: ID_NEW });
    const outcome = await findOrCreateCustomerDetailed({
      supabase,
      companyId: COMPANY,
      name: "New Person",
      email: "new@example.com",
    });
    assert.equal(outcome.status, "created");
    assert.equal(outcome.customerId, ID_NEW);
    assert.equal(calls.select, 1);
    assert.equal(calls.insert, 1);
  });

  test("exactly 1 match → found (legacy silent email collapse)", async () => {
    const { supabase, calls } = mockSupabase({ selectRows: [{ id: ID_A }] });
    const outcome = await findOrCreateCustomerDetailed({
      supabase,
      companyId: COMPANY,
      name: "Other Name",
      email: "dup@example.com",
    });
    assert.equal(outcome.status, "found");
    assert.equal(outcome.customerId, ID_A);
    assert.equal(calls.insert, 0);
  });

  test("2+ matches → ambiguous null (no create, no wrong attach)", async () => {
    const { supabase, calls } = mockSupabase({
      selectRows: [{ id: ID_A }, { id: ID_B }],
    });
    const outcome = await findOrCreateCustomerDetailed({
      supabase,
      companyId: COMPANY,
      name: "Ambiguous",
      email: "dup@example.com",
    });
    assert.equal(outcome.status, "ambiguous");
    assert.equal(outcome.customerId, null);
    assert.equal(calls.insert, 0);
  });

  test("select error → skipped null", async () => {
    const { supabase, calls } = mockSupabase({
      selectError: { message: "boom" },
    });
    const outcome = await findOrCreateCustomerDetailed({
      supabase,
      companyId: COMPANY,
      name: "X",
      email: "x@example.com",
    });
    assert.equal(outcome.status, "skipped");
    assert.equal(outcome.customerId, null);
    assert.equal(calls.insert, 0);
  });
});
