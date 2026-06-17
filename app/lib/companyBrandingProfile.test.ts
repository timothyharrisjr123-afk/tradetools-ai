/**
 * R11a — Pure tests for companyBrandingProfile.ts
 *
 * Run: npx tsx --test app/lib/companyBrandingProfile.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildBrandingMetadataPatch,
  buildCompanyBrandingViewModel,
  COMPANY_BRANDING_DEFERRED_FIELD_KEYS,
  COMPANY_BRANDING_METADATA_KEY,
  COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS,
  companyProfileToBrandingProfile,
  deriveCompanyBrandingPersistenceCapability,
  deriveCompanyBrandingReadiness,
  mapCompanyBrandingToProposalContextEcho,
  mergeCompanyBrandingProfile,
  normalizeBrandColorHex,
  normalizeCompanyBrandingProfile,
  normalizeShowLicenseOnCover,
  normalizeWebsiteField,
  parseBrandingFromCompanyMetadata,
  splitBrandingProfileForPersistence,
} from "./companyBrandingProfile";
import type { CompanyProfile } from "./companyProfile";

function fullBrandingInput() {
  return {
    companyName: "  Summit Roofing  ",
    email: " hello@summit.com ",
    phone: " 918-555-0100 ",
    license: " OK-12345 ",
    logoDataUrl: "data:image/png;base64,abc",
    notificationsEmail: " alerts@summit.com ",
    address: " 123 Main St, Tulsa, OK ",
    website: "summitroofing.com",
    brandPrimaryColor: "#ABC",
    brandSecondaryColor: "336699",
    showLicenseOnCover: true,
  };
}

describe("normalizeCompanyBrandingProfile", () => {
  test("existing identity fields normalize safely", () => {
    const result = normalizeCompanyBrandingProfile(fullBrandingInput());
    assert.equal(result.companyName, "Summit Roofing");
    assert.equal(result.email, "hello@summit.com");
    assert.equal(result.phone, "918-555-0100");
    assert.equal(result.license, "OK-12345");
    assert.equal(result.logoDataUrl, "data:image/png;base64,abc");
    assert.equal(result.notificationsEmail, "alerts@summit.com");
  });

  test("new branding fields normalize safely", () => {
    const result = normalizeCompanyBrandingProfile(fullBrandingInput());
    assert.equal(result.address, "123 Main St, Tulsa, OK");
    assert.equal(result.website, "https://summitroofing.com");
    assert.equal(result.brandPrimaryColor, "#aabbcc");
    assert.equal(result.brandSecondaryColor, "#336699");
    assert.equal(result.showLicenseOnCover, true);
  });

  test("does not mutate input object", () => {
    const input = fullBrandingInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizeCompanyBrandingProfile(input);
    assert.deepEqual(input, snapshot);
  });

  test("non-string identity fields fall back to defaults", () => {
    const result = normalizeCompanyBrandingProfile({
      companyName: 42 as unknown as string,
      phone: null as unknown as string,
    });
    assert.equal(result.companyName, "");
    assert.equal(result.phone, "");
  });
});

describe("normalizeWebsiteField", () => {
  test("trims and prefixes bare domains with https", () => {
    assert.equal(normalizeWebsiteField("  example.com  "), "https://example.com");
  });

  test("preserves existing http(s) scheme", () => {
    assert.equal(normalizeWebsiteField("http://example.com"), "http://example.com");
    assert.equal(normalizeWebsiteField("https://example.com/path"), "https://example.com/path");
  });

  test("rejects token without dot", () => {
    assert.equal(normalizeWebsiteField("mycompany"), "");
  });

  test("empty stays empty", () => {
    assert.equal(normalizeWebsiteField(""), "");
    assert.equal(normalizeWebsiteField("   "), "");
  });
});

describe("normalizeBrandColorHex", () => {
  test("expands 3-digit hex and lowercases", () => {
    assert.equal(normalizeBrandColorHex("#ABC"), "#aabbcc");
  });

  test("adds hash and normalizes 6-digit hex", () => {
    assert.equal(normalizeBrandColorHex("336699"), "#336699");
  });

  test("invalid colors become empty", () => {
    assert.equal(normalizeBrandColorHex("not-a-color"), "");
    assert.equal(normalizeBrandColorHex("#gggggg"), "");
  });

  test("empty stays empty", () => {
    assert.equal(normalizeBrandColorHex(""), "");
  });
});

describe("normalizeShowLicenseOnCover", () => {
  test("boolean passes through", () => {
    assert.equal(normalizeShowLicenseOnCover(true), true);
    assert.equal(normalizeShowLicenseOnCover(false), false);
  });

  test("string and numeric coercions", () => {
    assert.equal(normalizeShowLicenseOnCover("true"), true);
    assert.equal(normalizeShowLicenseOnCover("false"), false);
    assert.equal(normalizeShowLicenseOnCover(1), true);
    assert.equal(normalizeShowLicenseOnCover(0), false);
  });

  test("unknown values default false", () => {
    assert.equal(normalizeShowLicenseOnCover("maybe"), false);
    assert.equal(normalizeShowLicenseOnCover(undefined), false);
  });
});

describe("deriveCompanyBrandingReadiness", () => {
  test("incomplete when required company name missing", () => {
    const readiness = deriveCompanyBrandingReadiness({ companyName: "" });
    assert.equal(readiness.level, "incomplete");
    const nameField = readiness.fields.find((f) => f.key === "companyName");
    assert.equal(nameField?.tier, "required");
    assert.equal(nameField?.satisfied, false);
  });

  test("usable when required present but recommended missing", () => {
    const readiness = deriveCompanyBrandingReadiness({
      companyName: "Summit Roofing",
    });
    assert.equal(readiness.level, "usable");
    const emailField = readiness.fields.find((f) => f.key === "email");
    assert.equal(emailField?.tier, "recommended");
    assert.equal(emailField?.satisfied, false);
  });

  test("ready when required and recommended satisfied", () => {
    const readiness = deriveCompanyBrandingReadiness({
      companyName: "Summit Roofing",
      email: "hello@summit.com",
      phone: "918-555-0100",
      address: "123 Main St",
      license: "OK-12345",
    });
    assert.equal(readiness.level, "ready");
  });

  test("optional fields do not block ready level", () => {
    const readiness = deriveCompanyBrandingReadiness({
      companyName: "Summit Roofing",
      email: "hello@summit.com",
      phone: "918-555-0100",
      address: "123 Main St",
      license: "OK-12345",
      logoDataUrl: "",
      website: "",
    });
    assert.equal(readiness.level, "ready");
    const logoField = readiness.fields.find((f) => f.key === "logoDataUrl");
    assert.equal(logoField?.tier, "optional");
    assert.equal(logoField?.satisfied, false);
  });
});

describe("buildCompanyBrandingViewModel", () => {
  test("includes profile, readiness, and persistence capability", () => {
    const vm = buildCompanyBrandingViewModel({ companyName: "Summit Roofing" });
    assert.equal(vm.profile.companyName, "Summit Roofing");
    assert.equal(vm.readiness.level, "usable");
    assert.equal(vm.persistence.canPersistExtendedBrandingToDatabase, true);
    assert.deepEqual(vm.persistence.deferredFieldKeys, COMPANY_BRANDING_DEFERRED_FIELD_KEYS);
  });
});

describe("mapCompanyBrandingToProposalContextEcho", () => {
  test("maps company_name and company_logo_url only", () => {
    const echo = mapCompanyBrandingToProposalContextEcho(fullBrandingInput());
    assert.deepEqual(echo, {
      company_name: "Summit Roofing",
      company_logo_url: "data:image/png;base64,abc",
    });
    assert.equal("address" in echo, false);
    assert.equal("website" in echo, false);
  });

  test("empty strings become null", () => {
    const echo = mapCompanyBrandingToProposalContextEcho({
      companyName: "  ",
      logoDataUrl: "",
    });
    assert.deepEqual(echo, {
      company_name: null,
      company_logo_url: null,
    });
  });

  test("accepts legacy CompanyProfile shape", () => {
    const legacy: CompanyProfile = {
      companyName: "Legacy Co",
      phone: "",
      email: "",
      license: "",
      logoDataUrl: "https://cdn.example/logo.png",
      notificationsEmail: "",
    };
    const echo = mapCompanyBrandingToProposalContextEcho(legacy);
    assert.deepEqual(echo, {
      company_name: "Legacy Co",
      company_logo_url: "https://cdn.example/logo.png",
    });
  });
});

describe("mergeCompanyBrandingProfile", () => {
  test("composes core company fields with extended branding row fields", () => {
    const merged = mergeCompanyBrandingProfile(
      {
        companyName: "Summit Roofing",
        phone: "918-555-0100",
        email: "hello@summit.com",
        license: "OK-12345",
        logoDataUrl: "data:image/png;base64,abc",
        notificationsEmail: "alerts@summit.com",
      },
      {
        address: "123 Main St",
        website: "summitroofing.com",
        brandPrimaryColor: "#aabbcc",
        showLicenseOnCover: true,
      }
    );

    assert.equal(merged.companyName, "Summit Roofing");
    assert.equal(merged.email, "hello@summit.com");
    assert.equal(merged.address, "123 Main St");
    assert.equal(merged.website, "https://summitroofing.com");
    assert.equal(merged.brandPrimaryColor, "#aabbcc");
    assert.equal(merged.showLicenseOnCover, true);
  });

  test("extended fields default when omitted", () => {
    const merged = mergeCompanyBrandingProfile({
      companyName: "Summit Roofing",
      phone: "",
      email: "",
      license: "",
      logoDataUrl: "",
      notificationsEmail: "",
    });
    assert.equal(merged.address, "");
    assert.equal(merged.showLicenseOnCover, false);
  });
});

describe("schema / persistence capability", () => {
  test("reports extended branding persistence via company_branding_profiles", () => {
    const capability = deriveCompanyBrandingPersistenceCapability();
    assert.equal(capability.canPersistExtendedBrandingToDatabase, true);
    assert.ok(capability.deferredReason.includes("company_branding_profiles"));
    assert.deepEqual(capability.persistableFieldKeys, COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS);
    assert.deepEqual(capability.deferredFieldKeys, COMPANY_BRANDING_DEFERRED_FIELD_KEYS);
  });

  test("splitBrandingProfileForPersistence keeps deferred fields out of CompanyProfile", () => {
    const split = splitBrandingProfileForPersistence(fullBrandingInput());
    assert.deepEqual(split.persistableProfile, {
      companyName: "Summit Roofing",
      email: "hello@summit.com",
      phone: "918-555-0100",
      license: "OK-12345",
      logoDataUrl: "data:image/png;base64,abc",
      notificationsEmail: "alerts@summit.com",
    });
    assert.equal(split.deferredFields.address, "123 Main St, Tulsa, OK");
    assert.equal(split.deferredFields.website, "https://summitroofing.com");
    assert.equal(split.hasDeferredValues, true);
  });

  test("companyProfileToBrandingProfile does not invent deferred values", () => {
    const branding = companyProfileToBrandingProfile({
      companyName: "Summit Roofing",
      phone: "918-555-0100",
      email: "hello@summit.com",
      license: "",
      logoDataUrl: "",
      notificationsEmail: "",
    });
    assert.equal(branding.address, "");
    assert.equal(branding.website, "");
    assert.equal(branding.showLicenseOnCover, false);
  });
});

describe("metadata helpers (legacy nested + flat row metadata)", () => {
  test("parseBrandingFromCompanyMetadata reads nested branding key", () => {
    const parsed = parseBrandingFromCompanyMetadata({
      seed_key: "keep-me",
      [COMPANY_BRANDING_METADATA_KEY]: {
        address: " 456 Oak Ave ",
        website: "https://example.com",
        brand_primary_color: "#112233",
        brand_secondary_color: "#445566",
        show_license_on_cover: true,
      },
    });
    assert.equal(parsed.address, "456 Oak Ave");
    assert.equal(parsed.website, "https://example.com");
    assert.equal(parsed.brandPrimaryColor, "#112233");
    assert.equal(parsed.brandSecondaryColor, "#445566");
    assert.equal(parsed.showLicenseOnCover, true);
  });

  test("buildBrandingMetadataPatch preserves unrelated metadata keys", () => {
    const existing = {
      other_flag: true,
      nested: { a: 1 },
    };
    const patch = buildBrandingMetadataPatch(existing, {
      address: "789 Pine Rd",
      website: "example.org",
      brandPrimaryColor: "#aabbcc",
      showLicenseOnCover: false,
    });

    assert.equal(patch.other_flag, true);
    assert.deepEqual(patch.nested, { a: 1 });
    assert.deepEqual(patch[COMPANY_BRANDING_METADATA_KEY], {
      address: "789 Pine Rd",
      website: "https://example.org",
      brand_primary_color: "#aabbcc",
    });
    assert.equal("show_license_on_cover" in (patch[COMPANY_BRANDING_METADATA_KEY] as object), false);
  });

  test("buildBrandingMetadataPatch does not mutate existing metadata object", () => {
    const existing = { keep: true };
    const snapshot = { ...existing };
    buildBrandingMetadataPatch(existing, { address: "1 Main" });
    assert.deepEqual(existing, snapshot);
  });
});
