/**
 * Company Settings summary model.
 *
 * The settings home shows state before it offers editing, so every row needs a
 * readable one-line summary and a quiet count of what is still missing. These
 * are pure functions so the counts are testable without rendering.
 */

import {
  normalizeCompanyBrandingProfile,
  type CompanyBrandingProfile,
} from "@/app/lib/companyBrandingProfile";

export type CompanySettingsSectionId =
  | "business"
  | "branding"
  | "payments"
  | "pricing"
  | "preferences";

/** Fields a customer-facing proposal genuinely needs from each section. */
const BUSINESS_EXPECTED_FIELDS: ReadonlyArray<keyof CompanyBrandingProfile> = [
  "companyName",
  "email",
  "phone",
  "license",
];

const BRANDING_EXPECTED_FIELDS: ReadonlyArray<keyof CompanyBrandingProfile> = [
  "logoDataUrl",
  "address",
  "website",
];

function filled(profile: CompanyBrandingProfile, key: keyof CompanyBrandingProfile): boolean {
  const value = profile[key];
  if (typeof value === "boolean") return value;
  return typeof value === "string" && value.trim().length > 0;
}

function countMissing(
  profile: CompanyBrandingProfile,
  keys: ReadonlyArray<keyof CompanyBrandingProfile>
): number {
  return keys.filter((key) => !filled(profile, key)).length;
}

/** "2 details missing" — a count, never a red checklist of field labels. */
export function formatMissingDetailCount(missing: number): string | null {
  if (missing <= 0) return null;
  return missing === 1 ? "1 detail missing" : `${missing} details missing`;
}

export function countMissingBusinessDetails(
  input: Partial<CompanyBrandingProfile>
): number {
  return countMissing(normalizeCompanyBrandingProfile(input), BUSINESS_EXPECTED_FIELDS);
}

export function countMissingBrandingDetails(
  input: Partial<CompanyBrandingProfile>
): number {
  return countMissing(normalizeCompanyBrandingProfile(input), BRANDING_EXPECTED_FIELDS);
}

/** Company name plus contact metadata as separate scan lines. */
export function summarizeBusiness(
  input: Partial<CompanyBrandingProfile>
): { title: string | null; details: string[] } {
  const profile = normalizeCompanyBrandingProfile(input);
  const details: string[] = [];
  if (profile.email.trim()) details.push(profile.email.trim());
  if (profile.phone.trim()) details.push(profile.phone.trim());
  if (profile.license.trim()) details.push(profile.license.trim());
  return {
    title: profile.companyName.trim() || null,
    details,
  };
}

export function summarizeBranding(
  input: Partial<CompanyBrandingProfile>
): string {
  const profile = normalizeCompanyBrandingProfile(input);
  const parts: string[] = [profile.logoDataUrl.trim() ? "Logo added" : "No logo"];
  if (profile.brandPrimaryColor.trim()) parts.push("Brand colors set");
  if (profile.showLicenseOnCover) parts.push("License on cover");
  return parts.join(" · ");
}

export type CompanyPaymentsSummaryInput = {
  connected: boolean;
  chargesEnabled: boolean;
  defaultDepositMode: "none" | "percent" | "fixed";
  defaultDepositPercentBps: number | null;
  defaultDepositFixedCents: number | null;
};

export type CompanyPaymentsSummaryLoadStatus = "loading" | "ready" | "error";

/** Payment truth is provider-owned; this only restates what Stripe reported. */
export function summarizePayments(
  input: CompanyPaymentsSummaryInput | null,
  loadStatus: CompanyPaymentsSummaryLoadStatus = "ready"
): string {
  // Unknown must never read as disconnected — that caused a false "Not connected" flash.
  if (loadStatus === "loading") return "Checking…";
  if (loadStatus === "error") return "Couldn't load status";
  if (!input) return "Stripe not connected";

  const connection = !input.connected
    ? "Stripe not connected"
    : input.chargesEnabled
      ? "Stripe connected"
      : "Stripe setup incomplete";

  return connection;
}

export type CompanyPricingSummaryInput = {
  configured: boolean;
  profitabilityType: "margin" | "markup";
  defaultProfitabilityPct: number | null;
  salesTaxRatePct: number | null;
};

export function summarizePricing(input: CompanyPricingSummaryInput | null): string {
  if (!input || !input.configured) return "Not set up";

  const parts: string[] = [];
  if (input.defaultProfitabilityPct != null) {
    const label = input.profitabilityType === "margin" ? "margin" : "markup";
    parts.push(`${input.defaultProfitabilityPct}% ${label}`);
  }
  if (input.salesTaxRatePct != null) {
    parts.push(`${input.salesTaxRatePct}% sales tax`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Configured";
}

export function summarizeTimezone(timezone: string | null): string {
  const trimmed = (timezone ?? "").trim();
  return trimmed.length > 0 ? trimmed : "No timezone set";
}
