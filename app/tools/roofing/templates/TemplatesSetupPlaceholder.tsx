"use client";

import Link from "next/link";
import { TEMPLATES_CARD, TEMPLATES_SETUP_STEP_CARD } from "./templatesConstants";

export default function TemplatesSetupPlaceholder() {
  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Proposal templates</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Company-wide reusable proposal packages. Template line items come from your catalog.
          Install and configure templates here before using Proposal Builder on individual jobs.
        </p>
      </header>

      <section className={TEMPLATES_CARD} aria-labelledby="templates-setup-hub-heading">
        <h2 id="templates-setup-hub-heading" className="text-base font-semibold text-slate-900">
          Templates setup
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Work through company setup in order. This page is a setup surface only — not Proposal
          Builder and not per-job proposal creation.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={`${TEMPLATES_SETUP_STEP_CARD} ring-2 ring-cyan-200/90 border-cyan-200`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                1
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                Catalog
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

          <div className={`${TEMPLATES_SETUP_STEP_CARD} opacity-95`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                2
              </span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                Next pass
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Starter template installed</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
              Install the default roof replacement template (Standard, Enhanced, Premium options)
              linked to catalog items. Install and recheck controls will be added in the next
              implementation pass.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400 sm:w-auto"
              title="Available in a future update"
            >
              Install starter template
            </button>
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

      <section className={TEMPLATES_CARD} aria-labelledby="templates-scope-heading">
        <h2 id="templates-scope-heading" className="text-base font-semibold text-slate-900">
          What this page will include
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>Starter template install and recheck (insert-only, idempotent)</li>
          <li>Read-only summary of installed templates and catalog links</li>
          <li>Template readiness before Proposal Builder</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-slate-700">Explicitly not on this page yet:</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-slate-500">
          <li>Proposal Builder or creating proposals from jobs</li>
          <li>Template editing, pricing bridge, PDF, send, or approval workflows</li>
          <li>Changes to saved estimates or job pricing math</li>
        </ul>
      </section>
    </div>
  );
}
