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
async function getCurrentCompanyId(): Promise<string | null> {
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

export async function loadCompanyProfileFromSupabase(): Promise<CompanyProfile> {
  if (typeof window === "undefined") return { ...DEFAULTS };
  const cached = readCompanyProfileCache();
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return cached;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return cached;
    const companyId = await getCurrentCompanyId();
    if (!companyId) return cached;

    const { data: row, error } = await supabase
      .from("companies")
      .select("name, owner_email, phone, license, logo_url")
      .eq("id", companyId)
      .maybeSingle();

    if (error) {
      console.error("[companyProfile]", error);
      return cached;
    }
    if (!row) return cached;

    const merged: CompanyProfile = normalizeCompanyProfile({
      companyName: (row.name ?? "").toString().trim() || cached.companyName,
      email: (row.owner_email ?? "").toString().trim() || cached.email,
      phone: (row.phone ?? "").toString().trim() || cached.phone,
      license: (row.license ?? "").toString().trim() || cached.license,
      logoDataUrl: typeof row.logo_url === "string" ? row.logo_url : cached.logoDataUrl,
      notificationsEmail: cached.notificationsEmail ?? "",
    });
    writeCompanyProfileCache(merged);
    return merged;
  } catch (err) {
    console.error("[companyProfile]", err);
    return cached;
  }
}

export async function saveCompanyProfileToSupabase(p: CompanyProfile): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalized = normalizeCompanyProfile(p);
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      writeCompanyProfileCache(normalized);
      return false;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      writeCompanyProfileCache(normalized);
      return false;
    }
    const companyId = await getCurrentCompanyId();
    if (!companyId) {
      writeCompanyProfileCache(normalized);
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
      })
      .eq("id", companyId);

    if (error) {
      console.error("[companyProfile]", error);
      writeCompanyProfileCache(normalized);
      return false;
    }
    writeCompanyProfileCache(normalized);
    return true;
  } catch (err) {
    console.error("[companyProfile]", err);
    writeCompanyProfileCache(normalized);
    return false;
  }
}

export async function saveCompanyProfile(p: CompanyProfile): Promise<boolean> {
  return saveCompanyProfileToSupabase(p);
}
