/**
 * Authored package sales-language presentation.
 *
 * Description comes only from persisted template/draft/frozen wording.
 * Factual bullets are supplied by the composition presentation adapter.
 * No Standard / Enhanced / Premium marketing fallbacks.
 * No React, DB, or pricing logic.
 */

export type PackageAccent = "standard" | "enhanced" | "premium" | "default";

export type PackageMeta = {
  /** Authored customer description; null when blank — never invented. */
  description: string | null;
  /** Customer-safe composition facts. Empty when none apply (including base). */
  bullets: string[];
  /**
   * Visual tint only. Matching starter names is display fallback, not
   * customer/business truth and not a recommendation.
   */
  accent: PackageAccent;
};

function resolvePackageAccent(label: string): PackageAccent {
  const key = label.trim().toLowerCase();
  if (key === "standard") return "standard";
  if (key === "enhanced") return "enhanced";
  if (key === "premium") return "premium";
  return "default";
}

/**
 * Resolve customer-facing package presentation.
 * Authored description is the narrative source of truth when present.
 * Blank description omits copy rather than inventing a package-name story.
 * Fact lines must already be customer-safe; this helper does not derive them.
 */
export function resolvePackageMeta(
  label: string,
  authoredDescription?: string | null,
  factLines?: readonly string[] | null
): PackageMeta {
  const authored = String(authoredDescription ?? "").trim();
  return {
    description: authored.length > 0 ? authored : null,
    bullets: (factLines ?? [])
      .map((line) => String(line ?? "").trim())
      .filter((line) => line.length > 0),
    accent: resolvePackageAccent(label),
  };
}
