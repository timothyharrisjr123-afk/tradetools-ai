"use client";

import {
  FIRST_PROPOSAL_PRICE_THIS_ITEM,
  FIRST_PROPOSAL_PRICING_HINT,
  FIRST_PROPOSAL_PRICING_TITLE,
  FIRST_PROPOSAL_PRICES_REQUIRED,
  type FirstProposalPricingLine,
  formatCentsAsDollarInput,
} from "@/app/lib/firstProposalPrepare";

export type JobCardFirstProposalPricingProps = {
  lines: readonly FirstProposalPricingLine[];
  draftPrices: Record<string, string>;
  onDraftChange: (catalogItemId: string, value: string) => void;
  onSaveAll: () => void;
  saving: boolean;
  saveError: string | null;
  allPriced: boolean;
};

/**
 * Focused Catalog price editor for the first proposal — writes unit_price_cents only.
 */
export default function JobCardFirstProposalPricing({
  lines,
  draftPrices,
  onDraftChange,
  onSaveAll,
  saving,
  saveError,
  allPriced,
}: JobCardFirstProposalPricingProps) {
  if (lines.length === 0) return null;

  const missingCount = lines.filter((line) => line.needsPrice).length;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      data-first-proposal-pricing
      aria-labelledby="first-proposal-pricing-heading"
    >
      <h3
        id="first-proposal-pricing-heading"
        className="text-sm font-semibold text-slate-900"
      >
        {FIRST_PROPOSAL_PRICING_TITLE}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {FIRST_PROPOSAL_PRICING_HINT}
      </p>

      <ul className="mt-4 space-y-3">
        {lines.map((line) => {
          const draft = draftPrices[line.catalogItemId];
          const display =
            draft !== undefined
              ? draft
              : formatCentsAsDollarInput(line.unitPriceCents);
          const showMissing = line.needsPrice && display.trim() === "";

          return (
            <li
              key={line.catalogItemId}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
              data-first-proposal-price-row={line.catalogItemId}
              data-needs-price={line.needsPrice ? "true" : "false"}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">{line.name}</div>
                <div className="text-xs text-slate-500">per {line.unitLabel}</div>
                {showMissing ? (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {FIRST_PROPOSAL_PRICE_THIS_ITEM}
                  </div>
                ) : null}
              </div>
              <div className="relative w-full sm:w-36">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Price for ${line.name}`}
                  value={display}
                  onChange={(event) =>
                    onDraftChange(line.catalogItemId, event.target.value)
                  }
                  placeholder="—"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  data-missing-price={showMissing ? "true" : "false"}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {saveError ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {saveError}
        </p>
      ) : null}

      {!allPriced ? (
        <p className="mt-3 text-xs text-slate-500">
          {FIRST_PROPOSAL_PRICES_REQUIRED}
          {missingCount > 0 ? ` (${missingCount} left)` : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSaveAll}
        disabled={saving}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto"
        data-first-proposal-save-prices
      >
        {saving ? "Saving…" : allPriced ? "Prices saved" : "Save prices"}
      </button>
    </section>
  );
}
