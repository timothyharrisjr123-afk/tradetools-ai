"use client";

import {
  CATALOG_BULK_LIVE_ACTIONS,
  CATALOG_BULK_PLANNED_ACTIONS,
  type CatalogBulkLiveActionId,
} from "@/app/lib/catalogBulkActions";
import { formatCatalogSelectedCount } from "@/app/lib/catalogSelection";
import { CATALOG_PLANNED_LABEL } from "@/app/lib/catalogContractorLabels";
import {
  COMMAND_CONTROL_SOON_BADGE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "../catalogAdminConstants";

type CatalogBulkActionBarProps = {
  selectedCount: number;
  busy: boolean;
  onClearSelection: () => void;
  onLiveAction: (actionId: CatalogBulkLiveActionId) => void;
};

export default function CatalogBulkActionBar({
  selectedCount,
  busy,
  onClearSelection,
  onLiveAction,
}: CatalogBulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 sm:px-4"
      role="region"
      aria-label="Catalog bulk actions"
      data-catalog-bulk-bar
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900" data-catalog-selected-count>
            {formatCatalogSelectedCount(selectedCount)}
          </p>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={onClearSelection}
            disabled={busy}
            data-catalog-clear-selection
          >
            Clear selection
          </button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Bulk actions">
          {CATALOG_BULK_LIVE_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className={
                action.id === "mark_inactive" ||
                action.id === "proposal_hidden" ||
                action.id === "bulk_purchase_tax"
                  ? SECONDARY_BUTTON
                  : PRIMARY_BUTTON
              }
              title={action.detail}
              disabled={busy}
              onClick={() => onLiveAction(action.id as CatalogBulkLiveActionId)}
              data-catalog-bulk-action={action.id}
              data-catalog-bulk-status="live"
            >
              {action.label}
            </button>
          ))}

          <details className="relative">
            <summary
              className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-slate-300/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
              data-catalog-bulk-more
            >
              More actions
            </summary>
            <div className="absolute right-0 z-20 mt-1.5 w-[min(100vw-2rem,18rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Planned
              </p>
              <ul className="space-y-0.5">
                {CATALOG_BULK_PLANNED_ACTIONS.map((action) => (
                  <li key={action.id}>
                    <span
                      className="flex cursor-not-allowed select-none items-start justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm text-slate-500"
                      aria-disabled="true"
                      title={action.detail}
                      data-catalog-bulk-action={action.id}
                      data-catalog-bulk-status="planned"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-600">{action.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                          {action.detail}
                        </span>
                      </span>
                      <span className={`${COMMAND_CONTROL_SOON_BADGE} shrink-0`}>
                        {CATALOG_PLANNED_LABEL}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-slate-100 px-1.5 pt-2 text-[11px] leading-relaxed text-slate-500">
                Supplier sync, material ordering, hard delete, and template/proposal import are not
                live. Purchase tax remains internal contractor metadata.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
