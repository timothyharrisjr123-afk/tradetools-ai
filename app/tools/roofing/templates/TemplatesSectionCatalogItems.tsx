"use client";

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { formatProposalVisibilityShort } from "@/app/lib/catalogContractorLabels";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
  formatCatalogPickerPriceLine,
  sectionAcceptsCatalogItems,
  type TemplateCatalogLinkView,
} from "@/app/lib/proposalTemplateCatalogLink";
import type {
  ProposalTemplateItem,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";

type TemplatesSectionCatalogItemsProps = {
  sectionKind: ProposalTemplateSectionKind;
  sectionItems: readonly ProposalTemplateItem[];
  catalogItems: readonly CatalogItem[];
  structureDisabled: boolean;
  busy: boolean;
  onAddFromCatalog: () => void;
  onRelink: (templateItemId: string) => void;
};

function statusPillClass(status: TemplateCatalogLinkView["status"]): string {
  switch (status) {
    case "linked":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "inactive":
    case "missing_catalog":
    case "missing_id":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function TemplatesSectionCatalogItems({
  sectionKind,
  sectionItems,
  catalogItems,
  structureDisabled,
  busy,
  onAddFromCatalog,
  onRelink,
}: TemplatesSectionCatalogItemsProps) {
  if (!sectionAcceptsCatalogItems(sectionKind)) return null;

  const catalogById = buildCatalogByIdMap(catalogItems);
  const views = sectionItems
    .slice()
    .sort((a, b) => {
      const ao = a.sort_order ?? Number.POSITIVE_INFINITY;
      const bo = b.sort_order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    })
    .map((item) => buildTemplateCatalogLinkView(item, catalogById));

  return (
    <div
      className="mt-3 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-3"
      data-templates-section-catalog-items
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Included Catalog items
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Prices and measurements come from Catalog — not edited here.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddFromCatalog}
          disabled={structureDisabled || busy}
          className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${
            structureDisabled || busy
              ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          }`}
          data-templates-add-from-catalog
        >
          {TEMPLATE_ADD_FROM_CATALOG_LABEL}
        </button>
      </div>

      {views.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No Catalog items linked yet. Add an active Catalog item to include it in proposals from
          this template.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {views.map((view) => (
            <li
              key={view.templateItemId}
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5"
              data-templates-catalog-link={view.templateItemId}
              data-templates-catalog-link-status={view.status}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{view.displayName}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusPillClass(view.status)}`}
                    >
                      {view.statusLabel}
                    </span>
                  </div>
                  {view.status === "linked" && view.catalogTypeLabel ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {view.catalogTypeLabel}
                      {view.catalogUnitLabel ? ` · ${view.catalogUnitLabel}` : ""}
                      {view.measurementLabel ? ` · ${view.measurementLabel}` : ""}
                      {view.proposalVisibility
                        ? ` · Proposal ${formatProposalVisibilityShort(view.proposalVisibility)}`
                        : ""}
                    </p>
                  ) : null}
                  {view.status === "linked" ? (
                    <p className="mt-0.5 text-xs tabular-nums text-slate-600">
                      {formatCatalogPickerPriceLine({
                        unit_price_cents: view.unitPriceCents,
                        unit_cost_cents: view.unitCostCents,
                      })}
                      <span className="text-slate-400"> — from Catalog (not edited here)</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
                      {view.statusDetail}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRelink(view.templateItemId)}
                  disabled={structureDisabled || busy || !view.canRelink}
                  className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${
                    structureDisabled || busy
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  data-templates-relink-catalog={view.templateItemId}
                >
                  {TEMPLATE_RELINK_CATALOG_LABEL}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
