"use client";

import type { ReactNode } from "react";

type TemplatesOnboardingZoneProps = {
  workspaceActive: boolean;
  /** Catalog ready + starter installed — collapse out of first impression. */
  setupComplete: boolean;
  catalogPrerequisite: ReactNode;
  starterHero: ReactNode;
  recheckLabel: string;
  recheckDisabled: boolean;
  recheckDisabledTitle?: string;
  onRecheck: () => void;
};

export default function TemplatesOnboardingZone({
  workspaceActive,
  setupComplete,
  catalogPrerequisite,
  starterHero,
  recheckLabel,
  recheckDisabled,
  recheckDisabledTitle,
  onRecheck,
}: TemplatesOnboardingZoneProps) {
  if (workspaceActive && setupComplete) {
    return (
      <details
        className="rounded-md border border-transparent px-1 py-0.5 text-slate-400 open:border-slate-200 open:bg-slate-50/60 open:px-3 open:py-2"
        data-templates-setup-diagnostics
      >
        <summary
          className="cursor-pointer list-none text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline [&::-webkit-details-marker]:hidden"
          data-templates-setup-diagnostics-summary
        >
          Setup
        </summary>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500" data-templates-setup-strip>
            Catalog ready · Starter installed
          </p>
          <button
            type="button"
            disabled={recheckDisabled}
            title={recheckDisabledTitle}
            onClick={onRecheck}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              recheckDisabled
                ? "cursor-not-allowed text-slate-400"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            data-templates-setup-recheck
          >
            {recheckLabel}
          </button>
        </div>
      </details>
    );
  }

  return (
    <section
      aria-labelledby="templates-onboarding-heading"
      className="space-y-3"
      data-templates-onboarding-full
    >
      <div>
        <h2 id="templates-onboarding-heading" className="text-sm font-semibold text-slate-900">
          {workspaceActive ? "Setup" : "Get started"}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {workspaceActive
            ? "Finish Catalog and your starter template."
            : "Finish Catalog setup, then install a starter template."}
        </p>
      </div>

      {catalogPrerequisite}
      {starterHero}
    </section>
  );
}
