"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import CompanySettingsBrandingEditor from "@/app/tools/settings/CompanySettingsBrandingEditor";
import CompanySettingsBusinessEditor from "@/app/tools/settings/CompanySettingsBusinessEditor";
import CompanySettingsPaymentsEditor from "@/app/tools/settings/CompanySettingsPaymentsEditor";
import CompanySettingsPreferencesEditor from "@/app/tools/settings/CompanySettingsPreferencesEditor";
import {
  summarizeBranding,
  summarizeBusiness,
  summarizePayments,
  summarizePricing,
  summarizeTimezone,
} from "@/app/lib/companySettingsSummary";
import {
  COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED,
  COMPANY_PAYMENTS_VISUAL_FIXTURE_NONE,
  COMPANY_PAYMENTS_VISUAL_FIXTURE_PERCENT,
  COMPANY_PRICING_VISUAL_FIXTURE,
  COMPANY_SETTINGS_VISUAL_FIXTURE,
} from "@/app/lib/companySettingsVisualFixture";
import {
  LOCKED_QUANTITY_ROUNDING,
  LOCKED_WASTE_MODEL,
} from "@/app/tools/settings/pricing/pricingPolicyFormUtils";

/**
 * Cohesion B final polish — visual review harness only.
 * Renders Company Settings surfaces with one canonical Anderson Roofing fixture.
 * Never writes to production company rows.
 */

const ROW =
  "group flex w-full items-start gap-3 px-4 py-3.5 text-left sm:items-center sm:gap-4 sm:px-5 sm:py-4";

const ROW_ACTION =
  "flex shrink-0 items-center gap-0.5 self-start pt-0.5 text-sm font-medium text-blue-600 sm:self-center sm:pt-0";

const QUANTITY_LABELS: Record<string, string> = {
  exact: "Exact measurements",
  round_up: "Rounded up",
};

const WASTE_LABELS: Record<string, string> = {
  adjusted_measurement: "Included in measurements",
  percentage: "Percentage added",
};

function noop() {
  /* review harness */
}

