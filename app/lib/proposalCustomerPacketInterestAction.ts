/**
 * Soft, non-binding customer package interest links for the public proposal.
 *
 * Presentation only: mailto / tel / in-page anchor. No proposal status,
 * selection, approval, signature, or payment mutations.
 */

export type ProposalCustomerPacketInterestContact = {
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
};

export type PackageInterestIntent = "request" | "ask-about" | "question";

export const PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR = "proposal-ready-to-move-forward";

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function packagePhrase(packageLabel: string): string {
  const label = trimOrEmpty(packageLabel);
  return label || "recommended package";
}

/**
 * Build a contact href for package interest. Prefers email, then phone,
 * then scrolls to the closeout contact section. Never mutates proposal truth.
 */
export function buildPackageInterestHref(
  contact: ProposalCustomerPacketInterestContact | null | undefined,
  packageLabel: string,
  intent: PackageInterestIntent = "request"
): string {
  const email = trimOrEmpty(contact?.email);
  const phone = trimOrEmpty(contact?.phone);
  const pkg = packagePhrase(packageLabel);

  if (email) {
    const subject =
      intent === "request"
        ? `Request ${pkg} package`
        : intent === "ask-about"
          ? `Question about ${pkg} package`
          : "Question about my roofing proposal";
    const body =
      intent === "request"
        ? `Hi,\n\nI'm interested in the ${pkg} package from my proposal. Please contact me to confirm details.\n`
        : intent === "ask-about"
          ? `Hi,\n\nI'd like to ask about the ${pkg} package from my proposal.\n`
          : `Hi,\n\nI have a question about my roofing proposal.\n`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (phone) {
    return `tel:${phone}`;
  }

  return `#${PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR}`;
}

export function buildAskQuestionHref(
  contact: ProposalCustomerPacketInterestContact | null | undefined
): string {
  return buildPackageInterestHref(contact, "", "question");
}

export function contactCompanyLabel(
  contact: ProposalCustomerPacketInterestContact | null | undefined
): string | null {
  const name = trimOrEmpty(contact?.companyName);
  return name || null;
}
