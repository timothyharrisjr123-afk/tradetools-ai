/**
 * R11b — Pure helpers for Settings company branding UI/persistence.
 *
 * No React, no Supabase, no I/O. Split-save orchestration and readiness copy live
 * here so the client component stays thin.
 */

import type { CompanyProfile, CompanyProfileLoadStatus } from "@/app/lib/companyProfile";
import type { CompanyBrandingProfileLoadStatus } from "@/app/lib/companyBrandingProfileStore";
import {
  COMPANY_BRANDING_DEFERRED_FIELD_KEYS,
  COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS,
  buildCompanyBrandingViewModel,
  splitBrandingProfileForPersistence,
  type CompanyBrandingDeferredFieldKey,
  type CompanyBrandingProfile,
  type CompanyBrandingViewModel,
} from "@/app/lib/companyBrandingProfile";

export const SETTINGS_BRANDING_PAGE_INTRO =
  "Company identity and customer-facing branding for proposals. Pricing stays under Settings → Pricing. Terms, warranty, and scope content stay in Templates. Builder preview rendering comes later — saving here does not change live proposal layouts yet.";

export const SETTINGS_BRANDING_PRICING_NOTE =
  "Profitability, tax, and pricing math remain in Company Pricing Policy — not on this page.";

export const SETTINGS_BRANDING_TEMPLATES_NOTE =
  "Terms, warranty, and scope wording remain in Templates — not here.";

export const SETTINGS_CORE_LOAD_FAILED_ERROR =
  "Company profile could not be loaded. Refresh or sign in again before saving.";

export const SETTINGS_BRANDING_LOAD_FAILED_ERROR =
  "Branding profile could not be prepared. Settings were not saved.";

export const SETTINGS_BRANDING_ENSURE_FAILED_WARNING =
  "Could not prepare your company branding profile row. Core settings loaded; branding fields may not save until you refresh or sign in again.";

export const SETTINGS_BRANDING_BOOTSTRAP_FAILED_WARNING =
  "Branding profile row could not be created. Extended fields may not save until you refresh or sign in again.";

export const SETTINGS_AUTH_NOT_READY_MESSAGE =
  "Waiting for sign-in session… If this persists, refresh or sign in again.";

export const SETTINGS_SAVE_RELOAD_FAILED_WARNING =
  "Saved, but could not confirm reload. Refresh before editing further.";

