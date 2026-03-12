import { createClient } from "@/app/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Supabase auth callback: exchange the code from the URL for a session.
 * Used for email confirmation links and OAuth redirects.
 * Success → homepage. Failure → /login.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
