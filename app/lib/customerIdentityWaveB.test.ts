/**
 * Wave B — customer identity normalize + match + intake contracts.
 * Run: npx tsx --test app/lib/customerIdentityWaveB.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  normalizeCustomerEmail,
  normalizePersonName,
  normalizePhoneDigits,
  phoneDigitsForMatch,
  personNameTokens,
} from "./customerIdentityNormalize";
import {
  CUSTOMER_SEARCH_INITIAL_VISIBLE,
  CUSTOMER_SEARCH_RESULT_LIMIT,
  buildCustomerSearchRpcQuery,
  customerSearchQueryIsActive,
  partitionCustomerCandidates,
  rankCustomerSearchCandidates,
} from "./customerMatch";
import { isGooglePlacesConfigured } from "./placesConfig";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_060 = join(MIGRATIONS, "20260830_060_customers_tenant_isolation.sql");
const SQL_061 = join(MIGRATIONS, "20260830_061_search_company_jobs.sql");
const SQL_062 = join(MIGRATIONS, "20260830_062_legacy_billing_tenant_isolation.sql");
const SQL_063 = join(MIGRATIONS, "20260830_063_search_company_customers.sql");
const SHA_060 = "63273D0B4924E187D273B4D2010592B4C84BD34DFA5D4F28B0C62736EF78865C";
const SHA_062 = "1C21262F40BD3D9807302E04FCEA747E65E0A21D3FA6E374D2194D664A5301D6";

describe("Wave B — normalization", () => {
  test("email trim + lowercase; empty → null", () => {
    assert.equal(normalizeCustomerEmail("  Bob@Example.COM "), "bob@example.com");
    assert.equal(normalizeCustomerEmail(""), null);
    assert.equal(normalizeCustomerEmail("   "), null);
    assert.equal(normalizeCustomerEmail(null), null);
  });

  test("phone digits-only comparable; display formatting not required", () => {
    assert.equal(normalizePhoneDigits("(512) 555-0199"), "5125550199");
    assert.equal(phoneDigitsForMatch("512-555-0199"), "5125550199");
    assert.equal(phoneDigitsForMatch("555-0199"), "5550199");
    assert.equal(phoneDigitsForMatch("555"), null);
  });

  test("name trim/collapse; tokens for candidate discovery", () => {
    assert.equal(normalizePersonName("  Bob   Smith "), "Bob Smith");
    assert.deepEqual(personNameTokens("Bob Smith"), ["bob", "smith"]);
  });
});

describe("Wave B — candidate ranking (no auto-merge)", () => {
  const rows = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bob Smith",
      email: "bob@example.com",
      phone: "(512) 555-0199",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Robert Smith",
      email: "other@example.com",
      phone: "5125550000",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Alice Jones",
      email: "alice@example.com",
      phone: "7375551212",
    },
  ];

  test("normalized email is strong match signal", () => {
    const ranked = rankCustomerSearchCandidates(rows, { email: "  BOB@EXAMPLE.com " });
    assert.equal(ranked[0]?.id, rows[0].id);
    assert.ok(ranked[0]?.signals.includes("exact_email"));
  });

  test("formatted/unformatted phone match", () => {
    const ranked = rankCustomerSearchCandidates(rows, { phone: "5125550199" });
    assert.equal(ranked[0]?.id, rows[0].id);
    assert.ok(ranked[0]?.signals.includes("exact_phone"));
  });

  test("name is candidate discovery only — never sole auto-merge proof", () => {
    const ranked = rankCustomerSearchCandidates(rows, { name: "Bob" });
    assert.ok(ranked.some((c) => c.id === rows[0].id));
    assert.ok(ranked.every((c) => c.signals.includes("name")));
    // Ranker returns candidates; createCustomer / selection owns identity — no merge API.
    assert.equal(typeof ranked[0]?.id, "string");
  });

  test("deterministic small result set", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
      name: `Bob Candidate ${i}`,
      email: `bob${i}@example.com`,
      phone: null,
    }));
    const ranked = rankCustomerSearchCandidates(many, { name: "Bob" });
    assert.ok(ranked.length <= CUSTOMER_SEARCH_RESULT_LIMIT);
    assert.equal(ranked.length, CUSTOMER_SEARCH_RESULT_LIMIT);
  });

  test("initial visible list is 3; Show more reveals remaining ranked candidates", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`,
      name: `Bob Candidate ${i}`,
      email: `bob${i}@example.com`,
      phone: null,
    }));
    const ranked = rankCustomerSearchCandidates(many, { name: "Bob" });
    const compact = partitionCustomerCandidates(ranked, false);
    assert.equal(CUSTOMER_SEARCH_INITIAL_VISIBLE, 3);
    assert.equal(compact.visible.length, 3);
    assert.equal(compact.hiddenCount, ranked.length - 3);
    const expanded = partitionCustomerCandidates(ranked, true);
    assert.equal(expanded.visible.length, ranked.length);
    assert.equal(expanded.hiddenCount, 0);
    assert.deepEqual(expanded.visible.map((c) => c.id), ranked.map((c) => c.id));
  });

  test("name-only ranking never auto-merges", () => {
    const ranked = rankCustomerSearchCandidates(rows, { name: "Smith" });
    assert.ok(ranked.length >= 2);
    assert.ok(ranked.every((c) => c.signals.includes("name")));
    assert.ok(!ranked.some((c) => c.signals.includes("exact_email")));
  });

  test("query activity gates short input", () => {
    assert.equal(customerSearchQueryIsActive({ name: "B" }), false);
    assert.equal(customerSearchQueryIsActive({ name: "Bo" }), true);
    assert.equal(customerSearchQueryIsActive({ email: "a@b.co" }), true);
    assert.equal(buildCustomerSearchRpcQuery({ email: "X@Y.COM" }), "x@y.com");
  });
});

describe("Wave B — writers + intake contracts", () => {
  test("createCustomer always inserts; findOrCreate uses normalized email ilike", () => {
    const source = read("app/lib/customerStore.ts");
    assert.match(source, /export async function createCustomer/);
    assert.match(source, /export async function findOrCreateCustomer/);
    assert.match(source, /normalizeCustomerEmail/);
    assert.match(source, /\.ilike\("email", emailNorm\)/);
    assert.match(source, /Do not use this for New Job "continue as new"/);
  });

  test("New Job packet uses createCustomer or selected id — not silent findOrCreate collapse", () => {
    const source = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(source, /createCustomer\(/);
    assert.match(source, /selectedCustomerId/);
    assert.match(source, /forceNewCustomer|Continue as new/);
    assert.match(source, /exact-email findOrCreate cannot silently merge/);
    assert.match(source, /JobPacketCustomerCandidates/);
  });

  test("intake chrome stays quiet: no healthy badges, no readiness score, no empty Property preview", () => {
    const source = read("app/tools/roofing/RoofingClient.tsx");
    const packet = read("app/tools/roofing/JobPacketCustomerCandidates.tsx");
    assert.doesNotMatch(source, /emerald-800">\s*Active/);
    assert.doesNotMatch(source, /emerald-800">\s*Ready/);
    assert.doesNotMatch(source, /amber-800">\s*Needed/);
    assert.doesNotMatch(source, /core details captured/);
    assert.doesNotMatch(source, /Before you estimate/);
    assert.doesNotMatch(source, /Packet status/);
    assert.doesNotMatch(source, /Property preview/);
    assert.doesNotMatch(source, /Map preview when address is confirmed/);
    assert.match(source, /Add customer and property details to continue/);
    assert.match(source, /job_address1_field/);
    assert.match(packet, /Show more/);
    assert.match(packet, /Continue as new customer/);
    assert.match(packet, /Using existing customer/);
    assert.doesNotMatch(packet, /Duplicate detected/);
  });

  test("Job Card contact remains snapshot; live Customer not dual-written from packet edits", () => {
    const persist = read("app/lib/jobCardCustomerPersist.ts");
    assert.match(persist, /customer_id/);
    assert.doesNotMatch(persist, /\.update\(\{[\s\S]*email/);
    assert.match(persist, /findOrCreateCustomer/);
  });

  test("proposal customer context remains company-scoped snapshot path", () => {
    const context = read("app/lib/proposalCustomerContext.ts");
    assert.match(context, /\.from\("customers"\)/);
    assert.match(context, /\.eq\("company_id", cid\)/);
  });
});

describe("Wave B — migration 063 security contract", () => {
  test("historical 060/062 locked; 063 is customer search only", () => {
    assert.equal(existsSync(SQL_063), true);
    assert.equal(sha(SQL_060), SHA_060);
    assert.equal(sha(SQL_062), SHA_062);
    assert.ok(existsSync(SQL_061));
    const sql = readFileSync(SQL_063, "utf8");
    assert.match(sql, /search_company_customers_v1/);
    assert.match(sql, /security invoker/i);
    assert.match(sql, /company_memberships/);
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /limit 8/);
    assert.match(sql, /revoke all on function public\.search_company_customers_v1/);
    assert.match(sql, /from anon/);
    assert.match(sql, /grant execute[\s\S]*to authenticated/);
    assert.doesNotMatch(sql, /create table public\.properties/i);
    assert.doesNotMatch(sql, /security definer/i);
    assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  });

  test("no Property / Customer workspace / global typed customer shell search in Wave B files", () => {
    const names = readdirSync(MIGRATIONS).filter((n) => n.includes("_063_"));
    assert.deepEqual(names, ["20260830_063_search_company_customers.sql"]);
    const packet = read("app/tools/roofing/JobPacketCustomerCandidates.tsx");
    assert.match(packet, /Possible match/);
    assert.doesNotMatch(packet, /Duplicate detected/);
    const searchApi = read("app/api/customers/search/route.ts");
    assert.match(searchApi, /search_company_customers_v1/);
    assert.match(searchApi, /getUserCompanyId/);
    const shellSearch = read("app/tools/roofing/saved/useCompanyJobSearch.ts");
    assert.doesNotMatch(shellSearch, /customers\/search/);
  });
});

describe("Wave B — Places boundary", () => {
  test("Places is server-gated; no hardcoded key; manual address path remains", () => {
    const config = read("app/lib/placesConfig.ts");
    assert.match(config, /GOOGLE_PLACES_API_KEY/);
    assert.match(config, /GOOGLE_MAPS_API_KEY/);
    assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}/);
    const client = read("app/lib/placesClient.ts");
    assert.match(client, /places\.googleapis\.com\/v1/);
    const route = read("app/api/places/autocomplete/route.ts");
    assert.match(route, /available: false/);
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(roofing, /JobPacketAddressSuggestions/);
    assert.match(roofing, /job_address1_field/);
    // Without env, helper reports not configured (test env has no Places key).
    assert.equal(isGooglePlacesConfigured(), Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY));
  });
});
