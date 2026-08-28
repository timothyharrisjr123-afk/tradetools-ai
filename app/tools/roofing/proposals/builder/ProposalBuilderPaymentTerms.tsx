"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  PAYMENT_TERMS_BALANCE_ON_COMPLETION,
  PAYMENT_TERMS_SECTION_LABEL,
  formatPaymentTermsCustomerCopy,
  type ProposalPaymentDepositMode,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import { formatUsdFromCents, parseUsdInputToCents } from "@/app/lib/jobPaymentMoney";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS } from "@/app/lib/jobPaymentTypes";

type ProposalBuilderPaymentTermsProps = {
  proposalId: string;
  selectedTotalCents: number | null;
  /** Visual/review harness only. Production Builder always persists. */
  persist?: boolean;
  initialTerms?: ProposalPaymentTerms;
};

export default function ProposalBuilderPaymentTerms({
  proposalId,
  selectedTotalCents,
  persist = true,
  initialTerms,
}: ProposalBuilderPaymentTermsProps) {
  const [terms, setTerms] = useState<ProposalPaymentTerms>(
    initialTerms ?? DEFAULT_PROPOSAL_PAYMENT_TERMS
  );
  const [percent, setPercent] = useState("30");
  const [fixed, setFixed] = useState("3000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/proposals/${encodeURIComponent(proposalId)}/payment-terms`
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      terms?: ProposalPaymentTerms;
    };
    if (!response.ok || payload.ok !== true || !payload.terms) return;
    setTerms(payload.terms);
    if (payload.terms.depositPercentBps) {
      setPercent(String(payload.terms.depositPercentBps / 100));
    }
    if (payload.terms.depositFixedCents) {
      setFixed(String((payload.terms.depositFixedCents / 100).toFixed(2)));
    }
  }, [proposalId]);

  useEffect(() => {
    if (!persist) return;
    void load();
  }, [load, persist]);

  const save = async (next: ProposalPaymentTerms) => {
    if (!persist) {
      setTerms(next);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/proposals/${encodeURIComponent(proposalId)}/payment-terms`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositMode: next.depositMode,
            depositPercentBps: next.depositPercentBps,
            depositFixedCents: next.depositFixedCents,
          }),
        }
      );
      const payload = (await response.json()) as { ok?: boolean; code?: string };
      if (!response.ok || payload.ok !== true) {
        setError("Could not save payment terms.");
        return;
      }
      setTerms(next);
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(
    () => formatPaymentTermsCustomerCopy(terms, selectedTotalCents),
    [selectedTotalCents, terms]
  );

  const setMode = (mode: ProposalPaymentDepositMode) => {
    const percentBps =
      mode === "percent" ? Math.round(Number(percent) * 100) : null;
    const fixedCents = mode === "fixed" ? parseUsdInputToCents(fixed) : null;
    void save({
      ...terms,
      depositMode: mode,
      depositPercentBps:
        mode === "percent" && percentBps && percentBps >= 1 && percentBps <= 10000
          ? percentBps
          : mode === "percent"
            ? 3000
            : null,
      depositFixedCents:
        mode === "fixed" &&
        fixedCents != null &&
        fixedCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS
          ? fixedCents
          : mode === "fixed"
            ? 300000
            : null,
    });
  };

  return (
    <section
      className="border-t border-slate-200/70 px-5 py-4 sm:px-6"
      aria-labelledby="builder-payment-terms-heading"
      data-builder-payment-terms
      data-builder-payment-terms-mode={terms.depositMode}
    >
      <h3
        id="builder-payment-terms-heading"
        className="text-[13px] font-semibold text-slate-800"
      >
        {PAYMENT_TERMS_SECTION_LABEL}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["none", "No deposit"],
            ["percent", "Percentage"],
            ["fixed", "Fixed amount"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              terms.depositMode === mode
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            data-builder-deposit-mode={mode}
            disabled={saving}
            onClick={() => setMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      {terms.depositMode === "percent" ? (
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Percentage
          <input
            className="mt-1 w-full max-w-[10rem] rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={percent}
            inputMode="decimal"
            data-builder-deposit-percent
            onChange={(event) => setPercent(event.target.value)}
            onBlur={() => setMode("percent")}
          />
        </label>
      ) : null}
      {terms.depositMode === "fixed" ? (
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Amount
          <input
            className="mt-1 w-full max-w-[10rem] rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={fixed}
            inputMode="decimal"
            data-builder-deposit-fixed
            onChange={(event) => setFixed(event.target.value)}
            onBlur={() => setMode("fixed")}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {parseUsdInputToCents(fixed)
              ? formatUsdFromCents(parseUsdInputToCents(fixed)!)
              : "Enter dollars, minimum $1.00."}
          </span>
        </label>
      ) : null}
      <p className="mt-3 text-sm text-slate-700" data-builder-payment-terms-preview>
        {preview.depositLine}
      </p>
      <p className="text-sm text-slate-600">{PAYMENT_TERMS_BALANCE_ON_COMPLETION}</p>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
