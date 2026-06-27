/**
 * R11a/R11b — Pure company branding/profile foundation.
 *
 * Persistence model (Option B):
 * - Core identity on `public.companies` via `companyProfile.ts`:
 *   name, owner_email, phone, license, logo_url, notifications_email
 * - Extended branding on `public.company_branding_profiles` via
 *   `companyBrandingProfileStore.ts` (one row per company).
 * - Row `metadata` jsonb holds future branding-only extensions (flat keys).
 */

import type { CompanyProfile } from "@/app/lib/companyProfile";

/**
 * Legacy nested key used by Option A helpers/tests only.
 * Option B stores typed fields on `company_branding_profiles` columns; future
 * extensions use flat keys on `company_branding_profiles.metadata`.
 */
export const COMPANY_BRANDING_METADATA_KEY = "branding";

/** Repo-verified DB-backed identity columns on `companies`. */
export const COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS = [
  "companyName",
  "email",
  "phone",
  "license",
  "logoDataUrl",
  "notificationsEmail",
] as const;

export type CompanyBrandingPersistableFieldKey =
  (typeof COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS)[number];

/** Extended branding fields persisted on `company_branding_profiles`. */
export const COMPANY_BRANDING_DEFERRED_FIELD_KEYS = [
  "address",
  "website",
  "brandPrimaryColor",
  "brandSecondaryColor",
  "showLicenseOnCover",
] as const;

export type CompanyBrandingDeferredFieldKey =
  (typeof COMPANY_BRANDING_DEFERRED_FIELD_KEYS)[number];

export type CompanyBrandingProfile = {
  companyName: string;
  email: string;
  phone: string;
  license: string;
  logoDataUrl: string;
  notificationsEmail: string;
  address: string;
  website: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  showLicenseOnCover: boolean;
};

const DEFAULTS: CompanyBrandingProfile = {
  companyName: "",
  phone: "",
  email: "",
  license: "",
  logoDataUrl: "",
  notificationsEmail: "",
  address: "",
  website: "",
  brandPrimaryColor: "",
  brandSecondaryColor: "",
  showLicenseOnCover: false,
};

export type CompanyBrandingPersistenceCapability = {
  /** True when repo has verified column and/or metadata strategy for all fields. */
  canPersistExtendedBrandingToDatabase: boolean;
  persistableFieldKeys: readonly CompanyBrandingPersistableFieldKey[];
  deferredFieldKeys: readonly CompanyBrandingDeferredFieldKey[];
  deferredReason: string;
};

export type CompanyBrandingFieldTier = "required" | "recommended" | "optional";

export type CompanyBrandingFieldReadiness = {
  key: keyof CompanyBrandingProfile;
  label: string;
  tier: CompanyBrandingFieldTier;
  satisfied: boolean;
  message: string | null;
};

export type CompanyBrandingReadinessLevel = "ready" | "usable" | "incomplete";

export type CompanyBrandingReadiness = {
  level: CompanyBrandingReadinessLevel;
  fields: CompanyBrandingFieldReadiness[];
  summaryMessage: string;
};

export type CompanyBrandingViewModel = {
  profile: CompanyBrandingProfile;
  readiness: CompanyBrandingReadiness;
  persistence: CompanyBrandingPersistenceCapability;
};

export type ProposalContextEchoCompanyFields = {
  company_name: string | null;
  company_logo_url: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_license: string | null;
  company_address: string | null;
  company_website: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  show_license_on_cover: boolean;
};

export type BrandingMetadataPayload = {
  address?: string;
  website?: string;
  brand_primary_color?: string;
  brand_secondary_color?: string;
  show_license_on_cover?: boolean;
};

