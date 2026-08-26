"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { parseInternalReturnTo } from "@/app/lib/proposalBuilderReadiness";
import {
  getResolvedCompanyPricingPolicy,
  upsertCompanyPricingPolicy,
} from "@/app/lib/companyPricingPolicyStore";
import { resolveStarterPricingPolicySeed } from "@/app/lib/companyPricingPolicy";
import type { ProfitabilityType } from "@/app/lib/proposalPricingTypes";
import {
  LOCKED_QUANTITY_ROUNDING,
  LOCKED_WASTE_MODEL,
  policyToPricingPolicyFormState,
  pricingPolicyFormStateToPolicy,
  starterSeedToPricingPolicyFormState,
  validatePricingPolicyFormState,
  type PricingPolicyFormState,
} from "./pricingPolicyFormUtils";

const inputClass =
  "block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

const sectionClass = "border-t border-slate-200 px-4 py-5 sm:px-5 first:border-t-0";

const labelClass = "block text-sm font-medium text-slate-700";

const hintClass = "mt-1 text-xs text-slate-500";

const sectionTitleClass = "text-sm font-semibold text-slate-900";

const sectionDescClass = "mt-0.5 text-sm text-slate-500";

/** Contractor-facing wording for the locked engine values. */
const QUANTITY_ROUNDING_LABELS: Record<string, string> = {
  exact: "Exact measurements",
  round_up: "Rounded up",
};

const WASTE_MODEL_LABELS: Record<string, string> = {
  adjusted_measurement: "Included in measurements",
  percentage: "Percentage added",
};

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function CompanyPricingPolicySettingsClient({
  companyId,
}: {
  companyId: string;
}) {
  const [form, setForm] = useState<PricingPolicyFormState | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [backToJobCardHref, setBackToJobCardHref] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBackToJobCardHref(parseInternalReturnTo(params.get("returnTo")));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resolution = await getResolvedCompanyPricingPolicy(companyId);
      if (resolution.configured && resolution.policy) {
        setForm(policyToPricingPolicyFormState(resolution.policy));
        setConfigured(true);
      } else {
        setForm(starterSeedToPricingPolicyFormState(resolveStarterPricingPolicySeed()));
        setConfigured(false);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateField = useCallback(
    <K extends keyof PricingPolicyFormState>(key: K, value: PricingPolicyFormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaveStatus({ kind: "idle" });
      setValidationError(null);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    const validation = validatePricingPolicyFormState(form);
    if (!validation.valid) {
      setValidationError(validation.reason);
      setSaveStatus({ kind: "idle" });
      return;
    }
    setValidationError(null);
    setSaveStatus({ kind: "saving" });

    const policy = pricingPolicyFormStateToPolicy(form);
    const written = await upsertCompanyPricingPolicy(companyId, policy);
    if (!written) {
      setSaveStatus({
        kind: "error",
        message: "Could not save pricing policy. Please try again.",
      });
      return;
    }

    // Re-fetch through the resolver so configured state reflects the DB.
    const resolution = await getResolvedCompanyPricingPolicy(companyId);
    if (resolution.configured && resolution.policy) {
      setForm(policyToPricingPolicyFormState(resolution.policy));
      setConfigured(true);
    }
    setSaveStatus({ kind: "saved" });
  }, [companyId, form]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 sm:pb-6" data-pricing-policy-page>
      {backToJobCardHref ? (
        <Link
          href={backToJobCardHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to job card
        </Link>
      ) : null}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pricing rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          {loading
            ? "Loading your pricing rules."
            : configured
              ? "Your default profitability and tax rates for new proposals."
              : "Start from these suggested rates, then save to make them yours."}
        </p>
      </header>

      {loading || !form ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          {[0, 1, 2].map((row) => (
            <div key={row} className="border-t border-slate-200 px-4 py-5 first:border-t-0 sm:px-5">
              <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-11 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>Pricing method</h2>
              <p className={sectionDescClass}>How profitability is applied to your costs.</p>
              <div className="mt-3.5">
                <label htmlFor="profitability-type" className={labelClass}>
                  Profitability type
                </label>
                <select
                  id="profitability-type"
                  value={form.profitabilityType}
                  onChange={(e) =>
                    updateField("profitabilityType", e.target.value as ProfitabilityType)
                  }
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="margin">Margin</option>
                  <option value="markup">Markup</option>
                </select>
                <p className={hintClass}>
                  Margin must stay below 100%. Markup may be 100% or higher.
                </p>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>Profitability</h2>
              <p className={sectionDescClass}>Your default rate and the lowest you will accept.</p>
              <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="default-pct" className={labelClass}>
                    Default profitability %
                  </label>
                  <input
                    id="default-pct"
                    type="number"
                    inputMode="decimal"
                    value={form.defaultProfitabilityPct}
                    onChange={(e) => updateField("defaultProfitabilityPct", e.target.value)}
                    placeholder="e.g. 50"
                    className={`${inputClass} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor="minimum-pct" className={labelClass}>
                    Minimum profitability %
                  </label>
                  <input
                    id="minimum-pct"
                    type="number"
                    inputMode="decimal"
                    value={form.minimumProfitabilityPct}
                    onChange={(e) => updateField("minimumProfitabilityPct", e.target.value)}
                    placeholder="e.g. 20"
                    className={`${inputClass} mt-1.5`}
                  />
                  <p className={hintClass}>Must be at or below the default.</p>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>Tax</h2>
              <p className={sectionDescClass}>
                Sales tax charged to customers, and material tax you pay.
              </p>
              <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sales-tax" className={labelClass}>
                    Sales tax rate %
                  </label>
                  <input
                    id="sales-tax"
                    type="number"
                    inputMode="decimal"
                    value={form.salesTaxRatePct}
                    onChange={(e) => updateField("salesTaxRatePct", e.target.value)}
                    placeholder="e.g. 0"
                    className={`${inputClass} mt-1.5`}
                  />
                </div>
                <div>
                  <label htmlFor="material-tax" className={labelClass}>
                    Material purchase tax %{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="material-tax"
                    type="number"
                    inputMode="decimal"
                    value={form.materialPurchaseTaxRatePct}
                    onChange={(e) => updateField("materialPurchaseTaxRatePct", e.target.value)}
                    placeholder="Leave blank for none"
                    className={`${inputClass} mt-1.5`}
                  />
                  <p className={hintClass}>Used in your costs, never shown to customers.</p>
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className={sectionTitleClass}>Measurement assumptions</h2>
              <p className={sectionDescClass}>These apply to every proposal.</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">Quantities</dt>
                  <dd className="font-medium text-slate-900">
                    {QUANTITY_ROUNDING_LABELS[LOCKED_QUANTITY_ROUNDING] ??
                      LOCKED_QUANTITY_ROUNDING}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">Waste</dt>
                  <dd className="font-medium text-slate-900">
                    {WASTE_MODEL_LABELS[LOCKED_WASTE_MODEL] ?? LOCKED_WASTE_MODEL}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            {validationError ? (
              <p className="mb-2 text-sm text-rose-600" role="alert">
                {validationError}
              </p>
            ) : null}
            {saveStatus.kind === "error" ? (
              <p className="mb-2 text-sm text-rose-600" role="alert">
                {saveStatus.message}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus.kind === "saving"}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-none"
              >
                {saveStatus.kind === "saving" ? "Saving…" : "Save pricing rules"}
              </button>
              {saveStatus.kind === "saved" ? (
                <span className="text-sm font-medium text-emerald-700" role="status">
                  Saved.
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
