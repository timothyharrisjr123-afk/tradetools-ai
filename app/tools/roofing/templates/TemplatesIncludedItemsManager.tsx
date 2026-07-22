"use client";

import { useEffect, useState } from "react";
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
  TEMPLATES_ADJUST_INCLUDED_ACTION,
  TEMPLATES_INCLUDED_WORK_ADJUST_HINT,
  TEMPLATES_INCLUDED_WORK_HEADING,
  TEMPLATES_INCLUDED_WORK_HINT,
} from "./templatesWorkspaceFlow";
import type {
  PreparedIncludedWorkGroup,
  PreparedIncludedWorkItem,
} from "./templatesIncludedWorkPresentation";

type TemplatesIncludedItemsManagerProps = {
  scopeLabel: string;
  groups: readonly PreparedIncludedWorkGroup[];
  busy: boolean;
  onAddItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
  heading?: string;
  adjusting?: boolean;
  onAdjustingChange?: (next: boolean) => void;
  /** When true, renders as a band inside the connected workspace (no outer card). */
  embedded?: boolean;
};

function LocalIssue({
  item,
  busy,
  onReplaceItem,
}: {
  item: PreparedIncludedWorkItem;
  busy: boolean;
  onReplaceItem: (templateItemId: string) => void;
}) {
  if (!item.issueLabel) return null;
  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
      data-templates-included-local-issue={item.templateItemId}
    >
      <span className="text-[11px] font-medium text-amber-800">{item.issueLabel}</span>
      {item.canReplace ? (
        <button
          type="button"
          onClick={() => onReplaceItem(item.templateItemId)}
          disabled={busy}
          className="text-[11px] font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-40"
          data-templates-replace-issue-item={item.templateItemId}
        >
          Choose replacement
        </button>
      ) : null}
    </div>
  );
}

export default function TemplatesIncludedItemsManager({
  scopeLabel,
  groups,
  busy,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
  heading = TEMPLATES_INCLUDED_WORK_HEADING,
  adjusting: adjustingProp,
  onAdjustingChange,
  embedded = false,
}: TemplatesIncludedItemsManagerProps) {
  const [internalAdjusting, setInternalAdjusting] = useState(false);
  const controlled = typeof adjustingProp === "boolean";
  const adjusting = controlled ? adjustingProp : internalAdjusting;

  useEffect(() => {
    if (!controlled) return;
    if (!adjustingProp) return;
    document
      .getElementById("templates-included-items-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [controlled, adjustingProp]);

  const setAdjusting = (next: boolean) => {
    if (controlled) {
      onAdjustingChange?.(next);
      return;
    }
    setInternalAdjusting(next);
  };

  const totalItems = groups.reduce((sum, group) => sum + group.itemCount, 0);
  const shellClass = embedded
    ? TEMPLATES_WORKSPACE_SECTION
    : `${TEMPLATES_CARD} !px-4 !py-4 space-y-3`;

  return (
    <section
      className={shellClass}
      aria-labelledby="templates-included-items-heading"
      data-templates-included-manager
      data-templates-included-work
      data-templates-included-mode={adjusting ? "adjust" : "prepared"}
      data-templates-section-embedded={embedded ? "true" : "false"}
      data-templates-prepared-scope
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
              : `${scopeLabel} · ${totalItems} included`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {adjusting ? (
            <button
              type="button"
              onClick={onAddItem}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              data-templates-add-item
            >
              {TEMPLATE_ADD_FROM_CATALOG_LABEL}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAdjusting(!adjusting)}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            data-templates-adjust-included-work
          >
            {adjusting ? "Done adjusting" : TEMPLATES_ADJUST_INCLUDED_ACTION}
          </button>
        </div>
      </div>

      {totalItems === 0 ? (
        <p className="mt-3 text-xs text-slate-500" data-templates-included-empty>
          No included work prepared yet.
        </p>
      ) : adjusting ? (
        <div className="mt-3 space-y-2.5" data-templates-included-adjust-view>
          <p className="text-xs leading-relaxed text-slate-500">
            {TEMPLATES_INCLUDED_WORK_ADJUST_HINT}
          </p>
          {groups.map((group) => (
            <div
              key={group.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white"
              data-templates-included-adjust-group={group.id}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 ring-1 ring-slate-200/80">
                  {group.itemCount}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <li
                    key={item.templateItemId}
                    className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    data-templates-included-row={item.templateItemId}
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
                        data-templates-replace-item={item.templateItemId}
                        data-templates-relink-catalog={item.templateItemId}
                      >
                        {TEMPLATE_RELINK_CATALOG_LABEL}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.templateItemId)}
                        disabled={busy}
                        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        data-templates-remove-from-template={item.templateItemId}
                      >
                        {TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="mt-3 space-y-2.5"
          data-templates-included-prepared-view
          data-templates-prepared-scope-groups
        >
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl bg-slate-50/80 ring-1 ring-slate-200/70"
              data-templates-included-group={group.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                <p className="text-sm font-semibold text-slate-800">{group.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200/80">
                  {group.itemCount} included
                </span>
              </div>
              <ul className="grid gap-1.5 border-t border-slate-200/60 px-2.5 py-2.5 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li
                    key={item.templateItemId}
                    className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100"
                    data-templates-included-summary-item={item.templateItemId}
                    data-templates-catalog-link-status={item.status}
                  >
                    <p className="text-sm leading-snug text-slate-800">{item.name}</p>
                    <LocalIssue
                      item={item}
                      busy={busy}
                      onReplaceItem={onReplaceItem}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
