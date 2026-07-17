"use client";

import type { CatalogCsvAnalyzeResult } from "@/app/lib/catalogCsv";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../catalogAdminConstants";

type CatalogCsvImportModalProps = {
  open: boolean;
  fileName: string | null;
  analyzing: boolean;
  importing: boolean;
  analysis: CatalogCsvAnalyzeResult | null;
  importError: string | null;
  importSuccess: string | null;
  onClose: () => void;
  onPickFile: (file: File) => void;
  onClearFile: () => void;
  onConfirmImport: () => void;
};

export default function CatalogCsvImportModal({
  open,
  fileName,
  analyzing,
  importing,
  analysis,
  importError,
  importSuccess,
  onClose,
  onPickFile,
  onClearFile,
  onConfirmImport,
}: CatalogCsvImportModalProps) {
  if (!open) return null;

  const canImport =
    analysis != null &&
    analysis.ok &&
    analysis.summary.invalidCount === 0 &&
    (analysis.summary.createCount > 0 || analysis.summary.updateCount > 0) &&
    !importing &&
    !analyzing &&
    !importSuccess;

  const issueRows =
    analysis?.rows.filter((row) => row.errors.length > 0 || row.warnings.length > 0) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-csv-import-title"
      data-catalog-csv-import-modal
    >
      <div className="flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="catalog-csv-import-title" className="text-lg font-semibold text-slate-900">
            Upload catalog CSV
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Preview and validate before import. Invalid rows block the whole import. Supplier SKU
            columns are reserved and are not saved yet.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              CSV file
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-1.5 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
              disabled={analyzing || importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onPickFile(file);
              }}
              data-catalog-csv-file-input
            />
            {fileName ? (
              <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="truncate">{fileName}</span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-slate-700 hover:text-slate-900"
                  onClick={onClearFile}
                  disabled={analyzing || importing}
                >
                  Clear
                </button>
              </span>
            ) : null}
          </label>

          {analyzing ? <p className="text-sm text-slate-600">Parsing CSV…</p> : null}

          {analysis?.fileErrors.length ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              <p className="font-semibold">File errors</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {analysis.fileErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis && analysis.fileErrors.length === 0 ? (
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              data-catalog-csv-preview-summary
            >
              <SummaryChip label="Rows" value={analysis.summary.rowCount} />
              <SummaryChip label="Creates" value={analysis.summary.createCount} />
              <SummaryChip label="Updates" value={analysis.summary.updateCount} />
              <SummaryChip label="Unchanged" value={analysis.summary.unchangedCount} />
              <SummaryChip
                label="Invalid"
                value={analysis.summary.invalidCount}
                tone={analysis.summary.invalidCount > 0 ? "danger" : "default"}
              />
              <SummaryChip
                label="Warnings"
                value={analysis.summary.warningCount}
                tone={analysis.summary.warningCount > 0 ? "warn" : "default"}
              />
            </div>
          ) : null}

          {issueRows.length > 0 ? (
            <div className="space-y-2" data-catalog-csv-row-issues>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Row issues
              </p>
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                {issueRows.map((row) => (
                  <li
                    key={row.rowNumber}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-slate-800">
                      Row {row.rowNumber}
                      {row.values?.name ? (
                        <span className="font-normal text-slate-500"> · {row.values.name}</span>
                      ) : row.raw.name ? (
                        <span className="font-normal text-slate-500"> · {row.raw.name}</span>
                      ) : null}
                      <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        {row.action}
                      </span>
                    </p>
                    {row.errors.map((err) => (
                      <p key={err} className="mt-1 text-rose-700">
                        {err}
                      </p>
                    ))}
                    {row.warnings.map((warn) => (
                      <p key={warn} className="mt-1 text-amber-800">
                        {warn}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {importError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {importError}
            </div>
          ) : null}

          {importSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {importSuccess}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClose}
            disabled={importing}
          >
            {importSuccess ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={onConfirmImport}
            disabled={!canImport}
            data-catalog-csv-confirm-import
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warn";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
