import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">ServiceTools</h1>
          <p className="text-sm text-neutral-600">
            Instant estimates, calculators, and quote tools for contractors.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/tools"
            className="block w-full rounded-2xl border px-4 py-3 text-center font-medium hover:bg-neutral-50 transition-colors"
          >
            Tools
          </Link>
          <Link
            href="/ai"
            className="block w-full rounded-2xl border px-4 py-3 text-center font-medium hover:bg-neutral-50 transition-colors"
          >
            AI Assistant
          </Link>
        </div>
      </div>
    </main>
  );
}
