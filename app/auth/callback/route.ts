import { createClient } from "@/app/lib/supabase/server";
import { resolveAuthReturnPath } from "@/app/lib/safeInternalRedirect";
import { NextResponse } from "next/server";

/**
 * Supabase auth callback: exchange the code from the URL for a session.
 * Used for email confirmation links and OAuth redirects.
 * Success → safe internal redirectTo (or /). Failure → /login (preserving return when safe).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectCandidate =
    requestUrl.searchParams.get("redirectTo") ??
    requestUrl.searchParams.get("next");
  const safeReturn = resolveAuthReturnPath(redirectCandidate, "/");
  const loginFallback = new URL("/login", requestUrl.origin);
  if (safeReturn !== "/") {
    loginFallback.searchParams.set("redirectTo", safeReturn);
  }

  if (!code) {
    return NextResponse.redirect(loginFallback);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(loginFallback);
  }

  return NextResponse.redirect(new URL(safeReturn, requestUrl.origin));
}
