"use client";

import type { InstallDefaultRoofingCatalogResult } from "@/app/lib/defaultRoofingCatalogInstall";

type CatalogInstallFeedbackProps = {
  result: InstallDefaultRoofingCatalogResult;
};

export default function CatalogInstallFeedback({ result }: CatalogInstallFeedbackProps) {
  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3"
      aria-labelledby="catalog-install-feedback-heading"
    >
      <h3
        id="catalog-install-feedback-heading"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Install result
      </h3>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-700 sm:max-w-md">
        <div>
          <dt className="font-medium text-slate-500">Created</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{result.createdCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Skipped</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{result.skippedCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Failed</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{result.failedCount}</dd>
        </div>
      </dl>
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
