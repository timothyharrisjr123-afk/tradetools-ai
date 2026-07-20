"use client";

import type { WorkbenchDecisionTraceZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_DECISION_TRACE_ITEM,
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_LINE_NAME,
  WORKBENCH_LINE_QTY_VALUE,
  WORKBENCH_RESTORE_EXCLUDED_ACTION,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchDecisionTraceZoneProps = {
  zone: WorkbenchDecisionTraceZone;
  onRestoreExcludedLine?: (templateItemId: string) => void;
  excludeInFlight?: boolean;
};

/**
 * Expanded removed-items list. Parent supplies collapsed “Removed from proposal” label.
 */
export default function ProposalBuilderWorkbenchDecisionTraceZone({
  zone,
  onRestoreExcludedLine,
  excludeInFlight = false,
}: ProposalBuilderWorkbenchDecisionTraceZoneProps) {
  if (!zone.show || !zone.excluded.show) {
    return null;
  }

  const { excluded } = zone;

  return (
    <div data-builder-removed-items-list>
      <p className="mb-2 px-1 text-[13px] leading-relaxed text-slate-500">
        {excluded.description}
      </p>
      <ul className="space-y-1.5">
        {excluded.lines.map((line) => (
          <li key={line.templateItemId} className={WORKBENCH_DECISION_TRACE_ITEM}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1.5">
              <div className="min-w-0 flex-1">
                <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
                {line.qtyLabel ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Last qty{" "}
                    <span className={`font-medium ${WORKBENCH_LINE_QTY_VALUE}`}>
                      {line.qtyLabel}
                    </span>
                  </p>
                ) : null}
              </div>
              {onRestoreExcludedLine ? (
                <button
                  type="button"
                  className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                  disabled={excludeInFlight}
                  onClick={() => onRestoreExcludedLine(line.templateItemId)}
                  data-builder-restore-removed
                >
                  {WORKBENCH_RESTORE_EXCLUDED_ACTION}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
