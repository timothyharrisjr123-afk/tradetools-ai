"use client";

import Link from "next/link";
import type { InstallDefaultRoofingProposalTemplatesResult } from "@/app/lib/defaultRoofingProposalTemplateInstall";
import { TEMPLATES_CARD, TEMPLATES_METRIC_TILE } from "./templatesConstants";

type TemplatesInstallResultProps = {
  result: InstallDefaultRoofingProposalTemplatesResult;
};

export default function TemplatesInstallResult({ result }: TemplatesInstallResultProps) {
  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-install-result-heading">
      <h2 id="templates-install-result-heading" className="text-base font-semibold text-slate-900">
        Last install result
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Insert-only install. Recheck adds missing options, sections, and line items without duplicating
        existing seed keys.
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={TEMPLATES_METRIC_TILE}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Created
          </dt>
          <dd className="mt-1 space-y-0.5 text-xs text-slate-800">
            <div>
              Template:{" "}
              <span className="font-semibold tabular-nums">{result.createdTemplateCount}</span>
            </div>
            <div>
              Options:{" "}
              <span className="font-semibold tabular-nums">{result.createdOptionCount}</span>
            </div>
            <div>
              Sections:{" "}
              <span className="font-semibold tabular-nums">{result.createdSectionCount}</span>
            </div>
            <div>
              Line items:{" "}
              <span className="font-semibold tabular-nums">{result.createdItemCount}</span>
            </div>
          </dd>
        </div>
        <div className={TEMPLATES_METRIC_TILE}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Skipped
          </dt>
          <dd className="mt-1 space-y-0.5 text-xs text-slate-800">
            <div>
              Template:{" "}
              <span className="font-semibold tabular-nums">{result.skippedTemplateCount}</span>
            </div>
            <div>
              Options:{" "}
              <span className="font-semibold tabular-nums">{result.skippedOptionCount}</span>
            </div>
            <div>
              Sections:{" "}
              <span className="font-semibold tabular-nums">{result.skippedSectionCount}</span>
            </div>
            <div>
              Line items:{" "}
              <span className="font-semibold tabular-nums">{result.skippedItemCount}</span>
            </div>
          </dd>
        </div>
        <div className={TEMPLATES_METRIC_TILE}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Failed
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {result.failedCount}
          </dd>
        </div>
        <div className={TEMPLATES_METRIC_TILE}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Installed graph
          </dt>
          <dd className="mt-1 space-y-0.5 text-xs text-slate-800">
            <div>
              Options:{" "}
              <span className="font-semibold tabular-nums">
                {result.installedOptionCount ?? "—"}
              </span>
            </div>
            <div>
              Sections:{" "}
              <span className="font-semibold tabular-nums">
                {result.installedSectionCount ?? "—"}
              </span>
            </div>
            <div>
              Line items:{" "}
              <span className="font-semibold tabular-nums">
                {result.installedItemCount ?? "—"}
              </span>
            </div>
          </dd>
        </div>
      </dl>

      {result.missingCatalogSeedKeys.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-amber-900">Missing catalog seed keys</h3>
          <p className="mt-1 text-xs text-amber-800">
            Template line items need matching catalog rows with the same{" "}
            <code className="rounded bg-amber-100/80 px-1">metadata.seed_key</code>. Add or install
            catalog items, then recheck the starter template.
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
            {result.missingCatalogSeedKeys.map((key) => (
              <li key={key}>
                <code className="rounded bg-amber-100/80 px-1">{key}</code>
              </li>
            ))}
          </ul>
          <Link
            href="/tools/roofing/catalog"
            className="mt-3 inline-flex text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Open catalog setup
          </Link>
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-red-900">Install messages</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-800">
            {result.errors.map((err, index) => (
              <li key={`${index}-${err.slice(0, 40)}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
