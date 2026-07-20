"use client";

import type { CustomerPreviewEstimatePresentation } from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  CUSTOMER_PREVIEW_ESTIMATE_PACKAGE_BAND,
  CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL,
  CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL_HEADER,
  CUSTOMER_PREVIEW_SCOPE_SECTION_HEADING,
  CUSTOMER_PREVIEW_SELECTED_PACKAGE_LABEL,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewLineList from "./ProposalCustomerPreviewLineList";
import ProposalCustomerPreviewTotals from "./ProposalCustomerPreviewTotals";

type ProposalCustomerPreviewEstimateDocumentProps = {
  presentation: CustomerPreviewEstimatePresentation;
  /** Page/chapter title from the estimate page header — used to avoid duplicate section headings. */
  chapterTitle: string;
  /** Kept for call-site compatibility; incomplete totals use the contractor warning above the document. */
  pricingComplete: boolean;
};

function resolveScopeSectionHeading(sectionTitle: string, chapterTitle: string): string {
  const normalizedSection = sectionTitle.trim().toLowerCase();
  const normalizedChapter = chapterTitle.trim().toLowerCase();
  if (
    normalizedSection === normalizedChapter ||
    normalizedSection === "included scope" ||
    normalizedSection === "included estimate"
  ) {
    return CUSTOMER_PREVIEW_SCOPE_SECTION_HEADING;
  }
  return sectionTitle;
}

export default function ProposalCustomerPreviewEstimateDocument({
  presentation,
  chapterTitle,
}: ProposalCustomerPreviewEstimateDocumentProps) {
  const { packageHero, scopeSections, totals } = presentation;

  const hasScopeContent = scopeSections.length > 0;
  const bulletSummary =
    packageHero.bullets.length > 0 ? packageHero.bullets.join(" · ") : null;

  return (
    <div className="space-y-8" data-preview-estimate-document>
      {packageHero.label ? (
        <section
          className={CUSTOMER_PREVIEW_ESTIMATE_PACKAGE_BAND}
          data-preview-selected-package
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {CUSTOMER_PREVIEW_SELECTED_PACKAGE_LABEL}
          </p>
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                {packageHero.label}
              </h3>
              {packageHero.description ? (
                <p className="mt-1 text-[14px] leading-relaxed text-slate-600">
                  {packageHero.description}
                </p>
              ) : null}
              {bulletSummary ? (
                <p className="mt-2 text-[13px] leading-snug text-slate-500">{bulletSummary}</p>
              ) : null}
            </div>
            {totals.show && totals.totalLabel ? (
              <p className="shrink-0 text-right">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Total
                </span>
                <span className="mt-0.5 block text-xl font-semibold tabular-nums tracking-tight text-slate-950">
                  {totals.totalLabel}
                </span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasScopeContent ? (
        <div className="space-y-6">
          {scopeSections.map((section) => {
            const heading = resolveScopeSectionHeading(section.title, chapterTitle);
            return (
              <section
                key={section.sectionId}
                className={CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL}
                data-preview-included-estimate
              >
                {section.showHeading ? (
                  <header className={CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL_HEADER}>
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                      {heading}
                    </h3>
                  </header>
                ) : null}
                <ProposalCustomerPreviewLineList lines={section.lines} variant="scope" />
              </section>
            );
          })}
        </div>
      ) : null}

      {/* Upgrade selection is not supported yet — do not render upgrade_group sections.
          Incomplete pricing copy stays outside the document (contractor warning). */}
      <ProposalCustomerPreviewTotals totals={totals} />
    </div>
  );
}
