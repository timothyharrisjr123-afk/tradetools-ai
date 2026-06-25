import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import type { ProposalPublicProposalCoverSectionViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import {
  PUBLIC_PROPOSAL_ACCENT_BAR,
  PUBLIC_PROPOSAL_BODY,
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_SECTION_LABEL,
} from "./publicProposalStyles";

type PublicProposalCoverSectionProps = {
  cover: ProposalPublicProposalCoverSectionViewModel;
  brandPrimaryColor: string | null;
};

function DetailBlock({
  label,
  lines,
}: {
  label: string;
  lines: (string | null | undefined)[];
}) {
  const values = lines.map((line) => (line ?? "").trim()).filter(Boolean);
  if (values.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>{label}</p>
      {values.map((value) => (
        <p key={`${label}-${value}`} className="text-[15px] leading-snug text-slate-800">
          {value}
        </p>
      ))}
    </div>
  );
}

export default function PublicProposalCoverSection({
  cover,
  brandPrimaryColor,
}: PublicProposalCoverSectionProps) {
  const accentColor = brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;

  return (
    <section className={PUBLIC_PROPOSAL_CARD} aria-label="Proposal cover">
      <div className={PUBLIC_PROPOSAL_ACCENT_BAR} style={{ backgroundColor: accentColor }} aria-hidden />

      <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-6`}>
        {cover.headline ? (
          <div className="space-y-2">
            <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>Proposal</p>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[1.75rem]">
              {cover.headline}
            </h1>
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          {cover.customer.hasAnyField ? (
            <DetailBlock
              label="Prepared for"
              lines={[cover.customer.customerName, cover.customer.customerEmail, cover.customer.customerPhone]}
            />
          ) : null}

          {cover.project.hasAnyField ? (
            <DetailBlock
              label="Project"
              lines={[cover.project.jobName, cover.project.propertyAddress]}
            />
          ) : null}
        </div>

        {cover.company.hasAnyField ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-4">
            <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>Prepared by</p>
            <div className="mt-2 space-y-1">
              {[
                cover.company.companyName,
                cover.company.phone,
                cover.company.email,
                cover.company.website,
                cover.company.license ? `License ${cover.company.license}` : null,
                cover.company.address,
              ]
                .map((line) => (line ?? "").trim())
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="text-[15px] leading-snug text-slate-800">
                    {line}
                  </p>
                ))}
            </div>
          </div>
        ) : null}

        {cover.packageSummary.packageName || cover.packageSummary.totalDisplay ? (
          <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-4">
            <p className={PUBLIC_PROPOSAL_SECTION_LABEL}>Selected package</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              {cover.packageSummary.packageName ? (
                <p className="text-base font-semibold text-slate-900">{cover.packageSummary.packageName}</p>
              ) : null}
              {cover.packageSummary.totalDisplay ? (
                <p className="text-lg font-semibold tabular-nums text-slate-950">
                  {cover.packageSummary.totalDisplay}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {cover.heroContent?.bodyDisplay ? (
          <div className="space-y-2 border-t border-slate-100 pt-5">
            {cover.heroContent.title ? (
              <h2 className="text-lg font-semibold text-slate-950">{cover.heroContent.title}</h2>
            ) : null}
            <div className={PUBLIC_PROPOSAL_BODY}>{cover.heroContent.bodyDisplay}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
