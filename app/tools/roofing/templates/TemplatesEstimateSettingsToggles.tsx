"use client";

import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
} from "@/app/lib/proposalTemplateEstimateSettings";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import {
  ESTIMATE_SETTINGS_TOGGLE_LABELS,
  type EstimateSettingsToggleKey,
} from "./templatesStructureEditorUtils";

type TemplatesEstimateSettingsTogglesProps = {
  settings: ProposalPageSettings;
  disabled: boolean;
  saving: boolean;
  onToggle: (key: EstimateSettingsToggleKey, nextValue: boolean) => void;
  idPrefix: string;
};

export default function TemplatesEstimateSettingsToggles({
  settings,
  disabled,
  saving,
  onToggle,
  idPrefix,
}: TemplatesEstimateSettingsTogglesProps) {
  const keys = Object.keys(ESTIMATE_SETTINGS_TOGGLE_LABELS) as EstimateSettingsToggleKey[];

  return (
    <div className="space-y-3" data-templates-estimate-toggles={idPrefix}>
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
