/**
 * R11b — FieldDive Settings load/save orchestration (single path).
 *
 * Core identity → public.companies (companyProfile.ts)
 * Extended branding → public.company_branding_profiles (companyBrandingProfileStore.ts)
 *
 * Settings never treats localStorage cache fallback as DB truth.
 */

import {
  mergeCompanyBrandingProfile,
  normalizeCompanyBrandingProfile,
  buildCompanyBrandingViewModel,
  brandingProfileToCompanyProfile,
  type CompanyBrandingProfile,
  type CompanyBrandingViewModel,
} from "@/app/lib/companyBrandingProfile";
import {
  getCompanyBrandingProfileResult,
  upsertCompanyBrandingProfile,
  type CompanyBrandingExtendedFields,
  type CompanyBrandingProfileLoadStatus,
} from "@/app/lib/companyBrandingProfileStore";
import {
  getCurrentCompanyId,
  loadCompanyProfileResultFromSupabase,
  saveCompanyProfileToSupabase,
  writeCompanyProfileCache,
  type CompanyProfileLoadStatus,
} from "@/app/lib/companyProfile";
import {
  buildBrandingSaveSplit,
  buildNormalizationSaveNotice,
  detectBrandingNormalizationStrippedFields,
  isSettingsLoadSucceeded,
  resolveBrandingLoadWarning,
  resolveSettingsLoadGate,
  SETTINGS_AUTH_NOT_READY_MESSAGE,
  shouldUpdateCompanyProfileCacheAfterSave,
  type CompanyBrandingSaveOutcome,
  type SettingsLoadGate,
} from "@/app/tools/settings/settingsCompanyBrandingUtils";

export type LoadSettingsCompanyBrandingResult = {
  /** True only when core + extended were loaded from DB and save is allowed. */
  loadSucceeded: boolean;
  /** DB-truth profile — null when load did not succeed (do not use as form truth). */
  profile: CompanyBrandingProfile | null;
  viewModel: CompanyBrandingViewModel | null;
  companyId: string | null;
  loadError: string | null;
  loadWarning: string | null;
  loadGate: SettingsLoadGate;
  coreStatus: CompanyProfileLoadStatus;
  brandingStatus: CompanyBrandingProfileLoadStatus;
  coreFromDatabase: boolean;
  brandingFromDatabase: boolean;
};

async function loadExtendedBrandingForSettings(companyId: string): Promise<{
  fields: CompanyBrandingExtendedFields | null;
  brandingStatus: CompanyBrandingProfileLoadStatus;
  bootstrapAttempted: boolean;
  bootstrapSucceeded: boolean;
  fromDatabase: boolean;
}> {
  const brandingResult = await getCompanyBrandingProfileResult(companyId);

  if (brandingResult.status === "success" && brandingResult.fields) {
    return {
      fields: brandingResult.fields,
      brandingStatus: brandingResult.status,
      bootstrapAttempted: false,
      bootstrapSucceeded: false,
      fromDatabase: true,
    };
  }

  if (brandingResult.status === "missing_row" && brandingResult.canEnsureEmptyRow) {
    const bootstrapped = await upsertCompanyBrandingProfile(companyId, {});
    return {
      fields: bootstrapped,
      brandingStatus: bootstrapped ? "success" : "read_error",
      bootstrapAttempted: true,
      bootstrapSucceeded: bootstrapped != null,
      fromDatabase: bootstrapped != null,
    };
  }

  return {
    fields: null,
    brandingStatus: brandingResult.status,
    bootstrapAttempted: false,
    bootstrapSucceeded: false,
    fromDatabase: false,
  };
}

function buildLoadResult(input: {
  profile: CompanyBrandingProfile | null;
  companyId: string | null;
  loadError: string | null;
  loadWarning: string | null;
  loadGate: SettingsLoadGate;
  coreStatus: CompanyProfileLoadStatus;
  brandingStatus: CompanyBrandingProfileLoadStatus;
  coreFromDatabase: boolean;
  brandingFromDatabase: boolean;
}): LoadSettingsCompanyBrandingResult {
  const loadSucceeded = isSettingsLoadSucceeded({
    coreFromDatabase: input.coreFromDatabase,
    brandingFromDatabase: input.brandingFromDatabase,
    loadGate: input.loadGate,
  });

  return {
    loadSucceeded,
    profile: loadSucceeded ? input.profile : null,
    viewModel: loadSucceeded && input.profile ? buildCompanyBrandingViewModel(input.profile) : null,
    companyId: input.companyId,
    loadError: input.loadError,
    loadWarning: input.loadWarning,
    loadGate: input.loadGate,
    coreStatus: input.coreStatus,
    brandingStatus: input.brandingStatus,
    coreFromDatabase: input.coreFromDatabase,
    brandingFromDatabase: input.brandingFromDatabase,
  };
}

