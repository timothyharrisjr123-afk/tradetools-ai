/**
 * Composition role/slot identity helpers (V2E2A1).
 *
 * Catalog owns default composition_role.
 * Template item owns reusable role + authoritative composition_slot_key.
 * Proposal lines copy both at create and must preserve them on refresh/freeze.
 *
 * Runtime matching must not parse seed strings. The starter tables below are an
 * explicit reviewed map for install/backfill/tests — not a generic parser.
 */

export const COMPOSITION_ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;
export const COMPOSITION_SLOT_KEY_SLUG_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

export type CompositionGroup = "included" | "optional";

/** Original 13 starter Catalog seeds backfilled by migration 036. */
export const ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES: Readonly<Record<string, string>> = {
  "roofing.architectural_shingles": "roof_covering",
  "roofing.synthetic_underlayment": "underlayment",
  "roofing.starter_strip": "starter",
  "roofing.ridge_cap": "ridge_cap",
  "roofing.drip_edge": "drip_edge",
  "roofing.ice_water_valley": "ice_water",
  "roofing.pipe_boot": "pipe_boot",
  "roofing.roof_vent": "ventilation",
  "roofing.step_flashing": "step_flashing",
  "roofing.install_labor": "install_labor",
  "roofing.tear_off_labor": "tear_off",
  "roofing.disposal": "disposal",
  "roofing.permit_admin_fee": "permit",
};

/** Reviewed starter Catalog seed_key → composition_role. Not a generic parser. */
export const STARTER_CATALOG_COMPOSITION_ROLES: Readonly<Record<string, string>> = {
  ...ORIGINAL_STARTER_CATALOG_COMPOSITION_ROLES,
  "roofing.designer_shingles": "roof_covering",
  "roofing.premium_synthetic_underlayment": "underlayment",
  "roofing.ice_water_eaves": "ice_water",
};

/** Contractor-facing family labels. Never show the slug. */
export const COMPOSITION_ROLE_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  roof_covering: "Roof covering",
  underlayment: "Underlayment",
  starter: "Starter",
  ridge_cap: "Ridge cap",
  drip_edge: "Drip edge",
  ice_water: "Ice and water protection",
  pipe_boot: "Pipe boot",
  ventilation: "Ventilation",
  step_flashing: "Step flashing",
  install_labor: "Install labor",
  tear_off: "Tear-off",
  disposal: "Disposal",
  permit: "Permit",
};

export function compositionRoleDisplayLabel(role: string | null | undefined): string {
  const normalized = normalizeCompositionRole(role);
  if (!normalized) return "Other products";
  return COMPOSITION_ROLE_DISPLAY_LABELS[normalized] ?? "Other products";
}

export type StarterCompositionIdentity = {
  compositionRole: string;
  compositionSlotKey: string;
};

function normSlug(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCompositionRole(
  value: string | null | undefined
): string | null {
  const normalized = normSlug(value);
  if (!normalized) return null;
  return COMPOSITION_ROLE_SLUG_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeCompositionSlotKey(
  value: string | null | undefined
): string | null {
  const normalized = normSlug(value);
  if (!normalized) return null;
  return COMPOSITION_SLOT_KEY_SLUG_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Explicit starter Template/draft slot for a known seed + included/optional group.
 * Optional extra vent is the only reviewed same-seed exception.
 */
export function resolveStarterCompositionIdentity(
  seedKey: string | null | undefined,
  group: CompositionGroup
): StarterCompositionIdentity | null {
  const seed = normSlug(seedKey);
  if (!seed) return null;
  const compositionRole = STARTER_CATALOG_COMPOSITION_ROLES[seed];
  if (!compositionRole) return null;

  if (seed === "roofing.ice_water_valley") {
    return { compositionRole, compositionSlotKey: "ice_water.valleys" };
  }
  if (seed === "roofing.ice_water_eaves") {
    return { compositionRole, compositionSlotKey: "ice_water.eaves" };
  }
  if (seed === "roofing.roof_vent" && group === "optional") {
    return { compositionRole, compositionSlotKey: "ventilation.additional" };
  }
  return { compositionRole, compositionSlotKey: compositionRole };
}

export function compositionGroupFromItemRole(
  itemRole: string | null | undefined
): CompositionGroup {
  const role = String(itemRole ?? "").trim().toLowerCase();
  return role === "upgrade" || role === "optional_addon" ? "optional" : "included";
}

/**
 * Future multi-instance slot when the same role already exists in an option/group.
 * Generate once, persist, never regenerate on Replace. Not user-visible.
 */
export function generateCompositionInstanceSlotKey(compositionRole: string): string {
  const role = normalizeCompositionRole(compositionRole);
  if (!role) {
    throw new Error("generateCompositionInstanceSlotKey requires a valid composition_role");
  }
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("generateCompositionInstanceSlotKey requires globalThis.crypto.randomUUID");
  }
  const suffix = globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${role}.${suffix}`;
}
