import type { ProposalPublicProposalFooterViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { PUBLIC_PROPOSAL_CARD, PUBLIC_PROPOSAL_CARD_INNER, PUBLIC_PROPOSAL_SECTION_LABEL } from "./publicProposalStyles";

type PublicProposalFooterProps = {
  footer: ProposalPublicProposalFooterViewModel;
};

export default function PublicProposalFooter({ footer }: PublicProposalFooterProps) {
  const { company, supportMessage } = footer;
  const contactLines = [
    company.companyName,
    company.phone,
    company.email,
    company.website,
    company.license ? `License ${company.license}` : null,
    company.address,
  ]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);

  return (
    <footer className={`${PUBLIC_PROPOSAL_CARD} mt-2`}>
      <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-4 text-center sm:text-left`}>
        <div className="space-y-1">
          <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>Questions?</p>
          <p className="text-sm leading-relaxed text-slate-600">{supportMessage}</p>
        </div>

        {contactLines.length > 0 ? (
          <div className="space-y-1 border-t border-slate-100 pt-4">
            <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>Contact</p>
            {contactLines.map((line) => (
              <p key={line} className="text-sm text-slate-700">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
