import { Lock, SlidersHorizontal } from "lucide-react";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { WorkbenchDisplaySettingsEntry } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { DEFAULT_ESTIMATE_PAGE_SETTINGS } from "@/app/lib/proposalTemplateEstimateSettings";
import {
  ESTIMATE_SETTINGS_TOGGLE_LABELS,
  type EstimateSettingsToggleKey,
} from "@/app/tools/roofing/templates/templatesStructureEditorUtils";
import {
  WORKBENCH_SETTINGS_ENTRY,
  WORKBENCH_SETTINGS_MODULE,
  WORKBENCH_SETTINGS_TOGGLE_STUB,
  WORKBENCH_SETTINGS_TOGGLE_STUB_ON,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchSettingsEntryProps = {
  entry: WorkbenchDisplaySettingsEntry;
  saving?: boolean;
  error?: string | null;
  onToggleSetting?: (key: EstimateSettingsToggleKey, nextValue: boolean) => void;
};

function SettingStub({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={on ? WORKBENCH_SETTINGS_TOGGLE_STUB_ON : WORKBENCH_SETTINGS_TOGGLE_STUB}>
      {label}
    </span>
  );
}

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
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2.5"
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(event) => onToggle(settingKey, event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-slate-900">{meta.label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{meta.description}</span>
      </span>
    </label>
  );
}

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
    <section
      className={WORKBENCH_SETTINGS_MODULE}
      aria-labelledby="workbench-display-settings-label"
    >
      <div className={WORKBENCH_SETTINGS_ENTRY}>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 shadow-sm">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  id="workbench-display-settings-label"
                  className="text-sm font-semibold text-slate-900"
                >
                  {entry.label}
                </p>
                {!entry.enabled && entry.comingSoonBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <Lock className="h-2.5 w-2.5" aria-hidden />
                    {entry.comingSoonBadge}
                  </span>
                ) : null}
                {entry.enabled && saving ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Saving…
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 max-w-xl text-[12px] leading-snug text-slate-600">
                {entry.enabled ? entry.helpCopy : entry.lockedCopy}
              </p>
            </div>
          </div>
        </div>

        {settings && !entry.enabled ? (
          <div className="flex flex-wrap gap-1.5 sm:max-w-[14rem] sm:justify-end">
            <SettingStub label="Line prices" on={settings.show_line_prices === true} />
            <SettingStub label="Totals" on={settings.show_option_totals === true} />
            <SettingStub label="Headings" on={settings.show_section_headings === true} />
          </div>
        ) : null}
      </div>

      {entry.enabled && settings && onToggleSetting ? (
        <div className="space-y-2 border-t border-slate-200/60 px-4 py-3.5 sm:px-5">
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

      {error ? (
        <p className="border-t border-rose-100 bg-rose-50/70 px-4 py-2 text-[12px] text-rose-700 sm:px-5">
          {error}
        </p>
      ) : null}
    </section>
  );
}
