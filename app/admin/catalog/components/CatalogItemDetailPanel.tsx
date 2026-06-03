import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
  catalogItemTypeLabel,
  catalogUnitLabel,
  customerVisibilityLabel,
  pricingBasisLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import type { CustomerVisibility, PricingBasis } from "@/app/lib/catalogTypes";
import { FIELD_INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../catalogAdminConstants";
import type { CatalogItemEditDraft } from "../catalogAdminUtils";
import { extractSeedKey } from "../catalogAdminUtils";

type CatalogItemDetailPanelProps = {
  item: CatalogItem;
  editDraft: CatalogItemEditDraft;
  editError: string | null;
  isSaving: boolean;
  isTogglingActive: boolean;
  onDraftChange: <K extends keyof CatalogItemEditDraft>(
    key: K,
    value: CatalogItemEditDraft[K]
  ) => void;
  onSave: () => void;
  onClose: () => void;
  onToggleActive: () => void;
};

export default function CatalogItemDetailPanel({
  item,
  editDraft,
  editError,
  isSaving,
  isTogglingActive,
  onDraftChange,
  onSave,
  onClose,
  onToggleActive,
}: CatalogItemDetailPanelProps) {
  const seedKey = extractSeedKey(item.metadata ?? null);

  return (
    <div
      id="catalog-item-detail-panel"
      className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50/30 p-5 shadow-sm"
      role="region"
      aria-labelledby="catalog-item-detail-heading"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-800">
            Selected catalog item
          </p>
          <h3 id="catalog-item-detail-heading" className="mt-1 text-base font-semibold text-slate-900">
            {item.name}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={
                item.active
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
                  : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300"
              }
            >
              {item.active ? "Active" : "Inactive"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {seedKey ? `Seed: ${seedKey}` : "Custom item"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving || isTogglingActive}
          className="shrink-0 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Close
        </button>
      </div>

      <section className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Overview / identity
        </h4>
        <dl className="mt-3 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Internal name
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{item.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Item type
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {catalogItemTypeLabel(item.item_type)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Unit
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {catalogUnitLabel(item.unit)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Quantity source
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {quantitySourceLabel(item.quantity_source)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Seed key
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-slate-800">{seedKey ?? "Custom item"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Structural fields drive future template and proposal quantities and stay read-only for now.
        </p>
      </section>

      {editError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {editError}
        </div>
      )}

      <section className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pricing</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit price</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="25.00"
              className={`${FIELD_INPUT} tabular-nums`}
              value={editDraft.unit_price_dollars}
              onChange={(e) => onDraftChange("unit_price_dollars", e.target.value)}
              disabled={isSaving}
            />
            <span className="mt-1 block text-xs text-slate-500">Leave blank for Unpriced</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit cost</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="10.50"
              className={`${FIELD_INPUT} tabular-nums`}
              value={editDraft.unit_cost_dollars}
              onChange={(e) => onDraftChange("unit_cost_dollars", e.target.value)}
              disabled={isSaving}
            />
            <span className="mt-1 block text-xs text-slate-500">Leave blank for Unpriced</span>
          </label>
          {item.item_type === "labor" && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                Labor unit cost
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Optional"
                className={`${FIELD_INPUT} max-w-xs tabular-nums`}
                value={editDraft.labor_unit_cost_dollars}
                onChange={(e) => onDraftChange("labor_unit_cost_dollars", e.target.value)}
                disabled={isSaving}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Pricing basis</span>
            <select
              className={FIELD_INPUT}
              value={editDraft.pricing_basis}
              onChange={(e) => onDraftChange("pricing_basis", e.target.value as PricingBasis)}
              disabled={isSaving}
            >
              {PRICING_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {pricingBasisLabel(basis)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Customer-facing
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              Customer-facing name
            </span>
            <input
              type="text"
              className={FIELD_INPUT}
              value={editDraft.customer_name}
              onChange={(e) => onDraftChange("customer_name", e.target.value)}
              disabled={isSaving}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Description</span>
            <textarea
              rows={2}
              className={`${FIELD_INPUT} resize-y`}
              value={editDraft.description}
              onChange={(e) => onDraftChange("description", e.target.value)}
              disabled={isSaving}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              Customer visibility
            </span>
            <select
              className={FIELD_INPUT}
              value={editDraft.customer_visibility}
              onChange={(e) =>
                onDraftChange("customer_visibility", e.target.value as CustomerVisibility)
              }
              disabled={isSaving}
            >
              {CUSTOMER_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {customerVisibilityLabel(visibility)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Sort order</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Optional"
              className={`${FIELD_INPUT} max-w-[8rem] tabular-nums`}
              value={editDraft.sort_order}
              onChange={(e) => onDraftChange("sort_order", e.target.value)}
              disabled={isSaving}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isTogglingActive}
          className={PRIMARY_BUTTON}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          disabled={isSaving || isTogglingActive}
          className={SECONDARY_BUTTON}
        >
          {isTogglingActive
            ? "Updating…"
            : item.active
              ? "Deactivate item"
              : "Reactivate item"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving || isTogglingActive}
          className={SECONDARY_BUTTON}
        >
          Close
        </button>
      </div>
    </div>
  );
}
