/**
 * Company Settings data access for the summary-first page.
 *
 * Each loader returns a small, presentation-ready shape so the client can show
 * real state before it offers editing. Branding load/save keeps using the
 * existing single persistence path in settingsCompanyBrandingPersistence.
 */

import type { CompanyPaymentDepositMode } from "@/app/lib/jobPaymentTypes";
import { parseCompanyTimezoneGetResult } from "@/app/lib/jobScheduleMapper";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import type { CompanyPricingSummaryInput } from "@/app/lib/companySettingsSummary";

export type CompanyPaymentsStatus = {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  defaultDepositMode: CompanyPaymentDepositMode;
  defaultDepositPercentBps: number | null;
  defaultDepositFixedCents: number | null;
};

type PaymentsStatusPayload = {
  ok?: boolean;
  connected?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  settings?: {
    defaultDepositMode?: CompanyPaymentDepositMode;
    defaultDepositPercentBps?: number | null;
    defaultDepositFixedCents?: number | null;
  };
};

export function parseCompanyPaymentsStatus(
  responseOk: boolean,
  json: unknown
): CompanyPaymentsStatus | null {
  if (!responseOk || !json || typeof json !== "object") return null;
  const payload = json as PaymentsStatusPayload;
  if (payload.ok !== true) return null;

  return {
    connected: payload.connected === true,
    chargesEnabled: payload.chargesEnabled === true,
    detailsSubmitted: payload.detailsSubmitted === true,
    defaultDepositMode: payload.settings?.defaultDepositMode ?? "none",
    defaultDepositPercentBps: payload.settings?.defaultDepositPercentBps ?? null,
    defaultDepositFixedCents: payload.settings?.defaultDepositFixedCents ?? null,
  };
}

export async function loadCompanyPaymentsStatus(): Promise<CompanyPaymentsStatus | null> {
  try {
    const response = await fetch("/api/company/payments/status");
    const json = await response.json().catch(() => null);
    return parseCompanyPaymentsStatus(response.ok, json);
  } catch {
    return null;
  }
}

export async function loadCompanyTimezone(): Promise<{
  status: "ready" | "error";
  timezone: string | null;
}> {
  try {
    const response = await fetch("/api/company/timezone");
    const json = await response.json().catch(() => null);
    return parseCompanyTimezoneGetResult(response.ok, json);
  } catch {
    return { status: "error", timezone: null };
  }
}

export async function saveCompanyTimezone(
  timezone: string
): Promise<{ ok: boolean; timezone: string | null }> {
  try {
    const response = await fetch("/api/company/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; timezone?: unknown }
      | null;
    if (!response.ok || json?.ok !== true) return { ok: false, timezone: null };
    return {
      ok: true,
      timezone: typeof json.timezone === "string" ? json.timezone : timezone,
    };
  } catch {
    return { ok: false, timezone: null };
  }
}

export async function saveCompanyPaymentDefaults(input: {
  defaultDepositMode: CompanyPaymentDepositMode;
  defaultDepositPercentBps: number | null;
  defaultDepositFixedCents: number | null;
}): Promise<boolean> {
  try {
    const response = await fetch("/api/company/payments/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function startCompanyStripeOnboarding(): Promise<{
  url: string | null;
  ok: boolean;
}> {
  try {
    const response = await fetch("/api/company/payments/connect", { method: "POST" });
    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; url?: string | null }
      | null;
    return {
      ok: response.ok && json?.ok === true,
      url: typeof json?.url === "string" ? json.url : null,
    };
  } catch {
    return { ok: false, url: null };
  }
}

/** Read-only pricing summary. All pricing math stays on the Pricing page. */
export async function loadCompanyPricingSummary(
  companyId: string
): Promise<CompanyPricingSummaryInput | null> {
  const resolution = await getResolvedCompanyPricingPolicy(companyId);
  const policy = resolution.policy;
  if (!resolution.configured || !policy) {
    return {
      configured: false,
      profitabilityType: "margin",
      defaultProfitabilityPct: null,
      salesTaxRatePct: null,
    };
  }
  return {
    configured: true,
    profitabilityType: policy.profitabilityType,
    defaultProfitabilityPct: policy.defaultProfitabilityPct,
    salesTaxRatePct: policy.tax.salesTaxRatePct,
  };
}
