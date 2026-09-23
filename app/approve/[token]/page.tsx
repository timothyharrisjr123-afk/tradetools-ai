/**
 * Phase 3 — legacy /approve/[token] is retired.
 * Does not read or write KV. Does not redirect to /p/{token}
 * (approve tokens are a different system than public proposal tokens).
 */
export default async function ApprovePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-slate-900">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        data-legacy-approve-retired
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          FieldDive
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          This approval link is retired
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Customer proposal acceptance now uses the secure proposal link from
          your contractor&apos;s email. If you still need to review or accept a
          proposal, open the link in that message or contact your contractor.
        </p>
      </div>
    </main>
  );
}