function SummaryReview({
  business,
  branding,
  payments,
  pricing,
  timezone,
}: {
  business: ReturnType<typeof summarizeBusiness>;
  branding: string;
  payments: string;
  pricing: string;
  timezone: string;
}) {
  const rows = [
    { label: "Business", title: business.title, details: business.details, action: "Edit", id: "business" },
    { label: "Branding", detail: branding, action: "Edit", id: "branding" },
    { label: "Payments", detail: payments, action: "Manage", id: "payments" },
    { label: "Pricing", detail: pricing, action: "Manage", id: "pricing" },
    { label: "Preferences", detail: timezone, action: "Edit", id: "preferences" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Company settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your business identity, branding, payments, and pricing.
        </p>
      </header>
      <div
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
        data-company-settings-summary
      >
        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={row.id} className={ROW} data-company-settings-row={row.id}>
              <span className="min-w-0 flex-1">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  {row.label}
                </span>
                {"title" in row && row.title ? (
                  <span className="mt-1 block text-[15px] font-semibold leading-snug text-slate-900">
                    {row.title}
                  </span>
                ) : null}
                {"details" in row && row.details ? (
                  <span className="mt-0.5 block space-y-0.5">
                    {row.details.map((line) => (
                      <span
                        key={line}
                        className="block text-sm leading-snug text-slate-500 [overflow-wrap:anywhere]"
                      >
                        {line}
                      </span>
                    ))}
                  </span>
                ) : "detail" in row ? (
                  <span className="mt-0.5 block text-sm leading-snug text-slate-500">{row.detail}</span>
                ) : null}
              </span>
              <span className={ROW_ACTION}>
                {row.action}
                <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingReviewHarness({ dirty }: { dirty: boolean }) {
  const sectionClass = "border-t border-slate-100 px-4 py-3 first:border-t-0 sm:px-5 sm:py-3.5";
  return (
    <div
      className={`mx-auto w-full max-w-2xl space-y-5 ${dirty ? "pb-40 sm:pb-8" : "pb-6"}`}
      data-pricing-policy-page
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pricing rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your default profitability and tax rates for new proposals.
        </p>
      </header>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-900">Pricing method</h2>
          <p className="mt-0.5 text-sm text-slate-500">How profit is applied to your costs.</p>
          <label className="mt-2.5 block text-sm font-medium text-slate-700">
            Profitability type
            <select className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" defaultValue="margin">
              <option value="margin">Margin</option>
            </select>
          </label>
        </div>
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-900">Profitability</h2>
          <p className="mt-0.5 text-sm text-slate-500">Your default margin and minimum acceptable margin.</p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Default margin
              <input className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" defaultValue="50" readOnly />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Minimum margin
              <input className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" defaultValue="20" readOnly />
            </label>
          </div>
        </div>
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-slate-900">Tax</h2>
          <p className="mt-0.5 text-sm text-slate-500">Sales tax charged to customers and material tax used in costs.</p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Sales tax rate %
              <input className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" defaultValue="0" readOnly />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Material purchase tax %
              <input className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="Leave blank for none" readOnly />
            </label>
          </div>
        </div>
        <div className={sectionClass} data-pricing-measurement-section>
          <h2 className="text-sm font-semibold text-slate-900">Measurement assumptions</h2>
          <p className="mt-0.5 text-sm text-slate-500">How proposal quantities are interpreted.</p>
          <dl className="mt-2.5 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Quantities</dt>
              <dd className="font-medium text-slate-900">{QUANTITY_LABELS[LOCKED_QUANTITY_ROUNDING]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Waste</dt>
              <dd className="font-medium text-slate-900">{WASTE_LABELS[LOCKED_WASTE_MODEL]}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div
        className={`${
          dirty
            ? "fixed inset-x-3 bottom-3 z-30 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"
            : "hidden"
        }`}
        data-pricing-save-footer
      >
        <button
          type="button"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white sm:w-auto"
          data-pricing-save
        >
          Save pricing rules
        </button>
      </div>
    </div>
  );
}

export default function CohesionBFinalPolishHarness() {
  const params = useSearchParams();
  const view = params.get("view") ?? "summary";

  const profile = COMPANY_SETTINGS_VISUAL_FIXTURE;
  const business = useMemo(() => summarizeBusiness(profile), [profile]);
  const paymentsFixed = summarizePayments(COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED);
  const pricingSummary = summarizePricing(COMPANY_PRICING_VISUAL_FIXTURE);
  const timezone = summarizeTimezone("America/Chicago");

  const paymentsStatus =
    view === "payments-percent"
      ? COMPANY_PAYMENTS_VISUAL_FIXTURE_PERCENT
      : view === "payments-none"
        ? COMPANY_PAYMENTS_VISUAL_FIXTURE_NONE
        : COMPANY_PAYMENTS_VISUAL_FIXTURE_FIXED;

  const shellProps =
    view === "pricing" || view.startsWith("pricing-")
      ? { activeNav: "pricing" as const }
      : { activeNav: "company" as const };

  return (
    <FieldDiveAppShell {...shellProps}>
      {view === "summary" ? (
        <SummaryReview
          business={business}
          branding={summarizeBranding(profile)}
          payments={paymentsFixed}
          pricing={pricingSummary}
          timezone={timezone}
        />
      ) : null}

      {view === "business" ? (
        <CompanySettingsBusinessEditor
          profile={profile}
          saving={false}
          error={null}
          onClose={noop}
          onSave={noop}
        />
      ) : null}

      {view === "branding" ? (
        <CompanySettingsBrandingEditor
          profile={profile}
          saving={false}
          error={null}
          onClose={noop}
          onSave={noop}
        />
      ) : null}

      {view.startsWith("payments") ? (
        <CompanySettingsPaymentsEditor
          status={paymentsStatus}
          error={null}
          connecting={false}
          onClose={noop}
          onConnect={noop}
        />
      ) : null}

      {view === "preferences" ? (
        <CompanySettingsPreferencesEditor
          savedTimezone="America/Chicago"
          loadStatus="ready"
          saving={false}
          error={null}
          onClose={noop}
          onSave={noop}
        />
      ) : null}

      {view === "pricing" || view === "pricing-dirty" ? (
        <PricingReviewHarness dirty={view === "pricing-dirty"} />
      ) : null}
    </FieldDiveAppShell>
  );
}
