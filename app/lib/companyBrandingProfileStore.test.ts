/**
 * R11b — Programmatic tests for companyBrandingProfileStore.ts.
 *
 * Pure mapper tests only. No live Supabase (no DB test harness in repo).
 *
 * Run: npx tsx --test app/lib/companyBrandingProfileStore.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  buildDefaultCompanyBrandingProfileUpsertPayload,
  COMPANY_BRANDING_PROFILE_SELECT_COLUMNS,
  COMPANY_BRANDING_PROFILE_TABLE,
  companyBrandingProfileToUpsertPayload,
  mergeBrandingRowMetadata,
  normalizeBrandingRowMetadata,
  rowToCompanyBrandingProfileFields,
  type CompanyBrandingProfileRow,
} from "./companyBrandingProfileStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function dbRow(overrides: Partial<CompanyBrandingProfileRow> = {}): CompanyBrandingProfileRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    company_id: COMPANY_ID,
    address: null,
    website: null,
    brand_primary_color: null,
    brand_secondary_color: null,
    show_license_on_cover: false,
    metadata: {},
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T00:00:00Z",
    ...overrides,
  };
}

describe("rowToCompanyBrandingProfileFields", () => {
  test("maps DB row to normalized extended branding fields", () => {
    const fields = rowToCompanyBrandingProfileFields(
      dbRow({
        address: " 123 Main St ",
        website: "summitroofing.com",
        brand_primary_color: "#ABC",
        brand_secondary_color: "336699",
        show_license_on_cover: true,
      })
    );

    assert.equal(fields.address, "123 Main St");
    assert.equal(fields.website, "https://summitroofing.com");
    assert.equal(fields.brandPrimaryColor, "#aabbcc");
    assert.equal(fields.brandSecondaryColor, "#336699");
    assert.equal(fields.showLicenseOnCover, true);
  });

  test("null columns normalize to empty strings and false default", () => {
    const fields = rowToCompanyBrandingProfileFields(dbRow());
    assert.equal(fields.address, "");
    assert.equal(fields.website, "");
    assert.equal(fields.brandPrimaryColor, "");
    assert.equal(fields.brandSecondaryColor, "");
    assert.equal(fields.showLicenseOnCover, false);
  });
});

describe("companyBrandingProfileToUpsertPayload", () => {
  test("maps extended profile to upsert row without core company fields", () => {
    const payload = companyBrandingProfileToUpsertPayload(
      COMPANY_ID,
      {
        address: "123 Main St",
        website: "https://example.com",
        brandPrimaryColor: "#112233",
        brandSecondaryColor: "#445566",
        showLicenseOnCover: true,
      },
      { future_cover_layout: "classic" }
    );

    assert.equal(payload.company_id, COMPANY_ID);
    assert.equal(payload.address, "123 Main St");
    assert.equal(payload.website, "https://example.com");
    assert.equal(payload.brand_primary_color, "#112233");
    assert.equal(payload.brand_secondary_color, "#445566");
    assert.equal(payload.show_license_on_cover, true);
    assert.deepEqual(payload.metadata, { future_cover_layout: "classic" });
    assert.equal("companyName" in payload, false);
    assert.equal("owner_email" in payload, false);
    assert.equal("logo_url" in payload, false);
  });

  test("empty strings become null in DB columns", () => {
    const payload = companyBrandingProfileToUpsertPayload(COMPANY_ID, {
      address: "",
      website: "   ",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      showLicenseOnCover: false,
    });

    assert.equal(payload.address, null);
    assert.equal(payload.website, null);
    assert.equal(payload.brand_primary_color, null);
    assert.equal(payload.brand_secondary_color, null);
    assert.equal(payload.show_license_on_cover, false);
  });

  test("does not mutate input extended object", () => {
    const input = { address: " 456 Oak ", showLicenseOnCover: true };
    const snapshot = { ...input };
    companyBrandingProfileToUpsertPayload(COMPANY_ID, input);
    assert.deepEqual(input, snapshot);
  });
});

describe("buildDefaultCompanyBrandingProfileUpsertPayload", () => {
  test("bootstrap payload uses empty extended defaults", () => {
    const payload = buildDefaultCompanyBrandingProfileUpsertPayload(COMPANY_ID);
    assert.equal(payload.company_id, COMPANY_ID);
    assert.equal(payload.address, null);
    assert.equal(payload.website, null);
    assert.equal(payload.brand_primary_color, null);
    assert.equal(payload.brand_secondary_color, null);
    assert.equal(payload.show_license_on_cover, false);
    assert.deepEqual(payload.metadata, {});
  });
});

describe("branding row metadata helpers", () => {
  test("normalizeBrandingRowMetadata returns empty object for invalid input", () => {
    assert.deepEqual(normalizeBrandingRowMetadata(null), {});
    assert.deepEqual(normalizeBrandingRowMetadata([]), {});
  });

  test("mergeBrandingRowMetadata preserves unrelated keys", () => {
    const merged = mergeBrandingRowMetadata(
      { future_tagline: "Quality roofs", keep: true },
      { future_social: { facebook: "https://fb.example" } }
    );
    assert.deepEqual(merged, {
      future_tagline: "Quality roofs",
      keep: true,
      future_social: { facebook: "https://fb.example" },
    });
  });

  test("mergeBrandingRowMetadata does not mutate existing metadata object", () => {
    const existing = { keep: true };
    const snapshot = { ...existing };
    mergeBrandingRowMetadata(existing, { added: 1 });
    assert.deepEqual(existing, snapshot);
  });
});

describe("store contract", () => {
  test("select columns include branding table fields only", () => {
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /company_id/);
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /address/);
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /website/);
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /brand_primary_color/);
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /show_license_on_cover/);
    assert.match(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS, /metadata/);
    assert.equal(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS.includes("name"), false);
    assert.equal(COMPANY_BRANDING_PROFILE_SELECT_COLUMNS.includes("logo_url"), false);
  });

  test("table name matches migration", () => {
    assert.equal(COMPANY_BRANDING_PROFILE_TABLE, "company_branding_profiles");
  });

  test("store module does not import pricing/template/proposal stores", () => {
    const source = readFileSync(
      new URL("./companyBrandingProfileStore.ts", import.meta.url),
      "utf8"
    );
    assert.equal(/from\s+["']@\/app\/lib\/companyPricingPolicy/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/proposalTemplate/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/proposalRecord/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/proposalSnapshot/.test(source), false);
    assert.equal(/localStorage\./.test(source), false);
    assert.equal(/window\.localStorage/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/companyProfile["']/.test(source), false);
    assert.equal(/\.from\(\s*["']companies["']\s*\)/.test(source), false);
  });
});
