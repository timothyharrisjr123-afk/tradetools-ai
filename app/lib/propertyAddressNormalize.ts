/**
 * Wave C — Property address normalization for matching.
 * Must stay aligned with public.normalize_property_address_v1 (064).
 * Display values stay contractor-facing; comparison uses these helpers.
 */

export type PropertyAddressParts = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  formatted?: string | null;
};

const TOKEN_MAP: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  blvd: "boulevard",
  rd: "road",
  dr: "drive",
  ln: "lane",
  ct: "court",
  cir: "circle",
  hwy: "highway",
  pkwy: "parkway",
  pl: "place",
  ter: "terrace",
  terr: "terrace",
};

export function normalizePropertyToken(token: string): string {
  const raw = String(token ?? "").trim().toLowerCase();
  return TOKEN_MAP[raw] ?? raw;
}

export function normalizePropertyLine(input: string | null | undefined): string {
  const cleaned = String(input ?? "")
    .toLowerCase()
    .replace(/[.,#'"]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((part) => normalizePropertyToken(part).replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .join(" ");
}

export function normalizePropertyZip(input: string | null | undefined): string {
  return String(input ?? "").replace(/[^0-9]/g, "").slice(0, 5);
}

/**
 * Canonical matching key: line1|line2|city|state|zip5
 * Empty when the street is not street-like (needs a letter and a digit).
 */
export function normalizePropertyAddress(parts: PropertyAddressParts): string {
  const line1 = normalizePropertyLine(parts.line1 || parts.formatted);
  const line2 = normalizePropertyLine(parts.line2);
  const city = normalizePropertyLine(parts.city);
  const state = normalizePropertyLine(parts.state);
  const zip5 = normalizePropertyZip(parts.zip);
  if (!line1) return "";
  if (!/[a-z]/.test(line1) || !/[0-9]/.test(line1)) return "";
  return `${line1}|${line2}|${city}|${state}|${zip5}`;
}

export function propertyAddressIsMatchable(parts: PropertyAddressParts): boolean {
  return normalizePropertyAddress(parts).length > 0;
}

export function formatPropertyDisplayAddress(parts: PropertyAddressParts): string {
  const formatted = String(parts.formatted ?? "").trim();
  if (formatted) return formatted;
  return [
    String(parts.line1 ?? "").trim(),
    [String(parts.city ?? "").trim(), String(parts.state ?? "").trim()].filter(Boolean).join(", "),
    String(parts.zip ?? "").trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildCustomerWorkspaceHref(customerId: string): string {
  return `/tools/roofing/customers/${encodeURIComponent(customerId)}`;
}

export function buildPropertyWorkspaceHref(propertyId: string): string {
  return `/tools/roofing/properties/${encodeURIComponent(propertyId)}`;
}
