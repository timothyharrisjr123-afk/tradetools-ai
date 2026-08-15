"use client";

import { useEffect, useState } from "react";
import { TEMPLATE_ADD_FROM_CATALOG_LABEL } from "@/app/lib/proposalTemplateCatalogLink";
import {
  TEMPLATES_CARD,
  TEMPLATES_WORKSPACE_SECTION,
} from "./templatesConstants";
import {
  TEMPLATES_ADJUST_INCLUDED_ACTION,
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
  onSaveItemQuantity?: (
    templateItemId: string,
    mode: "inherit_catalog" | "fixed",
    fixedQuantity?: number | null
  ) => void;
  heading?: string;
  adjusting?: boolean;
  onAdjustingChange?: (next: boolean) => void;
  /** When true, renders as a band inside the connected workspace (no outer card). */
  embedded?: boolean;
};

function SecondaryProductName({ item }: { item: PreparedIncludedWorkItem }) {
  if (!item.showCatalogProduct || !item.catalogProductName) return null;
  return (
    <p
      className="mt-0.5 text-xs leading-snug text-slate-600"
      data-templates-catalog-product-identity
    >
      {item.catalogProductName}
    </p>
  );
}

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

function QuantityEditor({
  item,
  busy,
  onSaveItemQuantity,
}: {
  item: PreparedIncludedWorkItem;
  busy: boolean;
  onSaveItemQuantity: (
    templateItemId: string,
    mode: "inherit_catalog" | "fixed",
    fixedQuantity?: number | null
  ) => void;
}) {
  const mode = item.quantityMode === "fixed" ? "fixed" : "inherit_catalog";
  const choiceClass = (active: boolean) =>
    `rounded-md px-2 py-1 text-[11px] font-medium ${
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
    } disabled:cursor-not-allowed disabled:opacity-40`;
  return (
    <div
      className="mt-2 flex min-w-0 flex-wrap items-center gap-2"
      data-templates-quantity-editor={item.templateItemId}
      data-templates-quantity-mode={item.templateItemId}
    >
      <p className="sr-only">Quantity for {item.name}</p>
      <button
        type="button"
        disabled={busy}
        aria-pressed={mode === "inherit_catalog"}
        onClick={() =>
          onSaveItemQuantity(item.templateItemId, "inherit_catalog", null)
        }
        className={choiceClass(mode === "inherit_catalog")}
        data-templates-quantity-choice="inherit_catalog"
      >
        Use Catalog quantity
      </button>
      <button
        type="button"
        disabled={busy}
        aria-pressed={mode === "fixed"}
        onClick={() =>
          onSaveItemQuantity(item.templateItemId, "fixed", item.quantityFixed ?? 1)
        }
        className={choiceClass(mode === "fixed")}
        data-templates-quantity-choice="fixed"
      >
        Fixed quantity
      </button>
      {mode === "fixed" ? (
        <input
          type="number"
          min={0.01}
          step="any"
          defaultValue={item.quantityFixed ?? 1}
          disabled={busy}
          onBlur={(event) =>
            onSaveItemQuantity(item.templateItemId, "fixed", Number(event.target.value))
          }
          className="w-16 rounded border border-slate-200 px-1.5 py-1 text-[11px] tabular-nums"
          data-templates-quantity-fixed={item.templateItemId}
          aria-label="Fixed quantity"
        />
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
  onSaveItemQuantity,
  heading = TEMPLATES_INCLUDED_WORK_HEADING,
  adjusting: adjustingProp,
  onAdjustingChange,
  embedded = false,
}: TemplatesIncludedItemsManagerProps) {
  const [internalAdjusting, setInternalAdjusting] = useState(false);
  const [quantityItemId, setQuantityItemId] = useState<string | null>(null);
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
    if (!next) setQuantityItemId(null);
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
        <div className="mt-3 space-y-2" data-templates-included-empty>
          <p className="text-xs text-slate-500">No included work yet.</p>
          <button
            type="button"
            onClick={() => {
              setAdjusting(true);
              onAddItem();
            }}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-templates-add-included-work-empty
          >
            Add included work
          </button>
        </div>
      ) : adjusting ? (
        <div className="mt-3 space-y-2.5" data-templates-included-adjust-view>
          {groups.map((group) => (
            <div
              key={group.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white"
              data-templates-included-adjust-group={group.id}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
                <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 ring-1 ring-slate-200/80">
                  {group.itemCount}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => {
                  const quantityOpen = quantityItemId === item.templateItemId;
                  return (
                    <li
                      key={item.templateItemId}
                      className="px-3.5 py-2"
                      data-templates-included-row={item.templateItemId}
                      data-templates-catalog-link={item.templateItemId}
                      data-templates-catalog-link-status={item.status}
                      data-templates-quantity-open={quantityOpen ? "true" : "false"}
                    >
                      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug text-slate-900">
                            {item.name}
                          </p>
                          <SecondaryProductName item={item} />
                          {item.issueLabel ? (
                            <p className="mt-0.5 text-[11px] text-amber-800">
                              {item.issueLabel}
                              {item.issueDetail ? ` · ${item.issueDetail}` : ""}
                            </p>
                          ) : null}
                          {!quantityOpen && item.quantityMode === "fixed" ? (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {item.quantitySummary}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <button
                            type="button"
                            onClick={() => onReplaceItem(item.templateItemId)}
                            disabled={busy || !item.canReplace}
                            className="text-xs font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                            data-templates-replace-item={item.templateItemId}
                            data-templates-relink-catalog={item.templateItemId}
                          >
                            Replace
                          </button>
                          {onSaveItemQuantity ? (
                            <button
                              type="button"
                              onClick={() =>
                                setQuantityItemId(quantityOpen ? null : item.templateItemId)
                              }
                              disabled={busy}
                              className={`text-xs font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 ${
                                quantityOpen
                                  ? "text-slate-900"
                                  : "text-slate-700 hover:text-slate-900"
                              }`}
                              aria-expanded={quantityOpen}
                              data-templates-quantity-toggle={item.templateItemId}
                            >
                              Quantity
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.templateItemId)}
                            disabled={busy}
                            className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                            data-templates-remove-from-template={item.templateItemId}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {quantityOpen && onSaveItemQuantity ? (
                        <QuantityEditor
                          item={item}
                          busy={busy}
                          onSaveItemQuantity={(templateItemId, nextMode, fixedQuantity) => {
                            onSaveItemQuantity(templateItemId, nextMode, fixedQuantity);
                            if (nextMode === "inherit_catalog") {
                              setQuantityItemId(null);
                            }
                          }}
                        />
                      ) : null}
                    </li>
                  );
                })}
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
                    <SecondaryProductName item={item} />
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
