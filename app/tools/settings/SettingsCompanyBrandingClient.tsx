"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type CompanyBrandingProfile,
  type CompanyBrandingViewModel,
} from "@/app/lib/companyBrandingProfile";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import SettingsBrandingReadinessCard from "@/app/tools/settings/SettingsBrandingReadinessCard";
import SettingsCompanyBrandingSection from "@/app/tools/settings/SettingsCompanyBrandingSection";
import SettingsPageHeader from "@/app/tools/settings/SettingsPageHeader";
import SettingsPricingLinkCard from "@/app/tools/settings/SettingsPricingLinkCard";
import {
  loadSettingsCompanyBrandingProfile,
  saveSettingsCompanyBrandingProfile,
  shouldRetrySettingsLoad,
} from "@/app/tools/settings/settingsCompanyBrandingPersistence";
import {
  buildCompanyBrandingViewModelFromForm,
  canSaveCompanyBrandingSettings,
  createEmptyCompanyBrandingDraft,
  mergeCompanyBrandingDraftProfile,
  resolveCompanyBrandingSaveMessage,
  resolveDraftAfterSave,
  shouldReplaceDraftFromLoad,
  type SettingsLoadGate,
} from "@/app/tools/settings/settingsCompanyBrandingUtils";
import {
  SETTINGS_ALERT_ERROR,
  SETTINGS_ALERT_LOAD,
  SETTINGS_CARD,
  SETTINGS_PRIMARY_BUTTON,
} from "@/app/tools/settings/settingsConstants";

const AUTH_RETRY_MS = 400;
const MAX_AUTH_RETRIES = 8;

type ClientOperation = "idle" | "loading" | "saving";

export default function SettingsCompanyBrandingClient() {
  const [draft, setDraft] = useState<CompanyBrandingProfile>(() => createEmptyCompanyBrandingDraft());
  const [viewModel, setViewModel] = useState<CompanyBrandingViewModel>(() =>
    buildCompanyBrandingViewModelFromForm(createEmptyCompanyBrandingDraft())
  );
  const [loadGate, setLoadGate] = useState<SettingsLoadGate>({
    saveBlocked: true,
    saveBlockedReason: null,
    loadError: null,
    authPending: true,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const operationRef = useRef<ClientOperation>("idle");
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const applyLoadResult = useCallback(
    (result: Awaited<ReturnType<typeof loadSettingsCompanyBrandingProfile>>) => {
      const allowReplace = shouldReplaceDraftFromLoad(result, draftRef.current);

      setLoadError(result.loadError);
      setLoadWarning(result.loadWarning);
      setLoadGate(result.loadGate);

      if (allowReplace && result.profile && result.viewModel) {
        setDraft(result.profile);
        setViewModel(result.viewModel);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let authRetries = 0;

    async function runLoad(source: "initial-load" | "auth-retry" | "auth-listener") {
      if (operationRef.current === "saving") {
        return;
      }

      operationRef.current = "loading";
      setLoading(true);

      const result = await loadSettingsCompanyBrandingProfile();
      if (cancelled) return;

      if (shouldRetrySettingsLoad(result) && authRetries < MAX_AUTH_RETRIES) {
        authRetries += 1;
        operationRef.current = "idle";
        retryTimer = setTimeout(() => {
          void runLoad("auth-retry");
        }, AUTH_RETRY_MS);
        return;
      }

      applyLoadResult(result);
      operationRef.current = "idle";
      setLoading(false);
    }

    void runLoad("initial-load");

    const supabase = getSupabaseClient();
    const authListener = supabase?.auth.onAuthStateChange(() => {
      if (operationRef.current === "saving") return;
      authRetries = 0;
      void runLoad("auth-listener");
    });
    const authSubscription = authListener?.data.subscription;

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      authSubscription?.unsubscribe();
    };
  }, [applyLoadResult]);

  const saveBlocked = !canSaveCompanyBrandingSettings(loadGate);

  const handleProfileChange = (patch: Partial<CompanyBrandingProfile>) => {
    setDraft((prev) => {
      const next = mergeCompanyBrandingDraftProfile(prev, patch);
      setViewModel(buildCompanyBrandingViewModelFromForm(next));
      return next;
    });
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (loading || saving || saveBlocked) {
      if (saveBlocked && loadGate.saveBlockedReason) {
        setSaveMessage({ tone: "error", message: loadGate.saveBlockedReason });
      }
      return;
    }

    setSaveMessage(null);
    setSaving(true);
    operationRef.current = "saving";

    const draftSnapshot = draftRef.current;

    try {
      const result = await saveSettingsCompanyBrandingProfile(draftSnapshot, { loadGate });
      const resolved = resolveCompanyBrandingSaveMessage(result);
      const afterSave = resolveDraftAfterSave(draftSnapshot, result, result.profile);

      if (resolved.message && resolved.tone !== "idle") {
        setSaveMessage({ tone: resolved.tone, message: resolved.message });
        if (resolved.tone === "success") {
          setTimeout(() => setSaveMessage(null), 4000);
        }
      }

      if (afterSave.replaceDraft) {
        setDraft(afterSave.draft);
        setViewModel(buildCompanyBrandingViewModelFromForm(afterSave.draft));
      }

      if (result.loadGate) {
        setLoadGate(
          afterSave.blockSaveUntilRefresh
            ? {
                ...result.loadGate,
                saveBlocked: true,
                saveBlockedReason: resolved.message,
              }
            : result.loadGate
        );
      }
    } finally {
      operationRef.current = "idle";
      setSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      handleProfileChange({ logoDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsPageHeader />

      {loading ? (
        <p className="text-sm text-slate-500">Loading company profile…</p>
      ) : null}

      {loadError ? <div className={SETTINGS_ALERT_LOAD}>{loadError}</div> : null}
      {loadWarning ? <div className={SETTINGS_ALERT_LOAD}>{loadWarning}</div> : null}
      {!loading && saveBlocked && loadGate.saveBlockedReason && !loadError ? (
        <div className={SETTINGS_ALERT_LOAD}>{loadGate.saveBlockedReason}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <SettingsCompanyBrandingSection
            profile={draft}
            onChange={handleProfileChange}
            onLogoChange={handleLogoChange}
            disabled={loading || saving || saveBlocked}
          />

          <section className={`${SETTINGS_CARD} space-y-3`}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || saving || saveBlocked}
                className={SETTINGS_PRIMARY_BUTTON}
              >
                {saving ? "Saving…" : "Save company settings"}
              </button>
              {saveMessage?.tone === "success" ? (
                <p className="text-sm font-medium text-emerald-700" role="status">
                  {saveMessage.message}
                </p>
              ) : null}
              {saving ? (
                <span className="text-sm text-slate-500">Writing to company profile and branding…</span>
              ) : null}
            </div>
            {saveMessage?.tone === "error" ? (
              <div className={SETTINGS_ALERT_ERROR} role="alert">
                {saveMessage.message}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <SettingsBrandingReadinessCard viewModel={viewModel} />
          <SettingsPricingLinkCard />
        </aside>
      </div>
    </div>
  );
}
