import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";

export type PlacesRateLimitOperation = "autocomplete" | "details";
export type PlacesRateLimitCounterStore = {
  increment(key: string, windowSeconds: number): Promise<number>;
};

const WINDOW_SECONDS = 60;
const LIMITS: Record<PlacesRateLimitOperation, { user: number; company: number }> = {
  autocomplete: { user: 90, company: 600 },
  details: { user: 30, company: 180 },
};
const localCounters = new Map<string, { count: number; expiresAt: number }>();

const localStore: PlacesRateLimitCounterStore = {
  async increment(key, windowSeconds) {
    const now = Date.now();
    const current = localCounters.get(key);
    const next = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowSeconds * 1_000 }
      : { ...current, count: current.count + 1 };
    localCounters.set(key, next);
    if (localCounters.size > 2_000) {
      for (const [candidate, value] of localCounters) {
        if (value.expiresAt <= now) localCounters.delete(candidate);
      }
    }
    return next.count;
  },
};

const durableStore: PlacesRateLimitCounterStore = {
  async increment(key, windowSeconds) {
    const result = await kv.multi().incr(key).expire(key, windowSeconds).exec();
    return Number(result[0]);
  },
};

function opaque(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function defaultStore(): PlacesRateLimitCounterStore | null {
  const configured = Boolean(
    process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim()
  );
  if (configured) return durableStore;
  return process.env.NODE_ENV === "production" ? null : localStore;
}

export async function checkPlacesRateLimit(input: {
  operation: PlacesRateLimitOperation;
  userId: string;
  companyId: string;
  store?: PlacesRateLimitCounterStore;
}): Promise<{ allowed: boolean; reason?: "rate_limited" | "unavailable" }> {
  const store = input.store ?? defaultStore();
  if (!store) return { allowed: false, reason: "unavailable" };
  const limits = LIMITS[input.operation];
  const prefix = `places:${input.operation}`;
  try {
    const [userCount, companyCount] = await Promise.all([
      store.increment(`${prefix}:user:${opaque(input.userId)}`, WINDOW_SECONDS),
      store.increment(`${prefix}:company:${opaque(input.companyId)}`, WINDOW_SECONDS),
    ]);
    return userCount <= limits.user && companyCount <= limits.company
      ? { allowed: true }
      : { allowed: false, reason: "rate_limited" };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}

export function resetPlacesLocalRateLimitForTests(): void {
  localCounters.clear();
}
