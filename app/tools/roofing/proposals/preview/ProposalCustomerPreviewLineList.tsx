"use client";

import type { CustomerPreviewEstimateLine } from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  CUSTOMER_PREVIEW_ESTIMATE_ROW_GRID,
  WORKBENCH_LINE_AMOUNT,
  WORKBENCH_LINE_AMOUNT_INCLUDED,
  WORKBENCH_LINE_NAME,
  WORKBENCH_LINE_QTY,
  WORKBENCH_LINE_QTY_VALUE,
} from "../builder/proposalBuilderConstants";

type ProposalCustomerPreviewLineListProps = {
  lines: CustomerPreviewEstimateLine[];
  /** Softer row treatment for optional upgrades (unsupported in Preview — kept for type compat). */
  variant?: "scope" | "upgrade";
};

/**
 * Block 5B — Builder-density Item / Qty / Price rows for the customer document.
 * No edit actions, menus, or contractor labels.
 */
export default function ProposalCustomerPreviewLineList({
  lines,
}: ProposalCustomerPreviewLineListProps) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="w-full" data-preview-estimate-line-table>
      <div
        className={`${CUSTOMER_PREVIEW_ESTIMATE_ROW_GRID} border-b border-slate-200/80 pb-2`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Item
        </span>
        <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:block sm:text-right">
          Qty
        </span>
        <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:block sm:text-right">
          Price
        </span>
      </div>
      <ul className="w-full">
        {lines.map((line) => (
          <li
            key={line.templateItemId}
            className={`${CUSTOMER_PREVIEW_ESTIMATE_ROW_GRID} border-b border-slate-100 py-2 last:border-b-0`}
            data-preview-estimate-line
          >
            <div className="min-w-0">
              <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
              <p className={`${WORKBENCH_LINE_QTY} mt-0.5 sm:hidden`}>
                {line.qtyLabel ? (
                  <>
                    Qty{" "}
                    <span className={WORKBENCH_LINE_QTY_VALUE}>{line.qtyLabel}</span>
                  </>
                ) : null}
                {line.valueLabel != null ? (
                  <span
                    className={
                      line.kind === "priced"
                        ? ` ml-3 ${WORKBENCH_LINE_AMOUNT}`
                        : ` ml-3 ${WORKBENCH_LINE_AMOUNT_INCLUDED}`
                    }
                  >
                    {line.valueLabel}
                  </span>
                ) : null}
              </p>
            </div>
            <p className={`${WORKBENCH_LINE_QTY} hidden sm:block`}>
              {line.qtyLabel ? (
                <span className={WORKBENCH_LINE_QTY_VALUE}>{line.qtyLabel}</span>
              ) : (
                <span className="text-slate-300" aria-hidden>
                  —
                </span>
              )}
            </p>
            {line.valueLabel != null ? (
              <p
                className={
                  line.kind === "priced"
                    ? `hidden ${WORKBENCH_LINE_AMOUNT} sm:block`
                    : `hidden ${WORKBENCH_LINE_AMOUNT_INCLUDED} sm:block`
                }
              >
                {line.valueLabel}
              </p>
            ) : (
              <span className="hidden sm:block" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
