"use client";

import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
  type TemplateCatalogLinkView,
} from "@/app/lib/proposalTemplateCatalogLink";
import { formatProposalVisibilityShort } from "@/app/lib/catalogContractorLabels";
import { TEMPLATES_CARD } from "./templatesConstants";
import {
  TEMPLATES_INCLUDED_WORK_HEADING,
  TEMPLATES_INCLUDED_WORK_HINT,
} from "./templatesWorkspaceFlow";

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
  heading?: string;
};

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
  heading = TEMPLATES_INCLUDED_WORK_HEADING,
}: TemplatesIncludedItemsManagerProps) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section
      className={`${TEMPLATES_CARD} !px-4 !py-4 space-y-3`}
      aria-labelledby="templates-included-items-heading"
      data-templates-included-manager
      data-templates-included-work
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="templates-included-items-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {heading}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalItems === 0
              ? TEMPLATES_INCLUDED_WORK_HINT
              : `${totalItems} prepared item${totalItems === 1 ? "" : "s"}. ${TEMPLATES_INCLUDED_WORK_HINT}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddItem}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
          No included work here yet. Add from Catalog only if you need to adjust this setup.
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
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {group.items.map((view) => {
                  const summary = [
                    view.catalogTypeLabel,
                    view.catalogUnitLabel,
                    view.measurementLabel,
                    visibilityLabel(view),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const needsAdjust = view.status !== "linked";
                  return (
                    <li
                      key={view.templateItemId}
                      className="group flex flex-col gap-1.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      data-templates-included-row={view.templateItemId}
                      data-templates-catalog-link={view.templateItemId}
                      data-templates-catalog-link-status={view.status}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{view.displayName}</p>
                        {summary ? (
                          <p className="mt-0.5 text-xs text-slate-500">{summary}</p>
                        ) : null}
                        {needsAdjust ? (
                          <p className="mt-0.5 text-[11px] text-amber-900">{view.statusDetail}</p>
                        ) : null}
                      </div>
                      <div
                        className={`flex shrink-0 flex-wrap gap-x-3 gap-y-1 ${
                          needsAdjust
                            ? "opacity-100"
                            : "opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onReplaceItem(view.templateItemId)}
                          disabled={busy || !view.canRelink}
                          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          data-templates-replace-item={view.templateItemId}
                          data-templates-relink-catalog={view.templateItemId}
                        >
                          {TEMPLATE_RELINK_CATALOG_LABEL}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(view.templateItemId)}
                          disabled={busy}
                          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
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
