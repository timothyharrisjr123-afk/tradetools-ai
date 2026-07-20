import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { WORKBENCH_MODULE, WORKBENCH_MODULE_INNER } from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
};

export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lines = sections.flatMap((section) => section.lines);
  const lineCount = lines.length;

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
              className="mb-1 hidden grid-cols-[minmax(0,1fr)_5.5rem_6rem] gap-x-4 border-b border-slate-100 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid"
              data-builder-estimate-column-headers
            >
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
            </div>
            <ul>
              {lines.map((line) => (
                <ProposalBuilderWorkbenchLineRow
                  key={line.templateItemId}
                  variant="scope"
                  line={line}
                  hideDetails
                  onEditQuantity={
                    line.manualQuantityActive && onEditQuantityForLine
                      ? () => onEditQuantityForLine(line.templateItemId)
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
