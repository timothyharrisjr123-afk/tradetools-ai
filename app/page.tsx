import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      {/* Soft background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-32 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            FieldDive — contractor estimating tools
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Fast estimates. Clean proposals. Real approvals.
          </h1>

          <p className="mt-4 text-base text-white/70">
            Launching with Roofing — expanding to additional trades.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/tools/roofing"
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:bg-emerald-600"
            >
              Open Roofing Estimator
            </Link>

            <Link
              href="/tools"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 active:bg-white/15"
            >
              Browse Tools
            </Link>
          </div>

          <div className="mt-8 text-xs text-white/45">
            fielddive.com
          </div>
        </div>
      </div>
    </main>
  );
}
