"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listIanaTimezones,
  parseTimezoneReturnPath,
  suggestedBrowserTimezone,
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
  const [timezone, setTimezone] = useState<string>("");
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => listIanaTimezones(), []);
  const suggested = suggestedBrowserTimezone();
  const filtered = zones.filter((zone) =>
    zone.toLowerCase().includes(query.trim().toLowerCase())
  ).slice(0, 12);

  useEffect(() => {
    void fetch("/api/company/timezone", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const tz = typeof json?.timezone === "string" ? json.timezone : "";
        setSaved(tz || null);
        setTimezone(tz || suggested || "");
      })
      .catch(() => undefined);
  }, [suggested]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/company/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!json?.ok) {
      setMessage("Could not save timezone.");
      return;
    }
    setSaved(json.timezone);
    setMessage("Timezone saved.");
    const returnTo = parseTimezoneReturnPath(window.location.search);
    if (returnTo) router.push(returnTo);
  }

  return (
    <section
      id="company-timezone"
      className={`${SETTINGS_WORKSPACE_ZONE} overflow-hidden`}
      aria-label="Company timezone"
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className={SETTINGS_SECTION_TITLE}>Timezone</h2>
        <p className={SETTINGS_SECTION_DESC}>
          Scheduling uses this IANA timezone. Browser locale is only a suggestion until you save.
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
          placeholder={suggested || "America/Chicago"}
          className={SETTINGS_INPUT}
          list="company-timezone-options"
        />
        <datalist id="company-timezone-options">
          {filtered.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p className={SETTINGS_FIELD_HELP}>
          {saved ? `Saved: ${saved}` : "Not set — required before scheduling work."}
          {suggested && !saved ? ` Suggested: ${suggested}` : ""}
        </p>
        <button
          type="button"
          disabled={saving || !timezone.trim()}
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
