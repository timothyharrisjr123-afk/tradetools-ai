import type { CatalogItem, CoverageBasis } from "@/app/lib/catalogTypes";
import {
  COVERAGE_BASES,
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
  catalogItemTypeLabel,
  catalogUnitLabel,
  coverageBasisLabel,
  pricingBasisLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import type { CustomerVisibility, PricingBasis } from "@/app/lib/catalogTypes";
import {
  CATALOG_CONTRACTOR_LABELS,
  CATALOG_FIELD_HELPERS,
  coverageBasisFieldHelper,
  formatCatalogItemStatus,
  formatProposalVisibilityShort,
} from "@/app/lib/catalogContractorLabels";
import {
  catalogCoverageCompatibilityLabel,
  classifyCatalogCoverageCompatibility,
} from "@/app/lib/catalogCoverageCompatibility";
import { FIELD_INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../catalogAdminConstants";
import {
  parseCoverageRateOrNull,
  type CatalogItemEditDraft,
} from "../catalogAdminUtils";

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

function FieldHelper({ text }: { text: string }) {
  return <span className="mt-1 block text-xs leading-relaxed text-slate-500">{text}</span>;
}

const PROPOSAL_OPTIONS: { value: CustomerVisibility; label: string }[] = [
  { value: "customer_visible", label: "Visible" },
  { value: "grouped", label: "Grouped" },
  { value: "internal_only", label: "Hidden" },
];

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
  const coverageParsed = parseCoverageRateOrNull(editDraft.coverage_rate);
  const coverageEnabled = coverageParsed.value != null;
  const coverageCompatibility = classifyCatalogCoverageCompatibility({
    quantity_source: item.quantity_source,
    unit: item.unit,
    coverage_rate: coverageParsed.value,
    coverage_basis: editDraft.coverage_basis || null,
    waste_applies: editDraft.waste_applies,
  });
  const compatibilityLabel = catalogCoverageCompatibilityLabel(coverageCompatibility);

  return (
    <div
      id="catalog-item-detail-panel"
      className="mt-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      role="region"
      aria-labelledby="catalog-item-detail-heading"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Edit catalog item
          </p>
          <h3 id="catalog-item-detail-heading" className="mt-1 text-base font-semibold text-slate-900">
            {item.name}
          </h3>
          <p className="mt-2 text-xs text-slate-600">
            {CATALOG_CONTRACTOR_LABELS.status}: {formatCatalogItemStatus(item)} · Proposal:{" "}
            {formatProposalVisibilityShort(item.customer_visibility)}
          </p>
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

      {item.item_type === "labor" && (
        <p className="mb-5 text-xs leading-relaxed text-slate-600">
          {CATALOG_FIELD_HELPERS.laborExplainer}
        </p>
      )}

      {editError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {editError}
        </div>
      )}

      <section className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Item details
        </h4>
        <dl className="mt-3 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {CATALOG_CONTRACTOR_LABELS.name}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{item.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {CATALOG_CONTRACTOR_LABELS.type}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {catalogItemTypeLabel(item.item_type)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pricing</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.unitCost}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="10.50"
              className={`${FIELD_INPUT} tabular-nums`}
              value={editDraft.unit_cost_dollars}
              onChange={(e) => onDraftChange("unit_cost_dollars", e.target.value)}
              disabled={isSaving}
            />
            <FieldHelper text={CATALOG_FIELD_HELPERS.unitCost} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.unitPrice}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="25.00"
              className={`${FIELD_INPUT} tabular-nums`}
              value={editDraft.unit_price_dollars}
              onChange={(e) => onDraftChange("unit_price_dollars", e.target.value)}
              disabled={isSaving}
            />
            <FieldHelper text={CATALOG_FIELD_HELPERS.unitPrice} />
          </label>
          {item.item_type === "labor" && (
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-medium text-slate-700">
                Labor cost (optional)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Optional"
                className={`${FIELD_INPUT} tabular-nums`}
                value={editDraft.labor_unit_cost_dollars}
                onChange={(e) => onDraftChange("labor_unit_cost_dollars", e.target.value)}
                disabled={isSaving}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">How price is set</span>
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

      <section className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Proposal display
        </h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.customerName}
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
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.customerDescription}
            </span>
            <textarea
              rows={2}
              className={`${FIELD_INPUT} resize-y`}
              value={editDraft.description}
              onChange={(e) => onDraftChange("description", e.target.value)}
              disabled={isSaving}
            />
            <FieldHelper text={CATALOG_FIELD_HELPERS.customerDescription} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {CATALOG_CONTRACTOR_LABELS.proposal}
            </span>
            <select
              className={FIELD_INPUT}
              value={editDraft.customer_visibility}
              onChange={(e) =>
                onDraftChange("customer_visibility", e.target.value as CustomerVisibility)
              }
              disabled={isSaving}
            >
              {PROPOSAL_OPTIONS.filter((option) =>
                CUSTOMER_VISIBILITIES.includes(option.value)
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldHelper text={CATALOG_FIELD_HELPERS.proposal} />
          </label>
        </div>
      </section>

      <section className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Measurement
        </h4>
        <dl className="mt-3 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {CATALOG_CONTRACTOR_LABELS.measurement}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {quantitySourceLabel(item.quantity_source)}
            </dd>
            <FieldHelper text={CATALOG_FIELD_HELPERS.measurement} />
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {CATALOG_CONTRACTOR_LABELS.unit}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {catalogUnitLabel(item.unit)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6" data-catalog-quantity-drivers="edit">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {CATALOG_CONTRACTOR_LABELS.quantityDrivers}
        </h4>
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
              value={editDraft.coverage_rate}
              onChange={(e) => onDraftChange("coverage_rate", e.target.value)}
              disabled={isSaving}
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
              value={coverageEnabled ? editDraft.coverage_basis : ""}
              onChange={(e) =>
                onDraftChange("coverage_basis", e.target.value as "" | CoverageBasis)
              }
              disabled={isSaving || !coverageEnabled}
              aria-label={CATALOG_CONTRACTOR_LABELS.coverageBasis}
              aria-disabled={!coverageEnabled}
              data-catalog-coverage-basis="edit"
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
                  ? coverageBasisFieldHelper(editDraft.coverage_basis)
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
                checked={editDraft.waste_applies}
                onChange={(e) => onDraftChange("waste_applies", e.target.checked)}
                disabled={isSaving}
              />
              <span>{CATALOG_CONTRACTOR_LABELS.wasteApplies}</span>
            </label>
            <FieldHelper text={CATALOG_FIELD_HELPERS.wasteApplies} />
            <input
              type="text"
              inputMode="decimal"
              placeholder={editDraft.waste_applies ? "Optional %" : "Inactive"}
              className={`${FIELD_INPUT} mt-2 max-w-xs tabular-nums`}
              value={editDraft.waste_pct}
              onChange={(e) => onDraftChange("waste_pct", e.target.value)}
              disabled={isSaving || !editDraft.waste_applies}
              aria-label={CATALOG_CONTRACTOR_LABELS.waste}
              aria-disabled={!editDraft.waste_applies}
            />
            <FieldHelper
              text={
                editDraft.waste_applies
                  ? CATALOG_FIELD_HELPERS.waste
                  : "Waste percent is inactive while Apply waste is off."
              }
            />
          </div>
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
