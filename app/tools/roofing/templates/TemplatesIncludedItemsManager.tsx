"use client";

import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
  type TemplateCatalogLinkView,
} from "@/app/lib/proposalTemplateCatalogLink";
import { formatProposalVisibilityShort } from "@/app/lib/catalogContractorLabels";
import { TEMPLATES_CARD } from "./templatesConstants";

export type IncludedItemGroup = {
  sectionId: string;
  sectionLabel: string;
  items: TemplateCatalogLinkView[];
};

type TemplatesIncludedItemsManagerProps = {
  groups: readonly IncludedItemGroup[];
  busy: boolean;
  onAddItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
};

function statusBadgeClass(status: TemplateCatalogLinkView["status"]): string {
  if (status === "linked") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

function visibilityLabel(view: TemplateCatalogLinkView): string | null {
  if (!view.proposalVisibility) return null;
  return formatProposalVisibilityShort(view.proposalVisibility);
}

export default function TemplatesIncludedItemsManager({
  groups,
  busy,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
}: TemplatesIncludedItemsManagerProps) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section
      className={`${TEMPLATES_CARD} !px-4 !py-3 space-y-3`}
      aria-labelledby="templates-included-items-heading"
      data-templates-included-manager
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3
            id="templates-included-items-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Included items
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalItems === 0
              ? "Items from Catalog that appear on this package."
              : `${totalItems} item${totalItems === 1 ? "" : "s"} on this package`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddItem}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-templates-add-item
        >
          {TEMPLATE_ADD_FROM_CATALOG_LABEL}
        </button>
      </div>

      {totalItems === 0 ? (
        <p
          className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600"
          data-templates-included-empty
        >
          No items included here yet. Add from Catalog.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.sectionId} data-templates-included-group={group.sectionId}>
              {groups.length > 1 ? (
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.sectionLabel}
                </p>
              ) : null}
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
                {group.items.map((view) => {
                  const summary = [
                    view.catalogTypeLabel,
                    view.catalogUnitLabel,
                    view.measurementLabel,
                    visibilityLabel(view),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={view.templateItemId}
                      className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      data-templates-included-row={view.templateItemId}
                      data-templates-catalog-link={view.templateItemId}
                      data-templates-catalog-link-status={view.status}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{view.displayName}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusBadgeClass(view.status)}`}
                          >
                            {view.statusLabel}
                          </span>
                        </div>
                        {summary ? (
                          <p className="mt-0.5 text-xs text-slate-500">{summary}</p>
                        ) : null}
                        {view.status !== "linked" ? (
                          <p className="mt-0.5 text-[11px] text-amber-900">{view.statusDetail}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onReplaceItem(view.templateItemId)}
                          disabled={busy || !view.canRelink}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          data-templates-replace-item={view.templateItemId}
                          data-templates-relink-catalog={view.templateItemId}
                        >
                          {TEMPLATE_RELINK_CATALOG_LABEL}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(view.templateItemId)}
                          disabled={busy}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          data-templates-remove-from-template={view.templateItemId}
                        >
                          {TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
