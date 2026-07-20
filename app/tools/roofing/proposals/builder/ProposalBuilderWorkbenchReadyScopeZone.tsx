"use client";

import { useState } from "react";
import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_MODULE,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";
import ProposalBuilderWorkbenchRowMenu from "./ProposalBuilderWorkbenchRowMenu";
import ProposalBuilderWorkbenchInlineQuantityEditor from "./ProposalBuilderWorkbenchInlineQuantityEditor";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
  editingQuantityLineId?: string | null;
  onCancelSetQuantity?: () => void;
  onSaveQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  quantitySaveInFlight?: boolean;
  quantitySaveError?: string | null;
  onRemoveFromProposal?: (templateItemId: string) => void;
  removeEnabled?: boolean;
  removeInFlight?: boolean;
};

export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
  editingQuantityLineId = null,
  onCancelSetQuantity,
  onSaveQuantity,
  quantitySaveInFlight = false,
  quantitySaveError = null,
  onRemoveFromProposal,
  removeEnabled = false,
  removeInFlight = false,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lines = sections.flatMap((section) => section.lines);
  const lineCount = lines.length;
  const [detailsLineId, setDetailsLineId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <section
      className={WORKBENCH_MODULE}
      aria-labelledby="workbench-ready-scope-heading"
      data-builder-included-estimate
      data-builder-included-estimate-table
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 pb-1 pt-1">
        <p
          className="text-[15px] font-semibold tracking-tight text-slate-950"
          id="workbench-ready-scope-heading"
        >
          Included estimate
        </p>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} overflow-visible`}>
        {lineCount === 0 ? (
          <p className="text-sm text-slate-500">
            No included lines yet. Finish the estimate to populate this section.
          </p>
        ) : (
          <div className="overflow-visible">
            <div
              className="mb-1 hidden grid-cols-[minmax(0,1fr)_7rem_6.5rem_1.75rem] gap-x-3 border-b border-slate-100 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid"
              data-builder-estimate-column-headers
            >
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span />
            </div>
            <ul className="overflow-visible">
              {lines.map((line) => {
                const showDetails = detailsLineId === line.templateItemId;
                const canRemove = removeEnabled && Boolean(onRemoveFromProposal);
                const isEditing = editingQuantityLineId === line.templateItemId;

                return (
                  <li
                    key={line.templateItemId}
                    className={`overflow-visible border-b border-slate-100 last:border-b-0 ${
                      isEditing ? "bg-blue-50/30" : ""
                    }`}
                    data-builder-included-estimate-row
                    data-builder-inline-editing={isEditing ? "true" : undefined}
                  >
                    {isEditing && onSaveQuantity ? (
                      <div className="py-1.5">
                        <ProposalBuilderWorkbenchInlineQuantityEditor
                          line={{
                            templateItemId: line.templateItemId,
                            name: line.name,
                            unitLabel: line.detailMeta.unit?.trim() || null,
                          }}
                          inFlight={quantitySaveInFlight}
                          error={quantitySaveError}
                          onCancel={() => onCancelSetQuantity?.()}
                          onSave={onSaveQuantity}
                          alignToColumns
                        />
                      </div>
                    ) : (
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
                        <div className="mt-1.5 shrink-0">
                          <ProposalBuilderWorkbenchRowMenu
                            rowId={line.templateItemId}
                            rowLabel={line.name}
                            openMenuId={openMenuId}
                            onOpenMenuIdChange={setOpenMenuId}
                            actions={[
                              {
                                id: "details",
                                label: showDetails ? "Hide details" : "View details",
                                onSelect: () =>
                                  setDetailsLineId((current) =>
                                    current === line.templateItemId
                                      ? null
                                      : line.templateItemId
                                  ),
                              },
                              ...(canRemove
                                ? [
                                    {
                                      id: "remove",
                                      label: WORKBENCH_REMOVE_FROM_OPTION_ACTION,
                                      disabled: removeInFlight,
                                      onSelect: () =>
                                        onRemoveFromProposal!(line.templateItemId),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </div>
                    )}
                    {showDetails && !isEditing ? (
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
