"use client";

import { useMemo, useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import {
  collectPercentageAmountCents,
  formatUsdFromCents,
  parseUsdInputToCents,
} from "@/app/lib/jobPaymentMoney";
import {
  COLLECT_AMOUNT_MODES,
  JOB_CARD_PAYMENTS_CREATE_REQUEST_CTA,
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
  type CollectAmountMode,
} from "@/app/lib/jobPaymentTypes";

const MODE_LABEL: Record<CollectAmountMode, string> = {
  remaining: "Remaining",
  percentage: "Percentage",
  fixed: "Fixed",
};

type JobCardCollectPaymentSheetProps = {
  open: boolean;
  collectibleCents: number;
  contractTotalCents: number | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    amountMode: CollectAmountMode;
    percentageBps?: number;
    fixedAmount?: string;
  }) => void;
};

function percentToBps(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const bps = Math.round(Number(trimmed) * 100);
  if (!Number.isInteger(bps) || bps < 1 || bps > 10000) return null;
  return bps;
}

export default function JobCardCollectPaymentSheet({
  open,
  collectibleCents,
  contractTotalCents,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: JobCardCollectPaymentSheetProps) {
  const [mode, setMode] = useState<CollectAmountMode>("remaining");
  const [percent, setPercent] = useState("");
  const [fixed, setFixed] = useState("");

  const remainingLabel = formatUsdFromCents(Math.max(0, collectibleCents));
  const percentageBps = percentToBps(percent);
  const percentageCents =
    percentageBps != null && contractTotalCents != null
      ? collectPercentageAmountCents({
          contractTotalCents,
          percentageBps,
        })
      : null;
  const fixedCents = parseUsdInputToCents(fixed);

  const overLimit =
    (mode === "percentage" &&
      percentageCents != null &&
      percentageCents > collectibleCents) ||
    (mode === "fixed" && fixedCents != null && fixedCents > collectibleCents);

  const previewCents =
    mode === "remaining"
      ? collectibleCents
      : mode === "percentage"
        ? percentageCents
        : fixedCents;

  const valid = useMemo(() => {
    if (collectibleCents < JOB_PAYMENT_MIN_AMOUNT_CENTS) return false;
    if (mode === "remaining") return true;
    if (mode === "percentage") {
      return (
        percentageCents != null &&
        percentageCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS &&
        percentageCents <= collectibleCents
      );
    }
    return (
      fixedCents != null &&
      fixedCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS &&
      fixedCents <= collectibleCents
    );
  }, [collectibleCents, fixedCents, mode, percentageCents]);

  const dirty = mode !== "remaining" || percent.trim() !== "" || fixed.trim() !== "";

  if (!open) return null;

  return (
    <FocusedEditor
      open
      title="Collect payment"
      dirty={dirty}
      saving={submitting}
      saveDisabled={!valid || submitting}
      saveLabel={JOB_CARD_PAYMENTS_CREATE_REQUEST_CTA}
      savingLabel="Creating…"
      error={error}
      onClose={onClose}
      onSave={() => {
        if (!valid || submitting) return;
        if (mode === "remaining") {
          onSubmit({ amountMode: "remaining" });
          return;
        }
        if (mode === "percentage" && percentageBps != null) {
          onSubmit({ amountMode: "percentage", percentageBps });
          return;
        }
        if (mode === "fixed") {
          onSubmit({ amountMode: "fixed", fixedAmount: fixed.trim() });
        }
      }}
    >
      <div data-jobcard-collect-sheet className="space-y-4">
        <div>
          <p className={FOCUSED_EDITOR_LABEL}>Remaining to collect</p>
          <p
            className="mt-1 text-lg font-semibold tabular-nums text-slate-900"
            aria-live="polite"
            data-jobcard-collect-remaining
          >
            {remainingLabel}
          </p>
        </div>

        <fieldset>
          <legend className={FOCUSED_EDITOR_LABEL}>Amount to collect</legend>
          <div role="radiogroup" aria-label="Amount to collect" className="mt-2 flex flex-col gap-2">
            {COLLECT_AMOUNT_MODES.map((value) => (
              <label
                key={value}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800"
              >
                <input
                  type="radio"
                  name="jobcard-collect-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="h-4 w-4 shrink-0"
                  data-jobcard-collect-mode={value}
                />
                {MODE_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "percentage" ? (
          <label className={FOCUSED_EDITOR_LABEL}>
            Percent of contract
            <input
              className={FOCUSED_EDITOR_INPUT}
              value={percent}
              inputMode="decimal"
              onChange={(event) => setPercent(event.target.value)}
              data-jobcard-collect-percent
            />
          </label>
        ) : null}

        {mode === "fixed" ? (
          <label className={FOCUSED_EDITOR_LABEL}>
            Amount
            <input
              className={FOCUSED_EDITOR_INPUT}
              value={fixed}
              inputMode="decimal"
              onChange={(event) => setFixed(event.target.value)}
              data-jobcard-collect-fixed
            />
          </label>
        ) : null}

        {previewCents != null && !overLimit ? (
          <p className={FOCUSED_EDITOR_HINT} data-jobcard-collect-preview>
            {mode === "percentage" && percentageBps != null && contractTotalCents != null
              ? `${percent.trim()}% of ${formatUsdFromCents(contractTotalCents)} = ${formatUsdFromCents(previewCents)}`
              : formatUsdFromCents(previewCents)}
          </p>
        ) : null}

        {overLimit ? (
          <p className="text-sm text-rose-600" role="alert" data-jobcard-collect-over-limit>
            You have {remainingLabel} remaining to collect.
          </p>
        ) : null}
      </div>
    </FocusedEditor>
  );
}
