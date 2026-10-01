"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";
import {
  PERSON_CHOICE_SEARCH_THRESHOLD,
  filterPersonChoices,
  moveChoice,
  personInitials,
  tabStopKey,
  type PersonChoiceKey,
  type PersonChoiceOption,
} from "@/app/lib/personChoice";

export type { PersonChoiceOption } from "@/app/lib/personChoice";

const ROW =
  "flex w-full min-h-[56px] items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const ROW_IDLE = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
const ROW_SELECTED = "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500";
const ROW_DISABLED = "cursor-not-allowed border-slate-200 bg-slate-50/70";

const MOVE_KEYS = new Set<string>(["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"]);

type PersonChoiceListProps = {
  /** Accessible name of the group, e.g. "Coordinator". */
  label: string;
  describedBy?: string;
  options: readonly PersonChoiceOption[];
  value: string | null;
  onChange: (key: string) => void;
  disabled?: boolean;
  /** Prefix for data attributes on rows, e.g. "coordinator" -> data-coordinator-option. */
  name: string;
};

/**
 * Choose one person. Radio semantics with a single Tab stop, arrow/Home/End movement,
 * and Space to select. Choosing never saves; the caller confirms.
 */
export default function PersonChoiceList({
  label,
  describedBy,
  options,
  value,
  onChange,
  disabled = false,
  name,
}: PersonChoiceListProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const searchable = options.filter((option) => !option.none).length > PERSON_CHOICE_SEARCH_THRESHOLD;
  const visible = searchable ? filterPersonChoices(options, query) : [...options];
  const tabStop = tabStopKey(visible, value);

  const select = (key: string) => {
    if (disabled) return;
    onChange(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key === " ") {
      event.preventDefault();
      select(key);
      return;
    }
    if (!MOVE_KEYS.has(event.key)) return;
    event.preventDefault();
    const next = moveChoice(visible, key, event.key as PersonChoiceKey);
    if (!next) return;
    select(next);
    rowRefs.current.get(next)?.focus();
  };

  return (
    <div data-person-choice={name}>
      {searchable ? (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor={searchId} className="sr-only">
            Search people
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            autoComplete="off"
            className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            data-person-choice-search
          />
        </div>
      ) : null}
      <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="space-y-2">
        {visible.map((option) => {
          const selected = option.key === value;
          const rowClass = option.disabled ? ROW_DISABLED : selected ? ROW_SELECTED : ROW_IDLE;
          return (
            <button
              key={option.key}
              ref={(node) => {
                if (node) rowRefs.current.set(option.key, node);
                else rowRefs.current.delete(option.key);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={option.disabled || disabled || undefined}
              tabIndex={option.key === tabStop ? 0 : -1}
              className={`${ROW} ${rowClass}`}
              onClick={() => (option.disabled ? undefined : select(option.key))}
              onKeyDown={(event) => onKeyDown(event, option.key)}
              data-person-choice-option={option.none ? "none" : option.key}
              data-person-choice-current={option.current ? "true" : undefined}
            >
              {option.none ? (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"
                  aria-hidden
                >
                  <span className="block h-px w-3 bg-current" />
                </span>
              ) : (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    option.disabled ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden
                >
                  {personInitials(option.label)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className={`text-sm [overflow-wrap:anywhere] ${
                      option.disabled
                        ? "font-medium text-slate-500"
                        : option.none
                          ? "font-medium text-slate-700"
                          : "font-semibold text-slate-900"
                    }`}
                  >
                    {option.label}
                  </span>
                  {option.current ? (
                    <span
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      data-person-choice-current-tag
                    >
                      Current
                    </span>
                  ) : null}
                </span>
                {option.hint ? (
                  <span className="block text-xs text-slate-500 [overflow-wrap:anywhere]">{option.hint}</span>
                ) : null}
              </span>
              {selected && !option.disabled ? (
                <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
              ) : null}
            </button>
          );
        })}
        {searchable && visible.every((option) => option.none) ? (
          <p className="px-1 pt-1 text-sm text-slate-500" data-person-choice-no-match>
            No one matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : null}
      </div>
    </div>
  );
}
