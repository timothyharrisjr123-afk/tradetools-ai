"use client";

import { useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import type { CompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";

/** Mounted only while open, so the draft seeds from saved truth on open. */
type CompanySettingsBusinessEditorProps = {
  profile: CompanyBrandingProfile;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (patch: Partial<CompanyBrandingProfile>) => void;
};

type BusinessDraft = {
  companyName: string;
  email: string;
  phone: string;
  license: string;
  notificationsEmail: string;
};

function draftFrom(profile: CompanyBrandingProfile): BusinessDraft {
  return {
    companyName: profile.companyName,
    email: profile.email,
    phone: profile.phone,
    license: profile.license,
    notificationsEmail: profile.notificationsEmail,
  };
}

export default function CompanySettingsBusinessEditor({
  profile,
  saving,
  error,
  onClose,
  onSave,
}: CompanySettingsBusinessEditorProps) {
  const [draft, setDraft] = useState<BusinessDraft>(() => draftFrom(profile));
  const [touched, setTouched] = useState(false);

  const set = (patch: Partial<BusinessDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setTouched(true);
  };

  const nameMissing = draft.companyName.trim().length === 0;

  return (
    <FocusedEditor
      open
      title="Business"
      description="Who customers are hiring, and how they reach you."
      dirty={touched}
      saving={saving}
      saveDisabled={nameMissing}
      error={error}
      onClose={onClose}
      onSave={() => onSave(draft)}
    >
      <div data-company-settings-editor="business">
        <label className={FOCUSED_EDITOR_LABEL}>
          Company name
          <input
            className={FOCUSED_EDITOR_INPUT}
            value={draft.companyName}
            onChange={(event) => set({ companyName: event.target.value })}
            autoComplete="organization"
          />
        </label>
        {touched && nameMissing ? (
          <p className="mt-1 text-xs text-rose-600" role="alert">
            Company name is required.
          </p>
        ) : null}
      </div>

      <label className={FOCUSED_EDITOR_LABEL}>
        Business email
        <input
          type="email"
          className={FOCUSED_EDITOR_INPUT}
          value={draft.email}
          onChange={(event) => set({ email: event.target.value })}
          autoComplete="email"
        />
      </label>

      <label className={FOCUSED_EDITOR_LABEL}>
        Phone
        <input
          type="tel"
          className={FOCUSED_EDITOR_INPUT}
          value={draft.phone}
          onChange={(event) => set({ phone: event.target.value })}
          autoComplete="tel"
        />
      </label>

      <label className={FOCUSED_EDITOR_LABEL}>
        License number
        <input
          className={FOCUSED_EDITOR_INPUT}
          value={draft.license}
          onChange={(event) => set({ license: event.target.value })}
        />
      </label>

      <div>
        <label className={FOCUSED_EDITOR_LABEL}>
          Notification email
          <input
            type="email"
            className={FOCUSED_EDITOR_INPUT}
            value={draft.notificationsEmail}
            onChange={(event) => set({ notificationsEmail: event.target.value })}
          />
        </label>
        <p className={FOCUSED_EDITOR_HINT}>
          Where we tell you a customer accepted a proposal.
        </p>
      </div>
    </FocusedEditor>
  );
}
