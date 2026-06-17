import { getSupabaseClient } from "@/app/lib/supabaseClient";

const STORAGE_KEY = "serviceTools_companyProfile";

/** Try multiple localStorage keys to get company email (for notifyEmail on send). */
export function getCompanyProfileEmailSafe(): string {
  if (typeof window === "undefined") return "";
  const keysToTry = [
    STORAGE_KEY,
    "ttai_companyProfile",
    "ttai_company_profile",
    "companyProfile",
    "ttai_settings_companyProfile",
  ];

  for (const k of keysToTry) {
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const email = (obj?.email ?? obj?.companyEmail ?? "").toString().trim();
      if (email && email.includes("@")) return email;
    } catch {
      // ignore parse errors
    }
  }
  return "";
}

export type CompanyProfile = {
  companyName: string;
  phone: string;
  email: string;
  license: string;
  logoDataUrl: string;
  notificationsEmail?: string;
};

const DEFAULTS: CompanyProfile = {
  companyName: "",
  phone: "",
  email: "",
  license: "",
  logoDataUrl: "",
  notificationsEmail: "",
};

export function normalizeCompanyProfile(input: Partial<CompanyProfile>): CompanyProfile {
  return {
    companyName: typeof input.companyName === "string" ? input.companyName : DEFAULTS.companyName,
    phone: typeof input.phone === "string" ? input.phone : DEFAULTS.phone,
    email: typeof input.email === "string" ? input.email : DEFAULTS.email,
    license: typeof input.license === "string" ? input.license : DEFAULTS.license,
    logoDataUrl: typeof input.logoDataUrl === "string" ? input.logoDataUrl : DEFAULTS.logoDataUrl,
    notificationsEmail: typeof input.notificationsEmail === "string" ? input.notificationsEmail : (DEFAULTS.notificationsEmail ?? ""),
  };
}

export function writeCompanyProfileCache(p: CompanyProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        companyName: p.companyName ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        license: p.license ?? "",
        logoDataUrl: p.logoDataUrl ?? "",
        notificationsEmail: p.notificationsEmail ?? "",
      })
    );
  } catch {
    // ignore
  }
}

export function readCompanyProfileCache(): CompanyProfile {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<CompanyProfile>;
    return normalizeCompanyProfile(parsed);
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadCompanyProfile(): CompanyProfile {
  return readCompanyProfileCache();
}

/** Browser-only: get current user's company_id from company_memberships. */
export async function getCurrentCompanyId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  const { data: membership } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return membership?.company_id ?? null;
}

export type CompanyProfileLoadStatus =
  | "success_db"
  | "no_user"
  | "no_company_id"
  | "no_row"
  | "select_error"
  | "client_unavailable"
  | "exception";

export type CompanyProfileLoadResult = {
  profile: CompanyProfile;
  status: CompanyProfileLoadStatus;
  /** True when profile values came from a companies row (not cache-only fallback). */
  fromDatabase: boolean;
  usedCacheFallback: boolean;
  /** Settings and other DB-truth flows should block save unless this is true. */
  canUseForSave: boolean;
};

export type CompanyProfileLoadOptions = {
  /** When true, empty DB columns stay empty — no localStorage backfill (Settings DB-truth load). */
  dbTruthOnly?: boolean;
};

function companyProfileFromDbRow(
  row: Record<string, unknown>,
  cached: CompanyProfile,
  options: CompanyProfileLoadOptions = {}
): CompanyProfile {
  const dbTruthOnly = options.dbTruthOnly === true;
  const orCache = (dbValue: string, cacheValue: string) =>
    dbTruthOnly ? dbValue : dbValue || cacheValue;

  return normalizeCompanyProfile({
    companyName: orCache((row.name ?? "").toString().trim(), cached.companyName),
    email: orCache((row.owner_email ?? "").toString().trim(), cached.email),
    phone: orCache((row.phone ?? "").toString().trim(), cached.phone),
    license: orCache((row.license ?? "").toString().trim(), cached.license),
    logoDataUrl: dbTruthOnly
      ? typeof row.logo_url === "string"
        ? row.logo_url
        : ""
      : typeof row.logo_url === "string"
        ? row.logo_url
        : cached.logoDataUrl,
    notificationsEmail: orCache(
      (row.notifications_email ?? "").toString().trim(),
      cached.notificationsEmail ?? ""
    ),
  });
}

