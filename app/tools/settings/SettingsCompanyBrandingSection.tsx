"use client";

import type { CompanyBrandingProfile } from "@/app/lib/companyBrandingProfile";
import { SETTINGS_BRANDING_TEMPLATES_NOTE } from "@/app/tools/settings/settingsCompanyBrandingUtils";
import {
  SETTINGS_FIELD_HELP,
  SETTINGS_INPUT,
  SETTINGS_LABEL,
  SETTINGS_SECTION_DESC,
  SETTINGS_SECTION_TITLE,
  SETTINGS_WORKSPACE_ZONE,
} from "@/app/tools/settings/settingsConstants";

type SettingsCompanyBrandingSectionProps = {
  profile: CompanyBrandingProfile;
  onChange: (patch: Partial<CompanyBrandingProfile>) => void;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

function FieldGroup({
  id,
  label,
  help,
  children,
}: {
  id?: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={SETTINGS_LABEL}>
        {label}
      </label>
      {children}
      {help ? <p className={SETTINGS_FIELD_HELP}>{help}</p> : null}
    </div>
  );
}

export default function SettingsCompanyBrandingSection({
  profile,
  onChange,
  onLogoChange,
  disabled = false,
}: SettingsCompanyBrandingSectionProps) {
  return (
    <section className={`${SETTINGS_WORKSPACE_ZONE} overflow-hidden`} aria-label="Company settings form">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className={SETTINGS_SECTION_TITLE}>Company identity</h2>
        <p className={SETTINGS_SECTION_DESC}>
          Core account fields on your company profile — name, contact, license, and logo.
        </p>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        <FieldGroup id="company-name" label="Company name">
          <input
            id="company-name"
            type="text"
            value={profile.companyName}
            onChange={(e) => onChange({ companyName: e.target.value })}
            placeholder="Your company name"
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup id="company-email" label="Business email">
            <input
              id="company-email"
              type="email"
              value={profile.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="contact@company.com"
              className={SETTINGS_INPUT}
              disabled={disabled}
            />
          </FieldGroup>
          <FieldGroup id="company-phone" label="Phone">
            <input
              id="company-phone"
              type="tel"
              value={profile.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="(555) 123-4567"
              className={SETTINGS_INPUT}
              disabled={disabled}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          id="company-license"
          label="License / CLN number"
          help="Optional — used when you want license details on customer-facing documents."
        >
          <input
            id="company-license"
            type="text"
            value={profile.license}
            onChange={(e) => onChange({ license: e.target.value })}
            placeholder="License number"
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
        </FieldGroup>

        <FieldGroup
          id="notifications-email"
          label="Approval notification email"
          help="When a customer approves, we notify you at this email."
        >
          <input
            id="notifications-email"
            type="email"
            placeholder="notifications@company.com"
            value={profile.notificationsEmail ?? ""}
            onChange={(e) => onChange({ notificationsEmail: e.target.value })}
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
        </FieldGroup>

        <FieldGroup label="Logo URL or upload">
          <input
            type="text"
            value={profile.logoDataUrl.startsWith("data:") ? "" : profile.logoDataUrl}
            onChange={(e) => onChange({ logoDataUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
          <input
            type="file"
            accept="image/*"
            onChange={onLogoChange}
            disabled={disabled}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {profile.logoDataUrl ? (
            <div className="mt-2 inline-block rounded-md border border-slate-200 bg-slate-50 p-2">
              <img
                src={profile.logoDataUrl}
                alt="Company logo"
                className="max-h-24 max-w-[240px] object-contain"
              />
            </div>
          ) : null}
        </FieldGroup>
      </div>

      <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
        <h2 className={SETTINGS_SECTION_TITLE}>Proposal branding</h2>
        <p className={SETTINGS_SECTION_DESC}>
          Customer-facing branding on your company branding profile. {SETTINGS_BRANDING_TEMPLATES_NOTE}
        </p>
      </div>

      <div className="space-y-4 px-5 py-5 pb-6 sm:px-6">
        <FieldGroup id="company-address" label="Business address">
          <textarea
            id="company-address"
            value={profile.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="123 Main St, City, ST 12345"
            rows={2}
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
        </FieldGroup>

        <FieldGroup
          id="company-website"
          label="Website"
          help="Bare domains are normalized to https:// on save."
        >
          <input
            id="company-website"
            type="text"
            value={profile.website}
            onChange={(e) => onChange({ website: e.target.value })}
            placeholder="https://yourcompany.com"
            className={SETTINGS_INPUT}
            disabled={disabled}
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup
            id="brand-primary"
            label="Primary brand color"
            help="Hex color, e.g. #123456"
          >
            <input
              id="brand-primary"
              type="text"
              value={profile.brandPrimaryColor}
              onChange={(e) => onChange({ brandPrimaryColor: e.target.value })}
              placeholder="#123456"
              className={SETTINGS_INPUT}
              disabled={disabled}
            />
          </FieldGroup>
          <FieldGroup
            id="brand-secondary"
            label="Secondary brand color"
            help="Hex color, e.g. #abcdef"
          >
            <input
              id="brand-secondary"
              type="text"
              value={profile.brandSecondaryColor}
              onChange={(e) => onChange({ brandSecondaryColor: e.target.value })}
              placeholder="#abcdef"
              className={SETTINGS_INPUT}
              disabled={disabled}
            />
          </FieldGroup>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-3">
          <input
            type="checkbox"
            checked={profile.showLicenseOnCover}
            onChange={(e) => onChange({ showLicenseOnCover: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
            disabled={disabled}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900">Show license on cover</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              When enabled, your CLN/license can appear on proposal cover pages in a later rendering
              pass. Preview and send are not active yet.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
