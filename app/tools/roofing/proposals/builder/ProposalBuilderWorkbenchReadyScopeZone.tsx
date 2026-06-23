import { CheckCircle2 } from "lucide-react";
import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_MODULE,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_SCOPE_COUNT_CHIP,
  WORKBENCH_SCOPE_SECTION,
  WORKBENCH_SCOPE_SECTION_TITLE,
  WORKBENCH_ZONE_HEADER,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
};

export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lineCount = sections.reduce((sum, section) => sum + section.lines.length, 0);

  return (
    <section className={WORKBENCH_MODULE} aria-labelledby="workbench-ready-scope-heading">
      <header className={WORKBENCH_ZONE_HEADER}>
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className={WORKBENCH_MODULE_KICKER} id="workbench-ready-scope-heading">
              Customer-ready scope
            </p>
            <p className={WORKBENCH_MODULE_TITLE}>Included on the customer proposal</p>
            <p className={WORKBENCH_MODULE_DESC}>
              Resolved, priced, and included lines — compact contractor view.
            </p>
          </div>
        </div>
        <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{lineCount} lines</span>
      </header>

      <div className={WORKBENCH_MODULE_INNER}>
        {lineCount === 0 ? (
          <p className="text-sm text-slate-500">
            No customer-ready lines yet. Resolve items in Needs attention to populate this zone.
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.sectionId} className={WORKBENCH_SCOPE_SECTION}>
                <div className={WORKBENCH_SCOPE_SECTION_TITLE}>
                  <span>{section.title}</span>
                  <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{section.lines.length}</span>
                </div>
                <ul className="mt-1.5">
                  {section.lines.map((line) => (
                    <ProposalBuilderWorkbenchLineRow
                      key={line.templateItemId}
                      variant="scope"
                      line={line}
                      onEditQuantity={
                        line.manualQuantityActive && onEditQuantityForLine
                          ? () => onEditQuantityForLine(line.templateItemId)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
