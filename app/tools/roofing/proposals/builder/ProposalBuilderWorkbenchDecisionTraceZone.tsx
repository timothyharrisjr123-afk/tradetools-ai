"use client";

import { MinusCircle } from "lucide-react";
import type { WorkbenchDecisionTraceZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_DECISION_TRACE_ITEM,
  WORKBENCH_DECISION_TRACE_REMOVED_PILL,
  WORKBENCH_DECISION_TRACE_ZONE,
  WORKBENCH_DECISION_TRACE_ZONE_HEADER,
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_LINE_NAME,
  WORKBENCH_LINE_QTY_VALUE,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_RESTORE_EXCLUDED_ACTION,
  WORKBENCH_SCOPE_COUNT_CHIP,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";

type ProposalBuilderWorkbenchDecisionTraceZoneProps = {
  zone: WorkbenchDecisionTraceZone;
  onRestoreExcludedLine?: (templateItemId: string) => void;
  excludeInFlight?: boolean;
};

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
    <section className={WORKBENCH_DECISION_TRACE_ZONE} aria-labelledby="workbench-decision-trace-heading">
      <header className={WORKBENCH_DECISION_TRACE_ZONE_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className={WORKBENCH_MODULE_KICKER} id="workbench-decision-trace-heading">
                Package scope decisions
              </p>
              <p className={WORKBENCH_MODULE_TITLE}>{excluded.title}</p>
              <p className={WORKBENCH_MODULE_DESC}>{excluded.description}</p>
            </div>
          </div>
          <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{excluded.count}</span>
        </div>
      </header>

      <div className={WORKBENCH_MODULE_INNER}>
        <ul className="space-y-2">
          {excluded.lines.map((line) => (
            <li key={line.templateItemId} className={WORKBENCH_DECISION_TRACE_ITEM}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
                    <span className={WORKBENCH_DECISION_TRACE_REMOVED_PILL}>{line.statusLabel}</span>
                  </div>
                  {line.qtyLabel ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Last qty{" "}
                      <span className={`font-medium ${WORKBENCH_LINE_QTY_VALUE}`}>{line.qtyLabel}</span>
                    </p>
                  ) : null}
                  <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
                </div>
                {onRestoreExcludedLine ? (
                  <button
                    type="button"
                    className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                    disabled={excludeInFlight}
                    onClick={() => onRestoreExcludedLine(line.templateItemId)}
                  >
                    {WORKBENCH_RESTORE_EXCLUDED_ACTION}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
