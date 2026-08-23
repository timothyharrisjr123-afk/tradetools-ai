"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isCompanyTimezoneDraftUnsaved,
  listIanaTimezones,
  parseCompanyTimezoneGetResult,
  parseTimezoneReturnPath,
  resolveCompanyTimezoneCanonicalStatus,
  shouldShowTimezoneSuggestion,
  suggestedBrowserTimezone,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";
import { useRouter } from "next/navigation";
import {
  SETTINGS_FIELD_HELP,
  SETTINGS_INPUT,
  SETTINGS_LABEL,
  SETTINGS_SECTION_DESC,
  SETTINGS_SECTION_TITLE,
  SETTINGS_WORKSPACE_ZONE,
} from "@/app/tools/settings/settingsConstants";

export default function SettingsCompanyTimezoneSection() {
  const router = useRouter();
  const [loadStatus, setLoadStatus] =
    useState<CompanyTimezoneLoadStatus>("loading");
  const [timezone, setTimezone] = useState<string>("");
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => listIanaTimezones(), []);
  const suggested = suggestedBrowserTimezone();
  const draft = (query || timezone).trim();
  const canonical = resolveCompanyTimezoneCanonicalStatus({
    loadStatus,
    savedTimezone: saved,
  });
  const isUnsavedDraft = isCompanyTimezoneDraftUnsaved({
    loadStatus,
    savedTimezone: saved,
    draftTimezone: draft,
  });
  const showSuggestion = shouldShowTimezoneSuggestion({
    loadStatus,
    savedTimezone: saved,
    suggestedTimezone: suggested,
  });
  const filtered = zones
    .filter((zone) => zone.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 12);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/company/timezone", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        return parseCompanyTimezoneGetResult(res.ok, json);
      })
      .then((parsed) => {
        if (cancelled) return;
        if (parsed.status === "error") {
          setLoadStatus("error");
          setSaved(null);
          setTimezone("");
          setQuery("");
          return;
        }
        setLoadStatus("ready");
        setSaved(parsed.timezone);
        setTimezone(parsed.timezone ?? "");
        setQuery("");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadStatus("error");
        setSaved(null);
        setTimezone("");
        setQuery("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/company/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: draft }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!json?.ok) {
      setMessage("Could not save timezone.");
      return;
    }
    const next = String(json.timezone ?? "").trim();
    setLoadStatus("ready");
    setSaved(next || null);
    setTimezone(next);
    setQuery("");
    setMessage("Timezone saved.");
    const returnTo = parseTimezoneReturnPath(window.location.search);
    if (returnTo) router.push(returnTo);
  }

  return (
    <section
      id="company-timezone"
      className={`${SETTINGS_WORKSPACE_ZONE} overflow-hidden`}
      aria-label="Company timezone"
      data-timezone-load={loadStatus}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className={SETTINGS_SECTION_TITLE}>Timezone</h2>
        <p className={SETTINGS_SECTION_DESC}>
          Scheduling uses the saved company timezone. Browser locale is only a
          suggestion until you save.
        </p>
      </div>
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <label htmlFor="company-timezone-input" className={SETTINGS_LABEL}>
          Company timezone
        </label>
        <input
          id="company-timezone-input"
          value={query || timezone}
          onChange={(e) => {
            setQuery(e.target.value);
            setTimezone(e.target.value);
          }}
          placeholder="Type an IANA timezone"
          className={SETTINGS_INPUT}
          list="company-timezone-options"
          data-timezone-input
          disabled={loadStatus === "loading"}
        />
        <datalist id="company-timezone-options">
          {filtered.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        {canonical.kind === "loading" ? (
          <p className={SETTINGS_FIELD_HELP} data-timezone-loading="true">
            {canonical.text}
          </p>
        ) : null}
        {canonical.kind === "error" ? (
          <p
            className="text-xs font-medium text-red-700"
            role="alert"
            data-timezone-error="true"
          >
            {canonical.text}
          </p>
        ) : null}
        {canonical.kind === "saved" ? (
          <p
            className={SETTINGS_FIELD_HELP}
            data-timezone-saved={canonical.timezone}
          >
            {canonical.text}
          </p>
        ) : null}
        {canonical.kind === "not_set" ? (
          <p className={SETTINGS_FIELD_HELP} data-timezone-saved="">
            {canonical.text}
          </p>
        ) : null}
        {isUnsavedDraft ? (
          <p
            className="text-xs font-medium text-amber-800"
            data-timezone-draft={draft}
          >
            Selected for save: {draft}. Not company timezone until you save.
          </p>
        ) : null}
        {showSuggestion && suggested ? (
          <div
            className="flex flex-wrap items-center gap-2"
            data-timezone-suggested={suggested}
          >
            <p className="text-xs text-slate-500">
              Suggested from this browser (not saved): {suggested}
            </p>
            {draft !== suggested ? (
              <button
                type="button"
                onClick={() => {
                  setTimezone(suggested);
                  setQuery("");
                }}
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Use suggestion
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={saving || !draft || loadStatus === "loading"}
          onClick={() => void save()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save timezone
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </section>
  );
}
