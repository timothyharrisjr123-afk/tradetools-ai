"use client";

import type { CompanyBrandingViewModel } from "@/app/lib/companyBrandingProfile";
import {
  getBrandingReadinessSummary,
  getUnsatisfiedBrandingFieldMessages,
} from "@/app/tools/settings/settingsCompanyBrandingUtils";
import {
  SETTINGS_CARD,
  SETTINGS_GUIDANCE_INCOMPLETE,
  SETTINGS_GUIDANCE_READY,
  SETTINGS_GUIDANCE_USABLE,
} from "@/app/tools/settings/settingsConstants";

type SettingsBrandingReadinessCardProps = {
  viewModel: CompanyBrandingViewModel;
};

function readinessClass(level: CompanyBrandingViewModel["readiness"]["level"]): string {
  if (level === "ready") return SETTINGS_GUIDANCE_READY;
  if (level === "usable") return SETTINGS_GUIDANCE_USABLE;
  return SETTINGS_GUIDANCE_INCOMPLETE;
}

function readinessHeading(level: CompanyBrandingViewModel["readiness"]["level"]): string {
  if (level === "ready") return "Branding readiness";
  if (level === "usable") return "Recommended next steps";
  return "Required setup";
}

export default function SettingsBrandingReadinessCard({
  viewModel,
}: SettingsBrandingReadinessCardProps) {
  const summary = getBrandingReadinessSummary(viewModel);
  const unsatisfiedMessages = getUnsatisfiedBrandingFieldMessages(viewModel);
  const level = viewModel.readiness.level;

  return (
    <section className={SETTINGS_CARD} aria-labelledby="settings-readiness-heading">
      <h2 id="settings-readiness-heading" className="text-sm font-semibold text-slate-900">
        {readinessHeading(level)}
      </h2>
      <div className={`mt-3 ${readinessClass(level)}`}>
        <p>{summary}</p>
        {unsatisfiedMessages.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed opacity-90">
            {unsatisfiedMessages.slice(0, 5).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Proposal Builder preview and customer send flows are not active yet — saving here prepares
        identity and branding for later rendering stages.
      </p>
    </section>
  );
}
