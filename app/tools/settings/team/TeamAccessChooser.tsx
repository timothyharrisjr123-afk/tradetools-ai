"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  teamJobReach,
  type TeamAccessPreset,
  type TeamAccessPresetKey,
} from "@/app/lib/access/teamAccessPresentation";

/**
 * Access choice in contractor language: a label and one short phrase each.
 * Office Manager and Lead lead; specialist access waits behind Other access.
 */

function ChoiceRow({
  preset,
  checked,
  current,
  onSelect,
}: {
  preset: TeamAccessPreset;
  checked: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const scoped = preset.role === "field_user";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50"
      }`}
      data-company-settings-team-preset={preset.key}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-[15px] font-medium ${checked ? "text-blue-900" : "text-slate-900"}`}>{preset.label}</span>
          {current ? <span className="text-xs text-slate-500">Current</span> : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{preset.summary}</span>
        {checked && scoped ? (
          <span className="mt-1 block text-[13px] font-medium text-blue-800" data-company-settings-team-preset-reach>
            {teamJobReach(preset.role)}
          </span>
        ) : null}
      </span>
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          checked ? "bg-blue-600 text-white" : "border border-slate-300 bg-white"
        }`}
        aria-hidden
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function TeamAccessChooser({
  choices,
  value,
  currentKey = null,
  onChange,
  label = "Access",
}: {
  choices: readonly TeamAccessPreset[];
  value: TeamAccessPresetKey | "";
  currentKey?: TeamAccessPresetKey | null;
  onChange: (key: TeamAccessPresetKey) => void;
  label?: string;
}) {
  const primary = choices.filter((preset) => preset.primary);
  const other = choices.filter((preset) => !preset.primary);
  const otherHoldsSelection = other.some((preset) => preset.key === value || preset.key === currentKey);
  const [otherOpen, setOtherOpen] = useState(otherHoldsSelection);
  const showOther = otherOpen || otherHoldsSelection;

  return (
    <div data-company-settings-team-access>
      <p className="mb-2 text-[13px] font-medium text-slate-500" id="team-access-label">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby="team-access-label" className="-mx-3 space-y-1">
        {primary.map((preset) => (
          <ChoiceRow
            key={preset.key}
            preset={preset}
            checked={value === preset.key}
            current={currentKey === preset.key}
            onSelect={() => onChange(preset.key)}
          />
        ))}
        {other.length > 0 ? (
          <>
            <button
              type="button"
              className="mt-1 inline-flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-expanded={showOther}
              onClick={() => setOtherOpen((open) => !open)}
              disabled={otherHoldsSelection}
              data-company-settings-team-other-access
            >
              Other access
              <ChevronDown className={`h-4 w-4 transition-transform ${showOther ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {showOther
              ? other.map((preset) => (
                  <ChoiceRow
                    key={preset.key}
                    preset={preset}
                    checked={value === preset.key}
                    current={currentKey === preset.key}
                    onSelect={() => onChange(preset.key)}
                  />
                ))
              : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Additional access beyond the chosen profile. Hidden until someone asks for it. */
export function TeamAdditionalAccess({
  choices,
  selected,
  onToggle,
  startOpen = false,
}: {
  choices: readonly { key: string; label: string }[];
  selected: readonly string[];
  onToggle: (key: string, on: boolean) => void;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen || selected.length > 0);
  if (choices.length === 0) return null;
  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        onClick={() => setOpen(true)}
        data-company-settings-team-add-access
      >
        Add access
      </button>
    );
  }
  return (
    <div role="group" aria-labelledby="team-special-access" data-company-settings-team-special>
      <p id="team-special-access" className="text-[13px] font-medium text-slate-500">
        Additional access
      </p>
      <p className="mt-0.5 text-[13px] text-slate-500">Only if they need more than their access includes.</p>
      <div className="mt-2 space-y-0.5">
        {choices.map((choice) => (
          <label key={choice.key} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-blue-600"
              checked={selected.includes(choice.key)}
              onChange={(event) => onToggle(choice.key, event.target.checked)}
            />
            {choice.label}
          </label>
        ))}
      </div>
    </div>
  );
}
