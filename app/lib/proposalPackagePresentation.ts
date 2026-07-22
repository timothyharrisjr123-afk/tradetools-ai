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
    description:
      "Solid, complete roof replacement with quality materials and professional installation.",
    bullets: ["Architectural shingles", "Full install & cleanup"],
    accent: "standard",
  },
  enhanced: {
    description:
      "Stronger weather protection with upgraded underlayment and ice and water shield.",
    bullets: ["Upgraded underlayment", "Ice & water protection"],
    accent: "enhanced",
  },
  premium: {
    description:
      "Highest-protection package with premium shingles and upgraded weather layers.",
    bullets: ["Premium shingles", "Maximum weather protection"],
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
      description: "A complete roofing package with quality materials and professional installation.",
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
