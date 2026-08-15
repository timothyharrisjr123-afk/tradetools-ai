"use client";

import type {
  CustomerPreviewEstimateSectionPresentation,
  CustomerPreviewEstimateTotalsPresentation,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  PACKET_ESTIMATE_HEADER_CELL,
  PACKET_ESTIMATE_HEADER_ROW,
  PACKET_ESTIMATE_HEADING,
  PACKET_ESTIMATE_ITEM_NAME,
  PACKET_ESTIMATE_LABEL,
  PACKET_ESTIMATE_PANEL,
  PACKET_ESTIMATE_PRICE,
  PACKET_ESTIMATE_QTY,
  PACKET_ESTIMATE_ROW,
  PACKET_ESTIMATE_ROW_ALT,
  PACKET_ESTIMATE_SECTION_HEADING,
  PACKET_ESTIMATE_STATUS,
  PACKET_ESTIMATE_TABLE_SHELL,
  PACKET_TOTALS_BAND,
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
 * High-end contractor price breakdown — continuous Item / Qty / Price sheet.
 * No toy cards. Totals only when complete.
 */
export default function ProposalCustomerPreviewEstimateTable({
  sections,
  totals,
}: ProposalCustomerPreviewEstimateTableProps) {
  const allLines = sections.flatMap((section) => section.lines);
  if (allLines.length === 0) {
    return null;
  }

  let lineIndex = 0;

  return (
    <div className={PACKET_ESTIMATE_PANEL} data-preview-estimate-table>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={PACKET_ESTIMATE_LABEL}>Investment detail</p>
          <h2 className={PACKET_ESTIMATE_HEADING}>Estimate</h2>
        </div>
        <p className="pb-0.5 text-[12px] font-medium text-slate-400" data-preview-estimate-count>
          {allLines.length} item{allLines.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className={PACKET_ESTIMATE_TABLE_SHELL}>
        <div className={PACKET_ESTIMATE_HEADER_ROW}>
          <span className={PACKET_ESTIMATE_HEADER_CELL}>Item</span>
          <span className={`hidden sm:block ${PACKET_ESTIMATE_HEADER_CELL} sm:text-right`}>Qty</span>
          <span className={`hidden sm:block ${PACKET_ESTIMATE_HEADER_CELL} sm:text-right`}>Price</span>
        </div>

        {sections.map((section) => (
          <div key={section.sectionId}>
            {section.showHeading ? (
              <p className={PACKET_ESTIMATE_SECTION_HEADING}>{section.title}</p>
            ) : null}
            <ul>
              {section.lines.map((line) => {
                const index = lineIndex++;
                return (
                  <li
                    key={line.templateItemId}
                    className={`${PACKET_ESTIMATE_ROW} ${
                      index % 2 === 1 ? PACKET_ESTIMATE_ROW_ALT : ""
                    }`}
                    data-preview-estimate-line
                  >
                    <div className="min-w-0">
                      <p className={PACKET_ESTIMATE_ITEM_NAME}>{line.name}</p>
                      <p className={`mt-0.5 sm:hidden ${PACKET_ESTIMATE_QTY}`}>
                        {line.qtyLabel ? `${line.qtyLabel}  ·  ` : null}
                        {line.valueLabel ?? ""}
                      </p>
                    </div>
                    <p className={`hidden sm:block ${PACKET_ESTIMATE_QTY}`}>
                      {line.qtyLabel ?? "—"}
                    </p>
                    <p
                      className={`hidden sm:block ${
                        line.kind === "priced" ? PACKET_ESTIMATE_PRICE : PACKET_ESTIMATE_STATUS
                      }`}
                    >
                      {line.valueLabel ?? ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {totals.show ? (
          <div className={PACKET_TOTALS_BAND}>
            <div className="ml-auto w-full max-w-sm space-y-0.5">
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
                <div className="mt-2.5 flex items-baseline justify-between gap-6 border-t border-slate-200 pt-3.5">
                  <span className={PACKET_TOTALS_GRAND_LABEL}>Total investment</span>
                  <span className={PACKET_TOTALS_GRAND_VALUE}>{totals.totalLabel}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