export async function loadSettingsCompanyBrandingProfile(): Promise<LoadSettingsCompanyBrandingResult> {
  const coreResult = await loadCompanyProfileResultFromSupabase({ dbTruthOnly: true });
  const companyId = await getCurrentCompanyId();

  const preliminaryGate = resolveSettingsLoadGate({
    coreStatus: coreResult.status,
    brandingStatus: "read_error",
    companyId,
  });

  if (!companyId || coreResult.status === "no_user" || !coreResult.canUseForSave) {
    return buildLoadResult({
      profile: null,
      companyId,
      loadError: preliminaryGate.loadError,
      loadWarning: preliminaryGate.authPending ? SETTINGS_AUTH_NOT_READY_MESSAGE : null,
      loadGate: preliminaryGate,
      coreStatus: coreResult.status,
      brandingStatus: "read_error",
      coreFromDatabase: false,
      brandingFromDatabase: false,
    });
  }

  const extendedLoad = await loadExtendedBrandingForSettings(companyId);
  const loadGate = resolveSettingsLoadGate({
    coreStatus: coreResult.status,
    brandingStatus: extendedLoad.brandingStatus,
    companyId,
  });
  const loadWarning = resolveBrandingLoadWarning({
    brandingStatus: extendedLoad.brandingStatus,
    bootstrapAttempted: extendedLoad.bootstrapAttempted,
    bootstrapSucceeded: extendedLoad.bootstrapSucceeded,
  });

  const profile =
    extendedLoad.fields != null
      ? mergeCompanyBrandingProfile(coreResult.profile, extendedLoad.fields)
      : null;

  return buildLoadResult({
    profile,
    companyId,
    loadError: loadGate.loadError,
    loadWarning,
    loadGate,
    coreStatus: coreResult.status,
    brandingStatus: extendedLoad.brandingStatus,
    coreFromDatabase: coreResult.fromDatabase,
    brandingFromDatabase: extendedLoad.fromDatabase,
  });
}

export type SaveSettingsCompanyBrandingResult = CompanyBrandingSaveOutcome & {
  profile: CompanyBrandingProfile | null;
  loadGate: SettingsLoadGate | null;
};

export type SaveSettingsCompanyBrandingOptions = {
  loadGate: SettingsLoadGate;
};

export async function saveSettingsCompanyBrandingProfile(
  draft: Partial<CompanyBrandingProfile>,
  options: SaveSettingsCompanyBrandingOptions
): Promise<SaveSettingsCompanyBrandingResult> {
  if (options.loadGate.saveBlocked) {
    return {
      coreSaved: false,
      brandingSaved: false,
      saveBlocked: true,
      reloadSucceeded: false,
      profile: null,
      loadGate: options.loadGate,
    };
  }

  const normalized = normalizeCompanyBrandingProfile(draft);
  const strippedFields = detectBrandingNormalizationStrippedFields(draft, normalized);
  const normalizationNotice = buildNormalizationSaveNotice(strippedFields);
  const companyId = await getCurrentCompanyId();

  if (!companyId) {
    return {
      coreSaved: false,
      brandingSaved: false,
      companyIdMissing: true,
      reloadSucceeded: false,
      profile: null,
      loadGate: options.loadGate,
    };
  }

  const { persistableProfile, deferredFields } = buildBrandingSaveSplit(normalized);

  const coreSaved = await saveCompanyProfileToSupabase(persistableProfile, {
    updateCache: false,
  });

  if (!coreSaved) {
    return {
      coreSaved: false,
      brandingSaved: false,
      reloadSucceeded: false,
      profile: null,
      loadGate: options.loadGate,
    };
  }

  const brandingResult = await upsertCompanyBrandingProfile(companyId, deferredFields);
  const brandingSaved = brandingResult != null;

  if (!brandingSaved) {
    return {
      coreSaved: true,
      brandingSaved: false,
      reloadSucceeded: false,
      profile: null,
      loadGate: options.loadGate,
    };
  }

  const reloaded = await loadSettingsCompanyBrandingProfile();
  const reloadSucceeded = reloaded.loadSucceeded;

  const outcome: CompanyBrandingSaveOutcome = {
    coreSaved,
    brandingSaved,
    reloadSucceeded,
    normalizationNotice,
  };

  if (shouldUpdateCompanyProfileCacheAfterSave(outcome) && reloaded.profile) {
    writeCompanyProfileCache(brandingProfileToCompanyProfile(reloaded.profile));
  }

  return {
    ...outcome,
    profile: reloaded.loadSucceeded ? reloaded.profile : null,
    loadGate: reloaded.loadSucceeded ? reloaded.loadGate : options.loadGate,
  };
}

/** Retry load when auth session was not ready on first client mount. */
export function shouldRetrySettingsLoad(result: LoadSettingsCompanyBrandingResult): boolean {
  return result.loadGate.authPending || result.coreStatus === "no_user";
}
