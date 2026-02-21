"use client";

import Link from "next/link";

const tools = [
  {
    href: "/tools/roofing",
    title: "Roofing Calculator",
    description:
      "Estimate squares, materials, labor, and a suggested price with waste and profit margin.",
    cta: "Open calculator",
    secondaryHref: "/tools/roofing/history",
    secondaryLabel: "Roofing History",
  },
];

export default function Page() {
  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 pb-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Tools
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Calculators and quote tools for contractors.
          </p>
        </header>

        <ul className="space-y-4" role="list">
          {tools.map((tool) => (
            <li key={tool.href}>
              <div className="group rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm hover:border-neutral-300 hover:shadow-md transition-all">
                <Link href={tool.href} className="block focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 rounded-lg -m-1 p-1">
                  <h2 className="text-lg font-semibold text-neutral-900 group-hover:text-neutral-700">
                    {tool.title}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
                    {tool.description}
                  </p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-neutral-700 group-hover:text-neutral-900">
                    {tool.cta}
                    <span className="ml-1.5 transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
                {"secondaryHref" in tool && tool.secondaryHref && (
                  <Link
                    href={tool.secondaryHref}
                    className="mt-2 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                  >
                    {tool.secondaryLabel}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
