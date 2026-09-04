"use client";

import FocusedEditor, {
  FOCUSED_EDITOR_CANCEL,
} from "@/app/components/ui/FocusedEditor";
import type { CompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";

export const PAYMENTS_CONNECTION_COPY =
  "Customers pay securely through Stripe Checkout. Available payment methods are shown by Stripe at checkout.";

/** Load truth for Stripe connection — never collapse unknown into disconnected. */
export type PaymentsConnectionLoadStatus = "loading" | "ready" | "error";

export type PaymentsConnectionView =
  | { kind: "loading"; label: "Checking…" }
  | { kind: "error"; label: "Couldn't load status" }
  | { kind: "not_connected"; label: "Not connected" }
  | { kind: "setup_incomplete"; label: "Finish your Stripe requirements" | "Setup in progress" }
  | { kind: "connected"; label: "Connected" };

/**
 * Canonical Payments connection presentation.
 * `status` is only trusted when `loadStatus === "ready"`.
 */
export function resolvePaymentsConnectionView(
  status: CompanyPaymentsStatus | null,
  loadStatus: PaymentsConnectionLoadStatus
): PaymentsConnectionView {
  if (loadStatus === "loading") {
    return { kind: "loading", label: "Checking…" };
  }
  if (loadStatus === "error") {
    return { kind: "error", label: "Couldn't load status" };
  }
  if (!status?.connected) {
    return { kind: "not_connected", label: "Not connected" };
  }
  if (status.chargesEnabled) {
    return { kind: "connected", label: "Connected" };
  }
  if (status.detailsSubmitted) {
    return { kind: "setup_incomplete", label: "Finish your Stripe requirements" };
  }
  return { kind: "setup_incomplete", label: "Setup in progress" };
}

/** @deprecated Prefer resolvePaymentsConnectionView — kept for call-site migration clarity. */
export function stripeConnectionLabel(
  status: CompanyPaymentsStatus | null,
  loadStatus: PaymentsConnectionLoadStatus = "ready"
): string {
  return resolvePaymentsConnectionView(status, loadStatus).label;
}

type CompanySettingsPaymentsEditorProps = {
  status: CompanyPaymentsStatus | null;
  loadStatus: PaymentsConnectionLoadStatus;
  error: string | null;
  onClose: () => void;
  onConnect: () => void;
  connecting: boolean;
};

export default function CompanySettingsPaymentsEditor({
  status,
  loadStatus,
  error,
  onClose,
  onConnect,
  connecting,
}: CompanySettingsPaymentsEditorProps) {
  const view = resolvePaymentsConnectionView(status, loadStatus);
  const ready = view.kind === "connected";
  const showConnectAction =
    loadStatus === "ready" && (view.kind === "not_connected" || view.kind === "setup_incomplete");
  const connectLabel = connecting
    ? "Opening Stripe…"
    : view.kind === "setup_incomplete"
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
            className={`text-sm font-semibold ${
              ready
                ? "text-emerald-700"
                : view.kind === "loading"
                  ? "text-slate-400"
                  : "text-slate-600"
            }`}
            data-payments-connection={view.label}
            data-payments-connection-kind={view.kind}
            aria-live="polite"
          >
            {view.label}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-500">{PAYMENTS_CONNECTION_COPY}</p>
        {showConnectAction ? (
          <button
            type="button"
            className={`${FOCUSED_EDITOR_CANCEL} mt-2 border border-slate-200`}
            disabled={connecting}
            onClick={onConnect}
            data-payments-connect-action
          >
            {connectLabel}
          </button>
        ) : null}
      </div>
    </FocusedEditor>
  );
}
