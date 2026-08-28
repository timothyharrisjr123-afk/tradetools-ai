"use client";

import type { WorkbenchNeedsAttentionZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_ATTENTION_COUNT_BADGE,
  WORKBENCH_ATTENTION_ITEM,
  WORKBENCH_ATTENTION_ZONE,
  WORKBENCH_ATTENTION_ZONE_HEADER,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_TITLE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchAttentionZoneProps = {
  zone: WorkbenchNeedsAttentionZone;
};

function HardBlockersSection({ zone }: { zone: WorkbenchNeedsAttentionZone["hardBlockers"] }) {
  if (!zone.show) return null;

  return (
    <section className={WORKBENCH_ATTENTION_ZONE} aria-labelledby="workbench-hard-blockers-heading">
      <header className={WORKBENCH_ATTENTION_ZONE_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={WORKBENCH_MODULE_TITLE} id="workbench-hard-blockers-heading">
              {zone.title}
            </p>
            <p className={WORKBENCH_MODULE_DESC}>{zone.description}</p>
          </div>
          <span className={WORKBENCH_ATTENTION_COUNT_BADGE}>{zone.count}</span>
        </div>
      </header>

      <div className="space-y-1 px-0 py-3">
        <ul className="divide-y divide-slate-100">
          {zone.lines.map((line) => (
            <li
              key={line.templateItemId}
              className={`${WORKBENCH_ATTENTION_ITEM} !border-0 !bg-transparent !shadow-none px-0 py-2`}
            >
              <ProposalBuilderWorkbenchLineRow variant="hard_blocker" line={line} compact />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function ProposalBuilderWorkbenchAttentionZone({
  zone,
}: ProposalBuilderWorkbenchAttentionZoneProps) {
  if (!zone.hardBlockers.show) return null;

  return (
    <div className="space-y-3">
      <HardBlockersSection zone={zone.hardBlockers} />
    </div>
  );
}
