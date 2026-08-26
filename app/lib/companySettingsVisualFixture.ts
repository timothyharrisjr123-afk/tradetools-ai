/**
 * Canonical company identity for Cohesion B visual review only.
 * Never written to production company rows — harness and screenshot truth only.
 */

import type { CompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";
import type {
  CompanyPaymentsSummaryInput,
  CompanyPricingSummaryInput,
} from "@/app/lib/companySettingsSummary";
import type { CompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";

/** 1×1 blue PNG — enough for logo preview in review captures. */
export const VISUAL_FIXTURE_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const COMPANY_SETTINGS_VISUAL_FIXTURE: CompanyBrandingProfile = {
  companyName: "Anderson Roofing",
  email: "hello@andersonroofing.com",
  phone: "(918) 555-0142",
  license: "CLN 123-456",
  notificationsEmail: "hello@andersonroofing.com",
  logoDataUrl: VISUAL_FIXTURE_LOGO_DATA_URL,
  address: "220 S Elgin Ave, Tulsa, OK 74120",
  website: "https://andersonroofing.com",
  brandPrimaryColor: "#2563eb",
  brandSecondaryColor: "#0b1f33",
  showLicenseOnCover: true,
};

export const COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED: CompanyPaymentsStatus = {
  connected: true,
  chargesEnabled: true,
  detailsSubmitted: true,
  defaultDepositMode: "fixed",
  defaultDepositPercentBps: null,
  defaultDepositFixedCents: 100000,
};

export const COMPANY_PAYMENTS_VISUAL_FIXTURE_PERCENT: CompanyPaymentsStatus = {
  ...COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED,
  defaultDepositMode: "percent",
  defaultDepositPercentBps: 3000,
  defaultDepositFixedCents: null,
};

export const COMPANY_PAYMENTS_VISUAL_FIXTURE_NONE: CompanyPaymentsStatus = {
  ...COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED,
  defaultDepositMode: "none",
  defaultDepositPercentBps: null,
  defaultDepositFixedCents: null,
};

export const COMPANY_PRICING_VISUAL_FIXTURE: CompanyPricingSummaryInput = {
  configured: true,
  profitabilityType: "margin",
  defaultProfitabilityPct: 50,
  salesTaxRatePct: 0,
};

/** Whole-dollar contractor display — strips trailing .00 when cents are zero. */
export function formatContractorMoneyFromCents(cents: number): string {
  const safe = Number.isInteger(cents) ? cents : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: safe % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
  return formatted;
}
