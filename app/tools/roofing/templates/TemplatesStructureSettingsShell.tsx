"use client";

import { useMemo } from "react";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  readEstimatePageSettingsFromTemplate,
  resolveEstimatePageSettingsForOption,
} from "@/app/lib/proposalTemplateEstimateSettings";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import {
  proposalTemplateSectionKindLabel,
  type ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  TEMPLATES_CARD,
  TEMPLATES_LOCKED_BANNER,
  TEMPLATES_OPTION_GROUP,
} from "./templatesConstants";
import TemplatesStructureSectionRow from "./TemplatesStructureSectionRow";
import {
  describeRemoveSectionState,
  ESTIMATE_SETTINGS_TOGGLE_LABELS,
  type EstimateSettingsToggleKey,
} from "./templatesStructureEditorUtils";

type StructureSettingsBusy =
  | { kind: "add"; optionId: string; sectionKind: ProposalTemplateSectionKind }
  | { kind: "move"; sectionId: string }
  | { kind: "settings-template" }
  | { kind: "settings-option"; optionId: string }
  | { kind: "add-item"; sectionId: string }
  | { kind: "relink-item"; itemId: string }
  | null;

type TemplatesStructureSettingsShellProps = {
  graph: ProposalTemplateGraph;
  viewModel: TemplateStructureEditorViewModel;
  structureBusy: StructureSettingsBusy;
  structureError: string | null;
  contentSaveBlocked: boolean;
  catalogItems: readonly CatalogItem[];
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
};

function isStructureDisabled(
  structureBusy: StructureSettingsBusy,
  contentSaveBlocked: boolean
): boolean {
  return structureBusy != null || contentSaveBlocked;
}

