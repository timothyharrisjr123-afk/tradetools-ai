"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  "w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm";

const sectionClass =
  "rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl";

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
    <main className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 pb-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/tools/settings"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white/90 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <h1 className="text-xl font-semibold text-white/95 mb-2">Company Pricing Policy</h1>
        <p className="text-sm text-white/60 mb-4">
          Your company default profitability and tax settings. Used to price proposals once wired
          into the Builder. This is not a customer quote.
        </p>

        {/* Configured vs starter status */}
        <div className="mb-6">
          {loading ? (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
              Loading pricing policy…
            </span>
          ) : configured ? (
            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Company pricing policy configured
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              Starter defaults — not saved yet
            </span>
          )}
        </div>

        {loading || !form ? null : (
          <div className="space-y-5">
            {/* Pricing method */}
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold text-white/90 mb-1">Pricing method</h2>
              <p className="text-xs text-white/60 mb-4">
                How profitability is applied to costs.
              </p>
              <div className="space-y-1.5">
                <label
                  htmlFor="profitability-type"
                  className="block text-sm font-medium text-slate-300"
                >
                  Profitability type
                </label>
                <select
                  id="profitability-type"
                  value={form.profitabilityType}
                  onChange={(e) =>
                    updateField("profitabilityType", e.target.value as ProfitabilityType)
                  }
                  className={inputClass}
                >
                  <option value="margin">Margin</option>
                  <option value="markup">Markup</option>
                </select>
                <p className="mt-1 text-xs text-white/50">
                  Margin must stay below 100%. Markup may be 100% or higher.
                </p>
              </div>
            </div>

            {/* Profitability */}
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold text-white/90 mb-1">Profitability</h2>
              <p className="text-xs text-white/60 mb-4">Default and floor profitability percentages.</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="default-pct"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Default profitability %
                  </label>
                  <input
                    id="default-pct"
                    type="number"
                    inputMode="decimal"
                    value={form.defaultProfitabilityPct}
                    onChange={(e) => updateField("defaultProfitabilityPct", e.target.value)}
                    placeholder="e.g. 50"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="minimum-pct"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Minimum profitability %
                  </label>
                  <input
                    id="minimum-pct"
                    type="number"
                    inputMode="decimal"
                    value={form.minimumProfitabilityPct}
                    onChange={(e) => updateField("minimumProfitabilityPct", e.target.value)}
                    placeholder="e.g. 20"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-white/50">
                    Must be less than or equal to the default.
                  </p>
                </div>
              </div>
            </div>

            {/* Tax */}
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold text-white/90 mb-1">Tax</h2>
              <p className="text-xs text-white/60 mb-4">
                Customer sales tax and optional internal material purchase tax.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="sales-tax"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Sales tax rate %
                  </label>
                  <input
                    id="sales-tax"
                    type="number"
                    inputMode="decimal"
                    value={form.salesTaxRatePct}
                    onChange={(e) => updateField("salesTaxRatePct", e.target.value)}
                    placeholder="e.g. 0"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-tax"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Material purchase tax % <span className="text-white/50">(optional)</span>
                  </label>
                  <input
                    id="material-tax"
                    type="number"
                    inputMode="decimal"
                    value={form.materialPurchaseTaxRatePct}
                    onChange={(e) => updateField("materialPurchaseTaxRatePct", e.target.value)}
                    placeholder="Leave blank for none"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-white/50">
                    Internal only. Leave blank to store no material purchase tax.
                  </p>
                </div>
              </div>
            </div>

            {/* Locked assumptions */}
            <div className={sectionClass}>
              <h2 className="text-sm font-semibold text-white/90 mb-1">Locked assumptions</h2>
              <p className="text-xs text-white/60 mb-4">
                Fixed for this phase — not editable yet.
              </p>
              <div className="space-y-2 text-sm text-white/80">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-white/70">Quantity rounding</span>
                  <span className="font-medium text-white/90">{LOCKED_QUANTITY_ROUNDING}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-white/70">Waste model</span>
                  <span className="font-medium text-white/90">{LOCKED_WASTE_MODEL}</span>
                </div>
              </div>
            </div>

            {/* Save status */}
            <div className={sectionClass}>
              {validationError ? (
                <p className="mb-3 text-sm text-rose-300" role="alert">
                  {validationError}
                </p>
              ) : null}
              {saveStatus.kind === "error" ? (
                <p className="mb-3 text-sm text-rose-300" role="alert">
                  {saveStatus.message}
                </p>
              ) : null}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveStatus.kind === "saving"}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/15 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saveStatus.kind === "saving" ? "Saving..." : "Save Pricing Policy"}
                </button>
                {saveStatus.kind === "saved" ? (
                  <span className="text-sm text-emerald-400/90">Pricing policy saved.</span>
                ) : null}
              </div>
              <p className="mt-4 text-xs text-white/45">
                Starter defaults are a seed only and are never saved until you click Save. The
                Proposal Builder continues to use its preview placeholder until pricing wiring is
                enabled.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
