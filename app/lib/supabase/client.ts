import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a Supabase client for use in Client Components (browser).
 * Uses cookies for auth session. Prefer this for auth-related client code.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "TradeTools AI: Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return createBrowserClient(url, key);
}
