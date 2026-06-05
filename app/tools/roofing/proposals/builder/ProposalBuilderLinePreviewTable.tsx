import type { ProposalBuilderLineCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalPreviewLineRow } from "@/app/lib/proposalBuilderPreview";
import {
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
                        row.quantityUnresolved
                          ? "text-slate-500"
                          : "font-medium tabular-nums text-slate-700"
                      }
                    >
                      {row.quantityDisplayLabel}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <LineMetaDetail label="Source" value={row.quantitySourceLabel} />
                    <LineMetaDetail label="Rule" value={row.quantityRuleLabel} />
                    <LineMetaDetail label="Unit" value={row.unitLabel} />
                    <LineMetaDetail label="Role" value={row.roleLabel} />
                  </p>
                  {row.quantityStatusLabel ? (
                    <p
                      className={`mt-1 text-xs ${
                        row.quantityUnresolved ? "text-amber-800/80" : "text-slate-400"
                      }`}
                    >
                      {row.quantityUnresolved
                        ? row.quantityStatusLabel
                        : `Status: ${row.quantityStatusLabel}`}
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
        Preview pricing uses a placeholder margin. Not a customer contract amount.
      </p>
    </div>
  );
}
