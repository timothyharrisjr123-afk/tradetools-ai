import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (typeof window !== "undefined") {
  const missing = !url || !anonKey;
  if (missing && process.env.NODE_ENV === "development") {
    throw new Error(
      "TradeTools AI: Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createBrowserClient(url, anonKey);
  }
  return client;
}

/** Wait for the browser client to finish reading the existing auth session. */
export async function ensureBrowserAuthSession(
  timeoutMs = 12000
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
      resolve(value);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    const timer = window.setTimeout(() => finish(false), timeoutMs);

    void (async () => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs && !settled) {
        const current = await supabase.auth.getSession();
        if (current.data.session) {
          finish(true);
          return;
        }
        await new Promise((wait) => window.setTimeout(wait, 250));
      }
    })();
  });
}
