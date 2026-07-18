import { Info, SlidersHorizontal } from "lucide-react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import {
  WORKBENCH_EDIT_OPTION_TITLE,
  WORKBENCH_EDIT_OPTION_TRIGGER_PRIMARY,
  WORKBENCH_HINT_STRIP,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_PACKAGE_ACCENT,
  WORKBENCH_PACKAGE_ACTIVE_CHIP,
  WORKBENCH_PACKAGE_MODULE,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchPackageZoneProps = {
  packageZone: WorkbenchPackageZone;
  /** Draft-scoped option list for the package picker when a draft is loaded. */
  packageSelectorGraph: ProposalTemplateGraph;
  draftScopedPackagePicker?: boolean;
  selectedOptionId: string | null;
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onOpenEditOption: () => void;
};

export default function ProposalBuilderWorkbenchPackageZone({
  packageZone,
  packageSelectorGraph,
  draftScopedPackagePicker = false,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  onOpenEditOption,
}: ProposalBuilderWorkbenchPackageZoneProps) {
  return (
    <section className={WORKBENCH_PACKAGE_MODULE} aria-labelledby="workbench-package-zone-heading">
      <div className={WORKBENCH_PACKAGE_ACCENT} aria-hidden />

      <div className={`${WORKBENCH_MODULE_INNER} space-y-3.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={WORKBENCH_MODULE_KICKER} id="workbench-package-zone-heading">
              Package / option
            </p>
            {packageZone.label ? (
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {packageZone.label}
                <span className="ml-1.5 font-normal text-slate-500">· drives this estimate</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditOption}
              className={WORKBENCH_EDIT_OPTION_TRIGGER_PRIMARY}
              title="Open Edit option — set manual quantity for scope review lines"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              {WORKBENCH_EDIT_OPTION_TITLE}
            </button>
            {packageZone.label ? (
              <span className={WORKBENCH_PACKAGE_ACTIVE_CHIP}>Active option</span>
            ) : null}
          </div>
        </div>

        <ProposalBuilderPackageSelector
          graph={packageSelectorGraph}
          draftScoped={draftScopedPackagePicker}
          selectedOptionId={selectedOptionId}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={onSelectOption}
        />

        {packageZone.customerSigningHint ? (
          <p className={WORKBENCH_HINT_STRIP}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>{packageZone.customerSigningHint}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
