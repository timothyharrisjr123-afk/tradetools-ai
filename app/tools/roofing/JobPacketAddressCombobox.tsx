"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  movePlacesActiveIndex,
  type PlacesAssistStatus,
  type PlacesResolvedSelection,
  type PlacesSuggestion,
} from "@/app/tools/roofing/usePlacesAddressAssist";

type Props = {
  value: string;
  suggestions: PlacesSuggestion[];
  status: PlacesAssistStatus;
  manualMode: boolean;
  selectedAddress: PlacesResolvedSelection | null;
  onValueChange: (value: string) => void;
  onValueBlur: (value: string) => void;
  onSelect: (suggestion: PlacesSuggestion) => Promise<void>;
  onManual: () => void;
  onSearch: () => void;
  onChangeSelected: () => void;
  onClear: () => void;
};

export function JobPacketAddressCombobox({
  value,
  suggestions,
  status,
  manualMode,
  selectedAddress,
  onValueChange,
  onValueBlur,
  onSelect,
  onManual,
  onSearch,
  onChangeSelected,
  onClear,
}: Props) {
  const reactId = useId().replace(/:/g, "");
  const inputId = "job-address";
  const listboxId = `job-address-options-${reactId}`;
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  const eligible = value.trim().length >= 3;
  const showPanel = !manualMode && !selectedAddress && focused && !dismissed && eligible;
  const showOptions = showPanel && suggestions.length > 0;
  const expanded = showPanel && (suggestions.length > 0 || status !== "idle");

  useEffect(() => {
    if (activeIndex >= suggestions.length) setActiveIndex(suggestions.length ? 0 : -1);
  }, [activeIndex, suggestions.length]);

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  async function selectSuggestion(suggestion: PlacesSuggestion) {
    if (resolving) return;
    setResolving(true);
    setDismissed(true);
    try {
      await onSelect(suggestion);
    } finally {
      setResolving(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    }
  }

  function runAndRefocus(action: () => void) {
    action();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && suggestions.length) {
      event.preventDefault();
      setDismissed(false);
      setActiveIndex((current) =>
        movePlacesActiveIndex(
          current,
          suggestions.length,
          event.key as "ArrowDown" | "ArrowUp" | "Home" | "End"
        )
      );
      return;
    }
    if (event.key === "Enter" && showOptions && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
    } else if (event.key === "Tab") {
      setDismissed(true);
      setActiveIndex(-1);
    }
  }

  if (selectedAddress) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/55 px-3 py-2.5" data-testid="selected-address">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Selected property address</p>
            <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-slate-900">{selectedAddress.address.formatted}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => runAndRefocus(onChangeSelected)} className="min-h-11 px-1 text-[11px] font-semibold text-sky-700">Change</button>
            <button type="button" onClick={() => runAndRefocus(onClear)} className="min-h-11 px-1 text-[11px] font-medium text-slate-600">Clear</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block text-[13px] font-medium text-slate-700">
        {manualMode ? "Street address" : "Property address"}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        name="job_address1_field"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={showOptions && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => { setDismissed(false); setActiveIndex(-1); onValueChange(event.target.value); }}
        onFocus={() => { setFocused(true); setDismissed(false); }}
        onBlur={(event) => { setFocused(false); onValueBlur(event.target.value); }}
        onKeyDown={handleKeyDown}
        placeholder={manualMode ? "Street address" : "Start typing a property address"}
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-[13px] font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
      />

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" data-testid="address-suggestions-panel">
          {showOptions ? (
            <ul id={listboxId} role="listbox" aria-label="Address suggestions" className="max-h-64 overflow-y-auto overscroll-contain py-1" data-testid="address-suggestions">
              {suggestions.map((suggestion, index) => (
                <li
                  ref={(node) => { optionRefs.current[index] = node; }}
                  id={`${listboxId}-${index}`}
                  key={suggestion.placeId}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void selectSuggestion(suggestion)}
                  className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 text-left outline-none ${activeIndex === index ? "bg-sky-50" : "hover:bg-slate-50"}`}
                >
                  <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-slate-900">{suggestion.primaryText}</span>
                  {suggestion.secondaryText ? <span className="line-clamp-2 text-[11px] leading-snug text-slate-500">{suggestion.secondaryText}</span> : null}
                </li>
              ))}
            </ul>
          ) : status === "ready" ? (
            <div className="px-3 py-3">
              <p className="text-[12px] font-medium text-slate-700">No matching addresses</p>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runAndRefocus(onManual)} className="mt-1 min-h-11 text-[11.5px] font-semibold text-sky-700">Enter address manually</button>
            </div>
          ) : status === "unavailable" ? (
            <div className="px-3 py-3">
              <p className="text-[12px] leading-snug text-slate-600">Address suggestions are unavailable. Enter the address manually.</p>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runAndRefocus(onManual)} className="mt-1 min-h-11 text-[11.5px] font-semibold text-sky-700">Enter address manually</button>
            </div>
          ) : null}
          <div className="flex min-h-8 items-center justify-between gap-3 border-t border-slate-100 px-3 py-1.5">
            <span className="text-[10.5px] text-slate-500">{status === "loading" || resolving ? "Finding addresses…" : ""}</span>
            <span translate="no" aria-label="Powered by Google Maps" className="whitespace-nowrap text-xs font-normal text-[#5E5E5E]">Google Maps</span>
          </div>
        </div>
      ) : null}

      <div className="mt-1 flex min-h-8 items-center justify-between gap-3">
        <span aria-live="polite" className="sr-only">
          {status === "loading" ? "Finding addresses" : status === "unavailable" ? "Address suggestions unavailable" : status === "ready" && eligible && suggestions.length === 0 ? "No matching addresses" : ""}
        </span>
        <button type="button" onClick={() => runAndRefocus(manualMode ? onSearch : onManual)} className="min-h-8 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline">
          {manualMode ? "Search addresses" : "Enter address manually"}
        </button>
        {value ? <button type="button" onClick={() => runAndRefocus(onClear)} className="min-h-8 text-[11px] font-medium text-slate-500 hover:text-slate-800">Clear</button> : null}
      </div>
    </div>
  );
}
