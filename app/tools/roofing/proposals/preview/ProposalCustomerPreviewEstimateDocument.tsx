"use client";

import { Check } from "lucide-react";
import type { CustomerPreviewEstimatePresentation } from "@/app/lib/proposalCustomerEstimatePresenter";
import { CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY } from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  CUSTOMER_PREVIEW_ESTIMATE_PACKAGE_HERO,
  CUSTOMER_PREVIEW_ESTIMATE_PARTIAL_PRICING_NOTE,
  CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL,
  CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL_HEADER,
  CUSTOMER_PREVIEW_ESTIMATE_UPGRADES_HEADING,
  CUSTOMER_PREVIEW_ESTIMATE_UPGRADES_PANEL,
  CUSTOMER_PREVIEW_SCOPE_SECTION_HEADING,
  CUSTOMER_PREVIEW_SELECTED_PACKAGE_LABEL,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewLineList from "./ProposalCustomerPreviewLineList";
import ProposalCustomerPreviewTotals from "./ProposalCustomerPreviewTotals";

type ProposalCustomerPreviewEstimateDocumentProps = {
  presentation: CustomerPreviewEstimatePresentation;
  /** Page/chapter title from the estimate page header — used to avoid duplicate section headings. */
  chapterTitle: string;
  pricingComplete: boolean;
};

function resolveScopeSectionHeading(sectionTitle: string, chapterTitle: string): string {
  const normalizedSection = sectionTitle.trim().toLowerCase();
  const normalizedChapter = chapterTitle.trim().toLowerCase();
  if (normalizedSection === normalizedChapter) {
    return CUSTOMER_PREVIEW_SCOPE_SECTION_HEADING;
  }
  return sectionTitle;
}

export default function ProposalCustomerPreviewEstimateDocument({
  presentation,
  chapterTitle,
  pricingComplete,
}: ProposalCustomerPreviewEstimateDocumentProps) {
  const { packageHero, scopeSections, upgradeSections, totals, showFinalizingMessage } =
    presentation;

  const hasScopeContent = scopeSections.length > 0;
  const showPartialPricingNote = hasScopeContent && !pricingComplete && !totals.show;

  return (
    <div className="space-y-10">
      {packageHero.label ? (
        <section className={CUSTOMER_PREVIEW_ESTIMATE_PACKAGE_HERO}>
          <div className="flex items-start gap-4">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-100/80"
              aria-hidden
            >
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600/90">
                {CUSTOMER_PREVIEW_SELECTED_PACKAGE_LABEL}
              </p>
              <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">
                {packageHero.label}
              </h3>
              {packageHero.description ? (
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-slate-600">
                  {packageHero.description}
                </p>
              ) : null}
              {packageHero.bullets.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {packageHero.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2.5 text-[14px] leading-snug text-slate-700"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden
                        strokeWidth={2.5}
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {hasScopeContent ? (
        <div className="space-y-5">
          {scopeSections.map((section) => {
            const heading = resolveScopeSectionHeading(section.title, chapterTitle);
            return (
              <section key={section.sectionId} className={CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL}>
                <header className={CUSTOMER_PREVIEW_ESTIMATE_SCOPE_PANEL_HEADER}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      {heading}
                    </h3>
                    <span className="text-[12px] font-medium text-slate-500">
                      {section.lines.length}{" "}
                      {section.lines.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  {heading !== section.title ? (
                    <p className="mt-1 text-[13px] text-slate-500">{section.title}</p>
                  ) : null}
                </header>
                <div className="px-5 py-4">
                  <ProposalCustomerPreviewLineList lines={section.lines} variant="scope" />
                </div>
              </section>
            );
          })}
          {showPartialPricingNote ? (
            <p className="text-[13px] leading-relaxed text-slate-500">
              {CUSTOMER_PREVIEW_ESTIMATE_PARTIAL_PRICING_NOTE}
            </p>
          ) : null}
        </div>
      ) : showFinalizingMessage ? (
        <p className="max-w-prose rounded-xl border border-slate-200/80 bg-slate-50/50 px-5 py-4 text-[15px] leading-relaxed text-slate-600">
          {CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY}
        </p>
      ) : null}

      {upgradeSections.length > 0 ? (
        <section className={CUSTOMER_PREVIEW_ESTIMATE_UPGRADES_PANEL}>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
            {CUSTOMER_PREVIEW_ESTIMATE_UPGRADES_HEADING}
          </h3>
          <p className="mt-1 text-[13px] text-slate-500">
            Optional add-ons shown separately from the base scope.
          </p>
          <div className="mt-5 space-y-5">
            {upgradeSections.map((section) => (
              <div key={section.sectionId}>
                <h4 className="text-[15px] font-medium text-slate-800">{section.title}</h4>
                <div className="mt-3">
                  <ProposalCustomerPreviewLineList lines={section.lines} variant="upgrade" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ProposalCustomerPreviewTotals totals={totals} />
    </div>
  );
}
