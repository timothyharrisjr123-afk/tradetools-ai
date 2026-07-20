"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import { buildProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import {
  adaptProposalDraftGraphToBuilderPreview,
  validateProposalDraftGraphForJob,
} from "@/app/lib/proposalDraftGraphAdapter";
import { buildProposalBuilderHref } from "@/app/lib/proposalBuilderReadiness";
import {
  evaluateDbProposalLaunchSpine,
  productSpineRouteHintsFromSearchParams,
} from "@/app/lib/productSpine";
import {
  CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL,
  CUSTOMER_PREVIEW_COMPACT_READINESS_COPY,
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_PAGE_TITLE,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
  CUSTOMER_PREVIEW_SEND_SHARING_LABEL,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  getDraftGraph,
  ProposalRecordStoreError,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import {
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { PACKET_PAGE_BACKGROUND, PACKET_STAGE } from "./proposalCustomerPacketStyles";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewSendSharingDrawer from "./ProposalCustomerPreviewSendSharingDrawer";

const SEND_SHARING_BUTTON =
  "inline-flex items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800";

const RETURN_TO_BUILDER_BUTTON =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50";

export default function ProposalCustomerPreviewClient({
  companyId,
  emailDeliveryConfigured,
}: {
  companyId: string;
  emailDeliveryConfigured: boolean;
}) {
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job");
  const proposalIdParam = searchParams.get("proposal");

  const normalizedJobId = (jobIdParam ?? "").trim();
  const normalizedProposalId = (proposalIdParam ?? "").trim();
  const hasValidParams =
    isUuidLike(normalizedJobId) && isUuidLike(normalizedProposalId);

  const routeSpineLaunch = useMemo(
    () =>
      evaluateDbProposalLaunchSpine(
        productSpineRouteHintsFromSearchParams(
          "/tools/roofing/proposals/preview",
          searchParams
        )
      ),
    [searchParams]
  );

  const [job, setJob] = useState<JobRecord | null>(null);
  const [persistedGraph, setPersistedGraph] = useState<ProposalDraftGraph | null>(null);
  const [templateGraph, setTemplateGraph] = useState<ProposalTemplateGraph | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadComplete, setLoadComplete] = useState(false);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementUpdatedAt, setSelectedMeasurementUpdatedAt] = useState<string | null>(
    null
  );
  const [sendSharingOpen, setSendSharingOpen] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoadComplete(false);
    setLoadError(null);
    setPersistedGraph(null);
    setTemplateGraph(null);
    setJob(null);
    setSendSharingOpen(false);

    if (!routeSpineLaunch.allowed) {
      setLoadError(
        routeSpineLaunch.errorMessage ??
          "A valid DB proposal route is required to preview this draft."
      );
      setLoadComplete(true);
      return;
    }

    if (!hasValidParams) {
      setLoadError("A valid job and proposal are required to preview this draft.");
      setLoadComplete(true);
      return;
    }

    try {
      const [jobRecord, graph, catalog] = await Promise.all([
        getJobById(normalizedJobId),
        getDraftGraph(companyId, normalizedProposalId),
        getActiveCatalogItemsByCompany(companyId),
      ]);

      setJob(jobRecord);
      setCatalogItems(catalog);

      const validation = validateProposalDraftGraphForJob(graph, normalizedJobId);
      if (!validation.valid) {
        setLoadError(validation.message);
        return;
      }

      setPersistedGraph(graph);

      const measurement = await getSelectedMeasurementForJob(normalizedJobId);
      setSelectedMeasurementId(measurement?.id ?? null);
      setSelectedMeasurementUpdatedAt(measurement?.updated_at ?? null);

      const template = await getProposalTemplateGraph(graph.proposal.template_id, { companyId });
      setTemplateGraph(template);
    } catch (err) {
      const message =
        err instanceof ProposalRecordStoreError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load proposal preview.";
      setLoadError(message);
      if (!(err instanceof ProposalRecordStoreError)) {
        console.warn("[ProposalCustomerPreviewClient] load error:", err);
      }
    } finally {
      setLoadComplete(true);
    }
  }, [
    companyId,
    hasValidParams,
    normalizedJobId,
    normalizedProposalId,
    routeSpineLaunch.allowed,
    routeSpineLaunch.errorMessage,
  ]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const pricingStale = useMemo(() => {
    if (!persistedGraph) return { stale: false, reason: null as string | null };
    const adapter = adaptProposalDraftGraphToBuilderPreview(persistedGraph);
    return deriveProposalPricingStale({
      snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
      currentMeasurementId: selectedMeasurementId,
      snapshotUpdatedAt: persistedGraph.proposal.updated_at,
      measurementUpdatedAt: selectedMeasurementUpdatedAt,
    });
  }, [persistedGraph, selectedMeasurementId, selectedMeasurementUpdatedAt]);

  const previewDocument = useMemo(() => {
    if (!persistedGraph) return null;
    return buildProposalCustomerPreviewDocument(persistedGraph, {
      pricingStale,
    });
  }, [persistedGraph, pricingStale]);

  const builderHref = buildProposalBuilderHref(normalizedJobId, normalizedProposalId);
  const jobIdentity = resolveJobIdentityDisplay(job, "Proposal preview");

  const estimateIncomplete =
    previewDocument != null &&
    (!previewDocument.readiness.pricingComplete ||
      previewDocument.readiness.blockingLineCount > 0);

  const identityLine = [
    jobIdentity.primaryLabel,
    jobIdentity.secondaryAddress,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`min-h-full pb-16 ${PACKET_PAGE_BACKGROUND}`}>
      <header className={`${PACKET_STAGE} border-b border-slate-200/80 bg-white/90 pb-4 pt-5 backdrop-blur`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href={builderHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL}
            </Link>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {CUSTOMER_PREVIEW_PAGE_TITLE}
              </p>
              <p className="text-sm text-slate-500">{CUSTOMER_PREVIEW_DRAFT_NOTICE}</p>
            </div>
            <h1
              className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-slate-950 sm:text-[1.5rem]"
              data-preview-job-primary-identity
            >
              {identityLine || jobIdentity.primaryLabel}
            </h1>
          </div>
          {loadComplete && previewDocument && persistedGraph ? (
            <div className="shrink-0 sm:pt-7">
              <button
                type="button"
                className={SEND_SHARING_BUTTON}
                aria-expanded={sendSharingOpen}
                aria-controls="preview-send-sharing-panel"
                data-preview-send-sharing-toggle
                onClick={() => setSendSharingOpen(true)}
              >
                <Share2 className="h-4 w-4" aria-hidden />
                {CUSTOMER_PREVIEW_SEND_SHARING_LABEL}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {!loadComplete ? (
        <div className={`${PACKET_STAGE} pt-8`}>
          <div className="text-sm text-slate-500">Loading preview…</div>
        </div>
      ) : loadError ? (
        <div className={`${PACKET_STAGE} pt-8`}>
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        </div>
      ) : previewDocument && persistedGraph ? (
        <div className={`${PACKET_STAGE} space-y-6 pt-8`}>
          {/* Compact contractor readiness — outside the customer document. */}
          {estimateIncomplete ? (
            <div
              className="flex flex-col gap-2.5 rounded-md border border-amber-200/70 bg-amber-50/50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              data-preview-contractor-warning
              data-preview-compact-readiness
            >
              <p className="text-[13px] leading-snug text-amber-950/90">
                {CUSTOMER_PREVIEW_COMPACT_READINESS_COPY}
              </p>
              <Link href={builderHref} className={RETURN_TO_BUILDER_BUTTON}>
                {CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION}
              </Link>
            </div>
          ) : null}

          {/* Customer proposal packet — single continuous paper surface. */}
          <ProposalCustomerPreviewDocumentView
            document={previewDocument}
            templateGraph={templateGraph}
            catalogItems={catalogItems}
          />

          <ProposalCustomerPreviewSendSharingDrawer
            open={sendSharingOpen}
            onClose={() => setSendSharingOpen(false)}
            jobId={normalizedJobId}
            proposalId={normalizedProposalId}
            graph={persistedGraph}
            job={job}
            previewReadiness={previewDocument.readiness}
            pricingStale={pricingStale.stale}
            emailDeliveryConfigured={emailDeliveryConfigured}
          />
        </div>
      ) : null}
    </div>
  );
}
