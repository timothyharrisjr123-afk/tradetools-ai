/**
 * Pure rules for choosing one person from a list (radio semantics). Shared by the
 * PersonChoiceList primitive; no React here so the rules are testable directly.
 */

export type PersonChoiceOption = {
  /** Stable key: a user id, or a caller-defined key for the "no one" option. */
  key: string;
  /** Person display name only. Never a role, access profile, or title. */
  label: string;
  /** The value saved today. */
  current?: boolean;
  disabled?: boolean;
  /** Quiet second line, e.g. why a row can't be chosen. */
  hint?: string | null;
  /** The deliberate "no one" option (Unassigned). */
  none?: boolean;
};

/** Lists longer than this get a search field. */
export const PERSON_CHOICE_SEARCH_THRESHOLD = 8;

export function personInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** The "no one" option always stays; people match on any part of their name. */
export function filterPersonChoices<T extends PersonChoiceOption>(
  options: readonly T[],
  query: string
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...options];
  return options.filter((option) => option.none || option.label.toLocaleLowerCase().includes(needle));
}

export type PersonChoiceKey = "ArrowDown" | "ArrowRight" | "ArrowUp" | "ArrowLeft" | "Home" | "End";

/** Radio-group movement over enabled options, wrapping at the ends. */
export function moveChoice(
  options: readonly PersonChoiceOption[],
  fromKey: string | null,
  key: PersonChoiceKey
): string | null {
  const enabled = options.filter((option) => !option.disabled);
  if (enabled.length === 0) return null;
  if (key === "Home") return enabled[0].key;
  if (key === "End") return enabled[enabled.length - 1].key;
  const at = enabled.findIndex((option) => option.key === fromKey);
  const step = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
  if (at < 0) return step > 0 ? enabled[0].key : enabled[enabled.length - 1].key;
  return enabled[(at + step + enabled.length) % enabled.length].key;
}

/** The one option that takes Tab focus: the selection, else the first enabled option. */
export function tabStopKey(options: readonly PersonChoiceOption[], value: string | null): string | null {
  const selected = options.find((option) => option.key === value && !option.disabled);
  if (selected) return selected.key;
  return options.find((option) => !option.disabled)?.key ?? null;
}
