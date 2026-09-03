"use client";

import {
  FIRST_PROPOSAL_RULES_HINT,
  FIRST_PROPOSAL_RULES_REQUIRED,
  FIRST_PROPOSAL_RULES_TITLE,
  type FirstProposalPricingRulesDraft,
} from "@/app/lib/firstProposalPrepare";
import type { ProfitabilityType } from "@/app/lib/proposalPricingTypes";

export type JobCardFirstProposalPricingRulesProps = {
  draft: FirstProposalPricingRulesDraft;
  onChange: (patch: Partial<FirstProposalPricingRulesDraft>) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  configured: boolean;
};

/**
 * Contextual company pricing-rules editor for Prepare proposal.
 * Persists through upsertCompanyPricingPolicy — not a parallel authority.
 */
export default function JobCardFirstProposalPricingRules({
  draft,
  onChange,
  onSave,
  saving,
  saveError,
  configured,
}: JobCardFirstProposalPricingRulesProps) {
  if (configured) return null;

  const setType = (profitabilityType: ProfitabilityType) => {
    onChange({ profitabilityType });
  };

  const rateNoun = draft.profitabilityType === "markup" ? "markup" : "margin";

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-first-proposal-pricing-rules
      aria-labelledby="first-proposal-pricing-rules-heading"
    >
      <h3
        id="first-proposal-pricing-rules-heading"
        className="text-sm font-semibold text-slate-900"
      >
        {FIRST_PROPOSAL_RULES_TITLE}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{FIRST_PROPOSAL_RULES_HINT}</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-700">How do you price this work?</p>
          <div
            className="mt-2 inline-flex min-h-[44px] rounded-lg border border-slate-200 bg-white p-0.5"
            role="group"
            aria-label="Pricing method"
          >
            <button
              type="button"
              aria-pressed={draft.profitabilityType === "margin"}
              onClick={() => setType("margin")}
              disabled={saving}
              className={
                "rounded-md px-3 py-2 text-sm font-medium transition " +
                (draft.profitabilityType === "margin"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Margin
            </button>
            <button
              type="button"
              aria-pressed={draft.profitabilityType === "markup"}
              onClick={() => setType("markup")}
              disabled={saving}
              className={
                "rounded-md px-3 py-2 text-sm font-medium transition " +
                (draft.profitabilityType === "markup"
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Markup
            </button>
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Target {rateNoun} (%)
          <input
            type="text"
            inputMode="decimal"
            value={draft.defaultProfitabilityPct}
            onChange={(event) => onChange({ defaultProfitabilityPct: event.target.value })}
            disabled={saving}
            placeholder="—"
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:max-w-xs"
            aria-label={`Target ${rateNoun} percent`}
          />
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            Used when an item is priced from cost. Items with a set unit price use that price.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Sales tax (%)
          <input
            type="text"
            inputMode="decimal"
            value={draft.salesTaxRatePct}
            onChange={(event) => onChange({ salesTaxRatePct: event.target.value })}
            disabled={saving}
            placeholder="—"
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:max-w-xs"
            aria-label="Sales tax percent"
          />
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            Enter 0 if you do not charge sales tax on proposals.
          </span>
        </label>
      </div>

      {saveError ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {saveError}
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{FIRST_PROPOSAL_RULES_REQUIRED}</p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto"
        data-first-proposal-save-pricing-rules
      >
        {saving ? "Saving…" : "Save pricing"}
      </button>
    </section>
  );
}
