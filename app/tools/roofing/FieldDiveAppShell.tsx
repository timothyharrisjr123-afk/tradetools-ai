"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  LAST_DB_JOB_ID_STORAGE_KEY,
  buildJobCardRecoveryHref,
} from "@/app/lib/jobBoardAdapter";
import {
  Bell,
  Menu,
  ChevronDown,
  ClipboardList,
  Briefcase,
  LayoutTemplate,
  Calendar,
  FileText,
  Receipt,
  Users,
  BookOpen,
  Package,
  Bot,
  BarChart3,
  Settings,
} from "lucide-react";
import { SignOutButton } from "@/app/components/auth/SignOutButton";
import {
  FIELD_DIVE_NAV_SECTIONS,
  type FieldDiveNavIconName,
  type FieldDiveNavItemConfig,
  type FieldDiveNavSubItemConfig,
} from "./fieldDiveNavConfig";

export type FieldDiveActiveNav = "jobs" | "newJob" | "catalog" | "templates";
export type FieldDiveActiveSubNav = "packet" | "job-card" | "instant";

type NavIcon = ComponentType<{ className?: string }>;

type NavSubItemVariant = "active" | "available" | "soon";

const NAV_ICONS: Record<FieldDiveNavIconName, NavIcon> = {
  briefcase: Briefcase,
  clipboardList: ClipboardList,
  layoutTemplate: LayoutTemplate,
  package: Package,
  settings: Settings,
  users: Users,
  bookOpen: BookOpen,
  fileText: FileText,
  calendar: Calendar,
  receipt: Receipt,
  barChart3: BarChart3,
  bot: Bot,
};

function navItemKey(item: FieldDiveNavItemConfig): string {
  return item.key ?? item.label;
}

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

function resolveSubItemVariant(sub: FieldDiveNavSubItemConfig, activeSubId?: string): NavSubItemVariant {
  if (sub.variant === "soon") return "soon";
  if (activeSubId && sub.id === activeSubId) return "active";
  return "available";
}

const SUB_ITEM_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/90 focus-visible:ring-offset-1";

function subItemClassName(variant: NavSubItemVariant): string {
  switch (variant) {
    case "active":
      return `flex w-full items-center rounded-md px-2.5 py-2 text-[13px] font-semibold text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-200/80 transition-colors ${SUB_ITEM_FOCUS}`;
    case "available":
      return `flex w-full items-center rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${SUB_ITEM_FOCUS}`;
    case "soon":
      return "flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-400";
  }
}

function parentNavClassName(moduleActive: boolean, isExpanded: boolean): string {
  const base =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/80 focus-visible:ring-offset-1";

  if (moduleActive) {
    return `${base} font-medium text-slate-700 hover:bg-slate-100/80`;
  }
  if (isExpanded) {
    return `${base} font-medium text-slate-700 bg-slate-50/70 hover:bg-slate-100/80`;
  }
  return `${base} font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900`;
}

function NavSubLinks({
  items,
  ariaLabel,
  activeSubId,
}: {
  items: FieldDiveNavSubItemConfig[];
  ariaLabel?: string;
  activeSubId?: string;
}) {
  return (
    <div
      className="ml-2 mt-2 mb-2 space-y-1 border-l border-slate-200/90 pl-3"
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((sub) => {
        const displayVariant = resolveSubItemVariant(sub, activeSubId);

        if (displayVariant === "soon") {
          return (
            <div
              key={sub.id}
              className={subItemClassName("soon")}
              aria-disabled="true"
              title="Instant Estimate — coming soon"
            >
              <span>{sub.label}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-400">
                Soon
              </span>
            </div>
          );
        }

        if (sub.href) {
          return (
            <Link
              key={sub.id}
              href={sub.href}
              className={subItemClassName(displayVariant)}
              aria-current={displayVariant === "active" ? "page" : undefined}
            >
              {sub.label}
            </Link>
          );
        }

        return (
          <span key={sub.id} className={subItemClassName(displayVariant)}>
            {sub.label}
          </span>
        );
      })}
    </div>
  );
}

type FieldDiveAppShellProps = {
  activeNav: FieldDiveActiveNav;
  activeSubId?: FieldDiveActiveSubNav;
  children: ReactNode;
};

