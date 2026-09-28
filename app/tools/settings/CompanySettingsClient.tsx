"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import InlineNotice from "@/app/components/ui/InlineNotice";
import type { CompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";
import {
  countMissingBrandingDetails,
  countMissingBusinessDetails,
  formatMissingDetailCount,
  summarizeBranding,
  summarizeBusiness,
  summarizePayments,
  summarizePricing,
  summarizeTimezone,
  type CompanyPricingSummaryInput,
} from "@/app/lib/companySettingsSummary";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import CompanySettingsBrandingEditor from "@/app/tools/settings/CompanySettingsBrandingEditor";
import CompanySettingsBusinessEditor from "@/app/tools/settings/CompanySettingsBusinessEditor";
import CompanySettingsPaymentsEditor, {
  COMPANY_PAYMENT_SETUP_LABEL,
} from "@/app/tools/settings/CompanySettingsPaymentsEditor";
import CompanySettingsPreferencesEditor from "@/app/tools/settings/CompanySettingsPreferencesEditor";
import CompanySettingsTeamEditor from "@/app/tools/settings/CompanySettingsTeamEditor";
import { useCompanyMembers } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import {
  loadCompanyPaymentsStatus,
  loadCompanyPricingSummary,
  loadCompanyTimezone,
  saveCompanyTimezone,
  startCompanyStripeOnboarding,
  type CompanyPaymentsStatus,
} from "@/app/tools/settings/companySettingsData";
import {
  loadSettingsCompanyBrandingProfile,
  saveSettingsCompanyBrandingProfile,
  shouldRetrySettingsLoad,
} from "@/app/tools/settings/settingsCompanyBrandingPersistence";
import {
  canSaveCompanyBrandingSettings,
  createEmptyCompanyBrandingDraft,
  mergeCompanyBrandingDraftProfile,
  resolveCompanyBrandingSaveMessage,
  type SettingsLoadGate,
} from "@/app/tools/settings/settingsCompanyBrandingUtils";

const AUTH_RETRY_MS = 400;
const MAX_AUTH_RETRIES = 8;

export type CompanySettingsEditorId =
  | "business"
  | "branding"
  | "payments"
  | "preferences"
  | "team"
  | null;

type CompanySettingsClientProps = {
  companyId: string;
  /** Deep link so /tools/settings/payments can open the Payments editor. */
  initialEditor?: CompanySettingsEditorId;
  /** Schedule flows send the user here to set a timezone, then resume. */
  timezoneReturnTo?: string | null;
};

const ROW =
  "group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:items-center sm:gap-4 sm:px-5 sm:py-4";

const STATIC_ROW = "flex w-full items-start gap-3 px-4 py-3.5 text-left sm:items-center sm:gap-4 sm:px-5 sm:py-4";

const ROW_ACTION =
  "flex shrink-0 items-center gap-0.5 self-start pt-0.5 text-sm font-medium text-blue-600 group-hover:text-blue-700 sm:self-center sm:pt-0";

function SummaryRow({
  label,
  title,
  details,
  detail,
  missing,
  action,
  onClick,
  href,
  testId,
}: {
  label: string;
  title?: string | null;
  /** Preferred: separate metadata lines for clean mobile wrapping. */
  details?: string[];
  /** Legacy single-line detail fallback. */
  detail?: string;
  missing?: string | null;
  /** Omitted for people who can see a setting but not change it. */
  action?: string;
  onClick?: () => void;
  href?: string;
  testId: string;
}) {
  const metadata = details ?? (detail ? [detail] : []);

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
          {missing ? (
            <span className="text-xs font-medium text-amber-700" data-company-settings-missing>
              {missing}
            </span>
          ) : null}
        </span>
        {title ? (
          <span className="mt-1 block text-[15px] font-semibold leading-snug text-slate-900">
            {title}
          </span>
        ) : null}
        {metadata.length > 0 ? (
          <span className="mt-0.5 block space-y-0.5">
            {metadata.map((line) => (
              <span
                key={line}
                className="block text-sm leading-snug text-slate-500 [overflow-wrap:anywhere]"
              >
                {line}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {action ? (
        <span className={ROW_ACTION}>
          {action}
          <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
        </span>
      ) : null}
    </>
  );

  if (!action) {
    return (
      <div className={STATIC_ROW} data-company-settings-row={testId} data-company-settings-row-readonly>
        {body}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={ROW} data-company-settings-row={testId}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" className={ROW} onClick={onClick} data-company-settings-row={testId}>
      {body}
    </button>
  );
}

function SummarySkeleton() {
  return (
    <div className="divide-y divide-slate-200" data-company-settings-skeleton>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="px-4 py-4 sm:px-5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-2.5 h-3 w-48 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function CompanySettingsClient({
  companyId,
  initialEditor = null,
  timezoneReturnTo = null,
}: CompanySettingsClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyBrandingProfile>(() =>
    createEmptyCompanyBrandingDraft()
  );
  const [loadGate, setLoadGate] = useState<SettingsLoadGate>({
    saveBlocked: true,
    saveBlockedReason: null,
    loadError: null,
    authPending: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [payments, setPayments] = useState<CompanyPaymentsStatus | null>(null);
  const [paymentsStatus, setPaymentsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pricing, setPricing] = useState<CompanyPricingSummaryInput | null>(null);
  const [pricingStatus, setPricingStatus] = useState<"loading" | "ready" | "error">("loading");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [timezoneStatus, setTimezoneStatus] = useState<"loading" | "ready" | "error">("loading");

  const [editor, setEditor] = useState<CompanySettingsEditorId>(initialEditor);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const team = useCompanyMembers(Boolean(companyId));

  const savingRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let authRetries = 0;

    async function runLoad() {
      if (savingRef.current) return;
      setLoading(true);
      const result = await loadSettingsCompanyBrandingProfile();
      if (cancelled) return;

      if (shouldRetrySettingsLoad(result) && authRetries < MAX_AUTH_RETRIES) {
        authRetries += 1;
        retryTimer = setTimeout(() => void runLoad(), AUTH_RETRY_MS);
        return;
      }

      setLoadError(result.loadError);
      setLoadGate(result.loadGate);
      if (result.profile) setProfile(result.profile);
      setLoading(false);
    }

    void runLoad();

    const supabase = getSupabaseClient();
    const authListener = supabase?.auth.onAuthStateChange(() => {
      if (savingRef.current) return;
      authRetries = 0;
      void runLoad();
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      authListener?.data.subscription?.unsubscribe();
    };
  }, []);

  const refreshPayments = useCallback(async () => {
    // Keep prior truth while refreshing so Connected never flashes to Not connected.
    setPaymentsStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const next = await loadCompanyPaymentsStatus();
    if (next) {
      setPayments(next);
      setPaymentsStatus("ready");
      return;
    }
    // First-load failure → error. Refresh failure after known truth keeps prior Connected/Not connected.
    setPaymentsStatus((prev) => (prev === "ready" ? "ready" : "error"));
  }, []);

  const refreshTimezone = useCallback(async () => {
    const result = await loadCompanyTimezone();
    setTimezoneStatus(result.status);
    setTimezone(result.timezone);
  }, []);

  useEffect(() => {
    void refreshPayments();
    void refreshTimezone();
    setPricingStatus("loading");
    void loadCompanyPricingSummary(companyId)
      .then((next) => {
        setPricing(next);
        setPricingStatus("ready");
      })
      .catch(() => setPricingStatus("error"));
  }, [companyId, refreshPayments, refreshTimezone]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorError(null);
  };

  const saveProfilePatch = async (patch: Partial<CompanyBrandingProfile>) => {
    if (!canSaveCompanyBrandingSettings(loadGate)) {
      setEditorError(loadGate.saveBlockedReason ?? "Sign in again before saving.");
      return;
    }

    setSaving(true);
    savingRef.current = true;
    setEditorError(null);

    try {
      // The profile is one row pair, so each editor saves the merged whole.
      const merged = mergeCompanyBrandingDraftProfile(profileRef.current, patch);
      const result = await saveSettingsCompanyBrandingProfile(merged, { loadGate });
      const resolved = resolveCompanyBrandingSaveMessage(result);

      if (resolved.tone === "error") {
        setEditorError(resolved.message);
        return;
      }

      setProfile(result.profile ?? merged);
      if (result.loadGate) setLoadGate(result.loadGate);
      closeEditor();
      showToast(resolved.message || "Saved.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveTimezone = async (next: string) => {
    setSaving(true);
    setEditorError(null);
    try {
      const result = await saveCompanyTimezone(next);
      if (!result.ok) {
        setEditorError("Could not save your timezone.");
        return;
      }
      setTimezone(result.timezone);
      setTimezoneStatus("ready");
      closeEditor();
      showToast("Preferences saved.");
      if (timezoneReturnTo) router.push(timezoneReturnTo);
    } finally {
      setSaving(false);
    }
  };

  const connectStripe = async () => {
    setConnecting(true);
    setEditorError(null);
    try {
      const result = await startCompanyStripeOnboarding();
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      if (!result.ok) {
        setEditorError("Could not open Stripe.");
        return;
      }
      await refreshPayments();
    } finally {
      setConnecting(false);
    }
  };

  const accessPending = team.loading && team.viewerRole == null;
  const canManageCompany = team.canManageCompany;
  const showCommercial = team.canReadCommercial || team.canManagePricing || team.canConfigurePayments;
  const fieldViewer = team.viewerRole === "field_user";
  const business = summarizeBusiness(profile);
  const businessMissing = formatMissingDetailCount(countMissingBusinessDetails(profile));
  const brandingMissing = formatMissingDetailCount(countMissingBrandingDetails(profile));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Company settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          {accessPending || canManageCompany
            ? "Your business identity, branding, payments, and pricing."
            : "Your company's details. An Owner or Admin changes these."}
        </p>
      </header>

      {loadError ? (
        <InlineNotice tone="error">{loadError}</InlineNotice>
      ) : null}

      {toast ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
        data-company-settings-summary
      >
        {loading || accessPending ? (
          <SummarySkeleton />
        ) : (
          <div className="divide-y divide-slate-200">
            <SummaryRow
              label="Business"
              title={business.title}
              details={
                business.details.length > 0
                  ? business.details
                  : canManageCompany
                    ? ["Add your contact details"]
                    : []
              }
              missing={canManageCompany ? businessMissing : null}
              action={canManageCompany ? "Edit" : undefined}
              onClick={() => setEditor("business")}
              testId="business"
            />
            <SummaryRow
              label="Branding"
              detail={summarizeBranding(profile)}
              missing={canManageCompany ? brandingMissing : null}
              action={canManageCompany ? "Edit" : undefined}
              onClick={() => setEditor("branding")}
              testId="branding"
            />
            {showCommercial ? (
              <SummaryRow
                label={COMPANY_PAYMENT_SETUP_LABEL}
                detail={summarizePayments(payments, paymentsStatus)}
                action={team.canConfigurePayments ? "Manage" : undefined}
                onClick={() => setEditor("payments")}
                testId="payments"
              />
            ) : null}
            {showCommercial ? (
              <SummaryRow
                label="Pricing"
                detail={summarizePricing(pricing, pricingStatus)}
                action={team.canManagePricing ? "Manage" : "View"}
                href="/tools/settings/pricing"
                testId="pricing"
              />
            ) : null}
            <SummaryRow
              label="Preferences"
              detail={summarizeTimezone(timezone, timezoneStatus)}
              action={canManageCompany ? "Edit" : undefined}
              onClick={() => setEditor("preferences")}
              testId="preferences"
            />
            <SummaryRow
              label="Team"
              detail={
                team.loading
                  ? "Loading…"
                  : team.error
                    ? "Could not load team"
                    : fieldViewer
                      ? "An Owner or Admin manages the team"
                      : `${team.liveMembers.length} member${
                          team.liveMembers.length === 1 ? "" : "s"
                        }`
              }
              action={team.canAdminMembers ? "Manage" : "View"}
              onClick={() => setEditor("team")}
              testId="team"
            />
          </div>
        )}
      </div>

      {editor === "business" ? (
        <CompanySettingsBusinessEditor
          profile={profile}
          saving={saving}
          error={editorError}
          onClose={closeEditor}
          onSave={(patch) => void saveProfilePatch(patch)}
        />
      ) : null}
      {editor === "branding" ? (
        <CompanySettingsBrandingEditor
          profile={profile}
          saving={saving}
          error={editorError}
          onClose={closeEditor}
          onSave={(patch) => void saveProfilePatch(patch)}
        />
      ) : null}
      {editor === "payments" ? (
        <CompanySettingsPaymentsEditor
          status={payments}
          loadStatus={paymentsStatus}
          error={editorError}
          connecting={connecting}
          onClose={closeEditor}
          onConnect={() => void connectStripe()}
        />
      ) : null}
      {editor === "preferences" ? (
        <CompanySettingsPreferencesEditor
          savedTimezone={timezone}
          loadStatus={timezoneStatus}
          saving={saving}
          error={editorError}
          onClose={closeEditor}
          onSave={(next) => void saveTimezone(next)}
        />
      ) : null}
      {editor === "team" ? (
        <CompanySettingsTeamEditor
          canAdminMembers={team.canAdminMembers}
          viewerRole={team.viewerRole}
          viewerUserId={team.viewerUserId}
          members={team.members}
          loading={team.loading}
          error={team.error}
          onClose={closeEditor}
          onChanged={() => team.refresh()}
        />
      ) : null}
    </div>
  );
}
