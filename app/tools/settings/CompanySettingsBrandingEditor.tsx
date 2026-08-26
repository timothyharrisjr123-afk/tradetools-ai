"use client";

import Image from "next/image";
import { useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import type { CompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";

/** Mounted only while open, so the draft seeds from saved truth on open. */
type CompanySettingsBrandingEditorProps = {
  profile: CompanyBrandingProfile;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (patch: Partial<CompanyBrandingProfile>) => void;
};

type BrandingDraft = {
  logoDataUrl: string;
  address: string;
  website: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  showLicenseOnCover: boolean;
};

function draftFrom(profile: CompanyBrandingProfile): BrandingDraft {
  return {
    logoDataUrl: profile.logoDataUrl,
    address: profile.address,
    website: profile.website,
    brandPrimaryColor: profile.brandPrimaryColor,
    brandSecondaryColor: profile.brandSecondaryColor,
    showLicenseOnCover: profile.showLicenseOnCover,
  };
}

const SWATCH = "h-7 w-7 shrink-0 rounded-md border border-slate-200";

export default function CompanySettingsBrandingEditor({
  profile,
  saving,
  error,
  onClose,
  onSave,
}: CompanySettingsBrandingEditorProps) {
  const [draft, setDraft] = useState<BrandingDraft>(() => draftFrom(profile));
  const [touched, setTouched] = useState(false);

  const set = (patch: Partial<BrandingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setTouched(true);
  };

  const onLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      set({ logoDataUrl: typeof reader.result === "string" ? reader.result : "" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <FocusedEditor
      open
      title="Branding"
      description="How your company looks on customer proposals."
      dirty={touched}
      saving={saving}
      error={error}
      onClose={onClose}
      onSave={() => onSave(draft)}
    >
      <div data-company-settings-editor="branding">
        <span className={FOCUSED_EDITOR_LABEL}>Logo</span>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {draft.logoDataUrl ? (
              <Image
                src={draft.logoDataUrl}
                alt="Company logo"
                width={56}
                height={56}
                className="h-full w-full object-contain"
                unoptimized
              />
            ) : (
              <span className="text-[10px] font-medium text-slate-400">None</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
              {draft.logoDataUrl ? "Replace logo" : "Upload logo"}
              <input type="file" accept="image/*" onChange={onLogoFile} className="sr-only" />
            </label>
            {draft.logoDataUrl ? (
              <button
                type="button"
                className="min-h-[44px] text-sm font-medium text-slate-500 hover:text-slate-700"
                onClick={() => set({ logoDataUrl: "" })}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <label className={FOCUSED_EDITOR_LABEL}>
        Business address
        <textarea
          rows={2}
          className={`${FOCUSED_EDITOR_INPUT} py-2`}
          value={draft.address}
          onChange={(event) => set({ address: event.target.value })}
        />
      </label>

      <div>
        <label className={FOCUSED_EDITOR_LABEL}>
          Website
          <input
            className={FOCUSED_EDITOR_INPUT}
            value={draft.website}
            onChange={(event) => set({ website: event.target.value })}
            placeholder="andersonroofing.com"
          />
        </label>
        <p className={FOCUSED_EDITOR_HINT}>Saved as a full https:// address.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={FOCUSED_EDITOR_LABEL}>
          Primary color
          <span className="mt-1.5 flex items-center gap-2">
            <span
              className={SWATCH}
              style={{ backgroundColor: draft.brandPrimaryColor || "#f1f5f9" }}
              aria-hidden
            />
            <input
              className={`${FOCUSED_EDITOR_INPUT} mt-0`}
              value={draft.brandPrimaryColor}
              onChange={(event) => set({ brandPrimaryColor: event.target.value })}
              placeholder="#2563eb"
            />
          </span>
        </label>
        <label className={FOCUSED_EDITOR_LABEL}>
          Secondary color
          <span className="mt-1.5 flex items-center gap-2">
            <span
              className={SWATCH}
              style={{ backgroundColor: draft.brandSecondaryColor || "#f1f5f9" }}
              aria-hidden
            />
            <input
              className={`${FOCUSED_EDITOR_INPUT} mt-0`}
              value={draft.brandSecondaryColor}
              onChange={(event) => set({ brandSecondaryColor: event.target.value })}
              placeholder="#0b1f33"
            />
          </span>
        </label>
      </div>

      <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          checked={draft.showLicenseOnCover}
          onChange={(event) => set({ showLicenseOnCover: event.target.checked })}
        />
        Show license number on proposal covers
      </label>
    </FocusedEditor>
  );
}
