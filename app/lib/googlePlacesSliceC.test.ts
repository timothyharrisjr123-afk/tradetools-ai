import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { normalizePropertyAddress } from "./propertyAddressNormalize";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260909215532_durable_property_resolution.sql");

describe("Google Places Slice C durable property identity", () => {
  test("normalization preserves meaningful unit identity", () => {
    const base = { line1: "100 Main St", city: "Tulsa", state: "OK", zip: "74103" };
    assert.notEqual(
      normalizePropertyAddress({ ...base, line2: "Unit A" }),
      normalizePropertyAddress({ ...base, line2: "Unit B" })
    );
    assert.equal(
      normalizePropertyAddress({ ...base, line2: " unit   A " }),
      normalizePropertyAddress({ ...base, line2: "UNIT A" })
    );
  });

  test("migration provides company-scoped atomic resolution and least privilege", () => {
    assert.match(migration, /CREATE UNIQUE INDEX properties_company_address_normalized_uidx/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /p\.company_id = p_company_id/);
    assert.match(migration, /m\.user_id = auth\.uid\(\)/);
    assert.match(migration, /SECURITY INVOKER/);
    assert.match(migration, /SET search_path = pg_catalog, public/);
    assert.match(migration, /REVOKE ALL[\s\S]*FROM PUBLIC, anon/);
    assert.match(migration, /address_normalized = v_normalized/);
    assert.doesNotMatch(migration, /raw_provider|provider_json|session_token|latitude|longitude/);
  });

  test("New Job uses resolver, persists in-memory Place ID, and leaves customer mailing blank", () => {
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(roofing, /resolveCompanyProperty/);
    assert.match(roofing, /placesPlaceId: selectedPlacesAddress\?\.placeId \?\? null/);
    assert.match(roofing, /createCustomer\([\s\S]*?address: null/);
    assert.doesNotMatch(roofing, /createPropertyExplicit\(/);
  });

  test("job and proposal snapshots are not rewritten by resolver migration", () => {
    assert.doesNotMatch(migration, /UPDATE\s+public\.jobs/i);
    assert.doesNotMatch(migration, /proposal_versions|context_echo|proposal_deliveries/);
  });
});
