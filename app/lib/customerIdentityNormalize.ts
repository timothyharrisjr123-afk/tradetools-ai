/**
 * Wave B — customer identity normalization for matching.
 * Display values stay contractor-facing; comparison uses these helpers.
 */

export function normalizeCustomerEmail(input: string | null | undefined): string | null {
  const trimmed = String(input ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePhoneDigits(input: string | null | undefined): string {
  return String(input ?? "").replace(/[^0-9]/g, "");
}

/** Digits usable for match when at least 7 digits (local or full). */
export function phoneDigitsForMatch(input: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(input);
  return digits.length >= 7 ? digits : null;
}

export function normalizePersonName(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function personNameTokens(input: string | null | undefined): string[] {
  return normalizePersonName(input)
    .toLowerCase()
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
