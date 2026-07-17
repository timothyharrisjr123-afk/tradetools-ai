"use client";

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import type { ProposalTemplateSectionKind } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_WORKSPACE_ZONE } from "./templatesConstants";
import TemplatesContentEditorShell from "./TemplatesContentEditorShell";
import TemplatesEstimateDisplayTab from "./TemplatesEstimateDisplayTab";
import TemplatesOverviewPanel from "./TemplatesOverviewPanel";
import TemplatesPackagesCatalogTab from "./TemplatesPackagesCatalogTab";
import {
  TEMPLATES_WORKSPACE_TABS,
  type PackageOptionSummary,
  type TemplatesWorkspaceTabId,
} from "./templatesWorkspaceFlow";

type StructureSettingsBusy =
  | { kind: "add"; optionId: string; sectionKind: ProposalTemplateSectionKind }
  | { kind: "move"; sectionId: string }
  | { kind: "settings-template" }
  | { kind: "settings-option"; optionId: string }
  | { kind: "add-item"; sectionId: string }
  | { kind: "relink-item"; itemId: string }
  | null;

type SectionSaveError = {
  sectionId: string;
  message: string;
};

type TemplatesSelectedWorkspaceProps = {
  activeTab: TemplatesWorkspaceTabId;
  onSelectTab: (tab: TemplatesWorkspaceTabId) => void;
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  packageSummaries: readonly PackageOptionSummary[];
  contentViewModel: TemplateContentEditorViewModel;
  structureViewModel: TemplateStructureEditorViewModel;
  structureBusy: StructureSettingsBusy;
  structureError: string | null;
  catalogItems: readonly CatalogItem[];
  focusSectionId: string | null;
  savingSectionId: string | null;
  sectionSaveError: SectionSaveError | null;
  onFixLinks: () => void;
  onAddSection: (optionId: string, kind: ProposalTemplateSectionKind) => void;
  onMoveSection: (
    optionId: string,
    sectionId: string,
    direction: "up" | "down"
  ) => void;
  onSaveTemplateEstimateSettings: (patch: Partial<ProposalPageSettings>) => void;
  onSaveOptionEstimateSettings: (
    optionId: string,
    patch: Partial<ProposalPageSettings>
  ) => void;
  onAddCatalogItemToSection: (optionId: string, sectionId: string) => void;
  onRelinkTemplateItem: (templateItemId: string) => void;
  onSaveSection: (args: {
    sectionId: string;
    optionId: string;
    draftBody: string;
  }) => void;
  onDirtySectionCountChange: (count: number) => void;
};

export default function TemplatesSelectedWorkspace({
  activeTab,
  onSelectTab,
  graph,
  proposalReadiness,
  linkReadiness,
  packageSummaries,
  contentViewModel,
  structureViewModel,
  structureBusy,
  structureError,
  catalogItems,
  focusSectionId,
  savingSectionId,
  sectionSaveError,
  onFixLinks,
  onAddSection,
  onMoveSection,
  onSaveTemplateEstimateSettings,
  onSaveOptionEstimateSettings,
  onAddCatalogItemToSection,
  onRelinkTemplateItem,
  onSaveSection,
  onDirtySectionCountChange,
}: TemplatesSelectedWorkspaceProps) {
  const contentSaveBlocked = savingSectionId != null;

  return (
    <div
      className={`${TEMPLATES_WORKSPACE_ZONE} space-y-4 p-4 sm:p-5`}
      data-templates-selected-workspace
      data-templates-active-tab={activeTab}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Template workspace</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Review readiness first. Open edit tabs only when you need a change.
          </p>
        </div>
      </div>

      <div
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px"
        role="tablist"
        aria-label="Template workspace"
        data-templates-workspace-tabs
      >
        {TEMPLATES_WORKSPACE_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-templates-tab={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`shrink-0 rounded-t-md px-3 py-2 text-xs font-semibold transition ${
                selected
                  ? "border border-b-white border-slate-200 bg-white text-slate-900"
                  : "border border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" data-templates-tab-panel={activeTab}>
        {activeTab === "overview" ? (
          <TemplatesOverviewPanel
            graph={graph}
            proposalReadiness={proposalReadiness}
            linkReadiness={linkReadiness}
            packageSummaries={packageSummaries}
            editableProseCount={contentViewModel.totalEditableSectionCount}
            onFixLinks={onFixLinks}
            onOpenPackages={() => onSelectTab("packages")}
            onOpenEstimate={() => onSelectTab("estimate")}
            onOpenContent={() => onSelectTab("content")}
          />
        ) : null}

        {activeTab === "packages" ? (
          <TemplatesPackagesCatalogTab
            graph={graph}
            viewModel={structureViewModel}
            packageSummaries={packageSummaries}
            structureBusy={structureBusy}
            structureError={structureError}
            contentSaveBlocked={contentSaveBlocked}
            catalogItems={catalogItems}
            focusSectionId={focusSectionId}
            onAddSection={onAddSection}
            onMoveSection={onMoveSection}
            onAddCatalogItemToSection={onAddCatalogItemToSection}
            onRelinkTemplateItem={onRelinkTemplateItem}
          />
        ) : null}

        {activeTab === "estimate" ? (
          <TemplatesEstimateDisplayTab
            graph={graph}
            viewModel={structureViewModel}
            structureBusy={structureBusy}
            contentSaveBlocked={contentSaveBlocked}
            onSaveTemplateEstimateSettings={onSaveTemplateEstimateSettings}
            onSaveOptionEstimateSettings={onSaveOptionEstimateSettings}
          />
        ) : null}

        {activeTab === "content" ? (
          <TemplatesContentEditorShell
            viewModel={contentViewModel}
            graph={graph}
            savingSectionId={savingSectionId}
            sectionSaveError={sectionSaveError}
            contentSaveBlocked={structureBusy != null}
            onSaveSection={onSaveSection}
            onDirtySectionCountChange={onDirtySectionCountChange}
          />
        ) : null}
      </div>
    </div>
  );
}
