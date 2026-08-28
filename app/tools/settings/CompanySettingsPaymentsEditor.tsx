"use client";

import FocusedEditor, {
  FOCUSED_EDITOR_CANCEL,
} from "@/app/components/ui/FocusedEditor";
import type { CompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";

export const PAYMENTS_CONNECTION_COPY =
  "Customers pay securely through Stripe Checkout. Available payment methods are shown by Stripe at checkout.";

export function stripeConnectionLabel(status: CompanyPaymentsStatus | null): string {
  if (!status?.connected) return "Not connected";
  if (status.chargesEnabled) return "Connected";
  if (status.detailsSubmitted) return "Finish your Stripe requirements";
  return "Setup in progress";
}

type CompanySettingsPaymentsEditorProps = {
  status: CompanyPaymentsStatus | null;
  error: string | null;
  onClose: () => void;
  onConnect: () => void;
  connecting: boolean;
};

export default function CompanySettingsPaymentsEditor({
  status,
  error,
  onClose,
  onConnect,
  connecting,
}: CompanySettingsPaymentsEditorProps) {
  const ready = status?.chargesEnabled === true;
  const connection = stripeConnectionLabel(status);
  const connectLabel = connecting
    ? "Opening Stripe…"
    : status?.connected
      ? "Finish Stripe setup"
      : "Connect Stripe";

  return (
    <FocusedEditor
      open
      title="Payments"
      description="How customers pay you."
      dirty={false}
      saving={false}
      saveDisabled
      saveLabel="Done"
      error={error}
      onClose={onClose}
      onSave={onClose}
    >
      <div data-company-settings-editor="payments" className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">Stripe</span>
          <span
            className={`text-sm font-semibold ${ready ? "text-emerald-700" : "text-slate-600"}`}
            data-payments-connection={connection}
          >
            {connection}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-500">{PAYMENTS_CONNECTION_COPY}</p>
        {ready ? null : (
          <button
            type="button"
            className={`${FOCUSED_EDITOR_CANCEL} mt-2 border border-slate-200`}
            disabled={connecting}
            onClick={onConnect}
          >
            {connectLabel}
          </button>
        )}
      </div>
    </FocusedEditor>
  );
}
