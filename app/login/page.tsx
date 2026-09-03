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

function LoginPageInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      const redirectTo = searchParams.get("redirectTo");
      const safePath =
        typeof redirectTo === "string" &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//") &&
        !redirectTo.includes(":")
          ? redirectTo
          : "/";
      window.location.assign(safePath);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-md flex-col justify-center">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-lg font-bold tracking-tight text-slate-900">FieldDive</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Roofing jobs, proposals, and payments.
          </p>
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className={FOCUSED_EDITOR_LABEL}>
                Email
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className={FOCUSED_EDITOR_LABEL}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            No account?{" "}
            <Link href="/signup" className="font-medium text-blue-700 hover:text-blue-800">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
