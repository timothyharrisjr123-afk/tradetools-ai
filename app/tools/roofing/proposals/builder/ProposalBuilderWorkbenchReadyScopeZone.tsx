"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_MODULE,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
  onRemoveFromProposal?: (templateItemId: string) => void;
  removeEnabled?: boolean;
  removeInFlight?: boolean;
};

export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
  onRemoveFromProposal,
  removeEnabled = false,
  removeInFlight = false,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lines = sections.flatMap((section) => section.lines);
  const lineCount = lines.length;
  const [detailsLineId, setDetailsLineId] = useState<string | null>(null);

  return (
    <section
      className={WORKBENCH_MODULE}
      aria-labelledby="workbench-ready-scope-heading"
      data-builder-included-estimate
      data-builder-included-estimate-table
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 pb-1 pt-1">
        <p
          className="text-sm font-semibold text-slate-900"
          id="workbench-ready-scope-heading"
        >
          Included estimate
        </p>
      </header>

      <div className={WORKBENCH_MODULE_INNER}>
        {lineCount === 0 ? (
          <p className="text-sm text-slate-500">
            No included lines yet. Finish the estimate to populate this section.
          </p>
        ) : (
          <div>
            <div
              className="mb-1 hidden grid-cols-[minmax(0,1fr)_5.5rem_6rem_1.5rem] gap-x-3 border-b border-slate-100 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid"
              data-builder-estimate-column-headers
            >
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span />
            </div>
            <ul>
              {lines.map((line) => {
                const showDetails = detailsLineId === line.templateItemId;
                const canRemove = removeEnabled && Boolean(onRemoveFromProposal);

                return (
                  <li
                    key={line.templateItemId}
                    className="border-b border-slate-100 last:border-b-0"
                    data-builder-included-estimate-row
                  >
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <ProposalBuilderWorkbenchLineRow
                          variant="scope"
                          line={line}
                          as="div"
                          hideDetails
                          onEditQuantity={
                            line.manualQuantityActive && onEditQuantityForLine
                              ? () => onEditQuantityForLine(line.templateItemId)
                              : undefined
                          }
                        />
                      </div>
                      <details
                        className="relative mt-1.5 shrink-0"
                        data-builder-included-row-menu
                        data-builder-included-row-menu-for={line.templateItemId}
                      >
                        <summary
                          className="flex cursor-pointer list-none items-center justify-center rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 [&::-webkit-details-marker]:hidden"
                          aria-label={`More actions for ${line.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          {canRemove ? (
                            <button
                              type="button"
                              disabled={removeInFlight}
                              className="block w-full px-3 py-1.5 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              data-builder-remove-from-proposal
                              onClick={() => onRemoveFromProposal!(line.templateItemId)}
                            >
                              {WORKBENCH_REMOVE_FROM_OPTION_ACTION}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                            data-builder-view-line-details
                            onClick={() =>
                              setDetailsLineId((current) =>
                                current === line.templateItemId ? null : line.templateItemId
                              )
                            }
                          >
                            {showDetails ? "Hide details" : "View details"}
                          </button>
                        </div>
                      </details>
                    </div>
                    {showDetails ? (
                      <div className="pb-2" data-builder-included-line-details>
                        <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
