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
 * V2C1 — Customer document canvas with no admin packet framing.
 */
export default function ProposalPreviewReviewSurface({
  children,
}: ProposalPreviewReviewSurfaceProps) {
  return (
    <section
      className={PREVIEW_REVIEW_SURFACE}
      data-preview-customer-canvas
      data-preview-review-surface
      aria-label="Customer proposal"
    >
      <div className={PREVIEW_REVIEW_SURFACE_PAD}>
        <p className="sr-only" data-preview-review-surface-label>
          Customer proposal document
        </p>
        <div data-preview-customer-document data-preview-packet>
          {children}
        </div>
      </div>
    </section>
  );
}
