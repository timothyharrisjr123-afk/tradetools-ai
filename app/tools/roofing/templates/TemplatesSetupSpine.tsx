"use client";

import Link from "next/link";
import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import { formatCatalogSectionStatus } from "@/app/lib/catalogReadiness";
import {
  TEMPLATES_CARD,
  TEMPLATES_SETUP_STEP_ACTIVE_RING,
  TEMPLATES_SETUP_STEP_CARD,
} from "./templatesConstants";
import {
  formatStarterTemplateAvailability,
  getPassiveStarterOptionLabels,
} from "./templatesSetupUtils";

type TemplatesSetupSpineProps = {
  loading: boolean;
  catalogReady: boolean;
  installing: boolean;
  readiness: CatalogReadinessSummary;
  starterInstalled: boolean;
  catalogStatusLabel: string;
  installButtonLabel: string;
  installDisabled: boolean;
  installDisabledTitle?: string;
  onInstallStarter: () => void;
};

export default function TemplatesSetupSpine({
  loading,
  catalogReady,
  installing,
  readiness,
  starterInstalled,
  catalogStatusLabel,
  installButtonLabel,
  installDisabled,
  installDisabledTitle,
  onInstallStarter,
}: TemplatesSetupSpineProps) {
  const catalogSection = formatCatalogSectionStatus(readiness);
  const passiveOptions = getPassiveStarterOptionLabels();
  const starterDisplay = formatStarterTemplateAvailability(starterInstalled);

  const step1Class = `${TEMPLATES_SETUP_STEP_CARD} ${
    !catalogReady && !loading ? TEMPLATES_SETUP_STEP_ACTIVE_RING : ""
  }`;
  const step2Class = `${TEMPLATES_SETUP_STEP_CARD} ${
    catalogReady && !starterInstalled && !loading && !installing
      ? TEMPLATES_SETUP_STEP_ACTIVE_RING
      : ""
  }`;

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-setup-hub-heading">
      <h2 id="templates-setup-hub-heading" className="text-base font-semibold text-slate-900">
        Templates setup
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Work through company setup in order. This page is a setup surface only — not Proposal
        Builder and not per-job proposal creation.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={step1Class}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              1
            </span>
            <span
              className={
                catalogSection.ready
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                  : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
              }
            >
              {loading ? "…" : catalogSection.ready ? "Ready" : catalogStatusLabel}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Catalog ready</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            Reusable materials, labor, and fees with measurement quantity rules must exist in your
            company catalog before template line items can be installed.
          </p>
          <Link
            href="/tools/roofing/catalog"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:w-auto"
          >
            Open catalog setup
          </Link>
        </div>

        <div className={step2Class}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              2
            </span>
            <span
              className={
                starterInstalled
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                  : catalogReady
                    ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
              }
            >
              {loading || installing ? "…" : starterInstalled ? "Installed" : "Not installed"}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Starter template installed</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            {starterInstalled
              ? "Default roof replacement template is in your company library. Recheck adds any missing options, sections, or line items."
              : "Install the default roof replacement template (Standard, Enhanced, Premium options) linked to catalog items."}
          </p>
          {!starterInstalled && passiveOptions.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Available options: {passiveOptions.join(", ")}.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {loading || installing ? "…" : starterDisplay}
          </p>
          <button
            type="button"
            disabled={installDisabled}
            title={installDisabledTitle}
            onClick={onInstallStarter}
            className={`mt-4 w-full rounded-md px-4 py-2 text-sm font-semibold shadow-sm sm:w-auto ${
              installDisabled
                ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {installButtonLabel}
          </button>
          {!catalogReady && (
            <p className="mt-2 text-xs text-slate-500">Complete catalog setup first.</p>
          )}
          {catalogReady && starterInstalled && (
            <p className="mt-2 text-xs text-slate-500">
              Recheck is insert-only and will not duplicate existing template rows.
            </p>
          )}
        </div>

        <div className={`${TEMPLATES_SETUP_STEP_CARD} opacity-95`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600">
              3
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
              Later
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">Ready for Proposal Builder</h3>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
            After catalog and starter templates are in place, Proposal Builder will launch from Job
            Card to create job-specific proposals. Not available on this page.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">Proposal Builder — coming later</p>
        </div>
      </div>
    </section>
  );
}
