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
import TemplatesQuoteSetupReview from "./TemplatesQuoteSetupReview";
import type {
  PackageAuthorshipDraft,
  PackageStructureCreateDraft,
  TemplateIdentityDraft,
} from "./TemplatesSetupAuthorshipEditors";
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
  | { kind: "remove-item"; itemId: string }
  | null;

type SectionSaveError = {
  sectionId: string;
  message: string;
};

type TemplatesSelectedWorkspaceProps = {
  mode: TemplatesWorkspaceMode;
  editTab: TemplatesEditTabId;
  onSelectEditTab: (tab: TemplatesEditTabId) => void;
  onOpenAdvanced: (tab?: TemplatesEditTabId) => void;
  onBackToReview: () => void;
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
  selectedPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  focusSectionId: string | null;
  savingSectionId: string | null;
  sectionSaveError: SectionSaveError | null;
  onAddItem: () => void;
  onAddUpgradeItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
  onFixIssues: () => void;
  onSaveIdentity: (draft: TemplateIdentityDraft) => Promise<void> | void;
  onSavePackages: (drafts: readonly PackageAuthorshipDraft[]) => Promise<void> | void;
  onCopyPackage: (input: {
    sourceOptionId: string;
    draft: PackageStructureCreateDraft;
  }) => Promise<boolean>;
  onCreateBlankPackage: (draft: PackageStructureCreateDraft) => Promise<boolean>;
  onReorderPackage: (optionId: string, direction: "up" | "down") => Promise<boolean>;
  onRemovePackage: (input: {
    removeOptionId: string;
    replacementDefaultOptionId?: string | null;
  }) => Promise<boolean>;
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
  onOpenAdvanced,
  onBackToReview,
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
  selectedPackageOptionId,
  onSelectPackage,
  focusSectionId,
  savingSectionId,
  sectionSaveError,
  onAddItem,
  onAddUpgradeItem,
  onReplaceItem,
  onRemoveItem,
  onFixIssues,
  onSaveIdentity,
  onSavePackages,
  onCopyPackage,
  onCreateBlankPackage,
  onReorderPackage,
  onRemovePackage,
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
  const managerBusy = structureBusy != null || contentSaveBlocked;

  if (mode === "review") {
    return (
      <div
        className={`${TEMPLATES_WORKSPACE_ZONE} space-y-3 border-0 bg-transparent p-0 shadow-none sm:p-0`}
        data-templates-selected-workspace
        data-templates-workspace-mode="review"
      >
        <TemplatesQuoteSetupReview
          graph={graph}
          proposalReadiness={proposalReadiness}
          linkReadiness={linkReadiness}
          packageSummaries={packageSummaries}
          createsSummary={createsSummary}
          catalogItems={catalogItems}
          selectedPackageOptionId={selectedPackageOptionId}
          onSelectPackage={onSelectPackage}
          busy={managerBusy}
          onAddItem={onAddItem}
          onAddUpgradeItem={onAddUpgradeItem}
          onReplaceItem={onReplaceItem}
          onRemoveItem={onRemoveItem}
          onFixIssues={onFixIssues}
          onOpenAdvanced={onOpenAdvanced}
          onSaveIdentity={onSaveIdentity}
          onSavePackages={onSavePackages}
          onCopyPackage={onCopyPackage}
          onCreateBlankPackage={onCreateBlankPackage}
          onReorderPackage={onReorderPackage}
          onRemovePackage={onRemovePackage}
        />
      </div>
    );
  }

  return (
    <div
      className={`${TEMPLATES_WORKSPACE_ZONE} space-y-4 p-4 sm:p-5`}
      data-templates-selected-workspace
      data-templates-workspace-mode="advanced"
      data-templates-active-tab={editTab}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Advanced editing
          </p>
          <h2
            className="mt-1 text-base font-semibold text-slate-900"
            data-templates-edit-mode-heading
          >
            {graph.template.name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Sections, customer display, and content. Everyday included-work changes stay on the
            proposal setup.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToReview}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          data-templates-back-to-summary
          data-templates-back-to-review
        >
          Back to proposal setup
        </button>
      </div>

      <div
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px"
        role="tablist"
        aria-label="Advanced template settings"
        data-templates-edit-tabs
        data-templates-advanced-tabs
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
