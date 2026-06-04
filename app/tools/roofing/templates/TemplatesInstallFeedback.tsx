"use client";

import Link from "next/link";
import type { InstallDefaultRoofingProposalTemplatesResult } from "@/app/lib/defaultRoofingProposalTemplateInstall";

type TemplatesInstallFeedbackProps = {
  result: InstallDefaultRoofingProposalTemplatesResult;
};

export default function TemplatesInstallFeedback({ result }: TemplatesInstallFeedbackProps) {
  const createdSummary = [
    result.createdTemplateCount > 0 ? `${result.createdTemplateCount} template` : null,
    result.createdOptionCount > 0 ? `${result.createdOptionCount} options` : null,
    result.createdSectionCount > 0 ? `${result.createdSectionCount} sections` : null,
    result.createdItemCount > 0 ? `${result.createdItemCount} lines` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const skippedSummary = [
    result.skippedTemplateCount > 0 ? `${result.skippedTemplateCount} template` : null,
    result.skippedOptionCount > 0 ? `${result.skippedOptionCount} options` : null,
    result.skippedSectionCount > 0 ? `${result.skippedSectionCount} sections` : null,
    result.skippedItemCount > 0 ? `${result.skippedItemCount} lines` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3"
      aria-labelledby="templates-install-feedback-heading"
    >
      <h3 id="templates-install-feedback-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Install result
      </h3>
      <dl className="mt-2 space-y-1 text-xs text-slate-700">
        {createdSummary ? (
          <div>
            <span className="font-medium text-slate-800">Created:</span> {createdSummary}
          </div>
        ) : null}
        {skippedSummary ? (
          <div>
            <span className="font-medium text-slate-800">Skipped:</span> {skippedSummary}
          </div>
        ) : null}
        {result.failedCount > 0 ? (
          <div>
            <span className="font-medium text-red-800">Failed:</span>{" "}
            <span className="tabular-nums">{result.failedCount}</span>
          </div>
        ) : null}
        {result.installedOptionCount != null ? (
          <div className="text-slate-600">
            Graph now: {result.installedOptionCount} options · {result.installedSectionCount ?? "—"}{" "}
            sections · {result.installedItemCount ?? "—"} line items
          </div>
        ) : null}
      </dl>

      {result.missingCatalogSeedKeys.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">Missing catalog seed keys</p>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-900">
            {result.missingCatalogSeedKeys.map((key) => (
              <li key={key}>
                <code className="rounded bg-amber-100/80 px-1">{key}</code>
              </li>
            ))}
          </ul>
          <Link
            href="/tools/roofing/catalog"
            className="mt-2 inline-block text-xs font-semibold text-amber-900 underline underline-offset-2"
          >
            Open catalog setup
          </Link>
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-red-800">
          {result.errors.map((err, index) => (
            <li key={`${index}-${err.slice(0, 40)}`}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
