/**
 * R11b — Field-path isolation: pure save/reload pipeline (no browser/Supabase).
 *
 * Run: npx tsx --test app/tools/settings/settingsCompanyBrandingFieldPipeline.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  mergeCompanyBrandingProfile,
  normalizeCompanyBrandingProfile,
  type CompanyBrandingProfile,
} from "@/app/lib/companyBrandingProfile";
import {
  companyBrandingProfileToUpsertPayload,
  rowToCompanyBrandingProfileFields,
  type CompanyBrandingProfileRow,
} from "@/app/lib/companyBrandingProfileStore";
import {
  buildBrandingSaveSplit,
  createEmptyCompanyBrandingDraft,
  mergeCompanyBrandingDraftProfile,
  resolveDraftAfterSave,
} from "./settingsCompanyBrandingUtils";

const COMPANY_ID = "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6";

function andersonDraft(): CompanyBrandingProfile {
  return mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
    companyName: "Anderson Roofing",
    email: "test@example.com",
    phone: "(555) 123-4567",
    license: "CLN 123-456",
    notificationsEmail: "notify@example.com",
    address: "123 Main St, City, ST 12345",
    website: "example.com",
    brandPrimaryColor: "#123456",
    brandSecondaryColor: "#abcdef",
    showLicenseOnCover: true,
  });
}

function simulateCompaniesRowFromCoreSplit(
  core: ReturnType<typeof buildBrandingSaveSplit>["persistableProfile"]
) {
  return {
    name: core.companyName,
    owner_email: core.email,
    phone: core.phone,
    license: core.license,
    logo_url: core.logoDataUrl,
    notifications_email: core.notificationsEmail ?? "",
  };
}

function simulateBrandingRowFromUpsert(
  deferred: ReturnType<typeof buildBrandingSaveSplit>["deferredFields"]
): CompanyBrandingProfileRow {
  const payload = companyBrandingProfileToUpsertPayload(COMPANY_ID, deferred);
  return {
    id: "00000000-0000-4000-8000-000000000001",
    company_id: COMPANY_ID,
    address: payload.address,
    website: payload.website,
    brand_primary_color: payload.brand_primary_color,
    brand_secondary_color: payload.brand_secondary_color,
    show_license_on_cover: payload.show_license_on_cover,
    metadata: payload.metadata,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
  };
}

describe("settings field pipeline — Anderson Roofing fixture", () => {
  const draft = andersonDraft();

  test("normalize + split preserves all core and branding fields", () => {
    const normalized = normalizeCompanyBrandingProfile(draft);
    const split = buildBrandingSaveSplit(normalized);

    assert.equal(split.persistableProfile.companyName, "Anderson Roofing");
    assert.equal(split.persistableProfile.email, "test@example.com");
    assert.equal(split.persistableProfile.phone, "(555) 123-4567");
    assert.equal(split.persistableProfile.license, "CLN 123-456");
    assert.equal(split.persistableProfile.notificationsEmail, "notify@example.com");

    assert.equal(split.deferredFields.address, "123 Main St, City, ST 12345");
    assert.equal(split.deferredFields.website, "https://example.com");
    assert.equal(split.deferredFields.brandPrimaryColor, "#123456");
    assert.equal(split.deferredFields.brandSecondaryColor, "#abcdef");
    assert.equal(split.deferredFields.showLicenseOnCover, true);
  });

  test("full DB round-trip merge is not address-only", () => {
    const normalized = normalizeCompanyBrandingProfile(draft);
    const split = buildBrandingSaveSplit(normalized);
    const companiesRow = simulateCompaniesRowFromCoreSplit(split.persistableProfile);
    const brandingRow = simulateBrandingRowFromUpsert(split.deferredFields);

    const coreProfile = {
      companyName: String(companiesRow.name ?? ""),
      email: String(companiesRow.owner_email ?? ""),
      phone: String(companiesRow.phone ?? ""),
      license: String(companiesRow.license ?? ""),
      logoDataUrl: String(companiesRow.logo_url ?? ""),
      notificationsEmail: String(companiesRow.notifications_email ?? ""),
    };
    const extended = rowToCompanyBrandingProfileFields(brandingRow);
    const merged = mergeCompanyBrandingProfile(coreProfile, extended);

    assert.equal(merged.companyName, "Anderson Roofing");
    assert.equal(merged.email, "test@example.com");
    assert.equal(merged.website, "https://example.com");
    assert.equal(merged.brandPrimaryColor, "#123456");
    assert.equal(merged.showLicenseOnCover, true);
    assert.notEqual(merged.companyName, "");
  });

  test("address-only reload simulation refuses draft replacement", () => {
    const fullReload = mergeCompanyBrandingProfile(
      {
        companyName: "",
        email: "",
        phone: "",
        license: "",
        logoDataUrl: "",
        notificationsEmail: "",
      },
      rowToCompanyBrandingProfileFields(
        simulateBrandingRowFromUpsert({
          address: "123 Main St, City, ST 12345",
          website: "",
          brandPrimaryColor: "",
          brandSecondaryColor: "",
          showLicenseOnCover: false,
        })
      )
    );

    assert.equal(fullReload.address, "123 Main St, City, ST 12345");
    assert.equal(fullReload.companyName, "");
    assert.equal(fullReload.website, "");

    const afterSave = resolveDraftAfterSave(
      draft,
      { coreSaved: true, brandingSaved: true, reloadSucceeded: true },
      fullReload
    );
    assert.equal(afterSave.replaceDraft, false);
    assert.equal(afterSave.draft.companyName, "Anderson Roofing");
  });

  test("full reload simulation accepts draft replacement", () => {
    const normalized = normalizeCompanyBrandingProfile(draft);
    const split = buildBrandingSaveSplit(normalized);
    const fullReload = mergeCompanyBrandingProfile(
      split.persistableProfile,
      rowToCompanyBrandingProfileFields(simulateBrandingRowFromUpsert(split.deferredFields))
    );

    const afterSave = resolveDraftAfterSave(
      draft,
      { coreSaved: true, brandingSaved: true, reloadSucceeded: true },
      fullReload
    );
    assert.equal(afterSave.replaceDraft, true);
    assert.equal(afterSave.draft.companyName, "Anderson Roofing");
    assert.equal(afterSave.draft.website, "https://example.com");
  });
});
