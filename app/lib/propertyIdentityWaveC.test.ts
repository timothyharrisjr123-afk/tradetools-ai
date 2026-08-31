/**
 * Wave C — Property identity, security, search, workspaces.
 * Run: npx tsx --test app/lib/propertyIdentityWaveC.test.ts app/lib/workspaceSearch.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildCustomerWorkspaceHref,
  buildPropertyWorkspaceHref,
  normalizePropertyAddress,
  propertyAddressIsMatchable,
} from "./propertyAddressNormalize";
import { jobDraftToInsertRow } from "./jobStore";
import {
  groupWorkspaceSearchResults,
  mapWorkspaceSearchRowToResult,
  parseWorkspaceSearchApiPayload,
  workspaceSearchQueryIsActive,
} from "./workspaceSearch";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_063 = join(MIGRATIONS, "20260830_063_search_company_customers.sql");
const SQL_064 = join(MIGRATIONS, "20260830_064_properties_and_typed_search.sql");
const SHA_063 = "46C91BE779739EAC8340B2D6479A3596A2653873C85D67B3F50838A810B3C8B9";

describe("Wave C — historical files stay locked", () => {
  test("063 SHA unchanged; 064 is additive Property + typed search", () => {
    assert.equal(existsSync(SQL_063), true);
    assert.equal(existsSync(SQL_064), true);
    assert.equal(sha(SQL_063), SHA_063);
    const sql = readFileSync(SQL_064, "utf8");
    assert.match(sql, /create table if not exists public\.properties/);
    assert.match(sql, /add column if not exists property_id/);
    assert.match(sql, /search_company_workspace_v1/);
    assert.match(sql, /search_company_properties_v1/);
    assert.doesNotMatch(sql, /security definer/i);
    assert.doesNotMatch(sql, /create table public\.leads/i);
  });
});

describe("Wave C — Property security contract", () => {
  const sql = readFileSync(SQL_064, "utf8");

  test("RLS membership scoped; anon denied; company_id immutable", () => {
    assert.match(sql, /alter table public\.properties enable row level security/);
    assert.match(sql, /properties_select_company_scope/);
    assert.match(sql, /properties_insert_company_scope/);
    assert.match(sql, /properties_update_company_scope/);
    assert.match(sql, /from public\.company_memberships/);
    assert.match(sql, /properties_prevent_company_id_change/);
    assert.match(sql, /properties\.company_id is immutable/);
    assert.match(sql, /revoke all on table public\.properties from public/);
    assert.match(sql, /revoke all on table public\.properties from anon/);
    assert.match(sql, /grant select, insert, update, delete on table public\.properties to authenticated/);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  });

  test("search RPCs are SECURITY INVOKER and tenant scoped", () => {
    assert.match(sql, /security invoker/);
    assert.match(sql, /auth\.uid\(\) is not null/);
    assert.match(sql, /revoke all on function public\.search_company_workspace_v1\(text\) from anon/);
    assert.match(sql, /revoke all on function public\.search_company_properties_v1\(text\) from anon/);
    assert.match(sql, /grant execute on function public\.search_company_workspace_v1\(text\) to authenticated/);
    assert.doesNotMatch(sql, /p_company_id/);
  });
});

describe("Wave C — Property identity", () => {
  test("normalizes street suffixes without treating format as guaranteed identity alone", () => {
    const a = normalizePropertyAddress({
      line1: "123 N Main St",
      city: "Broken Arrow",
      state: "OK",
      zip: "74012",
    });
    const b = normalizePropertyAddress({
      line1: "123 North Main Street",
      city: "Broken Arrow",
      state: "OK",
      zip: "74012",
    });
    assert.equal(a, b);
    assert.match(a, /123 north main street\|/);
  });

  test("ZIP-only and letter-less values are not matchable Properties", () => {
    assert.equal(propertyAddressIsMatchable({ line1: "74120", zip: "74120" }), false);
    assert.equal(propertyAddressIsMatchable({ line1: "Tulsa", city: "Tulsa" }), false);
    assert.equal(
      propertyAddressIsMatchable({
        line1: "123 Main St",
        city: "Tulsa",
        state: "OK",
        zip: "74120",
      }),
      true
    );
  });

  test("create-new is explicit — store never findOrCreate collapses", () => {
    const store = read("app/lib/propertyStore.ts");
    assert.match(store, /createPropertyExplicit/);
    assert.doesNotMatch(store, /findOrCreateProperty/);
    assert.match(store, /Always insert/);
    const intake = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(intake, /createPropertyExplicit/);
    assert.match(intake, /selectedPropertyId/);
    assert.match(intake, /JobPacketPropertyCandidates/);
    const searchApi = read("app/api/properties/search/route.ts");
    assert.match(searchApi, /findPropertiesByNormalizedKey/);
    assert.match(searchApi, /exact normalized key only/);
    assert.doesNotMatch(searchApi, /search_company_properties_v1/);
  });

  test("jobs.property_id is persisted without deleting job address columns", () => {
    const row = jobDraftToInsertRow({
      company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      property_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      address: {
        line1: "123 Main St",
        city: "Tulsa",
        state: "OK",
        zip: "74120",
      },
    });
    assert.equal(row.property_id, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(row.address_line1, "123 Main St");
    const types = read("app/lib/jobTypes.ts");
    assert.match(types, /property_id\?: string \| null/);
  });
});

describe("Wave C — typed search contract", () => {
  test("maps job, customer, and property rows to typed navigation", () => {
    const job = mapWorkspaceSearchRowToResult({
      entity_type: "job",
      id: "11111111-1111-4111-8111-111111111111",
      primary_label: "Smith Roof",
      secondary_label: "123 Main",
      job_stage: "scheduled",
    });
    const customer = mapWorkspaceSearchRowToResult({
      entity_type: "customer",
      id: "22222222-2222-4222-8222-222222222222",
      primary_label: "Jane Smith",
      secondary_label: "jane@example.com",
    });
    const property = mapWorkspaceSearchRowToResult({
      entity_type: "property",
      id: "33333333-3333-4333-8333-333333333333",
      primary_label: "123 N Main St",
      secondary_label: "Broken Arrow, OK",
    });
    assert.equal(job?.type, "job");
    assert.equal(job?.href.includes("job="), true);
    assert.equal(customer?.href, buildCustomerWorkspaceHref(customer!.id));
    assert.equal(property?.href, buildPropertyWorkspaceHref(property!.id));
    const grouped = groupWorkspaceSearchResults([job!, customer!, property!]);
    assert.equal(grouped.jobs.length, 1);
    assert.equal(grouped.customers.length, 1);
    assert.equal(grouped.properties.length, 1);
  });

  test("empty query is inactive; payload parser is fail-closed", () => {
    assert.equal(workspaceSearchQueryIsActive(""), false);
    assert.equal(workspaceSearchQueryIsActive("a"), false);
    assert.equal(workspaceSearchQueryIsActive("12"), true);
    assert.deepEqual(parseWorkspaceSearchApiPayload({ ok: true, results: [{ id: "x" }] }), []);
    assert.deepEqual(parseWorkspaceSearchApiPayload(null), []);
  });

  test("Board search uses typed workspace API not three boxes", () => {
    const hook = read("app/tools/roofing/saved/useWorkspaceSearch.ts");
    assert.match(hook, /\/api\/search\?q=/);
    const ui = read("app/tools/roofing/saved/components/JobsBoardSearchResults.tsx");
    assert.match(ui, /Customers/);
    assert.match(ui, /Properties/);
    assert.doesNotMatch(ui, /suggested customers/i);
    assert.doesNotMatch(ui, /KPI/);
  });
});

describe("Wave C — workspaces and frozen truth", () => {
  test("Customer workspace is read-first with on-demand edit", () => {
    const page = read("app/tools/roofing/customers/[customerId]/CustomerWorkspaceClient.tsx");
    const shell = read("app/tools/roofing/workspace/FieldDiveWorkspaceShell.tsx");
    assert.match(page, /Edit customer/);
    assert.match(page, /customer-edit-action/);
    assert.match(page, /customer-edit-form/);
    assert.match(page, /Cancel/);
    assert.match(page, /WorkspaceSection title="Jobs"/);
    assert.match(page, /WorkspaceSection title="Properties"/);
    assert.match(shell, /Back to Jobs/);
    assert.doesNotMatch(page, /Live identity/);
    assert.doesNotMatch(page, /Job snapshots/);
    assert.doesNotMatch(page, /canonical/);
    assert.doesNotMatch(page, /lead stage/i);
    assert.doesNotMatch(page, /revenue/i);
    assert.doesNotMatch(page, /coming soon/i);
  });

  test("Property workspace is place + job history without ownership claims", () => {
    const page = read("app/tools/roofing/properties/[propertyId]/PropertyWorkspaceClient.tsx");
    assert.match(page, /WorkspaceSection title="Customers"/);
    assert.match(page, /WorkspaceSection title="Jobs"/);
    assert.doesNotMatch(page, /Seen with/i);
    assert.doesNotMatch(page, /Place identity/);
    assert.doesNotMatch(page, /owner/i);
    assert.doesNotMatch(page, /homeowner/i);
    assert.doesNotMatch(page, /job_attachments/);
    assert.doesNotMatch(page, /satellite/i);
    assert.doesNotMatch(page, /coming soon/i);
  });

  test("intake property matching microcopy stays compact and non-blocking", () => {
    const intake = read("app/tools/roofing/JobPacketPropertyCandidates.tsx");
    assert.match(intake, /Matching property/);
    assert.match(intake, />Use</);
    assert.match(intake, /Create new property/);
    assert.doesNotMatch(intake, /Possible property/);
    assert.doesNotMatch(intake, /warning/i);
    assert.doesNotMatch(intake, /must reuse/i);
  });

  test("no sidebar Customer/Property items; routes exist without nav promotion", () => {
    const nav = read("app/tools/roofing/fieldDiveNavConfig.ts");
    assert.doesNotMatch(nav, /label: "Customers"/);
    assert.doesNotMatch(nav, /label: "Properties"/);
    assert.equal(existsSync(join(ROOT, "app/tools/roofing/customers/[customerId]/page.tsx")), true);
    assert.equal(existsSync(join(ROOT, "app/tools/roofing/properties/[propertyId]/page.tsx")), true);
  });

  test("Job Card keeps Customer/Property contextual links", () => {
    const header = read("app/tools/roofing/jobCard/JobCardHeader.tsx");
    assert.match(header, /customerHref/);
    assert.match(header, /propertyHref/);
    assert.match(header, /data-jobcard-property-link/);
  });

  test("proposal/payment/lifecycle writers are not touched by Wave C identity files", () => {
    const waveC = [
      "app/lib/propertyStore.ts",
      "app/lib/propertyAddressNormalize.ts",
      "app/lib/workspaceSearch.ts",
      "app/api/search/route.ts",
      "app/api/properties/search/route.ts",
      "app/api/customers/[customerId]/route.ts",
      "app/api/properties/[propertyId]/route.ts",
      "app/tools/roofing/customers/[customerId]/CustomerWorkspaceClient.tsx",
      "app/tools/roofing/properties/[propertyId]/PropertyWorkspaceClient.tsx",
      "app/tools/roofing/workspace/FieldDiveWorkspaceShell.tsx",
    ];
    for (const file of waveC) {
      const source = read(file);
      assert.doesNotMatch(source, /jobs\.stage/);
      assert.doesNotMatch(source, /context_echo/);
      assert.doesNotMatch(source, /payment_requests/);
      assert.doesNotMatch(source, /frozen_at/);
      assert.doesNotMatch(source, /Live identity/);
      assert.doesNotMatch(source, /Place identity/);
      assert.doesNotMatch(source, /Job snapshots and sent proposals/);
    }
    const sql = readFileSync(SQL_064, "utf8");
    assert.doesNotMatch(sql, /proposal_versions/);
    assert.doesNotMatch(sql, /job_payment/);
    assert.match(sql, /Never rewrites job addresses/);
  });
});
