/**
 * Customer packet detail tab content guards — omit contractor-review boilerplate.
 * R3A0: polish known weak starter bodies at display time without mutating rows.
 */

import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  resolveCustomerFacingPacketBodyMarkdown,
} from "@/app/lib/proposalCustomerPacketDefaultContent";

const CONTRACTOR_REVIEW_DETAIL_PATTERNS = [
  /should be reviewed and completed by the contractor before sending/i,
  /should be confirmed by the contractor before work begins/i,
  /custom text page/i,
  /content for this page is not available yet/i,
  /placeholder/i,
] as const;

/** Trailing template merge artifacts (e.g. overview body ending with " Yes"). */
const TRAILING_ARTIFACT_PATTERN = /\s+Yes\s*$/i;

export function normalizeCustomerPacketDetailBody(body: string): string {
  return body.replace(TRAILING_ARTIFACT_PATTERN, "").trim();
}

/**
 * Soften empty R14 token merges so homeowner copy stays readable.
 */
export function cleanupCustomerPacketDisplayArtifacts(body: string): string {
  let next = body;
  // Leading empty company_name → "We prepared…"
  next = next.replace(/^\s*prepared this roofing proposal/i, "We prepared this roofing proposal");
  // Empty **{{selected_package_name}}** or bare empties → "your selected"
  next = next.replace(
    /around the\s+\*\*\s*\*\*\s+package/gi,
    "around your selected package"
  );
  next = next.replace(/around the\s+package\b/gi, "around your selected package");
  next = next.replace(/\bfrom\s+\./g, "from our team.");
  next = next.replace(/\bfrom\s+$/gm, "from our team.");
  next = next.replace(/\*\*\s*\*\*/g, "").replace(/[ \t]{2,}/g, " ");
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

const GENERIC_OVERVIEW_PATTERN =
  /outlines a roof replacement scope based on field measurements/i;

/** Display fallback when overview is still known-generic (tokens already merged). */
export const PROPOSAL_CUSTOMER_PACKET_OVERVIEW_COPY =
  "We prepared this roofing proposal for your home. Review the recommended package, what is included, your investment, and any available upgrades — then ask questions or confirm details when you are ready.";

export function finalizeCustomerPacketDetailBody(pageType: string, body: string): string {
  const normalized = normalizeCustomerPacketDetailBody(body);
  if (pageType === "project_overview" && GENERIC_OVERVIEW_PATTERN.test(normalized)) {
    return PROPOSAL_CUSTOMER_PACKET_OVERVIEW_COPY;
  }
  return cleanupCustomerPacketDisplayArtifacts(normalized);
}

/**
 * Prefer R3A0 seed when persisted markdown still matches known weak starter boilerplate.
 * Call before R14 token merge.
 */
export function prepareCustomerPacketDetailRawBody(
  pageType: string,
  rawBody: string | null | undefined
): string | null {
  return resolveCustomerFacingPacketBodyMarkdown(pageType, rawBody);
}

export function isCustomerPacketPlaceholderDetailBody(body: string): boolean {
  const normalized = normalizeCustomerPacketDetailBody(body);
  if (normalized.length === 0) {
    return true;
  }

  for (const pattern of CONTRACTOR_REVIEW_DETAIL_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

export function isCustomerPacketMeaningfulDetailBody(body: string): boolean {
  return !isCustomerPacketPlaceholderDetailBody(body);
}

// Re-export for tests that assert seed upgrade path.
export { DEFAULT_PACKET_OVERVIEW_BODY };
