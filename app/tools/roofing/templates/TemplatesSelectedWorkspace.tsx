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
import TemplatesPackagesCatalogTab from "./TemplatesPackagesCatalogTab";
import TemplatesUseSurface from "./TemplatesUseSurface";
import {
  TEMPLATES_EDIT_TABS,
  type PackageOptionSummary,
  type TemplateCreatesSummary,
  type TemplatesEditTabId,
  type TemplatesWorkspaceMode,
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
  mode: TemplatesWorkspaceMode;
  editTab: TemplatesEditTabId;
  onSelectEditTab: (tab: TemplatesEditTabId) => void;
  onEnterEditMode: (tab?: TemplatesEditTabId) => void;
  onBackToSummary: () => void;
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  packageSummaries: readonly PackageOptionSummary[];
  createsSummary: TemplateCreatesSummary;
  contentViewModel: TemplateContentEditorViewModel;
  structureViewModel: TemplateStructureEditorViewModel;
  structureBusy: StructureSettingsBusy;
  structureError: string | null;
  catalogItems: readonly CatalogItem[];
  focusSectionId: string | null;
  savingSectionId: string | null;
  sectionSaveError: SectionSaveError | null;
  onFixLinks: () => void;
  onAddCatalogItems: () => void;
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
  mode,
  editTab,
  onSelectEditTab,
  onEnterEditMode,
  onBackToSummary,
  graph,
  proposalReadiness,
  linkReadiness,
  packageSummaries,
  createsSummary,
  contentViewModel,
  structureViewModel,
  structureBusy,
  structureError,
  catalogItems,
  focusSectionId,
  savingSectionId,
  sectionSaveError,
  onFixLinks,
  onAddCatalogItems,
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

  if (mode === "use") {
    return (
      <div
        className={`${TEMPLATES_WORKSPACE_ZONE} space-y-4 p-4 sm:p-5`}
        data-templates-selected-workspace
        data-templates-workspace-mode="use"
      >
        <TemplatesUseSurface
          graph={graph}
          proposalReadiness={proposalReadiness}
          linkReadiness={linkReadiness}
          createsSummary={createsSummary}
          onFixLinks={onFixLinks}
          onAddCatalogItems={onAddCatalogItems}
          onEditTemplate={() => onEnterEditMode("packages")}
        />
      </div>
    );
  }

  return (
    <div
      className={`${TEMPLATES_WORKSPACE_ZONE} space-y-4 p-4 sm:p-5`}
      data-templates-selected-workspace
      data-templates-workspace-mode="edit"
      data-templates-active-tab={editTab}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Edit mode
          </p>
          <h2
            className="mt-1 text-base font-semibold text-slate-900"
            data-templates-edit-mode-heading
          >
            Editing {graph.template.name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Change packages, Catalog links, customer display, or content. Return to the summary when
            finished.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToSummary}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          data-templates-back-to-summary
        >
          Back to template summary
        </button>
      </div>

      <div
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px"
        role="tablist"
        aria-label="Edit template"
        data-templates-edit-tabs
      >
        {TEMPLATES_EDIT_TABS.map((tab) => {
          const selected = editTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-templates-tab={tab.id}
              onClick={() => onSelectEditTab(tab.id)}
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

      <div role="tabpanel" data-templates-tab-panel={editTab}>
        {editTab === "packages" ? (
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

        {editTab === "estimate" ? (
          <TemplatesEstimateDisplayTab
            graph={graph}
            viewModel={structureViewModel}
            structureBusy={structureBusy}
            contentSaveBlocked={contentSaveBlocked}
            onSaveTemplateEstimateSettings={onSaveTemplateEstimateSettings}
            onSaveOptionEstimateSettings={onSaveOptionEstimateSettings}
          />
        ) : null}

        {editTab === "content" ? (
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
