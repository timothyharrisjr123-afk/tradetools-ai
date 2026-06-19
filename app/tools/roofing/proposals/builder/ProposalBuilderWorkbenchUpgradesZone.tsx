import { Info, Sparkles } from "lucide-react";
import type { WorkbenchUpgradesZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_HINT_STRIP,
  WORKBENCH_MODULE_COMPACT,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_SCOPE_COUNT_CHIP,
  WORKBENCH_SCOPE_SECTION,
  WORKBENCH_SCOPE_SECTION_TITLE,
  WORKBENCH_UPGRADES_EMPTY,
  WORKBENCH_UPGRADES_ZONE,
  WORKBENCH_ZONE_HEADER,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchUpgradesZoneProps = {
  zone: WorkbenchUpgradesZone;
};

export default function ProposalBuilderWorkbenchUpgradesZone({
  zone,
}: ProposalBuilderWorkbenchUpgradesZoneProps) {
  if (!zone.show) return null;

  const lineCount = zone.sections.reduce((sum, section) => sum + section.lines.length, 0);

  if (zone.isEmpty) {
    return (
      <section
        className={WORKBENCH_MODULE_COMPACT}
        aria-labelledby="workbench-upgrades-heading"
      >
        <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <p
              className="text-[12px] font-semibold text-slate-700"
              id="workbench-upgrades-heading"
            >
              Optional upgrades
            </p>
          </div>
          <p className={WORKBENCH_UPGRADES_EMPTY}>
            <span>{zone.emptyCopy}</span>
          </p>
          {zone.customerSelectionHint ? (
            <p className={WORKBENCH_HINT_STRIP}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>{zone.customerSelectionHint}</span>
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={WORKBENCH_UPGRADES_ZONE} aria-labelledby="workbench-upgrades-heading">
      <header className={WORKBENCH_ZONE_HEADER}>
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <div>
            <p className={WORKBENCH_MODULE_KICKER} id="workbench-upgrades-heading">
              Optional upgrades
            </p>
            <p className={WORKBENCH_MODULE_TITLE}>Future customer selections</p>
            <p className={WORKBENCH_MODULE_DESC}>
              Shown separately on the customer proposal when signing is enabled.
            </p>
          </div>
        </div>
        <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{lineCount}</span>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} space-y-3`}>
        {zone.sections.map((section) =>
          section.lines.length > 0 ? (
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
                  />
                ))}
              </ul>
            </div>
          ) : null
        )}

        {zone.customerSelectionHint ? (
          <p className={WORKBENCH_HINT_STRIP}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>{zone.customerSelectionHint}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
