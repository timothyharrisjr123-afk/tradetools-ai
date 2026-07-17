"use client";

import { useMemo, useState } from "react";
import {
  readEstimatePageSettingsFromTemplate,
  resolveEstimatePageSettingsForOption,
} from "@/app/lib/proposalTemplateEstimateSettings";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { TemplateStructureEditorViewModel } from "@/app/lib/proposalTemplateStructureEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD } from "./templatesConstants";
import TemplatesEstimateSettingsToggles from "./TemplatesEstimateSettingsToggles";
import type { EstimateSettingsToggleKey } from "./templatesStructureEditorUtils";

type StructureSettingsBusy =
  | { kind: "settings-template" }
  | { kind: "settings-option"; optionId: string }
  | { kind: string; [key: string]: unknown }
  | null;

type TemplatesEstimateDisplayTabProps = {
  graph: ProposalTemplateGraph;
  viewModel: TemplateStructureEditorViewModel;
  structureBusy: StructureSettingsBusy;
  contentSaveBlocked: boolean;
  onSaveTemplateEstimateSettings: (patch: Partial<ProposalPageSettings>) => void;
  onSaveOptionEstimateSettings: (
    optionId: string,
    patch: Partial<ProposalPageSettings>
  ) => void;
};

export default function TemplatesEstimateDisplayTab({
  graph,
  viewModel,
  structureBusy,
  contentSaveBlocked,
  onSaveTemplateEstimateSettings,
  onSaveOptionEstimateSettings,
}: TemplatesEstimateDisplayTabProps) {
  const disabled = structureBusy != null || contentSaveBlocked;
  const templateSettings = useMemo(
    () => readEstimatePageSettingsFromTemplate(graph.template),
    [graph.template]
  );
  const templateSettingsSaving = structureBusy?.kind === "settings-template";
  const [openOverrideId, setOpenOverrideId] = useState<string | null>(null);

  return (
    <section
      className={TEMPLATES_CARD}
      aria-labelledby="templates-estimate-display-heading"
      data-templates-estimate-tab
    >
      <h2
        id="templates-estimate-display-heading"
        className="text-sm font-semibold text-slate-900"
      >
        Estimate display
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Controls what customers see in future proposal drafts. Does not change pricing or margin
        math.
      </p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Template-wide defaults</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Applied to all package options unless you open an override below.
        </p>
        <div className="mt-3">
          <TemplatesEstimateSettingsToggles
            idPrefix="template-estimate"
            settings={templateSettings}
            disabled={disabled}
            saving={templateSettingsSaving}
            onToggle={(key: EstimateSettingsToggleKey, nextValue) =>
              onSaveTemplateEstimateSettings({ [key]: nextValue })
            }
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Package option overrides
        </p>
        {viewModel.optionGroups.map((group) => {
          const resolved = resolveEstimatePageSettingsForOption(graph, group.optionId);
          const optionSaving =
            structureBusy?.kind === "settings-option" &&
            structureBusy.optionId === group.optionId;
          const open = openOverrideId === group.optionId;

          return (
            <div
              key={`settings-${group.optionId}`}
              className="rounded-lg border border-slate-200 bg-white"
              data-templates-estimate-option={group.optionId}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() =>
                  setOpenOverrideId((current) =>
                    current === group.optionId ? null : group.optionId
                  )
                }
                aria-expanded={open}
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {group.optionLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Optional override for this package option
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {open ? "Hide" : "Edit"}
                </span>
              </button>
              {open ? (
                <div className="border-t border-slate-100 px-4 py-3">
                  <TemplatesEstimateSettingsToggles
                    idPrefix={`option-estimate-${group.optionId}`}
                    settings={resolved}
                    disabled={disabled}
                    saving={optionSaving}
                    onToggle={(key: EstimateSettingsToggleKey, nextValue) =>
                      onSaveOptionEstimateSettings(group.optionId, { [key]: nextValue })
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
