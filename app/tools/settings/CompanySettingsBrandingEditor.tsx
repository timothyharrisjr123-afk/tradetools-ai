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

const SWATCH = "h-8 w-8 shrink-0 rounded-md border border-slate-200 shadow-sm";

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

  const primary = draft.brandPrimaryColor.trim() || "#2563eb";
  const secondary = draft.brandSecondaryColor.trim() || "#0b1f33";

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
      <div data-company-settings-editor="branding" className="space-y-4">
        <div>
          <span className={FOCUSED_EDITOR_LABEL}>Logo</span>
          <div className="mt-2 flex items-center gap-3">
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
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500 sm:min-h-[44px]">
                {draft.logoDataUrl ? "Replace" : "Upload logo"}
                <input type="file" accept="image/*" onChange={onLogoFile} className="sr-only" />
              </label>
              {draft.logoDataUrl ? (
                <button
                  type="button"
                  className="min-h-[40px] px-1 text-sm text-slate-500 hover:text-slate-700 sm:min-h-[44px]"
                  onClick={() => set({ logoDataUrl: "" })}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          aria-hidden
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: primary }}
          >
            AR
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {profile.companyName.trim() || "Your company"}
          </span>
          <span className="h-4 w-4 shrink-0 rounded-sm border border-slate-200" style={{ backgroundColor: secondary }} />
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
            <span className="mt-1 flex items-center gap-2">
              <span className={SWATCH} style={{ backgroundColor: primary }} aria-hidden />
              <input
                className={`${FOCUSED_EDITOR_INPUT} mt-0 font-mono text-[13px]`}
                value={draft.brandPrimaryColor}
                onChange={(event) => set({ brandPrimaryColor: event.target.value })}
                placeholder="#2563eb"
                aria-label="Primary brand color hex value"
              />
            </span>
          </label>
          <label className={FOCUSED_EDITOR_LABEL}>
            Secondary color
            <span className="mt-1 flex items-center gap-2">
              <span className={SWATCH} style={{ backgroundColor: secondary }} aria-hidden />
              <input
                className={`${FOCUSED_EDITOR_INPUT} mt-0 font-mono text-[13px]`}
                value={draft.brandSecondaryColor}
                onChange={(event) => set({ brandSecondaryColor: event.target.value })}
                placeholder="#0b1f33"
                aria-label="Secondary brand color hex value"
              />
            </span>
          </label>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 pt-0.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={draft.showLicenseOnCover}
            onChange={(event) => set({ showLicenseOnCover: event.target.checked })}
          />
          <span>
            <span className="font-medium">Show license number on proposal covers</span>
          </span>
        </label>
      </div>
    </FocusedEditor>
  );
}
