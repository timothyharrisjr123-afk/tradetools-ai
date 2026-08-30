"use client";

import type { PlacesSuggestion } from "@/app/tools/roofing/usePlacesAddressAssist";

type Props = {
  suggestions: PlacesSuggestion[];
  onSelect: (suggestion: PlacesSuggestion) => void;
};

/** Quiet street-address suggestions. Never a blocking error surface. */
export function JobPacketAddressSuggestions({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <ul
      className="mt-1 space-y-0.5 overflow-hidden rounded-lg border border-slate-200/80 bg-white"
      data-testid="address-suggestions"
      role="listbox"
    >
      {suggestions.map((s) => (
        <li key={s.placeId} role="option">
          <button
            type="button"
            onClick={() => onSelect(s)}
            className="flex min-h-[40px] w-full flex-col items-start px-2.5 py-2 text-left hover:bg-sky-50/50"
          >
            <span className="truncate text-[12.5px] font-medium text-slate-900">{s.primaryText}</span>
            {s.secondaryText ? (
              <span className="truncate text-[11px] text-slate-500">{s.secondaryText}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
