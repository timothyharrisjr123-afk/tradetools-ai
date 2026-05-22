"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Menu,
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Calendar,
  FileText,
  Receipt,
  Users,
  BookOpen,
  Bot,
  BarChart3,
  Settings,
} from "lucide-react";
import { SignOutButton } from "@/app/components/auth/SignOutButton";

export type FieldDiveActiveNav = "dashboard" | "newJob";

type NavIcon = ComponentType<{ className?: string }>;

type NavItem = {
  key: FieldDiveActiveNav | null;
  label: string;
  href: string;
  icon: NavIcon;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/tools/roofing/saved", icon: LayoutDashboard },
  { key: "newJob", label: "New Job", href: "/tools/roofing", icon: ClipboardList },
  { key: null, label: "Jobs Pipeline", href: "/tools/roofing/saved", icon: Briefcase },
  { key: null, label: "Calendar", href: "#", icon: Calendar },
  { key: null, label: "Estimates", href: "/tools/roofing", icon: FileText },
  { key: null, label: "Invoices", href: "#", icon: Receipt },
  { key: null, label: "Customers", href: "/admin/customers", icon: Users },
  { key: null, label: "Price Book", href: "/admin/price-book", icon: BookOpen },
  { key: null, label: "AI Conductor", href: "/tools/roofing/ai", icon: Bot },
  { key: null, label: "Reports", href: "#", icon: BarChart3 },
  { key: null, label: "Settings", href: "/tools/settings", icon: Settings },
];

function FieldDiveLogoMark() {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
      <span className="absolute left-0 top-0 h-3 w-6 rounded-[6px] bg-gradient-to-r from-sky-400 to-blue-500" />
      <span className="absolute left-0 top-[11px] h-3 w-4 rounded-[6px] bg-gradient-to-r from-sky-500 to-blue-600" />
      <span className="absolute left-0 top-[22px] h-3 w-3 rounded-[6px] bg-gradient-to-r from-sky-500 to-blue-600" />
      <span className="absolute left-[15px] top-[11px] h-3 w-3 rounded-[6px] bg-gradient-to-r from-sky-400 to-cyan-400" />
    </div>
  );
}

type FieldDiveAppShellProps = {
  activeNav: FieldDiveActiveNav;
  children: ReactNode;
};

export default function FieldDiveAppShell({ activeNav, children }: FieldDiveAppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside
          className="hidden w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex"
          aria-label="FieldDive"
        >
          <Link href="/tools" className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
            <FieldDiveLogoMark />
            <span className="text-lg font-bold tracking-tight text-slate-900">FieldDive</span>
          </Link>
          <nav className="flex-1 space-y-0.5 px-2 py-3">
            {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
              const active = key !== null && key === activeNav;
              const cls = active
                ? "flex items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-100"
                : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900";
              const inner = (
                <>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} aria-hidden />
                  {label}
                </>
              );
              return href === "#" ? (
                <a key={label} href="#" className={cls} onClick={(e) => e.preventDefault()}>
                  {inner}
                </a>
              ) : (
                <Link key={label} href={href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-slate-100 p-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-300 text-[10px] font-bold text-white">
                MA
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-800">Mike Anderson</div>
                <div className="truncate text-[10px] text-slate-500">Anderson Roofing</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="hidden flex-1 lg:block" />
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-300 text-[10px] font-bold text-white">
                  MA
                </div>
                <span className="hidden text-xs font-semibold text-slate-700 sm:inline">Mike Anderson</span>
                <div className="hidden sm:block">
                  <SignOutButton />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
