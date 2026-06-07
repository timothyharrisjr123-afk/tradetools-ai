import type { ProposalBuilderLineCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalPreviewLineRow } from "@/app/lib/proposalBuilderPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import {
  BUILDER_LINE_FOOTER_CONFIGURED_COPY,
  BUILDER_LINE_FOOTER_PLACEHOLDER_COPY,
  BUILDER_LINE_LIST_FOOTER,
  BUILDER_LINE_PRICE_COL_HEADER,
  BUILDER_LINE_PRICE_STATUS,
  BUILDER_LINE_PRICE_VALUE,
  BUILDER_PROPOSAL_LINE_ROW,
  formatPriceCents,
} from "./proposalBuilderConstants";

type ProposalBuilderLinePreviewTableProps = {
  rows: ProposalPreviewLineRow[];
  sectionTitle: string;
  /** Keyed by templateItemId. When present, shows customer price/status. */
  lineViewByTemplateItemId?: Record<string, ProposalBuilderLineCustomerView>;
  /**
   * Persisted-path snapshot quantities keyed by templateItemId. When present,
   * the quantity shown comes from the same snapshot as the price (no mixed
   * truth) instead of the live measurement-derived row.
   */
  snapshotQuantityByTemplateItemId?: Record<string, ProposalSnapshotLineQuantityView> | null;
  /** 3I-3B3c: drives the footer copy. Defaults to placeholder behavior. */
  pricingPolicyConfigured?: boolean;
};

function LineMetaDetail({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <span>
      <span className="text-slate-400">{label}: </span>
      <span>{value}</span>
    </span>
  );
}

function LinePriceCell({
  lineView,
  fallbackLabel,
}: {
  lineView: ProposalBuilderLineCustomerView | undefined;
  fallbackLabel: string;
}) {
  if (!lineView) {
    return (
      <>
        <p className={BUILDER_LINE_PRICE_COL_HEADER}>Catalog setup price</p>
        <p className={`mt-0.5 ${BUILDER_LINE_PRICE_STATUS}`}>{fallbackLabel}</p>
      </>
    );
  }

  const { displayStatus, customerLinePriceCents } = lineView;

  if (displayStatus === "priced" && customerLinePriceCents != null) {
    return (
      <>
        <p className={BUILDER_LINE_PRICE_COL_HEADER}>Customer price</p>
        <p className={`mt-0.5 ${BUILDER_LINE_PRICE_VALUE}`}>
          {formatPriceCents(customerLinePriceCents)}
        </p>
      </>
    );
  }

  const statusLabel: string =
    displayStatus === "included"
      ? "Included"
      : displayStatus === "grouped"
        ? "In package"
        : displayStatus === "needs_quantity"
          ? "Needs quantity"
          : "Not priced";

  return (
    <>
      <p className={BUILDER_LINE_PRICE_COL_HEADER}>Customer price</p>
      <p className={`mt-0.5 ${BUILDER_LINE_PRICE_STATUS}`}>{statusLabel}</p>
    </>
  );
}

export default function ProposalBuilderLinePreviewTable({
  rows,
  sectionTitle,
  lineViewByTemplateItemId,
  snapshotQuantityByTemplateItemId,
  pricingPolicyConfigured = false,
}: ProposalBuilderLinePreviewTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">No line items in {sectionTitle}.</p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-slate-200/80">
        {rows.map((row) => {
          const lineView = lineViewByTemplateItemId?.[row.id];
          // No mixed truth: in the persisted path the quantity comes from the
          // same snapshot as the price, not the live measurement-derived row.
          const snapshotQty = snapshotQuantityByTemplateItemId?.[row.id];
          const quantityDisplayLabel = snapshotQty
            ? snapshotQty.quantityDisplayLabel ?? "—"
            : row.quantityDisplayLabel;
          const quantitySourceLabel = snapshotQty
            ? snapshotQty.quantitySourceLabel ?? "—"
            : row.quantitySourceLabel;
          const unitLabel = snapshotQty ? snapshotQty.unitLabel ?? "—" : row.unitLabel;
          const quantityUnresolved = snapshotQty
            ? snapshotQty.quantityDisplayLabel == null
            : row.quantityUnresolved;
          const quantityStatusLabel = snapshotQty ? "" : row.quantityStatusLabel;
          return (
            <li
              key={row.id}
              className={`${BUILDER_PROPOSAL_LINE_ROW} ${row.missingCatalog ? "bg-amber-50/40" : ""}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-slate-900">{row.displayName}</p>
                  {row.missingCatalog ? (
                    <p className="mt-1 text-xs text-amber-800">Linked catalog item missing</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="text-slate-400">Qty: </span>
                    <span
                      className={
                        quantityUnresolved
                          ? "text-slate-500"
                          : "font-medium tabular-nums text-slate-700"
                      }
                    >
                      {quantityDisplayLabel}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <LineMetaDetail label="Source" value={quantitySourceLabel} />
                    <LineMetaDetail label="Rule" value={row.quantityRuleLabel} />
                    <LineMetaDetail label="Unit" value={unitLabel} />
                    <LineMetaDetail label="Role" value={row.roleLabel} />
                  </p>
                  {quantityStatusLabel ? (
                    <p
                      className={`mt-1 text-xs ${
                        quantityUnresolved ? "text-amber-800/80" : "text-slate-400"
                      }`}
                    >
                      {quantityUnresolved
                        ? quantityStatusLabel
                        : `Status: ${quantityStatusLabel}`}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <LinePriceCell lineView={lineView} fallbackLabel={row.catalogSetupPriceLabel} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={BUILDER_LINE_LIST_FOOTER}>
        {pricingPolicyConfigured
          ? BUILDER_LINE_FOOTER_CONFIGURED_COPY
          : BUILDER_LINE_FOOTER_PLACEHOLDER_COPY}
      </p>
    </div>
  );
}