export type SplitBrandingProfileForPersistenceResult = {
  persistableProfile: CompanyProfile;
  deferredFields: Pick<
    CompanyBrandingProfile,
    CompanyBrandingDeferredFieldKey
  >;
  hasDeferredValues: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTrimmedString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

/**
 * Light URL-ish normalization — does not fetch or fully validate hosts.
 * Empty input stays empty. Bare domains gain https:// prefix.
 */
export function normalizeWebsiteField(value: unknown): string {
  const trimmed = normalizeTrimmedString(value);
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return trimmed;
  }

  // Reject obvious non-URL tokens without a dot (e.g. "mycompany").
  if (!trimmed.includes(".")) {
    return "";
  }

  return `https://${trimmed}`;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandShortHex(hex: string): string {
  if (hex.length === 3) {
    return hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return hex;
}

/** Normalize optional brand color to lowercase #rrggbb, or empty when invalid. */
export function normalizeBrandColorHex(value: unknown): string {
  const trimmed = normalizeTrimmedString(value);
  if (!trimmed) return "";

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(withHash)) {
    return "";
  }

  const body = withHash.slice(1);
  const expanded = expandShortHex(body).toLowerCase();
  return `#${expanded}`;
}

export function normalizeShowLicenseOnCover(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return DEFAULTS.showLicenseOnCover;
}

export function normalizeCompanyBrandingProfile(
  input: Partial<CompanyBrandingProfile>
): CompanyBrandingProfile {
  return {
    companyName: normalizeTrimmedString(input.companyName, DEFAULTS.companyName),
    phone: normalizeTrimmedString(input.phone, DEFAULTS.phone),
    email: normalizeTrimmedString(input.email, DEFAULTS.email),
    license: normalizeTrimmedString(input.license, DEFAULTS.license),
    logoDataUrl: normalizeTrimmedString(input.logoDataUrl, DEFAULTS.logoDataUrl),
    notificationsEmail: normalizeTrimmedString(
      input.notificationsEmail,
      DEFAULTS.notificationsEmail
    ),
    address: normalizeTrimmedString(input.address, DEFAULTS.address),
    website: normalizeWebsiteField(input.website),
    brandPrimaryColor: normalizeBrandColorHex(input.brandPrimaryColor),
    brandSecondaryColor: normalizeBrandColorHex(input.brandSecondaryColor),
    showLicenseOnCover: normalizeShowLicenseOnCover(input.showLicenseOnCover),
  };
}

export function companyProfileToBrandingProfile(
  profile: Partial<CompanyProfile>
): CompanyBrandingProfile {
  return normalizeCompanyBrandingProfile({
    companyName: profile.companyName,
    phone: profile.phone,
    email: profile.email,
    license: profile.license,
    logoDataUrl: profile.logoDataUrl,
    notificationsEmail: profile.notificationsEmail,
    address: "",
    website: "",
    brandPrimaryColor: "",
    brandSecondaryColor: "",
    showLicenseOnCover: false,
  });
}

export function brandingProfileToCompanyProfile(
  profile: CompanyBrandingProfile
): CompanyProfile {
  const normalized = normalizeCompanyBrandingProfile(profile);
  return {
    companyName: normalized.companyName,
    phone: normalized.phone,
    email: normalized.email,
    license: normalized.license,
    logoDataUrl: normalized.logoDataUrl,
    notificationsEmail: normalized.notificationsEmail,
  };
}

export function deriveCompanyBrandingPersistenceCapability(): CompanyBrandingPersistenceCapability {
  return {
    canPersistExtendedBrandingToDatabase: true,
    persistableFieldKeys: COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS,
    deferredFieldKeys: COMPANY_BRANDING_DEFERRED_FIELD_KEYS,
    deferredReason:
      "Core identity persists on public.companies. Extended branding persists on public.company_branding_profiles (migration 20260617_008). Runtime writes succeed only after migration is applied.",
  };
}

/** Compose full branding profile from core company fields + extended branding row. */
export function mergeCompanyBrandingProfile(
  core: Partial<CompanyProfile>,
  extended: Partial<Pick<CompanyBrandingProfile, CompanyBrandingDeferredFieldKey>> = {}
): CompanyBrandingProfile {
  const normalizedExtended = normalizeCompanyBrandingProfile({
    address: extended.address,
    website: extended.website,
    brandPrimaryColor: extended.brandPrimaryColor,
    brandSecondaryColor: extended.brandSecondaryColor,
    showLicenseOnCover: extended.showLicenseOnCover,
  });
  const deferredOnly = deferredFieldsFromProfile(normalizedExtended);

  return normalizeCompanyBrandingProfile({
    ...companyProfileToBrandingProfile(core),
    ...deferredOnly,
  });
}

function deferredFieldsFromProfile(
  profile: CompanyBrandingProfile
): Pick<CompanyBrandingProfile, CompanyBrandingDeferredFieldKey> {
  return {
    address: profile.address,
    website: profile.website,
    brandPrimaryColor: profile.brandPrimaryColor,
    brandSecondaryColor: profile.brandSecondaryColor,
    showLicenseOnCover: profile.showLicenseOnCover,
  };
}

function hasNonDefaultDeferredValues(
  deferred: Pick<CompanyBrandingProfile, CompanyBrandingDeferredFieldKey>
): boolean {
  return (
    deferred.address.length > 0 ||
    deferred.website.length > 0 ||
    deferred.brandPrimaryColor.length > 0 ||
    deferred.brandSecondaryColor.length > 0 ||
    deferred.showLicenseOnCover === true
  );
}

/**
 * Splits a branding profile into core fields (`companies`) vs extended fields
 * (`company_branding_profiles`). Never duplicates core fields into the branding table.
 */
export function splitBrandingProfileForPersistence(
  input: Partial<CompanyBrandingProfile>
): SplitBrandingProfileForPersistenceResult {
  const profile = normalizeCompanyBrandingProfile(input);
  const deferredFields = deferredFieldsFromProfile(profile);
  return {
    persistableProfile: brandingProfileToCompanyProfile(profile),
    deferredFields,
    hasDeferredValues: hasNonDefaultDeferredValues(deferredFields),
  };
}

export function parseBrandingFromCompanyMetadata(
  metadata: unknown
): Partial<CompanyBrandingProfile> {
  if (!isPlainObject(metadata)) return {};

  const raw = metadata[COMPANY_BRANDING_METADATA_KEY];
  if (!isPlainObject(raw)) return {};

  return normalizeCompanyBrandingProfile({
    address: typeof raw.address === "string" ? raw.address : undefined,
    website: typeof raw.website === "string" ? raw.website : undefined,
    brandPrimaryColor:
      typeof raw.brand_primary_color === "string" ? raw.brand_primary_color : undefined,
    brandSecondaryColor:
      typeof raw.brand_secondary_color === "string" ? raw.brand_secondary_color : undefined,
    showLicenseOnCover: normalizeShowLicenseOnCover(raw.show_license_on_cover),
  });
}

/**
 * Legacy Option A nested-metadata patch helper (tests/back-compat).
 * Option B uses typed columns on `company_branding_profiles`; use
 * `mergeBrandingRowMetadata` in the store for flat row metadata.
 */
export function buildBrandingMetadataPatch(
  existingMetadata: unknown,
  branding: Partial<CompanyBrandingProfile>
): Record<string, unknown> {
  const base = isPlainObject(existingMetadata) ? { ...existingMetadata } : {};
  const normalized = normalizeCompanyBrandingProfile(branding);

  const payload: BrandingMetadataPayload = {
    address: normalized.address || undefined,
    website: normalized.website || undefined,
    brand_primary_color: normalized.brandPrimaryColor || undefined,
    brand_secondary_color: normalized.brandSecondaryColor || undefined,
    show_license_on_cover: normalized.showLicenseOnCover ? true : undefined,
  };

  const brandingObject: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      brandingObject[key] = value;
    }
  }

  if (Object.keys(brandingObject).length === 0) {
    const next = { ...base };
    delete next[COMPANY_BRANDING_METADATA_KEY];
    return next;
  }

  return {
    ...base,
    [COMPANY_BRANDING_METADATA_KEY]: brandingObject,
  };
}

