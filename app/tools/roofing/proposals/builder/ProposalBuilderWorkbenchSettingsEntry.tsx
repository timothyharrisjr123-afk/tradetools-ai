import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { WorkbenchDisplaySettingsEntry } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { DEFAULT_ESTIMATE_PAGE_SETTINGS } from "@/app/lib/proposalTemplateEstimateSettings";
import {
  ESTIMATE_SETTINGS_TOGGLE_LABELS,
  type EstimateSettingsToggleKey,
} from "@/app/tools/roofing/templates/templatesStructureEditorUtils";

type ProposalBuilderWorkbenchSettingsEntryProps = {
  entry: WorkbenchDisplaySettingsEntry;
  saving?: boolean;
  error?: string | null;
  onToggleSetting?: (key: EstimateSettingsToggleKey, nextValue: boolean) => void;
};

function EditableSettingToggle({
  settingKey,
  settings,
  disabled,
  onToggle,
}: {
  settingKey: EstimateSettingsToggleKey;
  settings: ProposalPageSettings;
  disabled: boolean;
  onToggle: (key: EstimateSettingsToggleKey, nextValue: boolean) => void;
}) {
  const meta = ESTIMATE_SETTINGS_TOGGLE_LABELS[settingKey];
  const checked = settings[settingKey] ?? DEFAULT_ESTIMATE_PAGE_SETTINGS[settingKey];
  const inputId = `workbench-estimate-${settingKey}`;

  return (
    <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2 py-1.5">
      <input
        id={inputId}
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(event) => onToggle(settingKey, event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-800">{meta.label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
          {meta.description}
        </span>
      </span>
    </label>
  );
}

/**
 * Block 4B — compact Display disclosure. Not a large card above Included estimate.
 */
export default function ProposalBuilderWorkbenchSettingsEntry({
  entry,
  saving = false,
  error = null,
  onToggleSetting,
}: ProposalBuilderWorkbenchSettingsEntryProps) {
  if (!entry.visible) return null;

  const settings = entry.currentSettings;
  const toggleKeys = Object.keys(ESTIMATE_SETTINGS_TOGGLE_LABELS) as EstimateSettingsToggleKey[];

  return (
    <details
      className="group rounded-lg border border-slate-200/70 bg-white"
      data-builder-display-settings
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Display
          {saving ? <span className="text-[10px] text-slate-400">Saving…</span> : null}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[11px] leading-snug text-slate-500">
          {entry.enabled ? entry.helpCopy : entry.lockedCopy}
        </p>
        {entry.enabled && settings && onToggleSetting ? (
          <div className="space-y-0.5">
            {toggleKeys.map((key) => (
              <EditableSettingToggle
                key={key}
                settingKey={key}
                settings={settings}
                disabled={saving}
                onToggle={onToggleSetting}
              />
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-[12px] text-rose-700">{error}</p> : null}
      </div>
    </details>
  );
}
