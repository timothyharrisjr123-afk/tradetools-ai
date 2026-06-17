import {
  SETTINGS_BRANDING_PAGE_INTRO,
  SETTINGS_BRANDING_PRICING_NOTE,
} from "@/app/tools/settings/settingsCompanyBrandingUtils";

export default function SettingsPageHeader() {
  return (
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Company setup
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        Company settings
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
        {SETTINGS_BRANDING_PAGE_INTRO}
      </p>
      <p className="mt-2 max-w-3xl text-xs text-slate-500">{SETTINGS_BRANDING_PRICING_NOTE}</p>
    </header>
  );
}
