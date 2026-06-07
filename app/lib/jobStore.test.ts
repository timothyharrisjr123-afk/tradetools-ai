import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  jobDraftToInsertRow,
  rowToJobRecord,
  rowToJobSummary,
} from "./jobStore";
import type { JobDraft } from "./jobTypes";

const CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function packetDraft(): JobDraft {
  return {
    company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    job_name: "Jason 4 — roofing",
    stage: "intake",
    status: "active",
    source: "intake",
    priority: "normal",
    contact: {
      customer_name: "Jason 4",
      customer_email: "jason4@gmail.com",
      customer_phone: "+17777777777",
    },
    address: {
      line1: "7777 Jason St",
      city: "Tulsa",
      state: "OK",
      zip: "74011",
      country: "US",
      formatted: "7777 Jason St, Tulsa, OK 74011",
    },
    source_metadata: { source: "job_packet" },
    archived: false,
  };
}

describe("jobStore draft/row mapping", () => {
  test("full packet draft maps contact and address columns for insert", () => {
    const row = jobDraftToInsertRow(packetDraft());
    assert.equal(row.customer_name, "Jason 4");
    assert.equal(row.customer_email, "jason4@gmail.com");
    assert.equal(row.customer_phone, "+17777777777");
    assert.equal(row.address_line1, "7777 Jason St");
    assert.equal(row.address_city, "Tulsa");
    assert.match(String(row.address_formatted), /7777 Jason St/);
  });

  test("customer_id-only patch does not null out contact or address columns", () => {
    const row = jobDraftToInsertRow({ customer_id: CUSTOMER_ID });
    assert.equal(row.customer_id, CUSTOMER_ID);
    assert.equal("customer_name" in row, false);
    assert.equal("customer_email" in row, false);
    assert.equal("customer_phone" in row, false);
    assert.equal("address_line1" in row, false);
    assert.equal("job_name" in row, false);
    assert.equal("stage" in row, false);
  });

  test("rowToJobSummary preserves customer name/email/phone/address from row", () => {
    const record = rowToJobRecord({
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      job_name: "Jason 4 — roofing",
      stage: "intake",
      status: "active",
      source: "intake",
      priority: "normal",
      customer_name: "Jason 4",
      customer_email: "jason4@gmail.com",
      customer_phone: "+17777777777",
      address_line1: "7777 Jason St",
      address_city: "Tulsa",
      address_state: "OK",
      address_zip: "74011",
      address_country: "US",
      address_formatted: "7777 Jason St, Tulsa, OK 74011",
      created_at: "2026-06-07T12:00:00.000Z",
      updated_at: "2026-06-07T12:00:00.000Z",
    });

    assert.equal(record.contact?.customer_name, "Jason 4");
    assert.equal(record.contact?.customer_email, "jason4@gmail.com");
    assert.equal(record.contact?.customer_phone, "+17777777777");
    assert.match(String(record.address?.formatted), /7777 Jason St/);

    const summary = rowToJobSummary({
      id: record.id,
      company_id: record.company_id,
      job_name: record.job_name ?? null,
      stage: record.stage,
      status: record.status,
      source: record.source,
      priority: record.priority,
      customer_name: "Jason 4",
      customer_email: "jason4@gmail.com",
      customer_phone: "+17777777777",
      address_line1: "7777 Jason St",
      address_city: "Tulsa",
      address_state: "OK",
      address_zip: "74011",
      address_country: "US",
      address_formatted: "7777 Jason St, Tulsa, OK 74011",
      created_at: record.created_at,
      updated_at: record.updated_at,
    });

    assert.equal(summary.customer_name, "Jason 4");
    assert.equal(summary.customer_email, "jason4@gmail.com");
    assert.match(String(summary.address?.formatted), /7777 Jason St/);
  });
});
