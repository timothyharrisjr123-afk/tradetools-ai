"use client";

import { useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_CANCEL,
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import { formatUsdFromCents, parseUsdInputToCents } from "@/app/lib/jobPaymentMoney";
import type { CompanyPaymentDepositMode } from "@/app/lib/jobPaymentTypes";
import type { CompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";

export const PAYMENTS_CONNECTION_COPY =
  "Customers pay through Stripe Checkout. Stripe presents the payment methods they can use, and funds go straight to your Stripe account.";

export const PAYMENTS_DEPOSIT_COPY =
  "Prefills payment terms on new proposals. Sent and accepted proposals keep the terms they were sent with.";

export function stripeConnectionLabel(status: CompanyPaymentsStatus | null): string {
  if (!status?.connected) return "Not connected";
  if (status.chargesEnabled) return "Connected";
  if (status.detailsSubmitted) return "Finish your Stripe requirements";
  return "Setup in progress";
}

/** Mounted only while open, so the draft seeds from saved truth on open. */
type CompanySettingsPaymentsEditorProps = {
  status: CompanyPaymentsStatus | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: {
    defaultDepositMode: CompanyPaymentDepositMode;
    defaultDepositPercentBps: number | null;
    defaultDepositFixedCents: number | null;
  }) => void;
  onConnect: () => void;
  connecting: boolean;
};

export default function CompanySettingsPaymentsEditor({
  status,
  saving,
  error,
  onClose,
  onSave,
  onConnect,
  connecting,
}: CompanySettingsPaymentsEditorProps) {
  const [mode, setMode] = useState<CompanyPaymentDepositMode>(
    status?.defaultDepositMode ?? "none"
  );
  const [percent, setPercent] = useState(() =>
    status?.defaultDepositPercentBps
      ? String(status.defaultDepositPercentBps / 100)
      : "20"
  );
  const [fixed, setFixed] = useState(() =>
    status?.defaultDepositFixedCents ? String(status.defaultDepositFixedCents / 100) : "500"
  );
  const [touched, setTouched] = useState(false);

  const fixedCents = parseUsdInputToCents(fixed);
  const percentValid = /^\d+(\.\d{1,2})?$/.test(percent.trim()) && Number(percent) > 0;
  const saveDisabled =
    (mode === "percent" && !percentValid) ||
    (mode === "fixed" && (fixedCents == null || fixedCents < 100));

  // Once Stripe can charge there is nothing left to do, so no control appears.
  const ready = status?.chargesEnabled === true;
  const connectLabel = connecting
    ? "Opening Stripe…"
    : status?.connected
      ? "Finish Stripe setup"
      : "Connect Stripe";

  return (
    <FocusedEditor
      open
      title="Payments"
      description="How you collect deposits and balances from customers."
      dirty={touched}
      saving={saving}
      saveDisabled={saveDisabled}
      saveLabel="Save"
      error={error}
      onClose={onClose}
      onSave={() =>
        onSave({
          defaultDepositMode: mode,
          defaultDepositPercentBps:
            mode === "percent" ? Math.round(Number(percent) * 100) : null,
          defaultDepositFixedCents: mode === "fixed" ? fixedCents : null,
        })
      }
    >
      <div data-company-settings-editor="payments" className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className={FOCUSED_EDITOR_LABEL}>Stripe</span>
          <span
            className={`text-sm font-medium ${ready ? "text-emerald-700" : "text-slate-600"}`}
            data-payments-connection={stripeConnectionLabel(status)}
          >
            {stripeConnectionLabel(status)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-500">{PAYMENTS_CONNECTION_COPY}</p>
        {ready ? null : (
          <button
            type="button"
            className={FOCUSED_EDITOR_CANCEL}
            disabled={connecting}
            onClick={onConnect}
          >
            {connectLabel}
          </button>
        )}
      </div>

      <div className="border-t border-slate-200 pt-5">
        <label className={FOCUSED_EDITOR_LABEL}>
          Default deposit
          <select
            className={FOCUSED_EDITOR_INPUT}
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as CompanyPaymentDepositMode);
              setTouched(true);
            }}
          >
            <option value="none">No deposit</option>
            <option value="percent">Percent of the total</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        <p className={FOCUSED_EDITOR_HINT}>{PAYMENTS_DEPOSIT_COPY}</p>
      </div>

      {mode === "percent" ? (
        <div>
          <label className={FOCUSED_EDITOR_LABEL}>
            Percent
            <input
              className={FOCUSED_EDITOR_INPUT}
              value={percent}
              inputMode="decimal"
              onChange={(event) => {
                setPercent(event.target.value);
                setTouched(true);
              }}
            />
          </label>
          <p className={percentValid ? FOCUSED_EDITOR_HINT : "mt-1 text-xs text-rose-600"}>
            {percentValid ? "Example: 30 for a 30% deposit." : "Enter a percent above 0."}
          </p>
        </div>
      ) : null}

      {mode === "fixed" ? (
        <div>
          <label className={FOCUSED_EDITOR_LABEL}>
            Amount
            <input
              className={FOCUSED_EDITOR_INPUT}
              value={fixed}
              inputMode="decimal"
              onChange={(event) => {
                setFixed(event.target.value);
                setTouched(true);
              }}
            />
          </label>
          <p
            className={
              fixedCents != null && fixedCents >= 100
                ? FOCUSED_EDITOR_HINT
                : "mt-1 text-xs text-rose-600"
            }
          >
            {fixedCents != null && fixedCents >= 100
              ? formatUsdFromCents(fixedCents)
              : "Enter dollars, minimum $1.00."}
          </p>
        </div>
      ) : null}
    </FocusedEditor>
  );
}
