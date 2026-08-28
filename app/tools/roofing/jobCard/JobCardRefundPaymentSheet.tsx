"use client";

import { useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { JOB_PAYMENT_REFUND_MAX_REASON_LENGTH } from "@/app/lib/jobPaymentTypes";

export function parseRefundDollarText(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 1 ? cents : null;
}

type Props = {
  open: boolean;
  originalPaymentCents: number;
  alreadyRefundedCents: number;
  refundableCents: number;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    amountCents: number;
    reason: string;
    commandId: string;
  }) => Promise<{ ok: boolean; code?: string }>;
};

export default function JobCardRefundPaymentSheet({
  open,
  originalPaymentCents,
  alreadyRefundedCents,
  refundableCents,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [commandId] = useState(() => crypto.randomUUID());
  const amountCents = parseRefundDollarText(amount);
  const valid =
    amountCents != null &&
    amountCents <= refundableCents &&
    reason.length <= JOB_PAYMENT_REFUND_MAX_REASON_LENGTH;
  const amountLabel = amountCents == null ? null : formatUsdFromCents(amountCents);
  const busy = submitting || localSubmitting;

  if (!open) return null;

  return (
    <FocusedEditor
      open
      title={confirming && amountLabel ? `Refund ${amountLabel}?` : "Refund payment"}
      dirty={amount.length > 0 || reason.length > 0}
      saving={busy}
      saveDisabled={!valid || busy}
      saveLabel={confirming && amountLabel ? `Refund ${amountLabel}` : "Continue"}
      savingLabel="Refunding…"
      error={error}
      onClose={onClose}
      onSave={() => {
        if (!valid || amountCents == null || busy) return;
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setLocalSubmitting(true);
        void onSubmit({ amountCents, reason: reason.trim(), commandId }).finally(() => {
          setLocalSubmitting(false);
        });
      }}
    >
      <div className="space-y-4" data-jobcard-refund-sheet>
        <style jsx global>{`
          @media (max-width: 639px) {
            [data-focused-editor]:has([data-jobcard-refund-sheet])
              [data-focused-editor-save] {
              width: 100%;
            }
            [data-focused-editor]:has([data-jobcard-refund-sheet])
              div:has(> [data-focused-editor-save]) {
              flex-direction: column-reverse;
              align-items: stretch;
            }
          }
        `}</style>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Original payment</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatUsdFromCents(originalPaymentCents)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Already refunded</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatUsdFromCents(alreadyRefundedCents)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Refundable now</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatUsdFromCents(refundableCents)}
            </dd>
          </div>
        </dl>

        {!confirming ? (
          <>
            <label className={FOCUSED_EDITOR_LABEL}>
              Refund amount
              <input
                className={FOCUSED_EDITOR_INPUT}
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                data-jobcard-refund-amount
              />
            </label>
            {amountCents != null && amountCents > refundableCents ? (
              <p className="text-sm text-rose-600" role="alert">
                Enter no more than {formatUsdFromCents(refundableCents)}.
              </p>
            ) : null}
            <label className={FOCUSED_EDITOR_LABEL}>
              Internal reason (optional)
              <textarea
                className={FOCUSED_EDITOR_INPUT}
                value={reason}
                maxLength={JOB_PAYMENT_REFUND_MAX_REASON_LENGTH}
                onChange={(event) => setReason(event.target.value)}
                data-jobcard-refund-reason
              />
            </label>
          </>
        ) : (
          <p className="text-sm text-slate-700">
            This sends {amountLabel} back to the customer.
          </p>
        )}

        <p className={FOCUSED_EDITOR_HINT}>
          Refunding this payment does not change the customer’s remaining contract balance.
        </p>
      </div>
    </FocusedEditor>
  );
}
