"use client";

import { useMemo, useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import {
  isCompanyTimezoneDraftUnsaved,
  listIanaTimezones,
  resolveCompanyTimezoneCanonicalStatus,
  shouldShowTimezoneSuggestion,
  suggestedBrowserTimezone,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";

/** Mounted only while open, so the draft seeds from saved truth on open. */
type CompanySettingsPreferencesEditorProps = {
  savedTimezone: string | null;
  loadStatus: CompanyTimezoneLoadStatus;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (timezone: string) => void;
};

export default function CompanySettingsPreferencesEditor({
  savedTimezone,
  loadStatus,
  saving,
  error,
  onClose,
  onSave,
}: CompanySettingsPreferencesEditorProps) {
  const [draft, setDraft] = useState(savedTimezone ?? "");
  const [touched, setTouched] = useState(false);
  const zones = useMemo(() => listIanaTimezones(), []);
  const suggested = useMemo(() => suggestedBrowserTimezone(), []);

  const trimmed = draft.trim();
  const known = zones.includes(trimmed);

  const canonical = resolveCompanyTimezoneCanonicalStatus({
    loadStatus,
    savedTimezone,
  });
  const isUnsavedDraft = isCompanyTimezoneDraftUnsaved({
    loadStatus,
    savedTimezone,
    draftTimezone: trimmed,
  });
  // Browser locale is a suggestion only; it never becomes truth without a save.
  const showSuggestion = shouldShowTimezoneSuggestion({
    loadStatus,
    savedTimezone,
    suggestedTimezone: suggested,
  });

  return (
    <FocusedEditor
      open
      title="Preferences"
      description="How FieldDive handles dates and times for your company."
      dirty={touched}
      saving={saving}
      saveDisabled={trimmed.length === 0 || !known || loadStatus === "loading"}
      error={error}
      onClose={onClose}
      onSave={() => onSave(trimmed)}
    >
      <div data-company-settings-editor="preferences" data-timezone-load={loadStatus}>
        <label htmlFor="company-timezone-input" className={FOCUSED_EDITOR_LABEL}>
          Timezone
        </label>
        <input
          id="company-timezone-input"
          className={FOCUSED_EDITOR_INPUT}
          value={draft}
          list="company-settings-timezones"
          onChange={(event) => {
            setDraft(event.target.value);
            setTouched(true);
          }}
          placeholder="America/Chicago"
          disabled={loadStatus === "loading"}
          data-timezone-input
        />
        <datalist id="company-settings-timezones">
          {zones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>

        {canonical.kind === "loading" ? (
          <p className={FOCUSED_EDITOR_HINT} data-timezone-loading="true">
            {canonical.text}
          </p>
        ) : null}
        {canonical.kind === "error" ? (
          <p className="mt-1 text-xs font-medium text-rose-600" role="alert" data-timezone-error="true">
            {canonical.text}
          </p>
        ) : null}
        {canonical.kind === "saved" ? (
          <p className={FOCUSED_EDITOR_HINT} data-timezone-saved={canonical.timezone}>
            Scheduling and reminders use this timezone.
          </p>
        ) : null}
        {canonical.kind === "not_set" ? (
          <p className={FOCUSED_EDITOR_HINT} data-timezone-saved="">
            Scheduling and reminders use this timezone.
          </p>
        ) : null}
        {trimmed.length > 0 && !known ? (
          <p className="mt-1 text-xs text-rose-600">Pick a timezone from the list.</p>
        ) : null}
        {isUnsavedDraft && known ? (
          <p className="mt-1 text-xs font-medium text-amber-700" data-timezone-draft={trimmed}>
            Not saved yet.
          </p>
        ) : null}
      </div>

      {showSuggestion && suggested ? (
        <div className="rounded-lg bg-slate-50 px-3.5 py-3" data-timezone-suggested={suggested}>
          <p className="text-sm text-slate-600">
            This browser looks like{" "}
            <span className="font-medium text-slate-900">{suggested}</span>.
          </p>
          {trimmed !== suggested ? (
            <button
              type="button"
              className="mt-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => {
                setDraft(suggested);
                setTouched(true);
              }}
            >
              Use this timezone
            </button>
          ) : null}
        </div>
      ) : null}
    </FocusedEditor>
  );
}