function isFieldSatisfied(
  profile: CompanyBrandingProfile,
  key: keyof CompanyBrandingProfile
): boolean {
  const value = profile[key];
  if (typeof value === "boolean") {
    return value;
  }
  return typeof value === "string" && value.length > 0;
}

const READINESS_FIELD_DEFS: ReadonlyArray<{
  key: keyof CompanyBrandingProfile;
  label: string;
  tier: CompanyBrandingFieldTier;
  unsatisfiedMessage: string;
}> = [
  {
    key: "companyName",
    label: "Company name",
    tier: "required",
    unsatisfiedMessage: "Add your company name so proposals show who customers are hiring.",
  },
  {
    key: "email",
    label: "Business email",
    tier: "recommended",
    unsatisfiedMessage: "Add a business email for customer-facing documents and notifications.",
  },
  {
    key: "phone",
    label: "Phone",
    tier: "recommended",
    unsatisfiedMessage: "Add a phone number customers can reach you at.",
  },
  {
    key: "address",
    label: "Business address",
    tier: "recommended",
    unsatisfiedMessage: "Add your business address for proposal cover identity.",
  },
  {
    key: "license",
    label: "License number",
    tier: "recommended",
    unsatisfiedMessage: "Add your contractor license number when you want it on proposals.",
  },
  {
    key: "logoDataUrl",
    label: "Logo",
    tier: "optional",
    unsatisfiedMessage: "Upload a logo to strengthen proposal branding.",
  },
  {
    key: "website",
    label: "Website",
    tier: "optional",
    unsatisfiedMessage: "Add your company website for cover and contact blocks.",
  },
  {
    key: "brandPrimaryColor",
    label: "Primary brand color",
    tier: "optional",
    unsatisfiedMessage: "Set a primary brand color for future proposal theming.",
  },
  {
    key: "brandSecondaryColor",
    label: "Secondary brand color",
    tier: "optional",
    unsatisfiedMessage: "Set a secondary brand color for future proposal theming.",
  },
  {
    key: "showLicenseOnCover",
    label: "Show license on cover",
    tier: "optional",
    unsatisfiedMessage: "Enable showing your license on the proposal cover when ready.",
  },
];

