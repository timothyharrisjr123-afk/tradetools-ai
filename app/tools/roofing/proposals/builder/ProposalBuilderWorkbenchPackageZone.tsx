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
  const bulletsLine =
    packageZone.bullets.length > 0 ? packageZone.bullets.join(" · ") : null;

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} overflow-visible py-4`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 max-w-3xl flex-1">
          <p
            className="text-base font-semibold tracking-tight text-slate-950"
            id="workbench-package-zone-heading"
            data-builder-package-title
          >
            {packageTitle}
          </p>
          {packageZone.description ? (
            <p
              className="mt-1 text-[14px] leading-relaxed text-slate-600"
              data-builder-package-description
            >
              {packageZone.description}
            </p>
          ) : packageZone.startingPackageHelper ? (
            <p
              className="mt-1 text-[13px] leading-relaxed text-slate-600"
              data-builder-package-helper
            >
              {packageZone.startingPackageHelper}
            </p>
          ) : null}
          {bulletsLine ? (
            <p
              className="mt-1.5 text-[13px] leading-relaxed text-slate-500"
              data-builder-package-bullets
            >
              {bulletsLine}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenEditPackage}
          className="shrink-0 text-[13px] font-medium text-slate-500 hover:text-slate-700"
          data-builder-edit-package
          title="Advanced package settings for this proposal"
        >
          {WORKBENCH_EDIT_PACKAGE_TITLE}
        </button>
      </div>

      <div className="mt-3 w-full min-w-0 overflow-visible">
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
