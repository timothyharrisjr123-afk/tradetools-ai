"use client";

import Link from "next/link";

/**
 * Phase 3 — admin sub-nav no longer promotes retired price-book/customers writers.
 * Catalog remains the setup entry (redirects to /tools/roofing/catalog).
 */
export default function AdminNavLinks(_props?: { current?: string }) {
  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 pb-4 text-sm"
      aria-label="Admin navigation"
      data-admin-nav-phase3
    >
      <Link href="/tools/roofing/saved" className="text-white/70 transition hover:text-white">
        ← Back to FieldDive
      </Link>
      <span className="text-white/30" aria-hidden>
        |
      </span>
      <Link href="/tools/roofing/catalog" className="font-medium text-cyan-400">
        Catalog
      </Link>
    </nav>
  );
}
