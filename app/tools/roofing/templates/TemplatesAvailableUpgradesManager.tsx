"use client";

import { useState } from "react";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
} from "@/app/lib/proposalTemplateCatalogLink";
import {
  TEMPLATES_CARD,
  TEMPLATES_WORKSPACE_SECTION,
} from "./templatesConstants";
import {
  TEMPLATES_AVAILABLE_UPGRADES_EMPTY,
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
  /** When true, renders as a band inside the connected workspace (no outer card). */
  embedded?: boolean;
};

export default function TemplatesAvailableUpgradesManager({
  items,
  busy,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
  embedded = false,
}: TemplatesAvailableUpgradesManagerProps) {
  const [adjusting, setAdjusting] = useState(false);
  const totalItems = items.length;
  const shellClass = embedded
    ? TEMPLATES_WORKSPACE_SECTION
    : `${TEMPLATES_CARD} !px-4 !py-4 space-y-3`;

  return (
    <section
      className={shellClass}
      aria-labelledby="templates-available-upgrades-heading"
      data-templates-available-upgrades
      data-templates-available-upgrades-mode={adjusting ? "adjust" : "prepared"}
      data-templates-section-embedded={embedded ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="templates-available-upgrades-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {TEMPLATES_AVAILABLE_UPGRADES_HEADING}
          </h3>
          {totalItems > 0 ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {totalItems} optional · {TEMPLATES_AVAILABLE_UPGRADES_HINT}
            </p>
          ) : null}
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
        <div
          className="mt-2.5 rounded-lg bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/60"
          data-templates-available-upgrades-empty
        >
          <p className="text-xs text-slate-500">{TEMPLATES_AVAILABLE_UPGRADES_EMPTY}</p>
        </div>
      ) : adjusting ? (
        <div className="mt-3 space-y-2" data-templates-available-upgrades-adjust-view>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/90 bg-white">
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
        <ul
          className="mt-2.5 space-y-1.5"
          data-templates-available-upgrades-prepared-view
        >
          {items.map((item) => (
            <li
              key={item.templateItemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200/80"
              data-templates-available-upgrade-summary={item.templateItemId}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.name}</p>
                {item.issueLabel ? (
                  <p className="mt-0.5 text-[11px] text-amber-800">{item.issueLabel}</p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Optional upgrade · selected later in Builder
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
                Optional
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
