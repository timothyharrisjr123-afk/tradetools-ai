import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_MODULE,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_SCOPE_COUNT_CHIP,
  WORKBENCH_SCOPE_SECTION,
  WORKBENCH_SCOPE_SECTION_TITLE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
};

export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lineCount = sections.reduce((sum, section) => sum + section.lines.length, 0);

  return (
    <section
      className={WORKBENCH_MODULE}
      aria-labelledby="workbench-ready-scope-heading"
      data-builder-included-estimate
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-1 pt-4 sm:px-5">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            id="workbench-ready-scope-heading"
          >
            Included estimate
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">Roof replacement scope</p>
        </div>
        <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{lineCount}</span>
      </header>

      <div className={WORKBENCH_MODULE_INNER}>
        {lineCount === 0 ? (
          <p className="text-sm text-slate-500">
            No included lines yet. Finish quantity review to populate this estimate.
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
