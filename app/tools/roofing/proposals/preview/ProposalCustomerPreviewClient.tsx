"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import { buildProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import { adaptProposalDraftGraphToBuilderPreview, validateProposalDraftGraphForJob } from "@/app/lib/proposalDraftGraphAdapter";
import {
  buildProposalBuilderHref,
} from "@/app/lib/proposalBuilderReadiness";
import {
  evaluateDbProposalLaunchSpine,
  productSpineRouteHintsFromSearchParams,
} from "@/app/lib/productSpine";
import {
  CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL,
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_PAGE_TITLE,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  getDraftGraph,
  ProposalRecordStoreError,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
import {
  deriveProposalPricingStale,
  PROPOSAL_PRICING_STALE_BANNER_COPY,
} from "@/app/lib/proposalStaleness";
import {
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { BUILDER_STAGE } from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewPublicAccessPanel from "./ProposalCustomerPreviewPublicAccessPanel";
import ProposalCustomerPreviewSendGatePanel from "./ProposalCustomerPreviewSendGatePanel";

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

  const loadPreview = useCallback(async () => {
    setLoadComplete(false);
    setLoadError(null);
    setPersistedGraph(null);
    setTemplateGraph(null);
    setJob(null);

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

  const jobTitle =
    (job?.job_name ?? "").trim() ||
    (job?.contact?.customer_name ?? "").trim() ||
    "Proposal preview";

  return (
    <div className="space-y-6 pb-12">
      <header className={`${BUILDER_STAGE} border-b border-slate-200/80 pb-5 pt-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href={builderHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL}
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {CUSTOMER_PREVIEW_PAGE_TITLE}
            </p>
            <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-tight text-slate-950">
              {jobTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{CUSTOMER_PREVIEW_DRAFT_NOTICE}</p>
          </div>
        </div>
      </header>

      {!loadComplete ? (
        <div className={`${BUILDER_STAGE} space-y-4`}>
          {hasValidParams && routeSpineLaunch.allowed ? (
            <>
              <ProposalCustomerPreviewPublicAccessPanel
                jobId={normalizedJobId}
                proposalId={normalizedProposalId}
                proposal={persistedGraph?.proposal ?? null}
                loading
              />
              <ProposalCustomerPreviewSendGatePanel
                jobId={normalizedJobId}
                proposalId={normalizedProposalId}
                graph={persistedGraph}
                job={job}
                previewReadiness={null}
                pricingStale={pricingStale.stale}
                loading
                emailDeliveryConfigured={emailDeliveryConfigured}
              />
            </>
          ) : null}
          <div className="text-sm text-slate-500">Loading preview…</div>
        </div>
      ) : loadError ? (
        <div
          className={`${BUILDER_STAGE} rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800`}
        >
          {loadError}
        </div>
      ) : previewDocument && persistedGraph ? (
        <div className={`${BUILDER_STAGE} space-y-4`}>
          <ProposalCustomerPreviewPublicAccessPanel
            jobId={normalizedJobId}
            proposalId={normalizedProposalId}
            proposal={persistedGraph.proposal}
            loading={false}
          />

          <ProposalCustomerPreviewSendGatePanel
            jobId={normalizedJobId}
            proposalId={normalizedProposalId}
            graph={persistedGraph}
            job={job}
            previewReadiness={previewDocument.readiness}
            pricingStale={pricingStale.stale}
            loading={false}
            emailDeliveryConfigured={emailDeliveryConfigured}
          />

          {previewDocument.readiness.warnings.length > 0 || pricingStale.stale ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {pricingStale.stale ? <p>{PROPOSAL_PRICING_STALE_BANNER_COPY}</p> : null}
              {previewDocument.readiness.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <ProposalCustomerPreviewDocumentView
            document={previewDocument}
            templateGraph={templateGraph}
            catalogItems={catalogItems}
          />
        </div>
      ) : null}
    </div>
  );
}
