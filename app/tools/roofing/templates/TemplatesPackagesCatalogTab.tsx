"use client";

import { useEffect, useState } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import {
  proposalTemplateSectionKindLabel,
  type ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD } from "./templatesConstants";
import TemplatesStructureSectionRow from "./TemplatesStructureSectionRow";
import {
  describeRemoveSectionState,
} from "./templatesStructureEditorUtils";
import {
  defaultExpandedPackageOptionId,
  type PackageOptionSummary,
} from "./templatesWorkspaceFlow";

type StructureSettingsBusy =
  | { kind: "add"; optionId: string; sectionKind: ProposalTemplateSectionKind }
  | { kind: "move"; sectionId: string }
  | { kind: "add-item"; sectionId: string }
  | { kind: "relink-item"; itemId: string }
  | { kind: string; [key: string]: unknown }
  | null;

type TemplatesPackagesCatalogTabProps = {
  graph: ProposalTemplateGraph;
  viewModel: TemplateStructureEditorViewModel;
  packageSummaries: readonly PackageOptionSummary[];
  structureBusy: StructureSettingsBusy;
  structureError: string | null;
  contentSaveBlocked: boolean;
  catalogItems: readonly CatalogItem[];
  focusSectionId?: string | null;
  onAddSection: (optionId: string, kind: ProposalTemplateSectionKind) => void;
  onMoveSection: (
    optionId: string,
    sectionId: string,
    direction: "up" | "down"
  ) => void;
  onAddCatalogItemToSection: (optionId: string, sectionId: string) => void;
  onRelinkTemplateItem: (templateItemId: string) => void;
};

export default function TemplatesPackagesCatalogTab({
  graph,
  viewModel,
  packageSummaries,
  structureBusy,
  structureError,
  contentSaveBlocked,
  catalogItems,
  focusSectionId = null,
  onAddSection,
  onMoveSection,
  onAddCatalogItemToSection,
  onRelinkTemplateItem,
}: TemplatesPackagesCatalogTabProps) {
  const structureDisabled = structureBusy != null || contentSaveBlocked;
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(() =>
    defaultExpandedPackageOptionId(packageSummaries)
  );
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedOptionId((current) => {
      if (current && packageSummaries.some((row) => row.optionId === current)) {
        return current;
      }
      return defaultExpandedPackageOptionId(packageSummaries);
    });
  }, [packageSummaries]);

  useEffect(() => {
    if (!focusSectionId) return;
    const section = graph.sections.find((row) => row.id === focusSectionId);
    if (!section) return;
    setExpandedOptionId(section.option_id);
    setExpandedSectionId(focusSectionId);
  }, [focusSectionId, graph.sections]);

  return (
    <section
      className={TEMPLATES_CARD}
      aria-labelledby="templates-packages-heading"
      data-templates-packages-tab
    >
      <h2 id="templates-packages-heading" className="text-sm font-semibold text-slate-900">
        Packages & Catalog
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Choose a package option, then open a section only when you need to add or change Included
        Catalog items. Pricing stays in Catalog.
      </p>

      {structureError ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {structureError}
        </p>
      ) : null}

      {contentSaveBlocked ? (
        <p className="mt-3 text-xs text-amber-800" role="status">
          Structure edits are paused while content is saving.
        </p>
      ) : null}

      {viewModel.optionGroups.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No package options found for this template yet.</p>
      ) : (
        <ul className="mt-4 space-y-3" data-templates-package-list>
          {viewModel.optionGroups.map((group) => {
            const summary = packageSummaries.find((row) => row.optionId === group.optionId);
            const expanded = expandedOptionId === group.optionId;
            const addingForThisOption =
              structureBusy?.kind === "add" && structureBusy.optionId === group.optionId;

            return (
              <li
                key={group.optionId}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                data-templates-package-option={group.optionId}
                data-templates-package-expanded={expanded ? "true" : "false"}
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/70"
                  onClick={() =>
                    setExpandedOptionId((current) =>
                      current === group.optionId ? null : group.optionId
                    )
                  }
                  aria-expanded={expanded}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">
                      {group.optionLabel}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {summary?.sectionCount ?? group.sections.length} sections ·{" "}
                      {summary?.linkedItemCount ?? 0} Catalog items
                      {(summary?.issueCount ?? 0) > 0
                        ? ` · ${summary?.issueCount} need attention`
                        : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {summary?.status === "needs_attention" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Needs attention
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold text-slate-500">
                      {expanded ? "Hide" : "Open"}
                    </span>
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-slate-100">
                    <div className="divide-y divide-slate-100">
                      {group.sections.map((section, sectionIndex) => {
                        const sectionItems = graph.items.filter(
                          (item) => item.section_id === section.sectionId
                        );
                        const sectionOpen = expandedSectionId === section.sectionId;
                        const catalogItemsBusy =
                          (structureBusy?.kind === "add-item" &&
                            structureBusy.sectionId === section.sectionId) ||
                          (structureBusy?.kind === "relink-item" &&
                            sectionItems.some((item) => item.id === structureBusy.itemId));

                        return (
                          <div
                            key={section.sectionId}
                            data-templates-section-compact={section.sectionId}
                          >
                            {!sectionOpen ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {section.displayTitle}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {proposalTemplateSectionKindLabel(section.kind)}
                                    {section.itemCount > 0
                                      ? ` · ${section.itemCount} included item${section.itemCount === 1 ? "" : "s"}`
                                      : ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedSectionId(section.sectionId)}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                                  data-templates-expand-section={section.sectionId}
                                >
                                  Edit section
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex justify-end px-4 pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSectionId(null)}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                                  >
                                    Collapse section
                                  </button>
                                </div>
                                <TemplatesStructureSectionRow
                                  section={section}
                                  sectionIndex={sectionIndex}
                                  sectionCount={group.sections.length}
                                  removeState={describeRemoveSectionState(
                                    graph,
                                    section.sectionId
                                  )}
                                  isMoving={
                                    structureBusy?.kind === "move" &&
                                    structureBusy.sectionId === section.sectionId
                                  }
                                  structureDisabled={structureDisabled}
                                  onMoveUp={() =>
                                    onMoveSection(group.optionId, section.sectionId, "up")
                                  }
                                  onMoveDown={() =>
                                    onMoveSection(group.optionId, section.sectionId, "down")
                                  }
                                  sectionItems={sectionItems}
                                  catalogItems={catalogItems}
                                  catalogItemsBusy={catalogItemsBusy}
                                  showCatalogItems
                                  onAddFromCatalog={() =>
                                    onAddCatalogItemToSection(
                                      group.optionId,
                                      section.sectionId
                                    )
                                  }
                                  onRelinkCatalogItem={onRelinkTemplateItem}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Add section
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.addableKinds.map((kind) => {
                          const isAddingThisKind =
                            addingForThisOption && structureBusy.sectionKind === kind;

                          return (
                            <button
                              key={kind}
                              type="button"
                              disabled={structureDisabled || addingForThisOption}
                              onClick={() => onAddSection(group.optionId, kind)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                structureDisabled || addingForThisOption
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {isAddingThisKind
                                ? "Adding…"
                                : `Add ${proposalTemplateSectionKindLabel(kind)}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