/** Empty draft defaults for Settings form state (no normalization). */
export function createEmptyCompanyBrandingDraft(): CompanyBrandingProfile {
  return {
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
}

/**
 * Merge user edits into draft form state without trim/website/color normalization.
 * Normalization belongs on save via `normalizeCompanyBrandingProfile`.
 */
export function mergeCompanyBrandingDraftProfile(
  prev: CompanyBrandingProfile,
  patch: Partial<CompanyBrandingProfile>
): CompanyBrandingProfile {
  return {
    ...prev,
    ...patch,
  };
}

/** Non-fatal warning when branding row bootstrap/read fails despite valid company scope. */
export function resolveBrandingLoadWarning(input: {
  brandingStatus: CompanyBrandingProfileLoadStatus;
  bootstrapAttempted: boolean;
  bootstrapSucceeded: boolean;
}): string | null {
  if (input.brandingStatus === "read_error" || input.brandingStatus === "client_unavailable") {
    return SETTINGS_BRANDING_LOAD_FAILED_ERROR;
  }
  if (input.brandingStatus === "invalid_company_id") {
    return SETTINGS_BRANDING_ENSURE_FAILED_WARNING;
  }
  if (input.bootstrapAttempted && !input.bootstrapSucceeded) {
    return SETTINGS_BRANDING_BOOTSTRAP_FAILED_WARNING;
  }
  return null;
}

/** @deprecated Use resolveBrandingLoadWarning with structured load status. */
export function resolveBrandingEnsureLoadWarning(
  companyId: string | null,
  extendedLoaded: unknown
): string | null {
  if (!companyId) return null;
  if (extendedLoaded === null) {
    return SETTINGS_BRANDING_ENSURE_FAILED_WARNING;
  }
  return null;
}

export type SettingsLoadGateInput = {
  coreStatus: CompanyProfileLoadStatus;
  brandingStatus: CompanyBrandingProfileLoadStatus;
  companyId: string | null;
};

export type SettingsLoadGate = {
  saveBlocked: boolean;
  saveBlockedReason: string | null;
  loadError: string | null;
  authPending: boolean;
};

export function resolveSettingsLoadGate(input: SettingsLoadGateInput): SettingsLoadGate {
  if (input.coreStatus === "no_user") {
    return {
      saveBlocked: true,
      saveBlockedReason: SETTINGS_AUTH_NOT_READY_MESSAGE,
      loadError: null,
      authPending: true,
    };
  }

  if (!input.companyId || input.coreStatus === "no_company_id") {
    return {
      saveBlocked: true,
      saveBlockedReason: SETTINGS_CORE_LOAD_FAILED_ERROR,
      loadError: SETTINGS_CORE_LOAD_FAILED_ERROR,
      authPending: false,
    };
  }

  if (
    input.coreStatus === "select_error" ||
    input.coreStatus === "no_row" ||
    input.coreStatus === "client_unavailable" ||
    input.coreStatus === "exception"
  ) {
    return {
      saveBlocked: true,
      saveBlockedReason: SETTINGS_CORE_LOAD_FAILED_ERROR,
      loadError: SETTINGS_CORE_LOAD_FAILED_ERROR,
      authPending: false,
    };
  }

  if (
    input.brandingStatus === "read_error" ||
    input.brandingStatus === "client_unavailable" ||
    input.brandingStatus === "invalid_company_id"
  ) {
    return {
      saveBlocked: true,
      saveBlockedReason: SETTINGS_BRANDING_LOAD_FAILED_ERROR,
      loadError: SETTINGS_BRANDING_LOAD_FAILED_ERROR,
      authPending: false,
    };
  }

  return {
    saveBlocked: false,
    saveBlockedReason: null,
    loadError: null,
    authPending: false,
  };
}

export function canSaveCompanyBrandingSettings(gate: SettingsLoadGate): boolean {
  return !gate.saveBlocked;
}

/** True when both core and extended fields were read from DB and save is allowed. */
export function isSettingsLoadSucceeded(input: {
  coreFromDatabase: boolean;
  brandingFromDatabase: boolean;
  loadGate: SettingsLoadGate;
}): boolean {
  return (
    input.coreFromDatabase &&
    input.brandingFromDatabase &&
    !input.loadGate.saveBlocked &&
    !input.loadGate.authPending
  );
}

/** Replace draft from load only when DB-truth load succeeded with a profile payload. */
export function isRegressiveDraftReplacement(
  current: CompanyBrandingProfile,
  next: CompanyBrandingProfile
): boolean {
  const stringKeys: (keyof CompanyBrandingProfile)[] = [
    "companyName",
    "email",
    "phone",
    "license",
    "logoDataUrl",
    "notificationsEmail",
    "address",
    "website",
    "brandPrimaryColor",
    "brandSecondaryColor",
  ];

  for (const key of stringKeys) {
    const cur = String(current[key] ?? "").trim();
    const nxt = String(next[key] ?? "").trim();
    if (cur.length > 0 && nxt.length === 0) {
      return true;
    }
  }

  if (current.showLicenseOnCover && !next.showLicenseOnCover) {
    return true;
  }

  return false;
}

export function shouldReplaceDraftFromLoad(
  result: {
    loadSucceeded: boolean;
    profile: CompanyBrandingProfile | null;
  },
  currentDraft?: CompanyBrandingProfile | null
): boolean {
  if (result.loadSucceeded !== true || result.profile == null) {
    return false;
  }

  if (currentDraft == null) {
    return true;
  }

  return !isRegressiveDraftReplacement(currentDraft, result.profile);
}

export type DraftAfterSaveResult = {
  draft: CompanyBrandingProfile;
  replaceDraft: boolean;
  blockSaveUntilRefresh: boolean;
};

/**
 * After save: replace draft only when DB reload succeeded.
 * Keep visible draft on save/reload failure — never clear the form.
 */
export function resolveDraftAfterSave(
  currentDraft: CompanyBrandingProfile,
  outcome: CompanyBrandingSaveOutcome,
  reloadedProfile: CompanyBrandingProfile | null
): DraftAfterSaveResult {
  if (outcome.saveBlocked) {
    return { draft: currentDraft, replaceDraft: false, blockSaveUntilRefresh: false };
  }

  if (
    outcome.coreSaved &&
    outcome.brandingSaved &&
    outcome.reloadSucceeded === true &&
    reloadedProfile != null &&
    !isRegressiveDraftReplacement(currentDraft, reloadedProfile)
  ) {
    return {
      draft: reloadedProfile,
      replaceDraft: true,
      blockSaveUntilRefresh: false,
    };
  }

  const blockSaveUntilRefresh =
    outcome.coreSaved === true &&
    outcome.brandingSaved === true &&
    outcome.reloadSucceeded === false;

  return {
    draft: currentDraft,
    replaceDraft: false,
    blockSaveUntilRefresh,
  };
}

export type CompanyBrandingSaveSplit = {
  persistableProfile: CompanyProfile;
  deferredFields: Pick<CompanyBrandingProfile, CompanyBrandingDeferredFieldKey>;
};

/** Map full form state into core (`companies`) vs extended (`company_branding_profiles`). */
export function buildBrandingSaveSplit(
  input: Partial<CompanyBrandingProfile>
): CompanyBrandingSaveSplit {
  const { persistableProfile, deferredFields } = splitBrandingProfileForPersistence(input);
  return { persistableProfile, deferredFields };
}

export type CompanyBrandingSaveOutcome = {
  coreSaved: boolean;
  brandingSaved: boolean;
  companyIdMissing?: boolean;
  saveBlocked?: boolean;
  reloadSucceeded?: boolean;
  normalizationNotice?: string | null;
};

/** localStorage cache updates only when both persistence paths succeed and reload confirms DB truth. */
export function shouldUpdateCompanyProfileCacheAfterSave(
  outcome: CompanyBrandingSaveOutcome
): boolean {
  return (
    outcome.coreSaved === true &&
    outcome.brandingSaved === true &&
    outcome.reloadSucceeded === true
  );
}

export type CompanyBrandingSaveMessage = {
  tone: "success" | "error" | "idle";
  message: string | null;
};

export function resolveCompanyBrandingSaveMessage(
  outcome: CompanyBrandingSaveOutcome
): CompanyBrandingSaveMessage {
  if (outcome.saveBlocked) {
    return {
      tone: "error",
      message: SETTINGS_CORE_LOAD_FAILED_ERROR,
    };
  }
  if (outcome.companyIdMissing) {
    return {
      tone: "error",
      message:
        "Could not determine your company. Sign in again or contact support before saving branding.",
    };
  }
  if (outcome.coreSaved && outcome.brandingSaved && outcome.reloadSucceeded) {
    return {
      tone: "success",
      message: outcome.normalizationNotice
        ? `Company identity and branding saved. ${outcome.normalizationNotice}`
        : "Company identity and branding saved.",
    };
  }
  if (outcome.coreSaved && outcome.brandingSaved && outcome.reloadSucceeded === false) {
    return {
      tone: "error",
      message: SETTINGS_SAVE_RELOAD_FAILED_WARNING,
    };
  }
  if (outcome.coreSaved && !outcome.brandingSaved) {
    return {
      tone: "error",
      message:
        "Core company profile saved, but branding fields failed to save. Refresh and try again — do not assume branding persisted.",
    };
  }
  if (!outcome.coreSaved && outcome.brandingSaved) {
    return {
      tone: "error",
      message:
        "Branding fields saved, but core company profile failed. Refresh and verify company identity fields.",
    };
  }
  return {
    tone: "error",
    message: "Save failed. Check your connection and try again.",
  };
}

/** Detect fields cleared by save-time normalization for user-visible notice. */
export function detectBrandingNormalizationStrippedFields(
  draft: Partial<CompanyBrandingProfile>,
  normalized: CompanyBrandingProfile
): string[] {
  const stripped: string[] = [];
  const draftWebsite = typeof draft.website === "string" ? draft.website.trim() : "";
  if (draftWebsite && !normalized.website) {
    stripped.push("website");
  }
  const draftPrimary =
    typeof draft.brandPrimaryColor === "string" ? draft.brandPrimaryColor.trim() : "";
  if (draftPrimary && !normalized.brandPrimaryColor) {
    stripped.push("primary color");
  }
  const draftSecondary =
    typeof draft.brandSecondaryColor === "string" ? draft.brandSecondaryColor.trim() : "";
  if (draftSecondary && !normalized.brandSecondaryColor) {
    stripped.push("secondary color");
  }
  return stripped;
}

export function buildNormalizationSaveNotice(strippedFields: string[]): string | null {
  if (strippedFields.length === 0) return null;
  return `Some values were normalized on save: ${strippedFields.join(", ")}.`;
}

export function buildCompanyBrandingViewModelFromForm(
  input: Partial<CompanyBrandingProfile>
): CompanyBrandingViewModel {
  return buildCompanyBrandingViewModel(input);
}

/** Recommended/optional fields with unsatisfied readiness messages for inline hints. */
export function getUnsatisfiedBrandingFieldMessages(
  viewModel: CompanyBrandingViewModel
): string[] {
  return viewModel.readiness.fields
    .filter((field) => !field.satisfied && field.message)
    .map((field) => field.message as string);
}

export function getBrandingReadinessSummary(viewModel: CompanyBrandingViewModel): string {
  return viewModel.readiness.summaryMessage;
}

export type BrandingPayloadSeparationCheck = {
  coreKeys: readonly string[];
  extendedKeys: readonly string[];
  pricingKeysAbsent: boolean;
};

/** Guardrail: branding split must not include pricing-policy fields. */
export function verifyBrandingPayloadSeparation(
  split: CompanyBrandingSaveSplit
): BrandingPayloadSeparationCheck {
  const pricingLikeKeys = [
    "profitabilityType",
    "defaultProfitabilityPct",
    "salesTaxRatePct",
    "minimumProfitabilityPct",
  ];
  const coreRecord = split.persistableProfile as Record<string, unknown>;
  const extendedRecord = split.deferredFields as Record<string, unknown>;
  const allKeys = [...Object.keys(coreRecord), ...Object.keys(extendedRecord)];
  const pricingKeysAbsent = !allKeys.some((key) => pricingLikeKeys.includes(key));

  return {
    coreKeys: COMPANY_BRANDING_PERSISTABLE_FIELD_KEYS,
    extendedKeys: COMPANY_BRANDING_DEFERRED_FIELD_KEYS,
    pricingKeysAbsent,
  };
}
