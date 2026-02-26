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

export function loadCompanyProfile(): CompanyProfile {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<CompanyProfile>;
    return {
      companyName: typeof parsed.companyName === "string" ? parsed.companyName : DEFAULTS.companyName,
      phone: typeof parsed.phone === "string" ? parsed.phone : DEFAULTS.phone,
      email: typeof parsed.email === "string" ? parsed.email : DEFAULTS.email,
      license: typeof parsed.license === "string" ? parsed.license : DEFAULTS.license,
      logoDataUrl: typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : DEFAULTS.logoDataUrl,
      notificationsEmail: typeof parsed.notificationsEmail === "string" ? parsed.notificationsEmail : (DEFAULTS.notificationsEmail ?? ""),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveCompanyProfile(p: CompanyProfile): void {
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
