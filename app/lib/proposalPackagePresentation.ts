/**
 * Pure package label → customer-facing presentation metadata.
 *
 * Shared by Builder package cards/selector and customer Preview estimate hero.
 * No React, DB, or pricing logic.
 */

export type PackageAccent = "standard" | "enhanced" | "premium" | "default";

export type PackageMeta = {
  description: string;
  bullets: [string, string];
  accent: PackageAccent;
};

const PACKAGE_META_BY_LABEL: Record<string, PackageMeta> = {
  standard: {
    description: "Reliable protection with quality materials.",
    bullets: ["25 Year Shingles", "Standard Underlayment"],
    accent: "standard",
  },
  enhanced: {
    description: "Better materials and added peace of mind.",
    bullets: ["30 Year Shingles", "Upgraded Underlayment"],
    accent: "enhanced",
  },
  premium: {
    description: "Best performance and maximum protection.",
    bullets: ["50 Year Shingles", "Premium Underlayment"],
    accent: "premium",
  },
};

/**
 * Resolve customer-facing package presentation.
 * Authored template/snapshot description is source of truth when present.
 * Hardcoded Standard/Enhanced/Premium (and generic) copy is fallback only.
 */
export function resolvePackageMeta(
  label: string,
  authoredDescription?: string | null
): PackageMeta {
  const key = label.trim().toLowerCase();
  const fallback =
    PACKAGE_META_BY_LABEL[key] ?? {
      description: "Customer-facing package option.",
      bullets: ["Quality materials", "Professional installation"],
      accent: "default" as const,
    };
  const authored = String(authoredDescription ?? "").trim();
  if (!authored) return fallback;
  return {
    ...fallback,
    description: authored,
  };
}
