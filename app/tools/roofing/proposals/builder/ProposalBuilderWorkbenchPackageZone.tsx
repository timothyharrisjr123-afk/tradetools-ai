import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import { WORKBENCH_PACKAGE_MODULE } from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchPackageZoneProps = {
  packageZone: WorkbenchPackageZone;
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
}: ProposalBuilderWorkbenchPackageZoneProps) {
  const packageTitle = packageZone.label
    ? `${packageZone.label} package`
    : "Package";

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} px-3.5 py-3`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold text-slate-900"
            id="workbench-package-zone-heading"
            data-builder-package-title
          >
            {packageTitle}
          </p>
          {packageZone.startingPackageHelper ? (
            <p
              className="mt-0.5 text-[12px] leading-snug text-slate-600"
              data-builder-package-helper
            >
              {packageZone.startingPackageHelper}
            </p>
          ) : null}
        </div>
        <ProposalBuilderPackageSelector
          graph={packageSelectorGraph}
          draftScoped={draftScopedPackagePicker}
          compact
          selectedOptionId={selectedOptionId}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={onSelectOption}
        />
      </div>
    </section>
  );
}
