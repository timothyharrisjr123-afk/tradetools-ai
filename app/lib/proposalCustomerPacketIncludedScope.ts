/**
 * Customer-facing "What is included" main cards.
 *
 * Permits & fees remain in pricing totals and full-scope details;
 * they are not shown as premium main benefit cards.
 */

export const PROPOSAL_CUSTOMER_PACKET_MAIN_INCLUDED_SCOPE_TITLES = [
  "Roofing materials",
  "Ventilation & flashing",
  "Installation & labor",
  "Cleanup & disposal",
] as const;

export type ProposalCustomerPacketMainIncludedScopeTitle =
  (typeof PROPOSAL_CUSTOMER_PACKET_MAIN_INCLUDED_SCOPE_TITLES)[number];

const MAIN_INCLUDED_SCOPE_TITLE_SET = new Set<string>(
  PROPOSAL_CUSTOMER_PACKET_MAIN_INCLUDED_SCOPE_TITLES
);

export const PROPOSAL_CUSTOMER_PACKET_PERMITS_FEES_SCOPE_TITLE = "Permits & fees";

export function isMainIncludedScopeCardTitle(title: string): boolean {
  return MAIN_INCLUDED_SCOPE_TITLE_SET.has(title);
}

export function filterMainIncludedScopeSummaries<T extends { title: string }>(
  summaries: readonly T[]
): T[] {
  return summaries.filter((summary) => isMainIncludedScopeCardTitle(summary.title));
}

export function sortMainIncludedScopeSummaries<T extends { title: string }>(
  summaries: readonly T[]
): T[] {
  const order = PROPOSAL_CUSTOMER_PACKET_MAIN_INCLUDED_SCOPE_TITLES as readonly string[];
  return [...summaries].sort((a, b) => {
    const ai = order.indexOf(a.title);
    const bi = order.indexOf(b.title);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
