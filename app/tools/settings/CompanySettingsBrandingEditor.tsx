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

function monogramFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

const SWATCH = "h-8 w-8 shrink-0 rounded-md border border-slate-200";

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
  const name = profile.companyName.trim() || "Your company";

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
      <div data-company-settings-editor="branding" className="space-y-3.5">
        <div>
          <span className={FOCUSED_EDITOR_LABEL}>Company identity</span>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              data-branding-identity-preview
            >
              {draft.logoDataUrl ? (
                <Image
                  src={draft.logoDataUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {monogramFrom(name)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-blue-600 hover:text-blue-700 focus-within:outline-none">
                  {draft.logoDataUrl ? "Replace" : "Upload logo"}
                  <input type="file" accept="image/*" onChange={onLogoFile} className="sr-only" />
                </label>
                {draft.logoDataUrl ? (
                  <button
                    type="button"
                    className="min-h-[44px] text-sm text-slate-400 hover:text-slate-600"
                    onClick={() => set({ logoDataUrl: "" })}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
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

        <div>
          <span className={FOCUSED_EDITOR_LABEL}>Brand colors</span>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-500">
              Primary
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
            <label className="block text-xs font-medium text-slate-500">
              Secondary
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
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={draft.showLicenseOnCover}
            onChange={(event) => set({ showLicenseOnCover: event.target.checked })}
          />
          Show license number on proposal covers
        </label>
      </div>
    </FocusedEditor>
  );
}
