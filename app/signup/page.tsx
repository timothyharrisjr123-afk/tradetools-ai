"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import {
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
  FOCUSED_EDITOR_SAVE,
} from "@/app/components/ui/FocusedEditor";
import FieldDiveLogoMark from "@/app/components/brand/FieldDiveLogoMark";
import { APP_PAGE_BG } from "@/app/components/ui/surfaceStyles";
import {
  buildAuthCallbackUrl,
  buildLoginHrefWithReturn,
  resolveAuthReturnPath,
} from "@/app/lib/safeInternalRedirect";

function SignUpPageInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectCandidate = searchParams.get("redirectTo");
  const loginHref = buildLoginHrefWithReturn(redirectCandidate);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const emailRedirectTo = buildAuthCallbackUrl(origin, redirectCandidate);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      // Session present (confirmations off) → return to intended FieldDive route.
      if (data.session) {
        window.location.assign(resolveAuthReturnPath(redirectCandidate, "/start"));
        return;
      }
      setMessage({
        type: "success",
        text: "Account created. Check your email to confirm, or sign in.",
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`min-h-screen ${APP_PAGE_BG} px-4 py-12 text-slate-900 sm:py-16`}>
      <div className="mx-auto flex max-w-md flex-col justify-center">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-900/5 sm:p-7">
          <div className="flex items-center gap-2.5">
            <FieldDiveLogoMark />
            <p className="text-lg font-bold tracking-tight text-slate-900">FieldDive</p>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">Create account</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Roofing jobs, proposals, and payments.
          </p>
          <form onSubmit={handleSignUp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="signup-email" className={FOCUSED_EDITOR_LABEL}>
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={FOCUSED_EDITOR_INPUT}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className={FOCUSED_EDITOR_LABEL}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={FOCUSED_EDITOR_INPUT}
              />
            </div>
            {message && (
              <p
                className={
                  message.type === "error" ? "text-sm text-rose-600" : "text-sm text-emerald-700"
                }
                role={message.type === "error" ? "alert" : undefined}
              >
                {message.text}
              </p>
            )}
            <button type="submit" disabled={loading} className={`${FOCUSED_EDITOR_SAVE} w-full`}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href={loginHref} className="font-medium text-blue-700 hover:text-blue-800">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageInner />
    </Suspense>
  );
}
