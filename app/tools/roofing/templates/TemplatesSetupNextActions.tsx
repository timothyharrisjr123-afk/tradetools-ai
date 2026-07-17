"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import { TEMPLATES_CARD } from "./templatesConstants";

type TemplatesSetupNextActionsProps = {
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  onFixLinks: () => void;
};

export default function TemplatesSetupNextActions({
  proposalReadiness,
  linkReadiness,
  onFixLinks,
}: TemplatesSetupNextActionsProps) {
  const companyReady = proposalReadiness.status === "ready_for_builder";
  const linksReady = linkReadiness.severity === "ready" && linkReadiness.totalItems > 0;
  const needsFix = linkReadiness.nextAction === "fix_links";
  const needsAdd = linkReadiness.nextAction === "add_items";

  return (
    <section
      className={TEMPLATES_CARD}
      aria-labelledby="templates-next-actions-heading"
      data-templates-next-actions
      data-templates-link-severity={linkReadiness.severity}
    >
      <h2 id="templates-next-actions-heading" className="text-sm font-semibold text-slate-900">
        Setup → proposal path
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Catalog is the source of truth for item economics. This template links Catalog items into
        structure. Proposals are created from a Job Card (job + measurement + template), then open in
        Builder as frozen snapshots.
      </p>

      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800" data-templates-link-summary>
          {linkReadiness.summaryLabel}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{linkReadiness.detail}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {needsFix ? (
          <button
            type="button"
            onClick={onFixLinks}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            data-templates-fix-links
          >
            Fix Catalog links
          </button>
        ) : null}

        {needsAdd ? (
          <p className="text-xs text-amber-800" data-templates-add-items-hint>
            Use <span className="font-semibold">Add item from catalog</span> on a line-items or
            upgrade section below.
          </p>
        ) : null}

        {companyReady && linksReady ? (
          <Link
            href="/tools/roofing/saved"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            data-templates-open-jobs
          >
            Open Jobs to create a proposal
          </Link>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_catalog" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            data-templates-open-catalog
          >
            Open Catalog setup
          </Link>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_pricing" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            data-templates-open-catalog-pricing
          >
            Price Catalog items
          </Link>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        There is no Create proposal button on this page — Job context is required. Existing drafts
        keep snapshotted prices until you refresh draft pricing in Builder.
      </p>
    </section>
  );
}
