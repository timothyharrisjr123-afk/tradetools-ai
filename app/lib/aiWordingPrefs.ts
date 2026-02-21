export type TierLabel = "Core" | "Enhanced" | "Premium";

export type AiWordingFavorite = {
  packageDescription: string;
  scheduleCta: string;
  locked: boolean;
  updatedAt: string; // ISO
};

export type AiFeedbackEvent = {
  ts: string; // ISO
  tier: TierLabel;
  rating: "up" | "down";
  packageDescription: string;
  scheduleCta: string;
};

type StoreShape = {
  version: 1;
  favorites: Partial<Record<TierLabel, AiWordingFavorite>>;
  feedback: AiFeedbackEvent[];
};

const STORAGE_KEY = "ttai_ai_wording_prefs_v1";

function safeParse(raw: string | null): StoreShape | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || obj.version !== 1) return null;
    if (!obj.favorites) obj.favorites = {};
    if (!Array.isArray(obj.feedback)) obj.feedback = [];
    return obj as StoreShape;
  } catch {
    return null;
  }
}

function loadStore(): StoreShape {
  if (typeof window === "undefined") return { version: 1, favorites: {}, feedback: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return safeParse(raw) || { version: 1, favorites: {}, feedback: [] };
}

function saveStore(store: StoreShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getFavorite(tier: TierLabel): AiWordingFavorite | null {
  const store = loadStore();
  return store.favorites?.[tier] || null;
}

export function setFavorite(tier: TierLabel, data: { packageDescription: string; scheduleCta: string; locked?: boolean }) {
  const store = loadStore();
  const prev = store.favorites?.[tier];
  store.favorites = store.favorites || {};
  store.favorites[tier] = {
    packageDescription: String(data.packageDescription || "").trim(),
    scheduleCta: String(data.scheduleCta || "").trim(),
    locked: typeof data.locked === "boolean" ? data.locked : Boolean(prev?.locked),
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.favorites[tier]!;
}

export function setLocked(tier: TierLabel, locked: boolean) {
  const store = loadStore();
  const prev = store.favorites?.[tier];
  store.favorites = store.favorites || {};
  store.favorites[tier] = {
    packageDescription: String(prev?.packageDescription || "").trim(),
    scheduleCta: String(prev?.scheduleCta || "").trim(),
    locked: Boolean(locked),
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.favorites[tier]!;
}

export function appendFeedback(evt: Omit<AiFeedbackEvent, "ts">) {
  const store = loadStore();
  store.feedback = store.feedback || [];
  store.feedback.push({ ...evt, ts: new Date().toISOString() });
  if (store.feedback.length > 200) store.feedback = store.feedback.slice(store.feedback.length - 200);
  saveStore(store);
}

export function getTierFeedbackBias(tier: TierLabel): "more_confident" | "simpler_clearer" | null {
  const store = loadStore();
  const events = (store.feedback || []).filter((f) => f.tier === tier);

  if (!events.length) return null;

  const up = events.filter((f) => f.rating === "up").length;
  const down = events.filter((f) => f.rating === "down").length;

  if (up > down) return "more_confident";
  if (down > up) return "simpler_clearer";
  return null;
}
