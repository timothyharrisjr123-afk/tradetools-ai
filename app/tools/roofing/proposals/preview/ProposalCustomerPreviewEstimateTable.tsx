"use client";

import type {
  CustomerPreviewEstimateSectionPresentation,
  CustomerPreviewEstimateTotalsPresentation,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  PACKET_ESTIMATE_GRID,
  PACKET_ESTIMATE_HEADER_CELL,
  PACKET_ESTIMATE_ITEM_NAME,
  PACKET_ESTIMATE_LABEL,
  PACKET_ESTIMATE_PRICE,
  PACKET_ESTIMATE_QTY,
  PACKET_ESTIMATE_STATUS,
  PACKET_SECTION_PAD,
  PACKET_TOTALS_GRAND_LABEL,
  PACKET_TOTALS_GRAND_VALUE,
  PACKET_TOTALS_LABEL,
  PACKET_TOTALS_ROW,
  PACKET_TOTALS_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewEstimateTableProps = {
  sections: CustomerPreviewEstimateSectionPresentation[];
  totals: CustomerPreviewEstimateTotalsPresentation;
};

/**
 * Block 5C — premium itemized estimate: Item / Qty / Price, one flat table.
 *
 * No nested card, no action column, no per-line controls, no manual or
 * unresolved-quantity labels. Totals render as this table's own footer,
 * not a separate card.
 */
export default function ProposalCustomerPreviewEstimateTable({
  sections,
  totals,
}: ProposalCustomerPreviewEstimateTableProps) {
  const allLines = sections.flatMap((section) => section.lines);
  if (allLines.length === 0) {
    return null;
  }

  return (
    <div className={`${PACKET_SECTION_PAD} pb-8 pt-8`} data-preview-estimate-table>
      <p className={PACKET_ESTIMATE_LABEL}>Included estimate</p>

      <div className="mt-4">
        <div className={`${PACKET_ESTIMATE_GRID} border-b border-slate-200/80 pb-2`}>
          <span className={PACKET_ESTIMATE_HEADER_CELL}>Item</span>
          <span className={`hidden sm:block ${PACKET_ESTIMATE_HEADER_CELL} sm:text-right`}>Qty</span>
          <span className={`hidden sm:block ${PACKET_ESTIMATE_HEADER_CELL} sm:text-right`}>Price</span>
        </div>

        <ul>
          {allLines.map((line) => (
            <li
              key={line.templateItemId}
              className={`${PACKET_ESTIMATE_GRID} border-b border-slate-100 py-3 last:border-b-0`}
              data-preview-estimate-line
            >
              <div className="min-w-0">
                <p className={PACKET_ESTIMATE_ITEM_NAME}>{line.name}</p>
                <p className={`mt-0.5 sm:hidden ${PACKET_ESTIMATE_QTY}`}>
                  {line.qtyLabel ? `${line.qtyLabel}  ·  ` : null}
                  {line.valueLabel ?? ""}
                </p>
              </div>
              <p className={`hidden sm:block ${PACKET_ESTIMATE_QTY}`}>{line.qtyLabel ?? "—"}</p>
              <p
                className={`hidden sm:block ${
                  line.kind === "priced" ? PACKET_ESTIMATE_PRICE : PACKET_ESTIMATE_STATUS
                }`}
              >
                {line.valueLabel ?? ""}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {totals.show ? (
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-1">
            {totals.subtotalLabel ? (
              <div className={PACKET_TOTALS_ROW}>
                <span className={PACKET_TOTALS_LABEL}>Subtotal</span>
                <span className={PACKET_TOTALS_VALUE}>{totals.subtotalLabel}</span>
              </div>
            ) : null}
            {totals.discountLabel ? (
              <div className={PACKET_TOTALS_ROW}>
                <span className={PACKET_TOTALS_LABEL}>Discount</span>
                <span className={PACKET_TOTALS_VALUE}>{totals.discountLabel}</span>
              </div>
            ) : null}
            {totals.taxLabel ? (
              <div className={PACKET_TOTALS_ROW}>
                <span className={PACKET_TOTALS_LABEL}>Sales tax</span>
                <span className={PACKET_TOTALS_VALUE}>{totals.taxLabel}</span>
              </div>
            ) : null}
            {totals.totalLabel ? (
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-slate-200/70 pt-2">
                <span className={PACKET_TOTALS_GRAND_LABEL}>Total investment</span>
                <span className={PACKET_TOTALS_GRAND_VALUE}>{totals.totalLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
