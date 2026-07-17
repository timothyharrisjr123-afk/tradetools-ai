import type {
  CatalogItemType,
  CatalogUnit,
  CoverageBasis,
  CustomerVisibility,
  PricingBasis,
  QuantitySource,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_UNITS,
  COVERAGE_BASES,
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
  QUANTITY_SOURCES,
  catalogUnitLabel,
  coverageBasisLabel,
  customerVisibilityLabel,
  pricingBasisLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_CONTRACTOR_LABELS,
  CATALOG_FIELD_HELPERS,
  coverageBasisFieldHelper,
} from "@/app/lib/catalogContractorLabels";
import {
  catalogCoverageCompatibilityLabel,
  classifyCatalogCoverageCompatibility,
} from "@/app/lib/catalogCoverageCompatibility";
import {
  CATALOG_ADD_ITEM_TYPE_OPTIONS,
  FIELD_INPUT,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "../catalogAdminConstants";
import {
  parseCoverageRateOrNull,
  type AddCatalogItemForm,
} from "../catalogAdminUtils";

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

  const coverageParsed = parseCoverageRateOrNull(form.coverage_rate);
  const coverageEnabled = coverageParsed.value != null;
  const coverageCompatibility = classifyCatalogCoverageCompatibility({
    quantity_source: form.quantity_source,
    unit: form.unit,
    coverage_rate: coverageParsed.value,
    coverage_basis: form.coverage_basis || null,
    waste_applies: form.waste_applies,
  });
  const compatibilityLabel = catalogCoverageCompatibilityLabel(coverageCompatibility);

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

        <section className="mt-5 border-t border-slate-200 pt-4" data-catalog-quantity-drivers="add">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {CATALOG_CONTRACTOR_LABELS.quantityDrivers}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {CATALOG_FIELD_HELPERS.quantityDriversSection}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                {CATALOG_CONTRACTOR_LABELS.coverage}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Optional"
                className={`${FIELD_INPUT} tabular-nums`}
                value={form.coverage_rate}
                onChange={(e) => onChange("coverage_rate", e.target.value)}
                disabled={creatingItem}
                aria-label={CATALOG_CONTRACTOR_LABELS.coverage}
              />
              <FieldHelper text={CATALOG_FIELD_HELPERS.coverage} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-slate-700">
                <span>{CATALOG_CONTRACTOR_LABELS.coverageBasis}</span>
                {compatibilityLabel ? (
                  <span
                    className="font-normal text-slate-500"
                    data-catalog-coverage-compatibility={coverageCompatibility}
                  >
                    {compatibilityLabel}
                  </span>
                ) : null}
              </span>
              <select
                className={FIELD_INPUT}
                value={coverageEnabled ? form.coverage_basis : ""}
                onChange={(e) =>
                  onChange("coverage_basis", e.target.value as "" | CoverageBasis)
                }
                disabled={creatingItem || !coverageEnabled}
                aria-label={CATALOG_CONTRACTOR_LABELS.coverageBasis}
                aria-disabled={!coverageEnabled}
                data-catalog-coverage-basis="add"
              >
                <option value="">
                  {coverageEnabled ? "Select basis" : "Set coverage first"}
                </option>
                {COVERAGE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {coverageBasisLabel(basis)}
                  </option>
                ))}
              </select>
              <FieldHelper
                text={
                  coverageEnabled
                    ? coverageBasisFieldHelper(form.coverage_basis)
                    : CATALOG_FIELD_HELPERS.coverageBasis
                }
              />
            </label>
            <div className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                {CATALOG_CONTRACTOR_LABELS.waste}
              </span>
              <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                  checked={form.waste_applies}
                  onChange={(e) => onChange("waste_applies", e.target.checked)}
                  disabled={creatingItem}
                />
                <span>{CATALOG_CONTRACTOR_LABELS.wasteApplies}</span>
              </label>
              <FieldHelper text={CATALOG_FIELD_HELPERS.wasteApplies} />
              <input
                type="text"
                inputMode="decimal"
                placeholder={form.waste_applies ? "Optional %" : "Inactive"}
                className={`${FIELD_INPUT} mt-2 max-w-xs tabular-nums`}
                value={form.waste_pct}
                onChange={(e) => onChange("waste_pct", e.target.value)}
                disabled={creatingItem || !form.waste_applies}
                aria-label={CATALOG_CONTRACTOR_LABELS.waste}
                aria-disabled={!form.waste_applies}
              />
              <FieldHelper
                text={
                  form.waste_applies
                    ? CATALOG_FIELD_HELPERS.waste
                    : "Waste percent is inactive while Apply waste is off."
                }
              />
            </div>
          </div>
        </section>

        <section className="mt-5 border-t border-slate-200 pt-4" data-catalog-tax="add">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {CATALOG_CONTRACTOR_LABELS.tax}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {CATALOG_FIELD_HELPERS.taxSection}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                {CATALOG_CONTRACTOR_LABELS.salesTax}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Optional %"
                className={`${FIELD_INPUT} tabular-nums`}
                value={form.sales_tax_rate_pct}
                onChange={(e) => onChange("sales_tax_rate_pct", e.target.value)}
                disabled={creatingItem}
                aria-label={CATALOG_CONTRACTOR_LABELS.salesTax}
                data-catalog-sales-tax="add"
              />
              <FieldHelper text={CATALOG_FIELD_HELPERS.salesTax} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                {CATALOG_CONTRACTOR_LABELS.purchaseTax}
                <span className="ml-1 font-normal text-slate-500">(internal)</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Optional %"
                className={`${FIELD_INPUT} tabular-nums`}
                value={form.purchase_tax_rate_pct}
                onChange={(e) => onChange("purchase_tax_rate_pct", e.target.value)}
                disabled={creatingItem}
                aria-label={CATALOG_CONTRACTOR_LABELS.purchaseTax}
                data-catalog-purchase-tax="add"
              />
              <FieldHelper text={CATALOG_FIELD_HELPERS.purchaseTax} />
            </label>
          </div>
        </section>

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
