/**
 * R3A0 — FieldDive-native default customer-facing proposal packet copy.
 *
 * Used as:
 * - seed body_markdown for new default roofing template installs
 * - live starter repair when reusable template sections still match known weak boilerplate
 *   (proposalCustomerPacketContentRepair — template sections only; never proposal_pages)
 * - display-time substitution when a page still carries known weak starter boilerplate
 *   (does not mutate proposal_pages rows; preferred path is durable template repair above)
 *
 * Tokens are display-time merged (R14). Prefer graceful wording when a token is empty.
 */

/** Known weak starter overview (pre-R3A0). */
export const LEGACY_PACKET_OVERVIEW_BODY = `This proposal outlines the recommended roofing work for your property based on the current job information, selected package, and contractor review.

The Estimate page shows the selected option, itemized roofing scope, quantities, and pricing. Supporting pages provide warranty, terms, and project notes so you can review the work clearly before approval.

Final scope details, site conditions, and any open items are confirmed by your contractor before work begins.`;

/** Known weak starter scope notes (pre-R3A0). */
export const LEGACY_PACKET_SCOPE_NOTES_BODY = `Scope notes help clarify what is included, what may need confirmation, and any assumptions behind the proposal. Your final scope is based on the selected package, resolved line items, and contractor review.

If additional work is discovered or requested, your contractor will review the change before it is added to the project.`;

/** Known weak starter warranty (pre-R3A0). */
export const LEGACY_PACKET_WARRANTY_BODY = `Roofing warranties typically include two parts: manufacturer coverage for eligible material defects and workmanship coverage for installation-related issues.

Manufacturer coverage depends on the selected products and manufacturer terms. Workmanship coverage is provided by the contractor and should be reviewed with your final proposal documents.

Your contractor will confirm the applicable warranty details for the selected package before approval.`;

/** Known weak starter terms (pre-R3A0). */
export const LEGACY_PACKET_TERMS_BODY = `Terms and conditions outline how the proposal is reviewed, approved, and completed. Final terms should be confirmed by the contractor before acceptance.

Items such as payment schedule, project timing, exclusions, change requests, site conditions, and warranty references may be completed or updated before the proposal is sent.

Any changes to the approved scope should be reviewed and confirmed in writing before being added to the project.`;

export const DEFAULT_PACKET_OVERVIEW_BODY = `{{company_name}} prepared this roofing proposal for your home.

This proposal is built around the {{selected_package_name}} package — the recommended path for your roof based on the measured scope and the materials selected for this project.

Review what is included, your investment, and any available upgrades. When you are ready, ask questions or confirm the details with our team.`;

export const DEFAULT_PACKET_SCOPE_NOTES_BODY = `Project notes

This proposal is based on the measurements and project details we have for your home.

If we find hidden conditions, or if additional work is needed once the project is underway, we will review those items with you before anything is added.

Final details are confirmed with you before work begins.`;

export const DEFAULT_PACKET_WARRANTY_BODY = `Warranty and protection

Your roof is protected in two ways:

• Manufacturer coverage — for eligible material defects on the products used in your package
• Workmanship coverage — for the quality of the installation itself

These are different protections. The exact coverage depends on the products and package selected for your home.

We will confirm the final warranty details with you before you approve the work.`;

export const DEFAULT_PACKET_TERMS_BODY = `What happens next

1. Review this proposal and ask any questions.
2. Confirm the package, scope, and details when you are ready.
3. After confirmation, we schedule the work and get started.

Until then, treat this as your clear written proposal from {{company_name}}.

If anything in the approved scope needs to change, we will review it with you in writing before the change is added.`;

export const DEFAULT_PACKET_OVERVIEW_TITLE = "Overview";
export const DEFAULT_PACKET_SCOPE_NOTES_TITLE = "Project notes";
export const DEFAULT_PACKET_WARRANTY_TITLE = "Warranty and protection";
export const DEFAULT_PACKET_TERMS_TITLE = "Next steps";

function normalizePacketBodyFingerprint(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

const LEGACY_BY_PAGE_TYPE: Readonly<Record<string, string>> = {
  project_overview: LEGACY_PACKET_OVERVIEW_BODY,
  custom_text: LEGACY_PACKET_SCOPE_NOTES_BODY,
  warranty: LEGACY_PACKET_WARRANTY_BODY,
  terms: LEGACY_PACKET_TERMS_BODY,
};

const DEFAULT_BY_PAGE_TYPE: Readonly<Record<string, string>> = {
  project_overview: DEFAULT_PACKET_OVERVIEW_BODY,
  custom_text: DEFAULT_PACKET_SCOPE_NOTES_BODY,
  warranty: DEFAULT_PACKET_WARRANTY_BODY,
  terms: DEFAULT_PACKET_TERMS_BODY,
};

/**
 * When persisted page markdown still matches known weak starter boilerplate,
 * return the R3A0 default (with tokens) so display merge can personalize it.
 * Otherwise return the original body unchanged.
 */
export function resolveCustomerFacingPacketBodyMarkdown(
  pageType: string,
  rawBody: string | null | undefined
): string | null {
  if (rawBody == null) return null;
  const normalized = normalizePacketBodyFingerprint(rawBody);
  if (!normalized) return null;

  const legacy = LEGACY_BY_PAGE_TYPE[pageType];
  if (legacy && normalized === normalizePacketBodyFingerprint(legacy)) {
    return DEFAULT_BY_PAGE_TYPE[pageType] ?? normalized;
  }

  // Older overview variant still seen in some fixtures / drafts.
  if (
    pageType === "project_overview" &&
    /this proposal outlines a roof replacement scope based on field measurements/i.test(normalized)
  ) {
    return DEFAULT_PACKET_OVERVIEW_BODY;
  }

  return normalized;
}

export function isLegacyWeakPacketBody(pageType: string, rawBody: string | null | undefined): boolean {
  const resolved = resolveCustomerFacingPacketBodyMarkdown(pageType, rawBody);
  const normalized = normalizePacketBodyFingerprint(rawBody ?? "");
  if (!normalized) return false;
  const legacy = LEGACY_BY_PAGE_TYPE[pageType];
  if (legacy && normalized === normalizePacketBodyFingerprint(legacy)) return true;
  if (
    pageType === "project_overview" &&
    /this proposal outlines/i.test(normalized)
  ) {
    return true;
  }
  return resolved !== normalized;
}
