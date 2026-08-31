"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";

type ShellProps = {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  status?: "loading" | "ready" | "error";
  loadingLabel?: string;
  errorLabel?: string;
};

/**
 * Quiet identity workspace chrome shared by Customer and Property routes.
 * Matches Job Card header language without copying the Job Card shell.
 */
export default function FieldDiveWorkspaceShell({
  eyebrow,
  title,
  meta,
  actions,
  children,
  status = "ready",
  loadingLabel = "Loading…",
  errorLabel = "Could not load this page.",
}: ShellProps) {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <div className="min-h-full bg-white">
        <header className="border-b border-slate-200/80 px-5 pb-4 pt-3 sm:px-6">
          <Link
            href="/tools/roofing/saved"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            ← Back to Jobs
          </Link>

          {status === "loading" ? (
            <p className="mt-6 text-sm text-slate-500">{loadingLabel}</p>
          ) : null}
          {status === "error" ? (
            <p className="mt-6 text-sm text-slate-600">{errorLabel}</p>
          ) : null}

          {status === "ready" ? (
            <div className="mt-3 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {eyebrow}
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
                  {title}
                </h1>
                {meta ? <div className="mt-2">{meta}</div> : null}
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-5">{actions}</div>
              ) : null}
            </div>
          ) : null}
        </header>

        {status === "ready" ? (
          <div className="max-w-3xl space-y-7 px-5 py-6 sm:px-6">{children}</div>
        ) : null}
      </div>
    </FieldDiveAppShell>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

export function WorkspaceSection({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

type LinkRowProps = {
  href: string;
  primary: string;
  secondary?: string | null;
};

export function WorkspaceLinkRow({ href, primary, secondary }: LinkRowProps) {
  return (
    <Link
      href={href}
      className="block border-t border-slate-100 px-0.5 py-3 transition hover:bg-slate-50/80 focus-visible:bg-slate-50/80 focus-visible:outline-none"
    >
      <span className="block truncate text-sm font-medium text-slate-900">{primary}</span>
      {secondary ? (
        <span className="mt-0.5 block truncate text-xs text-slate-500">{secondary}</span>
      ) : null}
    </Link>
  );
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
