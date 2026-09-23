"use client";

import AstraG5StarterPacketPreview from "@/app/tools/roofing/proposals/preview/AstraG5StarterPacketPreview";
import type { AstraG5StarterCompanyBrandingInput } from "@/app/lib/astraG5StarterPacketPreview";

export type JobCardFirstProposalTemplatePreviewProps = {
  /** When false, hide (e.g. custom non-starter template already chosen). */
  visible: boolean;
  /**
   * First-use activation shows the customer-document preview.
   * Activated/reuse Prepare stays quiet (no preview education).
   */
  showDocumentPreview?: boolean;
  branding?: AstraG5StarterCompanyBrandingInput | null;
};

/**
 * Preview-led first template understanding — reuses Customer Preview packet leafs.
 * Full persisted Customer Preview still opens after draft create.
 */
export default function JobCardFirstProposalTemplatePreview({
  visible,
  showDocumentPreview = false,
  branding = null,
}: JobCardFirstProposalTemplatePreviewProps) {
  if (!visible || !showDocumentPreview) return null;

  return (
    <div data-first-proposal-template-preview>
      <AstraG5StarterPacketPreview
        branding={branding}
        density="compact"
        className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 sm:px-4"
      />
    </div>
  );
}
