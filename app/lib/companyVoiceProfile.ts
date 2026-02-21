export type VoiceTone = "professional" | "friendly" | "direct" | "premium";

export type CompanyVoiceProfile = {
  tone: VoiceTone;
  styleNotes?: string; // user-written preferences e.g. "short sentences, no fluff"
  updatedAt: string; // ISO
};

const STORAGE_KEY = "ttai_company_voice_v1";

export function loadCompanyVoiceProfile(): CompanyVoiceProfile {
  if (typeof window === "undefined") {
    return { tone: "professional", styleNotes: "", updatedAt: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tone: "professional", styleNotes: "", updatedAt: new Date().toISOString() };
    const obj = JSON.parse(raw);
    const tone = (obj?.tone || "professional") as VoiceTone;
    const styleNotes = typeof obj?.styleNotes === "string" ? obj.styleNotes : "";
    return {
      tone: ["professional", "friendly", "direct", "premium"].includes(tone) ? tone : "professional",
      styleNotes,
      updatedAt: typeof obj?.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { tone: "professional", styleNotes: "", updatedAt: new Date().toISOString() };
  }
}

export function saveCompanyVoiceProfile(patch: Partial<CompanyVoiceProfile>) {
  if (typeof window === "undefined") return;
  const current = loadCompanyVoiceProfile();
  const next: CompanyVoiceProfile = {
    tone: (patch.tone as any) ?? current.tone,
    styleNotes: patch.styleNotes ?? current.styleNotes ?? "",
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
