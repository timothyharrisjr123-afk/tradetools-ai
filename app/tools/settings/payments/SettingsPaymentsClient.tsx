"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import {
  SETTINGS_ALERT_ERROR,
  SETTINGS_CARD,
  SETTINGS_FIELD_HELP,
  SETTINGS_INPUT,
  SETTINGS_LABEL,
  SETTINGS_PRIMARY_BUTTON,
  SETTINGS_SECTION_DESC,
  SETTINGS_SECTION_TITLE,
} from "@/app/tools/settings/settingsConstants";
import { parseUsdInputToCents, formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import type { CompanyPaymentDepositMode } from "@/app/lib/jobPaymentTypes";

type StatusPayload = {
  ok: boolean;
  connected?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingStatus?: string;
  settings?: {
    defaultDepositMode?: CompanyPaymentDepositMode;
    defaultDepositPercentBps?: number | null;
    defaultDepositFixedCents?: number | null;
  };
};

function connectionLabel(status: StatusPayload | null): string {
  if (!status?.connected) return "Not connected";
  if (status.chargesEnabled) return "Connected";
  if (status.detailsSubmitted) return "Restricted — finish Stripe requirements";
  return "Onboarding in progress";
}

export default function SettingsPaymentsClient() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CompanyPaymentDepositMode>("none");
  const [percent, setPercent] = useState("20");
  const [fixed, setFixed] = useState("5000");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/company/payments/status");
      const payload = (await response.json()) as StatusPayload;
      if (!response.ok || payload.ok !== true) {
        setError("Could not load payment settings.");
        return;
      }
      setStatus(payload);
      const nextMode = payload.settings?.defaultDepositMode ?? "none";
      setMode(nextMode);
      if (payload.settings?.defaultDepositPercentBps) {
        setPercent(String(payload.settings.defaultDepositPercentBps / 100));
      }
      if (payload.settings?.defaultDepositFixedCents) {
        setFixed(String(payload.settings.defaultDepositFixedCents / 100));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/company/payments/connect", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; url?: string | null };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      await load();
    } catch {
      setError("Could not start Stripe onboarding.");
    } finally {
      setConnecting(false);
    }
  };

  const saveDefaults = async () => {
    setSaving(true);
    setError(null);
    try {
      const percentBps =
        mode === "percent" ? Math.round(Number(percent) * 100) : null;
      const fixedCents = mode === "fixed" ? parseUsdInputToCents(fixed) : null;
      const response = await fetch("/api/company/payments/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultDepositMode: mode,
          defaultDepositPercentBps: percentBps,
          defaultDepositFixedCents: fixedCents,
        }),
      });
      if (!response.ok) {
        setError("Could not save deposit default.");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FieldDiveAppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Company setup
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Payments
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            Accept payments securely through Stripe Checkout. FieldDive does not take a fee and does
            not hold customer funds. Default deposit terms prefill new proposals only; sent and
            accepted proposals keep the terms they were sent with.
          </p>
        </header>

        {error ? <div className={SETTINGS_ALERT_ERROR}>{error}</div> : null}

        <section
          className={`${SETTINGS_CARD} space-y-3`}
          data-payments-stripe-status
          data-payments-loading={loading ? "true" : "false"}
          data-payments-connection={loading ? "loading" : connectionLabel(status)}
        >
          <h2 className={SETTINGS_SECTION_TITLE}>Stripe connection</h2>
          <p className={SETTINGS_SECTION_DESC}>
            {loading ? "Loading…" : connectionLabel(status)}
          </p>
          <p className="text-sm text-slate-600">
            Available through Stripe Checkout when your account is ready. Stripe presents the
            payment methods your customer can use.
          </p>
          <button
            type="button"
            className={SETTINGS_PRIMARY_BUTTON}
            disabled={connecting || loading || status?.chargesEnabled === true}
            onClick={() => void connect()}
          >
            {status?.chargesEnabled
              ? "Connected"
              : status?.connected
                ? connecting
                  ? "Opening Stripe…"
                  : "Resume onboarding"
                : connecting
                  ? "Opening Stripe…"
                  : "Connect Stripe"}
          </button>
        </section>

        <section className={`${SETTINGS_CARD} space-y-4`} data-payments-deposit-default>
          <div>
            <h2 className={SETTINGS_SECTION_TITLE}>Default deposit</h2>
            <p className={SETTINGS_SECTION_DESC}>
              Prefills Payment terms on new proposal drafts. Changing this never changes sent,
              accepted, or historical proposal terms.
            </p>
          </div>
          <label className={SETTINGS_LABEL}>
            Mode
            <select
              className={`${SETTINGS_INPUT} mt-1`}
              value={mode}
              onChange={(event) => setMode(event.target.value as CompanyPaymentDepositMode)}
            >
              <option value="none">No default</option>
              <option value="percent">Percent of accepted total</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          {mode === "percent" ? (
            <label className={SETTINGS_LABEL}>
              Percent
              <input
                className={`${SETTINGS_INPUT} mt-1`}
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                inputMode="decimal"
              />
              <span className={SETTINGS_FIELD_HELP}>Example: 20 for a 20% deposit.</span>
            </label>
          ) : null}
          {mode === "fixed" ? (
            <label className={SETTINGS_LABEL}>
              Amount
              <input
                className={`${SETTINGS_INPUT} mt-1`}
                value={fixed}
                onChange={(event) => setFixed(event.target.value)}
                inputMode="decimal"
              />
              <span className={SETTINGS_FIELD_HELP}>
                {parseUsdInputToCents(fixed)
                  ? formatUsdFromCents(parseUsdInputToCents(fixed)!)
                  : "Enter dollars, minimum $1.00."}
              </span>
            </label>
          ) : null}
          <button
            type="button"
            className={SETTINGS_PRIMARY_BUTTON}
            disabled={saving || loading}
            onClick={() => void saveDefaults()}
          >
            {saving ? "Saving…" : "Save deposit default"}
          </button>
        </section>

        <p className="text-xs text-slate-500">
          Pricing math stays in{" "}
          <Link href="/tools/settings/pricing" className="font-medium text-cyan-700">
            Pricing rules
          </Link>
          . Payments is collections only.
        </p>
      </div>
    </FieldDiveAppShell>
  );
}
