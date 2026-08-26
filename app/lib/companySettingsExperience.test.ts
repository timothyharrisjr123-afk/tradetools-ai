/**
 * Cohesion Cut 1 — Phase 2 product contract.
 *
 * Company Settings shows state before it offers editing, each focused editor
 * owns exactly one Save, mobile navigation actually opens, and Pricing lives in
 * the normal contractor shell with its math untouched.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  countMissingBrandingDetails,
  countMissingBusinessDetails,
  formatMissingDetailCount,
  summarizeBranding,
  summarizeBusiness,
  summarizePayments,
  summarizePricing,
  summarizeTimezone,
} from "@/app/lib/companySettingsSummary";
import { parseCompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";
import { hasNavHref, FIELD_DIVE_NAV_SECTIONS } from "@/app/tools/roofing/fieldDiveNavConfig";
import {
  pricingPolicyFormStateToPolicy,
  validatePricingPolicyFormState,
} from "@/app/tools/settings/pricing/pricingPolicyFormUtils";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SETTINGS_PAGE = read("app/tools/settings/page.tsx");
const SETTINGS_CLIENT = read("app/tools/settings/CompanySettingsClient.tsx");
const BUSINESS_EDITOR = read("app/tools/settings/CompanySettingsBusinessEditor.tsx");
const BRANDING_EDITOR = read("app/tools/settings/CompanySettingsBrandingEditor.tsx");
const PAYMENTS_EDITOR = read("app/tools/settings/CompanySettingsPaymentsEditor.tsx");
const PREFERENCES_EDITOR = read("app/tools/settings/CompanySettingsPreferencesEditor.tsx");
const PAYMENTS_ROUTE = read("app/tools/settings/payments/page.tsx");
const FOCUSED_EDITOR = read("app/components/ui/FocusedEditor.tsx");
const APP_SHELL = read("app/tools/roofing/FieldDiveAppShell.tsx");
const PRICING_CLIENT = read("app/tools/settings/pricing/CompanyPricingPolicySettingsClient.tsx");
const PRICING_PAGE = read("app/tools/settings/pricing/page.tsx");

const EDITORS = [BUSINESS_EDITOR, BRANDING_EDITOR, PAYMENTS_EDITOR, PREFERENCES_EDITOR];

const FILLED_PROFILE = {
  companyName: "Anderson Roofing",
  email: "office@andersonroofing.com",
  phone: "918-555-0134",
  license: "OK-114552",
  logoDataUrl: "data:image/png;base64,AAAA",
  address: "1200 S Denver Ave, Tulsa, OK",
  website: "https://andersonroofing.com",
  brandPrimaryColor: "#2563eb",
  showLicenseOnCover: true,
};

describe("Company Settings summary-first model", () => {
  test("summary rows are one connected container, not five cards", () => {
    assert.match(SETTINGS_CLIENT, /data-company-settings-summary/);
    assert.match(SETTINGS_CLIENT, /divide-y divide-slate-200/);
    assert.match(SETTINGS_CLIENT, /data-company-settings-row=\{testId\}/);
    for (const row of ["business", "branding", "payments", "pricing", "preferences"]) {
      assert.match(SETTINGS_CLIENT, new RegExp(`testId="${row}"`));
    }
  });

  test("each section summarizes real state before offering an edit", () => {
    const business = summarizeBusiness(FILLED_PROFILE);
    assert.equal(business.title, "Anderson Roofing");
    assert.ok(business.details.some((line) => /office@andersonroofing\.com/.test(line)));
    assert.ok(business.details.some((line) => /OK-114552/.test(line)));

    assert.match(summarizeBranding(FILLED_PROFILE), /Logo added/);
    assert.match(summarizeBranding({}), /No logo/);

    assert.equal(
      summarizePayments({
        connected: true,
        chargesEnabled: true,
        defaultDepositMode: "percent",
        defaultDepositPercentBps: 3000,
        defaultDepositFixedCents: null,
      }),
      "Stripe connected · 30% default deposit"
    );
    assert.equal(summarizePayments(null), "Not set up");

    assert.equal(
      summarizePricing({
        configured: true,
        profitabilityType: "margin",
        defaultProfitabilityPct: 45,
        salesTaxRatePct: 8.5,
      }),
      "45% margin · 8.5% sales tax"
    );
    assert.equal(summarizePricing({
      configured: false,
      profitabilityType: "margin",
      defaultProfitabilityPct: null,
      salesTaxRatePct: null,
    }), "Not set up");

    assert.equal(summarizeTimezone("America/Chicago"), "America/Chicago");
    assert.equal(summarizeTimezone(null), "No timezone set");
  });

  test("missing detail counts are truthful and quiet", () => {
    assert.equal(countMissingBusinessDetails(FILLED_PROFILE), 0);
    assert.equal(countMissingBusinessDetails({ companyName: "Anderson Roofing" }), 3);
    assert.equal(countMissingBrandingDetails({}), 3);
    assert.equal(countMissingBrandingDetails(FILLED_PROFILE), 0);

    assert.equal(formatMissingDetailCount(0), null);
    assert.equal(formatMissingDetailCount(1), "1 detail missing");
    assert.equal(formatMissingDetailCount(2), "2 details missing");
  });

  test("Required setup rail is gone — a count replaces the red checklist", () => {
    assert.match(SETTINGS_CLIENT, /formatMissingDetailCount/);
    assert.doesNotMatch(SETTINGS_CLIENT, /Required setup/i);
    assert.doesNotMatch(SETTINGS_CLIENT, /SettingsBrandingReadinessCard/);
    assert.doesNotMatch(SETTINGS_CLIENT, /border-red-|bg-red-|text-red-/);
  });

  test("loading shows a summary skeleton, never fake values", () => {
    assert.match(SETTINGS_CLIENT, /data-company-settings-skeleton/);
    assert.doesNotMatch(SETTINGS_CLIENT, /Loading company profile/);
  });

  test("no developer or architecture copy survives", () => {
    const forbidden =
      /Pricing stays under|Terms stay in Templates|rendering comes later|preview placeholder|not active yet|later phase|are a seed only|once wired|Payments is collections only|pricing wiring/i;
    assert.doesNotMatch(SETTINGS_CLIENT, forbidden);
    for (const editor of EDITORS) assert.doesNotMatch(editor, forbidden);
    assert.doesNotMatch(PRICING_CLIENT, forbidden);
  });
});

describe("Company Settings save model", () => {
  test("the page itself has no Save button", () => {
    assert.doesNotMatch(SETTINGS_CLIENT, /Save company settings/i);
    assert.doesNotMatch(SETTINGS_CLIENT, /Save timezone/i);
    assert.doesNotMatch(SETTINGS_CLIENT, /Save deposit default/i);
  });

  test("the focused editor owns the only Save and Cancel", () => {
    assert.equal((FOCUSED_EDITOR.match(/data-focused-editor-save/g) ?? []).length, 1);
    assert.equal((FOCUSED_EDITOR.match(/data-focused-editor-cancel/g) ?? []).length, 1);
    for (const editor of EDITORS) {
      assert.match(editor, /<FocusedEditor/);
      assert.equal((editor.match(/onSave=/g) ?? []).length, 1);
      // No editor ships its own second save control.
      assert.doesNotMatch(editor, /Save changes|Save and close/i);
    }
  });

  test("closing a dirty editor prompts before discarding", () => {
    assert.match(FOCUSED_EDITOR, /FOCUSED_EDITOR_DIRTY_PROMPT/);
    assert.match(FOCUSED_EDITOR, /if \(dirty && !window\.confirm/);
    for (const editor of EDITORS) assert.match(editor, /dirty=\{touched\}/);
  });

  test("editors mount fresh so drafts always seed from saved truth", () => {
    for (const editor of EDITORS) {
      assert.doesNotMatch(editor, /open: boolean/);
      assert.match(editor, /open\s*$|open\n/m);
    }
    for (const id of ["business", "branding", "payments", "preferences"]) {
      assert.match(SETTINGS_CLIENT, new RegExp(`editor === "${id}" \\?`));
    }
  });

  test("business and branding save through the single branding persistence path", () => {
    assert.match(SETTINGS_CLIENT, /saveSettingsCompanyBrandingProfile/);
    assert.match(SETTINGS_CLIENT, /mergeCompanyBrandingDraftProfile/);
    assert.match(SETTINGS_CLIENT, /canSaveCompanyBrandingSettings/);
    assert.match(BUSINESS_EDITOR, /companyName|license/);
    assert.match(BRANDING_EDITOR, /logoDataUrl/);
    // Identity fields do not leak into the branding editor and vice versa.
    assert.doesNotMatch(BRANDING_EDITOR, /notificationsEmail/);
    assert.doesNotMatch(BUSINESS_EDITOR, /brandPrimaryColor/);
  });

  test("preferences saves the timezone and resumes a schedule flow", () => {
    assert.match(SETTINGS_CLIENT, /saveCompanyTimezone/);
    assert.match(SETTINGS_CLIENT, /router\.push\(timezoneReturnTo\)/);
    assert.match(SETTINGS_PAGE, /parseTimezoneReturnPath/);
  });
});

describe("Payments ownership", () => {
  test("Payments is a focused editor inside Company Settings", () => {
    assert.match(SETTINGS_CLIENT, /CompanySettingsPaymentsEditor/);
    assert.match(PAYMENTS_EDITOR, /data-company-settings-editor="payments"/);
    assert.match(PAYMENTS_EDITOR, /Stripe Checkout/);
  });

  test("the old Payments page redirects into the focused editor", () => {
    assert.match(PAYMENTS_ROUTE, /redirect\("\/tools\/settings\?edit=payments"\)/);
    assert.match(SETTINGS_PAGE, /resolveInitialEditor/);
  });

  test("no standalone Payments sidebar item", () => {
    assert.equal(hasNavHref("/tools/settings/payments"), false);
    assert.equal(hasNavHref("/tools/settings"), true);
  });

  test("provider status is restated, never invented", () => {
    const status = parseCompanyPaymentsStatus(true, {
      ok: true,
      connected: true,
      chargesEnabled: false,
      detailsSubmitted: true,
      settings: { defaultDepositMode: "fixed", defaultDepositFixedCents: 450000 },
    });
    assert.equal(status?.connected, true);
    assert.equal(status?.chargesEnabled, false);
    assert.equal(status?.defaultDepositFixedCents, 450000);
    assert.equal(parseCompanyPaymentsStatus(false, { ok: true }), null);
    assert.equal(parseCompanyPaymentsStatus(true, { ok: false }), null);
    assert.doesNotMatch(PAYMENTS_EDITOR, /Pay by card|Pay by ACH|Cash App/);
  });
});

describe("Mobile navigation", () => {
  test("the hamburger actually opens a navigation sheet", () => {
    assert.match(APP_SHELL, /data-fielddive-menu-button/);
    assert.match(APP_SHELL, /onClick=\{\(\) => setMobileNavOpen\(\(open\) => !open\)\}/);
    assert.match(APP_SHELL, /aria-expanded=\{mobileNavOpen\}/);
    assert.match(APP_SHELL, /aria-controls="fielddive-mobile-nav"/);
    assert.match(APP_SHELL, /data-fielddive-mobile-nav\b/);
    assert.match(APP_SHELL, /role="dialog"/);
    assert.match(APP_SHELL, /aria-modal="true"/);
  });

  test("the sheet closes by backdrop, close button, Escape, and navigation", () => {
    assert.match(APP_SHELL, /data-fielddive-mobile-nav-backdrop/);
    assert.match(APP_SHELL, /data-fielddive-mobile-nav-close/);
    assert.match(APP_SHELL, /event\.key === "Escape"/);
    assert.match(APP_SHELL, /closest\("a"\)/);
  });

  test("focus is managed and restored, and the body scroll locks", () => {
    assert.match(APP_SHELL, /menuButtonRef\.current\?\.focus\(\)/);
    assert.match(APP_SHELL, /sheetCloseRef\.current\?\.focus\(\)/);
    assert.match(APP_SHELL, /document\.body\.style\.overflow = "hidden"/);
    assert.match(APP_SHELL, /document\.body\.style\.overflow = previousOverflow/);
  });

  test("the sheet reuses the desktop nav config with 44px targets", () => {
    assert.match(APP_SHELL, /MOBILE_NAV_TOUCH_TARGETS/);
    assert.match(APP_SHELL, /min-h-\[44px\]/);
    // One nav definition renders both sidebar and sheet.
    assert.equal((APP_SHELL.match(/\{navSections\}/g) ?? []).length, 2);
    assert.equal((APP_SHELL.match(/FIELD_DIVE_NAV_SECTIONS\.map/g) ?? []).length, 1);
  });

  test("every required destination is reachable from the shared nav", () => {
    const labels = FIELD_DIVE_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => item.label)
    );
    for (const label of [
      "Jobs",
      "New job",
      "Calendar",
      "Company settings",
      "Pricing rules",
      "Catalog",
      "Proposal templates",
    ]) {
      assert.ok(labels.includes(label), `missing nav item: ${label}`);
    }
  });

  test("Company and Pricing no longer share an icon", () => {
    const setup = FIELD_DIVE_NAV_SECTIONS.find((section) => section.id === "setup");
    const company = setup?.items.find((item) => item.key === "company");
    const pricing = setup?.items.find((item) => item.key === "pricing");
    assert.equal(company?.icon, "building2");
    assert.equal(pricing?.icon, "percent");
    assert.notEqual(company?.icon, pricing?.icon);
  });

  test("Company Settings and Pricing highlight their own nav item", () => {
    assert.match(SETTINGS_PAGE, /activeNav="company"/);
    assert.match(PRICING_PAGE, /activeNav="pricing"/);
  });
});

describe("Pricing visual normalization", () => {
  test("Pricing renders inside the normal FieldDive shell", () => {
    assert.match(PRICING_PAGE, /FieldDiveAppShell/);
    assert.match(PRICING_CLIENT, /data-pricing-policy-page/);
  });

  test("the dark glass generation is gone", () => {
    assert.doesNotMatch(PRICING_CLIENT, /#0b0f19/);
    assert.doesNotMatch(PRICING_CLIENT, /backdrop-blur-xl/);
    assert.doesNotMatch(PRICING_CLIENT, /bg-white\/\[0\.0/);
    assert.doesNotMatch(PRICING_CLIENT, /text-white\//);
    assert.doesNotMatch(PRICING_CLIENT, /min-h-screen/);
    assert.doesNotMatch(PRICING_CLIENT, /border-cyan-|text-cyan-|bg-cyan-/);
    assert.match(PRICING_CLIENT, /bg-blue-600/);
    assert.doesNotMatch(PRICING_CLIENT, /bg-white\/95/);
  });

  test("Pricing is one save concept and single column on mobile", () => {
    assert.equal((PRICING_CLIENT.match(/onClick=\{handleSave\}/g) ?? []).length, 1);
    assert.match(PRICING_CLIENT, /Save pricing rules/);
    assert.match(PRICING_CLIENT, /fixed inset-x-0 bottom-0/);
  });

  test("pricing truth and validation are unchanged", () => {
    assert.match(PRICING_CLIENT, /getResolvedCompanyPricingPolicy/);
    assert.match(PRICING_CLIENT, /upsertCompanyPricingPolicy/);
    assert.match(PRICING_CLIENT, /validatePricingPolicyFormState/);
    assert.match(PRICING_CLIENT, /pricingPolicyFormStateToPolicy/);
    assert.match(PRICING_CLIENT, /resolveStarterPricingPolicySeed/);

    const form = {
      profitabilityType: "margin" as const,
      defaultProfitabilityPct: "45",
      minimumProfitabilityPct: "20",
      salesTaxRatePct: "8.5",
      materialPurchaseTaxRatePct: "",
    };
    assert.equal(validatePricingPolicyFormState(form).valid, true);
    const policy = pricingPolicyFormStateToPolicy(form);
    assert.equal(policy.defaultProfitabilityPct, 45);
    assert.equal(policy.minimumProfitabilityPct, 20);
    assert.equal(policy.tax.salesTaxRatePct, 8.5);
    assert.equal(policy.tax.materialPurchaseTaxRatePct, null);

    // Cross-field guardrails still hold.
    assert.equal(
      validatePricingPolicyFormState({ ...form, minimumProfitabilityPct: "60" }).valid,
      false
    );
    assert.equal(
      validatePricingPolicyFormState({
        ...form,
        profitabilityType: "margin",
        defaultProfitabilityPct: "100",
      }).valid,
      false
    );
  });

  test("Pricing stays a full page, not a settings drawer", () => {
    assert.doesNotMatch(PRICING_CLIENT, /FocusedEditor/);
    assert.match(SETTINGS_CLIENT, /href="\/tools\/settings\/pricing"/);
  });

  test("business notification copy reflects current customer flow", () => {
    assert.match(
      BUSINESS_EDITOR,
      /Where FieldDive sends proposal and customer activity notifications/
    );
    assert.doesNotMatch(BUSINESS_EDITOR, /customer accepted a proposal/i);
  });

  test("payments copy is integrated and provider-neutral", () => {
    assert.match(PAYMENTS_EDITOR, /Customers pay securely through Stripe Checkout/);
    assert.match(
      PAYMENTS_EDITOR,
      /Used as the starting payment terms for new proposals/
    );
    assert.doesNotMatch(PAYMENTS_EDITOR, /Prefills payment terms on new proposals/);
  });

  test("focused editor close control is restrained", () => {
    assert.match(FOCUSED_EDITOR, /h-4 w-4/);
    assert.match(FOCUSED_EDITOR, /text-slate-400/);
    assert.doesNotMatch(FOCUSED_EDITOR, /border border-slate-200.*Close/);
  });

  test("pricing save stays calm until dirty or first-time setup", () => {
    assert.match(PRICING_CLIENT, /isDirty/);
    assert.match(PRICING_CLIENT, /showStickyFooter/);
    assert.match(PRICING_CLIENT, /saveSubduedClass/);
  });
});
