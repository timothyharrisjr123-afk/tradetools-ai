/**
 * Customer packet detail tab content guards — omit contractor-review boilerplate.
 */

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

const GENERIC_OVERVIEW_PATTERN =
  /outlines a roof replacement scope based on field measurements/i;

export const PROPOSAL_CUSTOMER_PACKET_OVERVIEW_COPY =
  "This proposal summarizes the roof replacement package, included scope, and available options for your home.";

export function finalizeCustomerPacketDetailBody(pageType: string, body: string): string {
  const normalized = normalizeCustomerPacketDetailBody(body);
  if (pageType === "project_overview" && GENERIC_OVERVIEW_PATTERN.test(normalized)) {
    return PROPOSAL_CUSTOMER_PACKET_OVERVIEW_COPY;
  }
  return normalized;
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
