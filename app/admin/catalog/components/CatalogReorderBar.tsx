"use client";

import {
  CATALOG_REORDER_HELPER_COPY,
  CATALOG_REORDER_UNAVAILABLE_COPY,
} from "@/app/lib/catalogReorder";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../catalogAdminConstants";

type CatalogReorderBarProps = {
  active: boolean;
  available: boolean;
  dirty: boolean;
  busy: boolean;
  itemCount: number;
  onCancel: () => void;
  onSave: () => void;
};

export default function CatalogReorderBar({
  active,
  available,
  dirty,
  busy,
  itemCount,
  onCancel,
  onSave,
}: CatalogReorderBarProps) {
  if (!active) return null;

  return (
    <div
      className="border-b border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 sm:px-4"
      role="region"
      aria-label="Catalog reorder mode"
      data-catalog-reorder-bar
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Reorder mode</p>
          <p
            className="mt-0.5 text-xs leading-relaxed text-slate-600"
            data-catalog-reorder-helper
          >
            {available
              ? `${CATALOG_REORDER_HELPER_COPY} ${itemCount} item${itemCount === 1 ? "" : "s"} in this order.`
              : CATALOG_REORDER_UNAVAILABLE_COPY}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!available ? (
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={onCancel}
              disabled={busy}
              data-catalog-reorder-cancel
            >
              Exit reorder
            </button>
          ) : (
            <>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={onCancel}
                disabled={busy}
                data-catalog-reorder-cancel
              >
                Cancel
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={onSave}
                disabled={busy || !dirty}
                data-catalog-reorder-save
              >
                {busy ? "Saving…" : "Save order"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