export function deriveCompanyBrandingReadiness(
  input: Partial<CompanyBrandingProfile>
): CompanyBrandingReadiness {
  const profile = normalizeCompanyBrandingProfile(input);

  const fields: CompanyBrandingFieldReadiness[] = READINESS_FIELD_DEFS.map((def) => {
    const satisfied = isFieldSatisfied(profile, def.key);
    return {
      key: def.key,
      label: def.label,
      tier: def.tier,
      satisfied,
      message: satisfied ? null : def.unsatisfiedMessage,
    };
  });

  const requiredMissing = fields.some((f) => f.tier === "required" && !f.satisfied);
  const recommendedMissing = fields.some(
    (f) => f.tier === "recommended" && !f.satisfied
  );

  let level: CompanyBrandingReadinessLevel;
  let summaryMessage: string;

  if (requiredMissing) {
    level = "incomplete";
    summaryMessage =
      "Add required company identity before proposals can present a complete business profile.";
  } else if (recommendedMissing) {
    level = "usable";
    summaryMessage =
      "Core identity is set. Add recommended contact and address details to strengthen proposal branding.";
  } else {
    level = "ready";
    summaryMessage = "Company branding profile is in good shape for proposal identity.";
  }

  return { level, fields, summaryMessage };
}

export function buildCompanyBrandingViewModel(
  input: Partial<CompanyBrandingProfile>
): CompanyBrandingViewModel {
  const profile = normalizeCompanyBrandingProfile(input);
  return {
    profile,
    readiness: deriveCompanyBrandingReadiness(profile),
    persistence: deriveCompanyBrandingPersistenceCapability(),
  };
}

function echoNullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Maps merged company branding profile to proposal `context_echo` company slice. */
export function mapCompanyBrandingToProposalContextEcho(
  input: Partial<CompanyBrandingProfile> | Partial<CompanyProfile>
): ProposalContextEchoCompanyFields {
  const profile =
    "address" in input || "website" in input || "brandPrimaryColor" in input
      ? normalizeCompanyBrandingProfile(input as Partial<CompanyBrandingProfile>)
      : companyProfileToBrandingProfile(input as Partial<CompanyProfile>);

  return {
    company_name: echoNullableString(profile.companyName),
    company_logo_url: echoNullableString(profile.logoDataUrl),
    company_phone: echoNullableString(profile.phone),
    company_email: echoNullableString(profile.email),
    company_license: echoNullableString(profile.license),
    company_address: echoNullableString(profile.address),
    company_website: echoNullableString(profile.website),
    brand_primary_color: echoNullableString(profile.brandPrimaryColor),
    brand_secondary_color: echoNullableString(profile.brandSecondaryColor),
    show_license_on_cover: profile.showLicenseOnCover,
  };
}

/** Alias for proposal draft stamping — merged profile in, context_echo company slice out. */
export const buildProposalCompanyContextEchoFromProfile =
  mapCompanyBrandingToProposalContextEcho;
