"use client";

import { useState } from "react";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
} from "@/app/lib/proposalTemplateCatalogLink";
import { TEMPLATES_CARD } from "./templatesConstants";
import {
  TEMPLATES_AVAILABLE_UPGRADES_HEADING,
  TEMPLATES_AVAILABLE_UPGRADES_HINT,
} from "./templatesWorkspaceFlow";
import type { PreparedAvailableUpgradeItem } from "./templatesIncludedWorkPresentation";

type TemplatesAvailableUpgradesManagerProps = {
  items: readonly PreparedAvailableUpgradeItem[];
  busy: boolean;
  onAddItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
};

export default function TemplatesAvailableUpgradesManager({
  items,
  busy,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
}: TemplatesAvailableUpgradesManagerProps) {
  const [adjusting, setAdjusting] = useState(false);
  const totalItems = items.length;

  return (
    <section
      className={`${TEMPLATES_CARD} !px-4 !py-4 space-y-3`}
      aria-labelledby="templates-available-upgrades-heading"
      data-templates-available-upgrades
      data-templates-available-upgrades-mode={adjusting ? "adjust" : "prepared"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="templates-available-upgrades-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {TEMPLATES_AVAILABLE_UPGRADES_HEADING}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {totalItems === 0
              ? TEMPLATES_AVAILABLE_UPGRADES_HINT
              : `${totalItems} available upgrade${totalItems === 1 ? "" : "s"}. ${TEMPLATES_AVAILABLE_UPGRADES_HINT}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {adjusting ? (
            <button
              type="button"
              onClick={onAddItem}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              data-templates-add-upgrade
            >
              {TEMPLATE_ADD_FROM_CATALOG_LABEL}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAdjusting((current) => !current)}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            data-templates-adjust-available-upgrades
          >
            {adjusting ? "Done adjusting" : "Adjust available upgrades"}
          </button>
        </div>
      </div>

      {totalItems === 0 ? (
        <p
          className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600"
          data-templates-available-upgrades-empty
        >
          No available upgrades prepared yet. Choose Adjust available upgrades to add elective
          add-ons.
        </p>
      ) : adjusting ? (
        <div className="space-y-3" data-templates-available-upgrades-adjust-view>
          <p className="text-xs text-slate-500">
            Add, replace, or remove upgrades available for selection on proposals. These are not
            included package scope.
          </p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {items.map((item) => (
              <li
                key={item.templateItemId}
                className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                data-templates-available-upgrade-row={item.templateItemId}
                data-templates-catalog-link={item.templateItemId}
                data-templates-catalog-link-status={item.status}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  {item.issueLabel ? (
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      {item.issueLabel}
                      {item.issueDetail ? ` · ${item.issueDetail}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => onReplaceItem(item.templateItemId)}
                    disabled={busy || !item.canReplace}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    data-templates-replace-upgrade={item.templateItemId}
                  >
                    {TEMPLATE_RELINK_CATALOG_LABEL}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.templateItemId)}
                    disabled={busy}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    data-templates-remove-upgrade={item.templateItemId}
                  >
                    {TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50/45 px-3.5 py-3"
          data-templates-available-upgrades-prepared-view
        >
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.templateItemId}
                className="min-w-0"
                data-templates-available-upgrade-summary={item.templateItemId}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">{item.name}</p>
                    {item.issueLabel ? (
                      <p className="mt-0.5 text-[11px] text-amber-800">{item.issueLabel}</p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Available for selection on proposals
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
