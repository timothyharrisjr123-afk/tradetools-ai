/**
 * Phase 6 Group 1+2 — packet identity entry + intake title + non-copy.
 * Run: npx tsx --test app/lib/packetIdentityEntry.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  assertPacketJobDraftIdentityOnly,
  buildPacketEntryHref,
  parsePacketIdentitySearchParams,
  resolvePacketIntakeTitle,
  PACKET_FIRST_JOB_TITLE,
  PACKET_REPEAT_JOB_TITLE,
} from "./packetIdentityEntry";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const C = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";

describe("packetIdentityEntry", () => {
  test("buildPacketEntryHref carries customer and property", () => {
    assert.equal(
      buildPacketEntryHref({ customerId: C, propertyId: P }),
      `/tools/roofing?entry=packet&customer=${C}&property=${P}`
    );
  });

  test("anotherProperty drops property id and sets flag", () => {
    assert.equal(
      buildPacketEntryHref({ customerId: C, propertyId: P, anotherProperty: true }),
      `/tools/roofing?entry=packet&customer=${C}&anotherProperty=1`
    );
  });

  test("parse rejects non-uuid and honors anotherProperty", () => {
    const parsed = parsePacketIdentitySearchParams(
      new URLSearchParams("customer=not-uuid&property=" + P + "&anotherProperty=1")
    );
    assert.equal(parsed.customerId, null);
    assert.equal(parsed.propertyId, null);
    assert.equal(parsed.anotherProperty, true);
  });

  test("intake title is always New job (Phase 12.5); first-job wording stays a CTA", () => {
    assert.equal(resolvePacketIntakeTitle({}), PACKET_REPEAT_JOB_TITLE);
    assert.equal(PACKET_FIRST_JOB_TITLE, "Start my first job");
    assert.equal(
      resolvePacketIntakeTitle({ hasSelectedCustomer: true }),
      PACKET_REPEAT_JOB_TITLE
    );
    assert.equal(
      resolvePacketIntakeTitle({ anotherProperty: true }),
      PACKET_REPEAT_JOB_TITLE
    );
  });

  test("non-copy guard rejects leaked commercial/ops fields", () => {
    const ok = assertPacketJobDraftIdentityOnly({
      customer_id: C,
      property_id: P,
      stage: "intake",
    });
    assert.equal(ok.ok, true);
    const bad = assertPacketJobDraftIdentityOnly({
      customer_id: C,
      selected_measurement_id: "m1",
      active_proposal_id: "p1",
      latest_estimate_id: "e1",
    });
    assert.equal(bad.ok, false);
  });

  test("customer workspace exposes New job packet entry", () => {
    const src = read("app/tools/roofing/customers/[customerId]/CustomerWorkspaceClient.tsx");
    assert.match(src, /buildPacketEntryHref/);
    assert.match(src, /customer-new-job/);
  });

  test("property workspace exposes New job here packet entry", () => {
    const src = read("app/tools/roofing/properties/[propertyId]/PropertyWorkspaceClient.tsx");
    assert.match(src, /property-new-job-here/);
  });

  test("Another property lives on property summary, not customer summary", () => {
    const src = read("app/tools/roofing/RoofingClient.tsx");
    const cust = src.indexOf('kind="customer"');
    const prop = src.indexOf('kind="property"');
    assert.equal(src.slice(cust, cust + 550).includes("Another property"), false);
    assert.equal(src.slice(prop, prop + 650).includes("Another property"), true);
  });

  test("packet title uses resolvePacketIntakeTitle", () => {
    const src = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(src, /resolvePacketIntakeTitle/);
    assert.match(src, /packet-intake-title/);
  });

  test("packet createJob draft omits measurement/proposal copies", () => {
    const src = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(src, /buildJobDraftFromPacketState/);
    assert.match(src, /source_metadata: \{ source: "job_packet" \}/);
  });

  test("createJob path uses durable idempotency before network create", () => {
    const src = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(src, /if \(isCreatingJob\) return/);
    assert.match(src, /setIsCreatingJob\(true\)/);
    assert.match(src, /ensurePacketCreateOperation/);
    assert.match(src, /withJobCreateIdempotencyMetadata/);
    assert.match(src, /router\.replace\(/);
    assert.doesNotMatch(src, /fielddive\.packetCreateDedup/);
  });

  test("estimateStore no longer findOrCreates customers", () => {
    const src = read("app/lib/estimateStore.ts");
    assert.doesNotMatch(src, /findOrCreateCustomer/);
  });

  test("Job Card persist no longer silently findOrCreates", () => {
    const src = read("app/lib/jobCardCustomerPersist.ts");
    assert.match(src, /explicit_selection_required/);
  });
});
