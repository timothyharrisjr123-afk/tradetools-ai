/**
 * Wave B — safe customer candidate ranking (no auto-merge).
 */

import {
  normalizeCustomerEmail,
  normalizePersonName,
  personNameTokens,
  phoneDigitsForMatch,
} from "./customerIdentityNormalize";

export const CUSTOMER_SEARCH_RESULT_LIMIT = 8;
export const CUSTOMER_SEARCH_MIN_QUERY_LENGTH = 2;
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 280;

export type CustomerMatchSignal = "exact_email" | "exact_phone" | "name";

export type CustomerSearchCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  signals: CustomerMatchSignal[];
};

export type CustomerSearchRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type CustomerSearchQuery = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Free text used when field-specific values are empty. */
  q?: string | null;
};

export function customerSearchQueryIsActive(input: CustomerSearchQuery): boolean {
  const email = normalizeCustomerEmail(input.email);
  const phone = phoneDigitsForMatch(input.phone);
  const name = normalizePersonName(input.name);
  const q = String(input.q ?? "").trim();
  if (email) return true;
  if (phone) return true;
  if (name.length >= CUSTOMER_SEARCH_MIN_QUERY_LENGTH) return true;
  return q.length >= CUSTOMER_SEARCH_MIN_QUERY_LENGTH;
}

export function buildCustomerSearchRpcQuery(input: CustomerSearchQuery): string {
  const phone = phoneDigitsForMatch(input.phone);
  if (phone) return phone;
  const email = normalizeCustomerEmail(input.email);
  if (email && email.includes("@") && email.includes(".")) return email;
  const name = normalizePersonName(input.name);
  if (name.length >= CUSTOMER_SEARCH_MIN_QUERY_LENGTH) return name;
  const qEmail = normalizeCustomerEmail(input.q);
  if (qEmail && qEmail.includes("@")) return qEmail;
  const qPhone = phoneDigitsForMatch(input.q);
  if (qPhone) return qPhone;
  return String(input.q ?? "").trim();
}

function scoreAndSignals(
  row: CustomerSearchRow,
  input: CustomerSearchQuery
): { score: number; signals: CustomerMatchSignal[] } | null {
  const signals: CustomerMatchSignal[] = [];
  let score = 0;

  const qEmail = normalizeCustomerEmail(input.email) ?? normalizeCustomerEmail(input.q);
  const rowEmail = normalizeCustomerEmail(row.email);
  if (qEmail && rowEmail && qEmail === rowEmail) {
    signals.push("exact_email");
    score += 100;
  }

  const qPhone = phoneDigitsForMatch(input.phone) ?? phoneDigitsForMatch(input.q);
  const rowPhone = phoneDigitsForMatch(row.phone);
  if (qPhone && rowPhone && (rowPhone.includes(qPhone) || qPhone.includes(rowPhone))) {
    signals.push("exact_phone");
    score += 80;
  }

  const qName = normalizePersonName(input.name) || normalizePersonName(input.q);
  const rowName = normalizePersonName(row.name);
  if (qName.length >= 2 && rowName) {
    const qTokens = personNameTokens(qName);
    const rowLower = rowName.toLowerCase();
    const tokenHit =
      qTokens.length > 0 && qTokens.every((t) => rowLower.includes(t));
    const substringHit = rowLower.includes(qName.toLowerCase()) || qName.toLowerCase().includes(rowLower);
    if (tokenHit || substringHit) {
      signals.push("name");
      score += tokenHit && qTokens.length >= 2 ? 40 : 25;
    }
  }

  if (signals.length === 0) return null;
  return { score, signals };
}

/**
 * Rank already company-scoped rows. Never auto-merges.
 * Name-only matches are candidates only (never treated as identity proof alone upstream).
 */
export function rankCustomerSearchCandidates(
  rows: CustomerSearchRow[],
  input: CustomerSearchQuery
): CustomerSearchCandidate[] {
  const out: Array<CustomerSearchCandidate & { score: number }> = [];
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    const ranked = scoreAndSignals(row, input);
    if (!ranked) continue;
    out.push({
      id,
      name: normalizePersonName(row.name) || "Customer",
      email: row.email ? String(row.email).trim() || null : null,
      phone: row.phone ? String(row.phone).trim() || null : null,
      signals: ranked.signals,
      score: ranked.score,
    });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return out.slice(0, CUSTOMER_SEARCH_RESULT_LIMIT).map(({ score: _s, ...rest }) => rest);
}

export function parseCustomerSearchApiPayload(json: unknown): CustomerSearchCandidate[] {
  if (!json || typeof json !== "object") return [];
  const customers = (json as { customers?: unknown }).customers;
  if (!Array.isArray(customers)) return [];
  const out: CustomerSearchCandidate[] = [];
  for (const item of customers) {
    if (!item || typeof item !== "object") continue;
    const row = item as CustomerSearchCandidate;
    if (!row.id) continue;
    out.push({
      id: String(row.id),
      name: String(row.name ?? "Customer"),
      email: row.email == null || row.email === "" ? null : String(row.email),
      phone: row.phone == null || row.phone === "" ? null : String(row.phone),
      signals: Array.isArray(row.signals)
        ? (row.signals.filter((s) =>
            s === "exact_email" || s === "exact_phone" || s === "name"
          ) as CustomerMatchSignal[])
        : [],
    });
  }
  return out.slice(0, CUSTOMER_SEARCH_RESULT_LIMIT);
}
