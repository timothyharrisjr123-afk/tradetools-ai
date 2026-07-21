"use client";

import type { ReactNode } from "react";
import {
  PREVIEW_REVIEW_SURFACE,
  PREVIEW_REVIEW_SURFACE_PAD,
} from "./proposalPreviewWorkspaceStyles";

type ProposalPreviewReviewSurfaceProps = {
  children: ReactNode;
};

/**
 * Contractor review surface for customer proposal content.
 * Integrated FieldDive packet — not a document viewer or public page takeover.
 */
export default function ProposalPreviewReviewSurface({
  children,
}: ProposalPreviewReviewSurfaceProps) {
  return (
    <section
      className={PREVIEW_REVIEW_SURFACE}
      data-preview-customer-canvas
      data-preview-review-surface
      aria-label="Customer proposal review"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-3.5 sm:px-10 lg:px-12">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900">Customer proposal preview</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            What the customer will receive
          </p>
        </div>
      </div>
      <div className={PREVIEW_REVIEW_SURFACE_PAD}>
        <p className="sr-only" data-preview-review-surface-label>
          What the customer will receive
        </p>
        <div data-preview-customer-document data-preview-packet>
          {children}
        </div>
      </div>
    </section>
  );
}
