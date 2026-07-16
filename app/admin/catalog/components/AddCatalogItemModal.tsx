import type {
  CatalogItemType,
  CatalogUnit,
  CustomerVisibility,
  PricingBasis,
  QuantitySource,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_UNITS,
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
  QUANTITY_SOURCES,
  catalogUnitLabel,
  customerVisibilityLabel,
  pricingBasisLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_CONTRACTOR_LABELS,
  CATALOG_FIELD_HELPERS,
} from "@/app/lib/catalogContractorLabels";
import {
  CATALOG_ADD_ITEM_TYPE_OPTIONS,
  FIELD_INPUT,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "../catalogAdminConstants";
import type { AddCatalogItemForm } from "../catalogAdminUtils";

function FieldHelper({ text }: { text: string }) {
  return <span className="mt-1 block text-xs leading-relaxed text-slate-500">{text}</span>;
}

type AddCatalogItemModalProps = {
  open: boolean;
  form: AddCatalogItemForm;
  error: string | null;
  creatingItem: boolean;
  onChange: <K extends keyof AddCatalogItemForm>(key: K, value: AddCatalogItemForm[K]) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function AddCatalogItemModal({
  open,
  form,
  error,
  creatingItem,
  onChange,
  onClose,
  onSubmit,
}: AddCatalogItemModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-catalog-item-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id="add-catalog-item-title" className="text-lg font-semibold text-slate-900">
          Add catalog item
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Manual lines use a fixed quantity source by default. No starter seed key is assigned.
        </p>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Name *</span>
            <input
              type="text"
              className={FIELD_INPUT}
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              disabled={creatingItem}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Item type *</span>
            <select
              className={FIELD_INPUT}
              value={form.item_type}
              onChange={(e) => onChange("item_type", e.target.value as CatalogItemType)}
              disabled={creatingItem}
            >
              {CATALOG_ADD_ITEM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit *</span>
            <select
              className={FIELD_INPUT}
              value={form.unit}
              onChange={(e) => onChange("unit", e.target.value as CatalogUnit)}
              disabled={creatingItem}
            >
              {CATALOG_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {catalogUnitLabel(unit)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.measurement} *
            </span>
            <select
              className={FIELD_INPUT}
              value={form.quantity_source}
              onChange={(e) => onChange("quantity_source", e.target.value as QuantitySource)}
              disabled={creatingItem}
            >
              {QUANTITY_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {quantitySourceLabel(source)}
                </option>
              ))}
            </select>
            <FieldHelper text={CATALOG_FIELD_HELPERS.measurement} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.customerName}
            </span>
            <input
              type="text"
              className={FIELD_INPUT}
              value={form.customer_name}
              onChange={(e) => onChange("customer_name", e.target.value)}
              disabled={creatingItem}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.customerDescription}
            </span>
            <textarea
              rows={2}
              className={`${FIELD_INPUT} resize-y`}
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              disabled={creatingItem}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.unitPrice}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Optional"
              className={`${FIELD_INPUT} tabular-nums`}
              value={form.unit_price_dollars}
              onChange={(e) => onChange("unit_price_dollars", e.target.value)}
              disabled={creatingItem}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.unitCost}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Optional"
              className={`${FIELD_INPUT} tabular-nums`}
              value={form.unit_cost_dollars}
              onChange={(e) => onChange("unit_cost_dollars", e.target.value)}
              disabled={creatingItem}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">Pricing basis</span>
            <select
              className={FIELD_INPUT}
              value={form.pricing_basis}
              onChange={(e) => onChange("pricing_basis", e.target.value as PricingBasis)}
              disabled={creatingItem}
            >
              {PRICING_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {pricingBasisLabel(basis)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.proposal}
            </span>
            <select
              className={FIELD_INPUT}
              value={form.customer_visibility}
              onChange={(e) =>
                onChange("customer_visibility", e.target.value as CustomerVisibility)
              }
              disabled={creatingItem}
            >
              {CUSTOMER_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {customerVisibilityLabel(visibility)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creatingItem}
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={creatingItem}
            className={PRIMARY_BUTTON}
          >
            {creatingItem ? "Creating…" : "Create item"}
          </button>
        </div>
      </div>
    </div>
  );
}
