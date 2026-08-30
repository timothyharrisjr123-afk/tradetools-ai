"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download } from "lucide-react";

import {
  CONTRACTOR_PDF_DOWNLOAD_LABEL,
  CONTRACTOR_PDF_DOWNLOAD_SIGNED_LABEL,
  CONTRACTOR_PDF_PREPARING_LABEL,
  CONTRACTOR_PDF_UNAVAILABLE_MESSAGE,
  hasContractorProposalPdfSignedFinal,
} from "@/app/lib/proposalPdfContractorDownload";
import { downloadContractorProposalPdf } from "@/app/lib/proposalPdfContractorDownloadClient";
import {
  PROPOSAL_PDF_ARTIFACT_SENT,
  PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL,
  type ProposalPdfArtifactType,
} from "@/app/lib/proposalPdfTypes";
import { isUuidLike } from "@/app/lib/uuid";

const SECONDARY_ACTION =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 sm:min-h-9";

type ProposalPreviewPdfActionsProps = {
  companyId: string;
  proposalId: string;
  versionId: string;
};

/**
 * Quiet secondary PDF actions for sent-record Preview only.
 * Never mount on draft Preview.
 */
export default function ProposalPreviewPdfActions({
  companyId,
  proposalId,
  versionId,
}: ProposalPreviewPdfActionsProps) {
  const [signedAvailable, setSignedAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ProposalPdfArtifactType | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (
      !isUuidLike(companyId) ||
      !isUuidLike(proposalId) ||
      !isUuidLike(versionId)
    ) {
      setSignedAvailable(false);
      return;
    }
    let cancelled = false;
    void hasContractorProposalPdfSignedFinal({
      companyId,
      proposalId,
      proposalVersionId: versionId,
    }).then((available) => {
      if (!cancelled) setSignedAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, proposalId, versionId]);

  const busy = pending || activeArtifact != null;

  const onDownload = (artifactType: ProposalPdfArtifactType) => {
    if (busy) return;
    setError(null);
    setActiveArtifact(artifactType);
    const requestId = ++requestIdRef.current;
    startTransition(() => {
      void downloadContractorProposalPdf({
        proposalId,
        versionId,
        artifactType,
      }).then((result) => {
        if (requestId !== requestIdRef.current) return;
        setActiveArtifact(null);
        if (!result.ok) {
          setError(result.message || CONTRACTOR_PDF_UNAVAILABLE_MESSAGE);
        }
      });
    });
  };

  const preparingSent = activeArtifact === PROPOSAL_PDF_ARTIFACT_SENT;
  const preparingSigned = activeArtifact === PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL;

  return (
    <div
      className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end"
      data-preview-pdf-actions
      aria-label="Proposal PDF downloads"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={SECONDARY_ACTION}
          data-preview-download-pdf
          data-preview-pdf-version={versionId}
          data-preview-pdf-artifact={PROPOSAL_PDF_ARTIFACT_SENT}
          disabled={busy}
          onClick={() => onDownload(PROPOSAL_PDF_ARTIFACT_SENT)}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {preparingSent ? CONTRACTOR_PDF_PREPARING_LABEL : CONTRACTOR_PDF_DOWNLOAD_LABEL}
        </button>
        {signedAvailable ? (
          <button
            type="button"
            className={SECONDARY_ACTION}
            data-preview-download-signed-pdf
            data-preview-pdf-version={versionId}
            data-preview-pdf-artifact={PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL}
            disabled={busy}
            onClick={() => onDownload(PROPOSAL_PDF_ARTIFACT_SIGNED_FINAL)}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {preparingSigned
              ? CONTRACTOR_PDF_PREPARING_LABEL
              : CONTRACTOR_PDF_DOWNLOAD_SIGNED_LABEL}
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          className="max-w-[16rem] text-right text-[11.5px] text-slate-500"
          data-preview-pdf-error
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
