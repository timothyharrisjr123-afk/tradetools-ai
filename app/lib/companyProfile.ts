const STORAGE_KEY = "serviceTools_companyProfile";

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
