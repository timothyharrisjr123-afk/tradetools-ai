import { Lock, SlidersHorizontal } from "lucide-react";
import type { WorkbenchDisplaySettingsEntry } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_SETTINGS_ENTRY,
  WORKBENCH_SETTINGS_MODULE,
  WORKBENCH_SETTINGS_TOGGLE_STUB,
  WORKBENCH_SETTINGS_TOGGLE_STUB_ON,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchSettingsEntryProps = {
  entry: WorkbenchDisplaySettingsEntry;
};

function SettingStub({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={on ? WORKBENCH_SETTINGS_TOGGLE_STUB_ON : WORKBENCH_SETTINGS_TOGGLE_STUB}>
      {label}
    </span>
  );
}

export default function ProposalBuilderWorkbenchSettingsEntry({
  entry,
}: ProposalBuilderWorkbenchSettingsEntryProps) {
  if (!entry.visible) return null;

  const settings = entry.currentSettings;

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
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <Lock className="h-2.5 w-2.5" aria-hidden />
                  {entry.comingSoonBadge}
                </span>
              </div>
              <p className="mt-0.5 max-w-xl text-[12px] leading-snug text-slate-600">
                Control line prices, totals, and headings on the customer proposal — saved on
                template today.
              </p>
            </div>
          </div>
        </div>

        {settings ? (
          <div className="flex flex-wrap gap-1.5 sm:max-w-[14rem] sm:justify-end">
            <SettingStub label="Line prices" on={settings.show_line_prices === true} />
            <SettingStub label="Totals" on={settings.show_option_totals === true} />
            <SettingStub label="Headings" on={settings.show_section_headings === true} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
