"use client";

import Link from "next/link";

export function ComingSoon({
  title = "Coming soon",
  description = "This section is under construction.",
  backHref = "/tools/roofing",
  backLabel = "Back to Roofing Tool",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Under construction
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/70">{description}</p>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08] active:bg-white/[0.10]"
          >
            {backLabel}
          </Link>

          <Link
            href="/tools/roofing/saved"
            className="text-sm font-semibold text-white/70 hover:text-white"
          >
            Go to Saved Estimates →
          </Link>
        </div>
      </div>
    </div>
  );
}
