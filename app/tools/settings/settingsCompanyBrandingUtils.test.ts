/**
 * R11b — Tests for settingsCompanyBrandingUtils.ts (pure, no React/Supabase).
 *
 * Run: npx tsx --test app/tools/settings/settingsCompanyBrandingUtils.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildBrandingSaveSplit,
  buildCompanyBrandingViewModelFromForm,
  buildNormalizationSaveNotice,
  canSaveCompanyBrandingSettings,
  createEmptyCompanyBrandingDraft,
  detectBrandingNormalizationStrippedFields,
  getUnsatisfiedBrandingFieldMessages,
  mergeCompanyBrandingDraftProfile,
  resolveBrandingLoadWarning,
  resolveBrandingEnsureLoadWarning,
  resolveCompanyBrandingSaveMessage,
  resolveDraftAfterSave,
  resolveSettingsLoadGate,
  shouldReplaceDraftFromLoad,
  isRegressiveDraftReplacement,
  isSettingsLoadSucceeded,
  shouldUpdateCompanyProfileCacheAfterSave,
  verifyBrandingPayloadSeparation,
  SETTINGS_BRANDING_ENSURE_FAILED_WARNING,
  SETTINGS_BRANDING_LOAD_FAILED_ERROR,
  SETTINGS_BRANDING_PRICING_NOTE,
  SETTINGS_CORE_LOAD_FAILED_ERROR,
  SETTINGS_SAVE_RELOAD_FAILED_WARNING,
} from "./settingsCompanyBrandingUtils";
import { normalizeCompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";

function fullProfile() {
  return {
    companyName: "Acme Roofing",
    email: "ops@acme.test",
    phone: "555-0100",
    license: "CLN-123",
    logoDataUrl: "https://cdn.test/logo.png",
    notificationsEmail: "notify@acme.test",
    address: "1 Main St",
    website: "acme.test",
    brandPrimaryColor: "#123456",
    brandSecondaryColor: "#abcdef",
    showLicenseOnCover: true,
  };
}

describe("settingsCompanyBrandingUtils", () => {
  test("full profile form state maps to split persistence payload", () => {
    const split = buildBrandingSaveSplit(fullProfile());

    assert.equal(split.persistableProfile.companyName, "Acme Roofing");
    assert.equal(split.persistableProfile.email, "ops@acme.test");
    assert.equal(split.persistableProfile.phone, "555-0100");
    assert.equal(split.persistableProfile.license, "CLN-123");
    assert.equal(split.persistableProfile.logoDataUrl, "https://cdn.test/logo.png");
    assert.equal(split.persistableProfile.notificationsEmail, "notify@acme.test");

    assert.equal(split.deferredFields.address, "1 Main St");
    assert.equal(split.deferredFields.website, "https://acme.test");
    assert.equal(split.deferredFields.brandPrimaryColor, "#123456");
    assert.equal(split.deferredFields.brandSecondaryColor, "#abcdef");
    assert.equal(split.deferredFields.showLicenseOnCover, true);
  });

  test("core and extended fields remain separated", () => {
    const split = buildBrandingSaveSplit(fullProfile());
    const coreKeys = Object.keys(split.persistableProfile);
    const extendedKeys = Object.keys(split.deferredFields);

    assert.ok(!coreKeys.includes("address"));
    assert.ok(!coreKeys.includes("website"));
    assert.ok(!extendedKeys.includes("companyName"));
    assert.ok(!extendedKeys.includes("email"));
    assert.ok(!extendedKeys.includes("logoDataUrl"));
  });

  test("cache updates only after both saves succeed and reload confirms DB truth", () => {
    assert.equal(
      shouldUpdateCompanyProfileCacheAfterSave({
        coreSaved: true,
        brandingSaved: true,
        reloadSucceeded: true,
      }),
      true
    );
    assert.equal(
      shouldUpdateCompanyProfileCacheAfterSave({
        coreSaved: true,
        brandingSaved: true,
        reloadSucceeded: false,
      }),
      false
    );
    assert.equal(
      shouldUpdateCompanyProfileCacheAfterSave({ coreSaved: true, brandingSaved: false }),
      false
    );
    assert.equal(
      shouldUpdateCompanyProfileCacheAfterSave({ coreSaved: false, brandingSaved: false }),
      false
    );
  });

  test("save messages distinguish partial failures", () => {
    const partial = resolveCompanyBrandingSaveMessage({
      coreSaved: true,
      brandingSaved: false,
    });
    assert.equal(partial.tone, "error");
    assert.match(partial.message ?? "", /branding fields failed/i);

    const success = resolveCompanyBrandingSaveMessage({
      coreSaved: true,
      brandingSaved: true,
      reloadSucceeded: true,
    });
    assert.equal(success.tone, "success");

    const blocked = resolveCompanyBrandingSaveMessage({
      saveBlocked: true,
      coreSaved: false,
      brandingSaved: false,
    });
    assert.equal(blocked.tone, "error");
    assert.equal(blocked.message, SETTINGS_CORE_LOAD_FAILED_ERROR);
  });

  test("readiness/view-model surfaces missing recommended fields", () => {
    const vm = buildCompanyBrandingViewModelFromForm({ companyName: "Only Name" });
    const messages = getUnsatisfiedBrandingFieldMessages(vm);
    assert.ok(messages.length > 0);
    assert.ok(messages.some((m) => /email|phone|address/i.test(m)));
    assert.equal(vm.readiness.level, "usable");
  });

  test("pricing separation copy/helper excludes pricing fields from branding payload", () => {
    const split = buildBrandingSaveSplit(fullProfile());
    const check = verifyBrandingPayloadSeparation(split);
    assert.equal(check.pricingKeysAbsent, true);
    assert.ok(SETTINGS_BRANDING_PRICING_NOTE.includes("Pricing"));
    assert.ok(!Object.keys(split.deferredFields).includes("salesTaxRatePct"));
    assert.ok(!Object.keys(split.persistableProfile).includes("defaultProfitabilityPct"));
  });
});

describe("mergeCompanyBrandingDraftProfile", () => {
  test("preserves trailing spaces and internal spaces while typing", () => {
    let draft = createEmptyCompanyBrandingDraft();
    draft = mergeCompanyBrandingDraftProfile(draft, { companyName: "Anderson Roofing " });
    assert.equal(draft.companyName, "Anderson Roofing ");
    draft = mergeCompanyBrandingDraftProfile(draft, {
      address: "123 Main St, City, ST 12345",
    });
    assert.equal(draft.address, "123 Main St, City, ST 12345");
    draft = mergeCompanyBrandingDraftProfile(draft, { phone: "(555) 123-4567" });
    assert.equal(draft.phone, "(555) 123-4567");
    draft = mergeCompanyBrandingDraftProfile(draft, { license: "CLN 123-456" });
    assert.equal(draft.license, "CLN 123-456");
  });

  test("preserves partial website values while typing", () => {
    let draft = createEmptyCompanyBrandingDraft();
    for (const website of ["example", "example.", "example.com"]) {
      draft = mergeCompanyBrandingDraftProfile(draft, { website });
      assert.equal(draft.website, website);
    }
  });

  test("preserves partial hex color values while typing", () => {
    let draft = createEmptyCompanyBrandingDraft();
    for (const brandPrimaryColor of ["#", "#12", "#123"]) {
      draft = mergeCompanyBrandingDraftProfile(draft, { brandPrimaryColor });
      assert.equal(draft.brandPrimaryColor, brandPrimaryColor);
    }
  });

  test("save split still normalizes draft values on save", () => {
    const draft = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
      companyName: "  Acme Roofing  ",
      website: "example.com",
      brandPrimaryColor: "#123456",
      brandSecondaryColor: "#abcdef",
      address: "123 Main St ",
    });
    const split = buildBrandingSaveSplit(normalizeCompanyBrandingProfile(draft));
    assert.equal(split.persistableProfile.companyName, "Acme Roofing");
    assert.equal(split.deferredFields.website, "https://example.com");
    assert.equal(split.deferredFields.brandPrimaryColor, "#123456");
    assert.equal(split.deferredFields.address, "123 Main St");
  });
});

describe("resolveBrandingEnsureLoadWarning", () => {
  test("warns when company id exists but ensure returned null", () => {
    const warning = resolveBrandingEnsureLoadWarning("e1fd48bb-fe22-4dfe-9622-3f25eb2109b6", null);
    assert.equal(warning, SETTINGS_BRANDING_ENSURE_FAILED_WARNING);
  });

  test("no warning when ensure succeeded or company id missing", () => {
    assert.equal(resolveBrandingEnsureLoadWarning(null, null), null);
    assert.equal(
      resolveBrandingEnsureLoadWarning("e1fd48bb-fe22-4dfe-9622-3f25eb2109b6", { address: "" }),
      null
    );
  });
});

describe("resolveSettingsLoadGate", () => {
  test("core load failure blocks save", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "select_error",
      brandingStatus: "success",
      companyId: "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6",
    });
    assert.equal(gate.saveBlocked, true);
    assert.equal(gate.loadError, SETTINGS_CORE_LOAD_FAILED_ERROR);
    assert.equal(canSaveCompanyBrandingSettings(gate), false);
  });

  test("missing company_id blocks save", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "no_company_id",
      brandingStatus: "read_error",
      companyId: null,
    });
    assert.equal(gate.saveBlocked, true);
    assert.equal(canSaveCompanyBrandingSettings(gate), false);
  });

  test("branding read error blocks save without treating as missing row", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "success_db",
      brandingStatus: "read_error",
      companyId: "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6",
    });
    assert.equal(gate.saveBlocked, true);
    assert.equal(gate.loadError, SETTINGS_BRANDING_LOAD_FAILED_ERROR);
  });

  test("successful core and branding load allows save", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "success_db",
      brandingStatus: "success",
      companyId: "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6",
    });
    assert.equal(gate.saveBlocked, false);
    assert.equal(canSaveCompanyBrandingSettings(gate), true);
  });
});

describe("resolveBrandingLoadWarning", () => {
  test("read error returns load failed error not bootstrap warning", () => {
    const warning = resolveBrandingLoadWarning({
      brandingStatus: "read_error",
      bootstrapAttempted: false,
      bootstrapSucceeded: false,
    });
    assert.equal(warning, SETTINGS_BRANDING_LOAD_FAILED_ERROR);
  });

  test("bootstrap failure returns bootstrap warning", () => {
    const warning = resolveBrandingLoadWarning({
      brandingStatus: "missing_row",
      bootstrapAttempted: true,
      bootstrapSucceeded: false,
    });
    assert.match(warning ?? "", /could not be created/i);
  });
});

describe("normalization save notices", () => {
  test("detects stripped website and colors on save", () => {
    const draft = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
      website: "invalid",
      brandPrimaryColor: "#12",
      brandSecondaryColor: "not-a-color",
    });
    const normalized = normalizeCompanyBrandingProfile(draft);
    const stripped = detectBrandingNormalizationStrippedFields(draft, normalized);
    assert.deepEqual(stripped, ["website", "primary color", "secondary color"]);
    assert.match(buildNormalizationSaveNotice(stripped) ?? "", /normalized on save/i);
  });
});

describe("shouldReplaceDraftFromLoad", () => {
  test("failed load does not replace draft", () => {
    assert.equal(
      shouldReplaceDraftFromLoad({ loadSucceeded: false, profile: null }),
      false
    );
    assert.equal(
      shouldReplaceDraftFromLoad({
        loadSucceeded: false,
        profile: createEmptyCompanyBrandingDraft(),
      }),
      false
    );
  });

  test("successful DB load replaces draft when no current draft", () => {
    const profile = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
      companyName: "Anderson Roofing",
      address: "123 Main St",
    });
    assert.equal(shouldReplaceDraftFromLoad({ loadSucceeded: true, profile }), true);
  });

  test("address-only reload does not replace a fuller current draft", () => {
    const current = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
      companyName: "Anderson Roofing",
      email: "test@example.com",
      address: "123 Main St, City, ST 12345",
      website: "example.com",
    });
    const addressOnly = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
      address: "123 Main St, City, ST 12345",
    });
    assert.equal(
      shouldReplaceDraftFromLoad({ loadSucceeded: true, profile: addressOnly }, current),
      false
    );
    assert.equal(isRegressiveDraftReplacement(current, addressOnly), true);
  });
});

describe("isSettingsLoadSucceeded", () => {
  test("address-only load is not safe when core DB load failed", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "select_error",
      brandingStatus: "success",
      companyId: "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6",
    });
    assert.equal(
      isSettingsLoadSucceeded({
        coreFromDatabase: false,
        brandingFromDatabase: true,
        loadGate: gate,
      }),
      false
    );
  });

  test("full DB load succeeds when core and branding are from database", () => {
    const gate = resolveSettingsLoadGate({
      coreStatus: "success_db",
      brandingStatus: "success",
      companyId: "e1fd48bb-fe22-4dfe-9622-3f25eb2109b6",
    });
    assert.equal(
      isSettingsLoadSucceeded({
        coreFromDatabase: true,
        brandingFromDatabase: true,
        loadGate: gate,
      }),
      true
    );
  });
});

describe("resolveDraftAfterSave", () => {
  const draft = mergeCompanyBrandingDraftProfile(createEmptyCompanyBrandingDraft(), {
    companyName: "Anderson Roofing",
    address: "123 Main St, City, ST 12345",
    website: "example.com",
  });

  test("save failure keeps draft visible", () => {
    const result = resolveDraftAfterSave(draft, { coreSaved: false, brandingSaved: false }, null);
    assert.equal(result.replaceDraft, false);
    assert.deepEqual(result.draft, draft);
    assert.equal(result.blockSaveUntilRefresh, false);
  });

  test("reload failure after save keeps draft visible and blocks save", () => {
    const result = resolveDraftAfterSave(
      draft,
      { coreSaved: true, brandingSaved: true, reloadSucceeded: false },
      null
    );
    assert.equal(result.replaceDraft, false);
    assert.deepEqual(result.draft, draft);
    assert.equal(result.blockSaveUntilRefresh, true);
  });

  test("successful save uses reloaded DB truth only", () => {
    const reloaded = normalizeCompanyBrandingProfile({
      ...draft,
      website: "https://example.com",
    });
    const result = resolveDraftAfterSave(
      draft,
      { coreSaved: true, brandingSaved: true, reloadSucceeded: true },
      reloaded
    );
    assert.equal(result.replaceDraft, true);
    assert.equal(result.draft.website, "https://example.com");
    assert.equal(result.blockSaveUntilRefresh, false);
  });

  test("address-only reload after save keeps visible draft", () => {
    const addressOnlyReload = normalizeCompanyBrandingProfile({
      address: "123 Main St, City, ST 12345",
    });
    const result = resolveDraftAfterSave(
      draft,
      { coreSaved: true, brandingSaved: true, reloadSucceeded: true },
      addressOnlyReload
    );
    assert.equal(result.replaceDraft, false);
    assert.equal(result.draft.companyName, "Anderson Roofing");
    assert.equal(result.draft.website, "example.com");
    assert.equal(result.blockSaveUntilRefresh, false);
  });

  test("no optimistic normalized draft replacement path", () => {
    const normalizedDraft = normalizeCompanyBrandingProfile(draft);
    const result = resolveDraftAfterSave(
      draft,
      { coreSaved: false, brandingSaved: false },
      normalizedDraft
    );
    assert.equal(result.replaceDraft, false);
    assert.equal(result.draft.website, "example.com");
  });
});

describe("save reload failure message", () => {
  test("reload failure shows refresh-before-edit warning", () => {
    const message = resolveCompanyBrandingSaveMessage({
      coreSaved: true,
      brandingSaved: true,
      reloadSucceeded: false,
    });
    assert.equal(message.tone, "error");
    assert.equal(message.message, SETTINGS_SAVE_RELOAD_FAILED_WARNING);
  });
});