/** Structured core profile load — distinguishes DB truth from cache/auth failures. */
export async function loadCompanyProfileResultFromSupabase(
  options: CompanyProfileLoadOptions = {}
): Promise<CompanyProfileLoadResult> {
  if (typeof window === "undefined") {
    return {
      profile: { ...DEFAULTS },
      status: "client_unavailable",
      fromDatabase: false,
      usedCacheFallback: false,
      canUseForSave: false,
    };
  }

  const cached = readCompanyProfileCache();

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        profile: cached,
        status: "client_unavailable",
        fromDatabase: false,
        usedCacheFallback: true,
        canUseForSave: false,
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return {
        profile: cached,
        status: "no_user",
        fromDatabase: false,
        usedCacheFallback: true,
        canUseForSave: false,
      };
    }

    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      return {
        profile: cached,
        status: "no_company_id",
        fromDatabase: false,
        usedCacheFallback: true,
        canUseForSave: false,
      };
    }

    const { data: row, error } = await supabase
      .from("companies")
      .select("name, owner_email, phone, license, logo_url, notifications_email")
      .eq("id", companyId)
      .maybeSingle();

    if (error) {
      console.error("[companyProfile]", error);
      return {
        profile: cached,
        status: "select_error",
        fromDatabase: false,
        usedCacheFallback: true,
        canUseForSave: false,
      };
    }

    if (!row) {
      return {
        profile: cached,
        status: "no_row",
        fromDatabase: false,
        usedCacheFallback: true,
        canUseForSave: false,
      };
    }

    const merged = companyProfileFromDbRow(row as Record<string, unknown>, cached, options);
    writeCompanyProfileCache(merged);
    return {
      profile: merged,
      status: "success_db",
      fromDatabase: true,
      usedCacheFallback: false,
      canUseForSave: true,
    };
  } catch (err) {
    console.error("[companyProfile]", err);
    return {
      profile: cached,
      status: "exception",
      fromDatabase: false,
      usedCacheFallback: true,
      canUseForSave: false,
    };
  }
}

/** Legacy helper — returns profile only; prefer loadCompanyProfileResultFromSupabase for Settings. */
export async function loadCompanyProfileFromSupabase(): Promise<CompanyProfile> {
  const result = await loadCompanyProfileResultFromSupabase();
  return result.profile;
}

export type SaveCompanyProfileOptions = {
  /** When false, skips localStorage cache write (e.g. split branding save). Default true. */
  updateCache?: boolean;
};

export async function saveCompanyProfileToSupabase(
  p: CompanyProfile,
  options: SaveCompanyProfileOptions = {}
): Promise<boolean> {
  const updateCache = options.updateCache !== false;
  if (typeof window === "undefined") return false;
  const normalized = normalizeCompanyProfile(p);
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      if (updateCache) writeCompanyProfileCache(normalized);
      return false;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      if (updateCache) writeCompanyProfileCache(normalized);
      return false;
    }
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      if (updateCache) writeCompanyProfileCache(normalized);
      return false;
    }

    const { error } = await supabase
      .from("companies")
      .update({
        name: normalized.companyName,
        owner_email: normalized.email,
        phone: normalized.phone,
        license: normalized.license,
        logo_url: normalized.logoDataUrl,
        notifications_email: normalized.notificationsEmail ?? "",
      })
      .eq("id", companyId);

    if (error) {
      console.error("[companyProfile]", error);
      if (updateCache) writeCompanyProfileCache(normalized);
      return false;
    }
    if (updateCache) writeCompanyProfileCache(normalized);
    return true;
  } catch (err) {
    console.error("[companyProfile]", err);
    if (updateCache) writeCompanyProfileCache(normalized);
    return false;
  }
}

export async function saveCompanyProfile(p: CompanyProfile): Promise<boolean> {
  return saveCompanyProfileToSupabase(p);
}
