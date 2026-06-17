"use client";

import type { ReactNode } from "react";
import { TEMPLATES_CARD } from "./templatesConstants";

type TemplatesOnboardingZoneProps = {
  workspaceActive: boolean;
  catalogPrerequisite: ReactNode;
  starterHero: ReactNode;
};

export default function TemplatesOnboardingZone({
  workspaceActive,
  catalogPrerequisite,
  starterHero,
}: TemplatesOnboardingZoneProps) {
  return (
    <section aria-labelledby="templates-onboarding-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="templates-onboarding-heading" className="text-sm font-semibold text-slate-900">
            {workspaceActive ? "Setup & onboarding" : "Get started"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {workspaceActive
              ? "Catalog and starter template setup. Install controls stay here while you work in the workspace below."
              : "Complete catalog setup and install your first reusable proposal template."}
          </p>
        </div>
        {workspaceActive ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            Onboarding
          </span>
        ) : null}
      </div>

      {catalogPrerequisite}
      {starterHero}
    </section>
  );
}
