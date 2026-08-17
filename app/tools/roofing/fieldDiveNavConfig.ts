/**
 * FieldDive sidebar nav config (R7) — labels, grouping, and hrefs only.
 * Icons and rendering live in FieldDiveAppShell.tsx.
 */

export type FieldDiveNavSectionId = "operations" | "setup" | "legacyAndFuture";

export type FieldDiveNavItemKey = "jobs" | "newJob" | "catalog" | "templates" | "calendar";

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
  /** When true, section starts collapsed in the sidebar (Advanced). */
  collapsedByDefault?: boolean;
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

export const FIELD_DIVE_NAV_SECTIONS: FieldDiveNavSectionConfig[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        key: "jobs",
        label: "Jobs",
        href: "/tools/roofing/saved",
        kind: "link",
        icon: "briefcase",
      },
      {
        key: "newJob",
        label: "New job",
        href: "/tools/roofing?entry=packet",
        kind: "link",
        icon: "clipboardList",
      },
      {
        key: "calendar",
        label: "Calendar",
        href: "/tools/roofing/calendar",
        kind: "link",
        icon: "calendar",
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    items: [
      {
        key: null,
        label: "Company profile",
        href: "/tools/settings",
        kind: "link",
        icon: "settings",
      },
      {
        key: null,
        label: "Pricing rules",
        href: "/tools/settings/pricing",
        kind: "link",
        icon: "settings",
      },
      {
        key: null,
        label: "Payments",
        href: "/tools/settings/payments",
        kind: "link",
        icon: "settings",
      },
      {
        key: "catalog",
        label: "Catalog",
        href: "/tools/roofing/catalog",
        kind: "link",
        icon: "package",
      },
      {
        key: "templates",
        label: "Proposal templates",
        href: "/tools/roofing/templates",
        kind: "link",
        icon: "layoutTemplate",
      },
    ],
  },
  {
    id: "legacyAndFuture",
    label: "Advanced",
    collapsedByDefault: true,
    items: [
      {
        key: null,
        label: "Instant Estimate",
        kind: "soon",
        icon: "fileText",
        soonTitle: "Instant Estimate — coming later; not part of the primary job workflow",
      },
      {
        key: null,
        label: "Legacy price book",
        href: "/admin/price-book",
        kind: "legacy",
        icon: "bookOpen",
        soonTitle: "Replaced by Catalog — legacy admin shelf only. Do not use for new proposals.",
      },
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
        label: "Estimates (Legacy)",
        kind: "soon",
        icon: "fileText",
        soonTitle:
          "Legacy saved-estimate entry removed from primary nav — use Jobs and New job",
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