function EstimateSettingsToggles({
  settings,
  disabled,
  saving,
  onToggle,
  idPrefix,
}: {
  settings: ProposalPageSettings;
  disabled: boolean;
  saving: boolean;
  onToggle: (key: EstimateSettingsToggleKey, nextValue: boolean) => void;
  idPrefix: string;
}) {
  const keys = Object.keys(ESTIMATE_SETTINGS_TOGGLE_LABELS) as EstimateSettingsToggleKey[];

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const meta = ESTIMATE_SETTINGS_TOGGLE_LABELS[key];
        const checked = settings[key] ?? DEFAULT_ESTIMATE_PAGE_SETTINGS[key];
        const inputId = `${idPrefix}-${key}`;

        return (
          <label
            key={key}
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5"
          >
            <input
              id={inputId}
              type="checkbox"
              checked={checked}
              disabled={disabled || saving}
              onChange={(event) => onToggle(key, event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{meta.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{meta.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function TemplatesStructureSettingsShell({
  graph,
  viewModel,
  structureBusy,
  structureError,
  contentSaveBlocked,
  catalogItems,
  onAddSection,
  onMoveSection,
  onSaveTemplateEstimateSettings,
  onSaveOptionEstimateSettings,
  onAddCatalogItemToSection,
  onRelinkTemplateItem,
}: TemplatesStructureSettingsShellProps) {
  const structureDisabled = isStructureDisabled(structureBusy, contentSaveBlocked);
  const templateSettings = useMemo(
    () => readEstimatePageSettingsFromTemplate(graph.template),
    [graph.template]
  );

  const templateSettingsSaving = structureBusy?.kind === "settings-template";

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-structure-settings-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="templates-structure-settings-heading"
            className="text-base font-semibold text-slate-900"
          >
            Structure &amp; estimate settings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Package option layout and estimate display for{" "}
            <span className="font-medium text-slate-800">{viewModel.templateName}</span>.
          </p>
        </div>
        <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-800 ring-1 ring-cyan-200">
          Master template
        </span>
      </div>

      <div className={TEMPLATES_LOCKED_BANNER} role="status">
        <p className="text-sm font-medium text-slate-800">
          Template structure controls future proposal drafts
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Reorder and add sections per package option. Link Catalog items into line-item and upgrade
          sections — Catalog remains the source of truth for pricing and quantity drivers. Existing
          job proposal drafts keep snapshotted values until you refresh draft pricing. Remove section
          is blocked until safe delete semantics are approved. Estimate display settings control line
          visibility, totals, and headings — not pricing or margin.
        </p>
      </div>

      {contentSaveBlocked ? (
        <p className="mt-3 text-xs text-amber-800" role="status">
          Structure and settings are paused while content is saving.
        </p>
      ) : null}

      {structureError ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {structureError}
        </p>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Template structure</h3>
        <p className="mt-1 text-xs text-slate-500">
          Sections are scoped per package option. Reorder within the same option only.
        </p>

        {viewModel.optionGroups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No sections found for this template yet.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {viewModel.optionGroups.map((group) => {
              const addingForThisOption =
                structureBusy?.kind === "add" && structureBusy.optionId === group.optionId;

              return (
                <div key={group.optionId} className={TEMPLATES_OPTION_GROUP}>
                  <div className="border-b border-slate-200/80 px-4 py-3">
                    <h4 className="text-sm font-semibold text-slate-900">{group.optionLabel}</h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.sections.length} section{group.sections.length === 1 ? "" : "s"} ·
                      reorder within this option only
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.sections.map((section, sectionIndex) => {
                      const sectionItems = graph.items.filter(
                        (item) => item.section_id === section.sectionId
                      );
                      const catalogItemsBusy =
                        (structureBusy?.kind === "add-item" &&
                          structureBusy.sectionId === section.sectionId) ||
                        (structureBusy?.kind === "relink-item" &&
                          sectionItems.some((item) => item.id === structureBusy.itemId));

                      return (
                        <TemplatesStructureSectionRow
                          key={section.sectionId}
                          section={section}
                          sectionIndex={sectionIndex}
                          sectionCount={group.sections.length}
                          removeState={describeRemoveSectionState(graph, section.sectionId)}
                          isMoving={
                            structureBusy?.kind === "move" &&
                            structureBusy.sectionId === section.sectionId
                          }
                          structureDisabled={structureDisabled}
                          onMoveUp={() => onMoveSection(group.optionId, section.sectionId, "up")}
                          onMoveDown={() =>
                            onMoveSection(group.optionId, section.sectionId, "down")
                          }
                          sectionItems={sectionItems}
                          catalogItems={catalogItems}
                          catalogItemsBusy={catalogItemsBusy}
                          onAddFromCatalog={() =>
                            onAddCatalogItemToSection(group.optionId, section.sectionId)
                          }
                          onRelinkCatalogItem={onRelinkTemplateItem}
                        />
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
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6">
        <h3 className="text-sm font-semibold text-slate-900">Estimate display settings</h3>
        <p className="mt-1 text-xs text-slate-500">
          Controls how estimate pages render for future drafts. Does not change company pricing
          policy or margin math.
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Template-wide defaults</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Applied to all package options unless overridden per option below.
          </p>
          <div className="mt-3">
            <EstimateSettingsToggles
              idPrefix="template-estimate"
              settings={templateSettings}
              disabled={structureDisabled}
              saving={templateSettingsSaving}
              onToggle={(key, nextValue) =>
                onSaveTemplateEstimateSettings({ [key]: nextValue })
              }
            />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {viewModel.optionGroups.map((group) => {
            const resolved = resolveEstimatePageSettingsForOption(graph, group.optionId);
            const optionSaving =
              structureBusy?.kind === "settings-option" &&
              structureBusy.optionId === group.optionId;

            return (
              <div
                key={`settings-${group.optionId}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="text-sm font-semibold text-slate-900">{group.optionLabel}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Per-option override saved on the estimate (line items) section metadata.
                </p>
                <div className="mt-3">
                  <EstimateSettingsToggles
                    idPrefix={`option-estimate-${group.optionId}`}
                    settings={resolved}
                    disabled={structureDisabled}
                    saving={optionSaving}
                    onToggle={(key, nextValue) =>
                      onSaveOptionEstimateSettings(group.optionId, { [key]: nextValue })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
