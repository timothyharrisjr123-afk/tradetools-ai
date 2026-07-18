"use client";

import type { ReactNode } from "react";

type TemplatesOnboardingZoneProps = {
  workspaceActive: boolean;
  /** Catalog ready + starter installed — collapse to a quiet strip. */
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
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2"
        data-templates-setup-strip
        role="status"
      >
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Setup complete</span>
          <span className="text-slate-400"> · </span>
          Catalog ready
          <span className="text-slate-400"> · </span>
          Starter installed
        </p>
        <button
          type="button"
          disabled={recheckDisabled}
          title={recheckDisabledTitle}
          onClick={onRecheck}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            recheckDisabled
              ? "cursor-not-allowed text-slate-400"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          data-templates-setup-recheck
        >
          {recheckLabel}
        </button>
      </div>
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
            ? "Finish Catalog and starter template setup to unlock quote review."
            : "Complete Catalog setup and install your first proposal template."}
        </p>
      </div>

      {catalogPrerequisite}
      {starterHero}
    </section>
  );
}