function resolveSubItems(items: FieldDiveNavSubItemConfig[], jobCardHref: string): FieldDiveNavSubItemConfig[] {
  return items.map((sub) =>
    sub.id === "job-card" && sub.href ? { ...sub, href: jobCardHref } : sub
  );
}

type NavSidebarItemProps = {
  item: FieldDiveNavItemConfig;
  activeNav: FieldDiveActiveNav;
  activeSubId?: FieldDiveActiveSubNav;
  jobCardHref: string;
  groupExpandedOverrides: Record<string, boolean>;
  onToggleGroup: (groupKey: string, defaultExpanded: boolean) => void;
};

function NavSidebarItem({
  item,
  activeNav,
  activeSubId,
  jobCardHref,
  groupExpandedOverrides,
  onToggleGroup,
}: NavSidebarItemProps) {
  const { key, label, href, kind, icon, subItems, subItemsAriaLabel, activeSubId: defaultActiveSubId, soonTitle } =
    item;
  const Icon = NAV_ICONS[icon];
  const groupKey = navItemKey(item);
  const moduleActive = key !== null && key === activeNav;
  const hasSubItems = kind === "group" && Boolean(subItems?.length);
  const defaultExpanded = moduleActive;
  const isExpanded = groupExpandedOverrides[groupKey] ?? defaultExpanded;
  const showSubItems = hasSubItems && isExpanded;

  if (hasSubItems) {
    return (
      <div className="py-0.5">
        <button
          type="button"
          className={parentNavClassName(moduleActive, isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={`nav-group-${groupKey}`}
          onClick={() => onToggleGroup(groupKey, defaultExpanded)}
        >
          <Icon
            className={`h-4 w-4 shrink-0 ${
              moduleActive ? "text-blue-600" : isExpanded ? "text-slate-500" : "text-slate-400"
            }`}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-left">{label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
              moduleActive ? "text-blue-500/70" : "text-slate-400"
            } ${isExpanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {showSubItems ? (
          <div id={`nav-group-${groupKey}`}>
            <NavSubLinks
              items={resolveSubItems(subItems!, jobCardHref)}
              ariaLabel={subItemsAriaLabel}
              activeSubId={moduleActive ? (activeSubId ?? defaultActiveSubId) : undefined}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (kind === "soon") {
    return (
      <div
        className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
        aria-disabled="true"
        title={soonTitle ?? `${label} — coming later`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
          {label}
        </span>
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-400">
          Soon
        </span>
      </div>
    );
  }

  if (kind === "legacy") {
    const legacyCls =
      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700";
    return (
      <div>
        {href ? (
          <Link href={href} className={legacyCls} title={soonTitle}>
            <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {label}
          </Link>
        ) : (
          <span className={legacyCls} title={soonTitle}>
            <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {label}
          </span>
        )}
      </div>
    );
  }

  const cls = moduleActive
    ? "flex items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-100"
    : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900";

  return (
    <div>
      {href ? (
        <Link href={href} className={cls}>
          <Icon className={`h-4 w-4 shrink-0 ${moduleActive ? "text-blue-600" : "text-slate-400"}`} aria-hidden />
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export default function FieldDiveAppShell({ activeNav, activeSubId, children }: FieldDiveAppShellProps) {
  const [groupExpandedOverrides, setGroupExpandedOverrides] = useState<Record<string, boolean>>({});
  const [jobCardHref, setJobCardHref] = useState("/tools/roofing?entry=job-card");

  useEffect(() => {
    try {
      const lastJobId = window.localStorage.getItem(LAST_DB_JOB_ID_STORAGE_KEY);
      setJobCardHref(buildJobCardRecoveryHref(lastJobId));
    } catch {
      // ignore storage failures — fallback href already set
    }
  }, []);

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
          <nav className="flex-1 space-y-4 px-2 py-3">
            {FIELD_DIVE_NAV_SECTIONS.map((section) => (
              <div key={section.id}>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavSidebarItem
                      key={navItemKey(item)}
                      item={item}
                      activeNav={activeNav}
                      activeSubId={activeSubId}
                      jobCardHref={jobCardHref}
                      groupExpandedOverrides={groupExpandedOverrides}
                      onToggleGroup={(groupKey, defaultExpanded) => {
                        setGroupExpandedOverrides((prev) => ({
                          ...prev,
                          [groupKey]: !(prev[groupKey] ?? defaultExpanded),
                        }));
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
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
