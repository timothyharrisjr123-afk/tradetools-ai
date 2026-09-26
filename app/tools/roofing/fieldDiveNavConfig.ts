/**
 * FieldDive sidebar nav config (R7) — labels, grouping, and hrefs only.
 * Icons and rendering live in FieldDiveAppShell.tsx.
 */

export type FieldDiveNavSectionId = "operations" | "setup" | "legacyAndFuture";

export type FieldDiveNavItemKey =
  | "jobs"
  | "newJob"
  | "catalog"
  | "templates"
  | "calendar"
  | "company"
  | "pricing";

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
  /** Kept as a record of retired/unavailable entries; never rendered in the sidebar. */
  hiddenFromNavigation?: boolean;
  items: FieldDiveNavItemConfig[];
};

export type FieldDiveNavIconName =
  | "briefcase"
  | "clipboardList"
  | "layoutTemplate"
  | "package"
  | "settings"
  | "building2"
  | "percent"
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
        key: "company",
        label: "Company settings",
        href: "/tools/settings",
        kind: "link",
        icon: "building2",
      },
      {
        key: "pricing",
        label: "Pricing rules",
        href: "/tools/settings/pricing",
        kind: "link",
        icon: "percent",
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
        label: "Templates",
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
    hiddenFromNavigation: true,
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
        kind: "soon",
        icon: "bookOpen",
        soonTitle:
          "Replaced by Catalog — admin service_items shelf retired from navigation (Phase 3)",
      },
      {
        key: null,
        label: "Customers (Legacy)",
        kind: "soon",
        icon: "users",
        soonTitle:
          "Legacy admin customer shelf retired from navigation — use New job / Job Card (Phase 3)",
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
    ],
  },
];

export function getVisibleNavSections(
  sections: FieldDiveNavSectionConfig[] = FIELD_DIVE_NAV_SECTIONS
): FieldDiveNavSectionConfig[] {
  return sections.filter((section) => !section.hiddenFromNavigation);
}

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
