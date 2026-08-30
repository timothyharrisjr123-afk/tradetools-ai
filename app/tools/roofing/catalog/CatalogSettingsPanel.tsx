"use client";

import Link from "next/link";
import {
  CATALOG_COMING_SOON_LABEL,
  CATALOG_SETTINGS_PLANNED_TOOLS,
} from "@/app/lib/catalogContractorLabels";
import { COMMAND_CONTROL_SOON_BADGE } from "@/app/admin/catalog/catalogAdminConstants";

export default function CatalogSettingsPanel() {
  return (
    <div className="space-y-4" aria-labelledby="catalog-settings-heading">
      <section className="rounded-xl border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <h2 id="catalog-settings-heading" className="text-base font-semibold text-slate-900">
          Catalog settings
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Catalog item defaults and advanced controls will live here. Taxes, margin, and profit
          rules are managed in Pricing rules.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/tools/settings/pricing"
          className="rounded-xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80"
        >
          <p className="text-sm font-semibold text-slate-900">Pricing rules</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Company tax, margin, and profit display policy.
          </p>
          <span className="mt-3 inline-flex text-sm font-semibold text-slate-800">
            Open Pricing rules →
          </span>
        </Link>
        <Link
          href="/tools/roofing/templates"
          className="rounded-xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80"
        >
          <p className="text-sm font-semibold text-slate-900">Templates</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Reusable proposal structure and package defaults.
          </p>
          <span className="mt-3 inline-flex text-sm font-semibold text-slate-800">
            Open Templates →
          </span>
        </Link>
      </div>

      <section
        className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-5"
        aria-labelledby="catalog-settings-planned-heading"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id="catalog-settings-planned-heading"
            className="text-sm font-semibold text-slate-700"
          >
            Future Catalog tools
          </h3>
          <span className={COMMAND_CONTROL_SOON_BADGE}>Planned</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          These controls will appear here when architecture supports them. They are not active yet.
        </p>
        <ul className="mt-4 space-y-3">
          {CATALOG_SETTINGS_PLANNED_TOOLS.map((tool) => (
            <li
              key={tool.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/70 px-3.5 py-3"
              aria-disabled="true"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">{tool.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{tool.detail}</p>
              </div>
              <span className={COMMAND_CONTROL_SOON_BADGE}>{CATALOG_COMING_SOON_LABEL}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
