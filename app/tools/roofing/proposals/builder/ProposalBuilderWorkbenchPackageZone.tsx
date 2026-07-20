import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import {
  WORKBENCH_EDIT_PACKAGE_TITLE,
  WORKBENCH_PACKAGE_MODULE,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchPackageZoneProps = {
  packageZone: WorkbenchPackageZone;
  packageSelectorGraph: ProposalTemplateGraph;
  draftScopedPackagePicker?: boolean;
  selectedOptionId: string | null;
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onOpenEditPackage: () => void;
};

export default function ProposalBuilderWorkbenchPackageZone({
  packageZone,
  packageSelectorGraph,
  draftScopedPackagePicker = false,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  onOpenEditPackage,
}: ProposalBuilderWorkbenchPackageZoneProps) {
  const packageTitle = packageZone.label
    ? `${packageZone.label} package`
    : "Package";

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} py-3`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold text-slate-900"
            id="workbench-package-zone-heading"
            data-builder-package-title
          >
            {packageTitle}
          </p>
          {packageZone.description ? (
            <p
              className="mt-0.5 text-[13px] leading-snug text-slate-600"
              data-builder-package-description
            >
              {packageZone.description}
            </p>
          ) : packageZone.startingPackageHelper ? (
            <p
              className="mt-0.5 text-[12px] leading-snug text-slate-600"
              data-builder-package-helper
            >
              {packageZone.startingPackageHelper}
            </p>
          ) : null}
          {packageZone.bullets.length > 0 ? (
            <p
              className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500"
              data-builder-package-bullets
            >
              {packageZone.bullets.map((bullet, index) => (
                <span key={bullet} className="inline-flex items-center gap-1.5">
                  {index > 0 ? (
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {bullet}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <ProposalBuilderPackageSelector
            graph={packageSelectorGraph}
            draftScoped={draftScopedPackagePicker}
            compact
            selectedOptionId={selectedOptionId}
            effectiveOptionId={effectiveOptionId}
            onSelectOption={onSelectOption}
          />
          <button
            type="button"
            onClick={onOpenEditPackage}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
            data-builder-edit-package
            title="Advanced package editing"
          >
            {WORKBENCH_EDIT_PACKAGE_TITLE}
          </button>
        </div>
      </div>
    </section>
  );
}
