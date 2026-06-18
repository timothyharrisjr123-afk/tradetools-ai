import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  mapCustomerToProposalContextEcho,
  loadProposalCustomerContextFromDatabase,
} from "./proposalCustomerContext";

describe("mapCustomerToProposalContextEcho", () => {
  test("maps name, email, phone, and address from customers row", () => {
    const echo = mapCustomerToProposalContextEcho({
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "918-555-0200",
      address: "99 Mailing Ln",
    });

    assert.equal(echo.customer_name, "Jane Smith");
    assert.equal(echo.customer_email, "jane@example.com");
    assert.equal(echo.customer_phone, "918-555-0200");
    assert.equal(echo.customer_address, "99 Mailing Ln");
  });

  test("trims whitespace and normalizes empty strings to null", () => {
    const echo = mapCustomerToProposalContextEcho({
      name: "  ",
      email: "  jane@example.com  ",
      phone: "",
      address: "   ",
    });

    assert.equal(echo.customer_name, null);
    assert.equal(echo.customer_email, "jane@example.com");
    assert.equal(echo.customer_phone, null);
    assert.equal(echo.customer_address, null);
  });

  test("tolerates null/undefined row", () => {
    assert.deepEqual(mapCustomerToProposalContextEcho(null), {
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      customer_address: null,
    });
    assert.deepEqual(mapCustomerToProposalContextEcho(undefined), {
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      customer_address: null,
    });
  });

  test("output excludes company, job, pricing, and template fields", () => {
    const echo = mapCustomerToProposalContextEcho({ name: "Jane" });
    const keys = Object.keys(echo);
    for (const forbidden of [
      "customer_id",
      "address_formatted",
      "company_name",
      "template_id",
      "unit_cost",
    ]) {
      assert.ok(!keys.includes(forbidden), `forbidden key: ${forbidden}`);
    }
  });
});

describe("loadProposalCustomerContextFromDatabase", () => {
  const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";

  test("loads customer row scoped by company_id", async () => {
    const supabase = {
      from(table: string) {
        assert.equal(table, "customers");
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === "id") assert.equal(value, CUSTOMER_ID);
            if (column === "company_id") assert.equal(value, COMPANY_ID);
            return this;
          },
          maybeSingle: async () => ({
            data: {
              name: "Jane Smith",
              email: "jane@example.com",
              phone: "918-555-0200",
              address: "99 Mailing Ln",
            },
            error: null,
          }),
        };
      },
    };

    const result = await loadProposalCustomerContextFromDatabase(
      COMPANY_ID,
      CUSTOMER_ID,
      supabase as never
    );

    assert.equal(result.customer_name, "Jane Smith");
    assert.equal(result.customer_email, "jane@example.com");
    assert.equal(result.customer_phone, "918-555-0200");
    assert.equal(result.customer_address, "99 Mailing Ln");
  });

  test("fail-soft null slice when row missing or read error", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: { message: "not found" } }),
        };
      },
    };

    const result = await loadProposalCustomerContextFromDatabase(
      COMPANY_ID,
      CUSTOMER_ID,
      supabase as never
    );

    assert.deepEqual(result, {
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      customer_address: null,
    });
  });

  test("returns null slice for invalid customer id without querying", async () => {
    let queried = false;
    const supabase = {
      from() {
        queried = true;
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
      },
    };

    const result = await loadProposalCustomerContextFromDatabase(
      COMPANY_ID,
      "not-a-uuid",
      supabase as never
    );

    assert.equal(queried, false);
    assert.equal(result.customer_name, null);
  });
});
