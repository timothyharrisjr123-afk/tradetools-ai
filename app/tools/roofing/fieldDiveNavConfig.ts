/**
 * FieldDive sidebar nav config (R7) — labels, grouping, and hrefs only.
 * Icons and rendering live in FieldDiveAppShell.tsx.
 */

export type FieldDiveNavSectionId = "operations" | "setup" | "legacyAndFuture";

export type FieldDiveNavItemKey = "jobs" | "newJob" | "catalog" | "templates";

export type FieldDiveNavItemKind = "link" | "group" | "soon" | "legacy";

export type FieldDiveNavSubItemConfig = {
  id: string;
  label: string;
  href?: string;
  variant: "active" | "available" | "soon";
};

export type FieldDiveNavItemConfig = {
  key: FieldDiveNavItemKey | null;
  label: string;
  href?: string;
  kind: FieldDiveNavItemKind;
  icon: FieldDiveNavIconName;
  subItems?: FieldDiveNavSubItemConfig[];
  subItemsAriaLabel?: string;
  activeSubId?: string;
  soonTitle?: string;
};

export type FieldDiveNavSectionConfig = {
  id: FieldDiveNavSectionId;
  label: string;
  items: FieldDiveNavItemConfig[];
};

export type FieldDiveNavIconName =
  | "briefcase"
  | "clipboardList"
  | "layoutTemplate"
  | "package"
  | "settings"
  | "users"
  | "bookOpen"
  | "fileText"
  | "calendar"
  | "receipt"
  | "barChart3"
  | "bot";

export const NEW_JOB_SUB_ITEMS: FieldDiveNavSubItemConfig[] = [
  { id: "packet", label: "Job Packet", href: "/tools/roofing?entry=packet", variant: "active" },
  {
    id: "job-card",
    label: "Job Card",
    href: "/tools/roofing?entry=job-card",
    variant: "available",
  },
  { id: "instant", label: "Instant Estimate", variant: "soon" },
];

export const FIELD_DIVE_NAV_SECTIONS: FieldDiveNavSectionConfig[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        key: "jobs",
        label: "Job Board",
        href: "/tools/roofing/saved",
        kind: "link",
        icon: "briefcase",
      },
      {
        key: "newJob",
        label: "New Job",
        href: "/tools/roofing",
        kind: "group",
        icon: "clipboardList",
        subItems: NEW_JOB_SUB_ITEMS,
        subItemsAriaLabel: "New job entry paths",
        activeSubId: "packet",
      },
    ],
  },
  {
    id: "setup",
    label: "Company setup",
    items: [
      {
        key: "catalog",
        label: "Catalog",
        href: "/tools/roofing/catalog",
        kind: "link",
        icon: "package",
      },
      {
        key: "templates",
        label: "Templates",
        href: "/tools/roofing/templates",
        kind: "link",
        icon: "layoutTemplate",
      },
      {
        key: null,
        label: "Settings",
        href: "/tools/settings",
        kind: "link",
        icon: "settings",
      },
    ],
  },
  {
    id: "legacyAndFuture",
    label: "Legacy & future",
    items: [
      {
        key: null,
        label: "Customers (Legacy)",
        href: "/admin/customers",
        kind: "legacy",
        icon: "users",
        soonTitle: "Legacy admin shelf — not primary workflow navigation",
      },
      {
        key: null,
        label: "Price Book (Legacy)",
        href: "/admin/price-book",
        kind: "legacy",
        icon: "bookOpen",
        soonTitle: "Replaced by Catalog — legacy admin shelf only",
      },
      {
        key: null,
        label: "Estimates (Legacy)",
        kind: "soon",
        icon: "fileText",
        soonTitle:
          "Legacy saved-estimate entry removed from primary nav — use Job Board and New Job",
      },
      {
        key: null,
        label: "Calendar",
        kind: "soon",
        icon: "calendar",
        soonTitle: "Scheduling — coming later",
      },
      {
        key: null,
        label: "Invoices",
        kind: "soon",
        icon: "receipt",
        soonTitle: "Invoicing — coming later",
      },
      {
        key: null,
        label: "Reports",
        kind: "soon",
        icon: "barChart3",
        soonTitle: "Reporting — coming later",
      },
      {
        key: null,
        label: "AI Conductor",
        href: "/tools/roofing/ai",
        kind: "legacy",
        icon: "bot",
        soonTitle: "Secondary automation surface — not proposal spine",
      },
    ],
  },
];

export function flattenNavItems(
  sections: FieldDiveNavSectionConfig[] = FIELD_DIVE_NAV_SECTIONS
): FieldDiveNavItemConfig[] {
  return sections.flatMap((section) => section.items);
}

export function getNavSectionItems(
  sectionId: FieldDiveNavSectionId,
  sections: FieldDiveNavSectionConfig[] = FIELD_DIVE_NAV_SECTIONS
): FieldDiveNavItemConfig[] {
  const section = sections.find((row) => row.id === sectionId);
  return section?.items ?? [];
}

export function getPrimaryWorkflowNavItems(): FieldDiveNavItemConfig[] {
  return [
    ...getNavSectionItems("operations"),
    ...getNavSectionItems("setup"),
  ];
}

export function getLegacyAndFutureNavItems(): FieldDiveNavItemConfig[] {
  return getNavSectionItems("legacyAndFuture");
}

export function collectNavHrefs(
  sections: FieldDiveNavSectionConfig[] = FIELD_DIVE_NAV_SECTIONS
): string[] {
  const hrefs: string[] = [];
  for (const item of flattenNavItems(sections)) {
    if (item.href) hrefs.push(item.href);
    for (const sub of item.subItems ?? []) {
      if (sub.href) hrefs.push(sub.href);
    }
  }
  return hrefs;
}

export function hasNavHref(
  href: string,
  sections: FieldDiveNavSectionConfig[] = FIELD_DIVE_NAV_SECTIONS
): boolean {
  return collectNavHrefs(sections).includes(href);
}
