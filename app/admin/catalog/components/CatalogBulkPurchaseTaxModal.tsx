"use client";

import { formatCatalogSelectedCount } from "@/app/lib/catalogSelection";
import type { CatalogBulkPurchaseTaxMode } from "@/app/lib/catalogBulkActions";
import {
  CATALOG_BULK_PURCHASE_TAX_HELPER,
  CATALOG_BULK_PURCHASE_TAX_TITLE,
} from "@/app/lib/catalogContractorLabels";
import { FIELD_INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../catalogAdminConstants";

type CatalogBulkPurchaseTaxModalProps = {
  open: boolean;
  selectedCount: number;
  mode: CatalogBulkPurchaseTaxMode;
  rateInput: string;
  error: string | null;
  busy: boolean;
  onModeChange: (mode: CatalogBulkPurchaseTaxMode) => void;
  onRateInputChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CatalogBulkPurchaseTaxModal({
  open,
  selectedCount,
  mode,
  rateInput,
  error,
  busy,
  onModeChange,
  onRateInputChange,
  onClose,
  onConfirm,
}: CatalogBulkPurchaseTaxModalProps) {
  if (!open) return null;

  const confirmLabel =
    mode === "clear" ? "Clear purchase tax" : "Apply purchase tax";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-bulk-purchase-tax-title"
      data-catalog-bulk-purchase-tax-modal
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2
          id="catalog-bulk-purchase-tax-title"
          className="text-lg font-semibold text-slate-900"
        >
          {CATALOG_BULK_PURCHASE_TAX_TITLE}
        </h2>
        <p
          className="mt-1 text-xs leading-relaxed text-slate-500"
          data-catalog-bulk-purchase-tax-helper
        >
          {CATALOG_BULK_PURCHASE_TAX_HELPER}
        </p>
        <p
          className="mt-3 text-sm font-semibold text-slate-800"
          data-catalog-bulk-purchase-tax-count
        >
          {formatCatalogSelectedCount(selectedCount)}
        </p>

        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}

        <fieldset className="mt-4 space-y-3" disabled={busy}>
          <legend className="sr-only">Purchase tax action</legend>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
            <input
              type="radio"
              name="catalog-bulk-purchase-tax-mode"
              className="mt-0.5"
              checked={mode === "set"}
              onChange={() => onModeChange("set")}
              data-catalog-bulk-purchase-tax-mode="set"
            />
            <span>
              <span className="block font-medium">Set purchase tax rate</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Apply the same internal percent to every selected item.
              </span>
            </span>
          </label>

          {mode === "set" ? (
            <label className="block text-sm pl-6">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                Purchase tax rate
              </span>
              <input
                type="text"
                inputMode="decimal"
                className={FIELD_INPUT}
                value={rateInput}
                onChange={(e) => onRateInputChange(e.target.value)}
                placeholder="e.g. 7.25"
                aria-label="Purchase tax rate"
                data-catalog-bulk-purchase-tax-rate
              />
              <span className="mt-1 block text-xs text-slate-500">
                Percent points, 0–100. Decimals allowed. Internal only.
              </span>
            </label>
          ) : null}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
            <input
              type="radio"
              name="catalog-bulk-purchase-tax-mode"
              className="mt-0.5"
              checked={mode === "clear"}
              onChange={() => onModeChange("clear")}
              data-catalog-bulk-purchase-tax-mode="clear"
            />
            <span>
              <span className="block font-medium">Clear purchase tax on selected items</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Removes the stored purchase tax rate (sets it to unset).
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={onConfirm}
            disabled={busy || selectedCount <= 0}
            data-catalog-bulk-purchase-tax-confirm
          >
            {busy ? "Updating…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
