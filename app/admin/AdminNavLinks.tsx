"use client";

import Link from "next/link";

export type AdminNavPage = "catalog" | "price-book" | "customers";

export default function AdminNavLinks({ current }: { current?: AdminNavPage }) {
  const linkClass = (page: AdminNavPage) =>
    page === current
      ? "font-medium text-cyan-400"
      : "text-white/70 transition hover:text-white";

  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 pb-4 text-sm"
      aria-label="Admin navigation"
    >
      <Link href="/tools/roofing/saved" className="text-white/70 transition hover:text-white">
        ← Back to FieldDive
      </Link>
      <span className="text-white/30" aria-hidden>
        |
      </span>
      <Link href="/admin/catalog" className={linkClass("catalog")}>
        Catalog setup
      </Link>
      <Link href="/admin/price-book" className={linkClass("price-book")}>
        Legacy Price Book
      </Link>
    </nav>
  );
}
