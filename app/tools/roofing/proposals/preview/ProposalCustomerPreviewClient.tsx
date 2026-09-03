"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import {
  applyIndependentReadFailure,
  applyIndependentReadSuccess,
  createIndependentRead,
  decidePreviewSurface,
  previewJobIdentityFallback,
  shouldApplyProposalContextResult,
  type IndependentRead,
} from "@/app/lib/proposalPreviewReadOwnership";
import {
  buildProposalCustomerPreviewDocument,
  resolveProposalCustomerPreviewSelectedTotalLabel,
} from "@/app/lib/proposalCustomerPreviewViewModel";
import {
  adaptProposalDraftGraphToBuilderPreview,
  validateProposalDraftGraphForJob,
} from "@/app/lib/proposalDraftGraphAdapter";
import {
  buildJobCardHref,
  buildProposalBuilderHref,
} from "@/app/lib/proposalBuilderReadiness";
import {
  evaluateDbProposalLaunchSpine,
  productSpineRouteHintsFromSearchParams,
} from "@/app/lib/productSpine";
import {
  getDraftGraph,
  getLatestSentProposalVersionGraph,
  getProposalVersionGraph,
  listSentProposalVersionLineage,
  ProposalRecordStoreError,
  type ProposalDraftGraph,
  type ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import { buildRevisionChangeSummary } from "@/app/lib/proposalRevisionChangeSummary";
import type { ProposalPaymentTerms } from "@/app/lib/proposalPaymentTerms";
import { resolvePreviousSentVersionId } from "@/app/lib/proposalSentVersionLineage";
import {
  buildProposalPreviewSentFrozenChrome,
  hasLatestSentProposalVersionId,
} from "@/app/lib/proposalPreviewSentFrozenChrome";
import {
  asCustomerPreviewGraphFromSentRecord,
  buildProposalPreviewSentRecordChrome,
  parseProposalPreviewSentRecordRequest,
  validateProposalSentRecordGraph,
} from "@/app/lib/proposalPreviewSentRecord";
import { isMutableDraftDirtyAfterSentFreeze } from "@/app/lib/proposalContractorLifecycle";
import { resolveSendGateRecipientEmail } from "@/app/lib/proposalSendGateReadiness";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewSendSharingDrawer from "./ProposalCustomerPreviewSendSharingDrawer";
import ProposalPreviewChangeSummary from "./ProposalPreviewChangeSummary";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReadinessSummary from "./ProposalPreviewReadinessSummary";
import ProposalPreviewRequestAwareness from "./ProposalPreviewRequestAwareness";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

/**
 * FieldDive Proposal Preview — contractor review-and-send workspace.
 *
 * V2C1: compact command context + customer document first.
 * V2C2: focused Send sheet.
 * V2C3: delivery activity stays secondary in Send; request awareness is read-only.
 * V2C4: sent/frozen chrome from latest_sent_version_id; document remains draft.
 */
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
  const sentRequest = useMemo(
    () =>
      parseProposalPreviewSentRecordRequest({
        view: searchParams.get("view"),
        version: searchParams.get("version"),
      }),
    [searchParams]
  );
  const isSentRecord = sentRequest.mode === "sent_record";

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

  const [jobRead, setJobRead] = useState<IndependentRead<JobRecord>>(() =>
    createIndependentRead()
  );
  const [graphRead, setGraphRead] = useState<IndependentRead<ProposalDraftGraph>>(
    () => createIndependentRead()
  );
  const [catalogRead, setCatalogRead] = useState<IndependentRead<CatalogItem[]>>(
    () => createIndependentRead()
  );
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementUpdatedAt, setSelectedMeasurementUpdatedAt] = useState<string | null>(
    null
  );
  const [sendSharingOpen, setSendSharingOpen] = useState(false);
  const [lastSentFrozenAt, setLastSentFrozenAt] = useState<string | null>(null);
  const [comparisonGraph, setComparisonGraph] = useState<ProposalVersionGraph | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<ProposalPaymentTerms | null>(null);
  const loadGenerationRef = useRef(0);

  const loadPreview = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    const jobId = normalizedJobId;
    const proposalId = normalizedProposalId;
    const stillCurrent = () =>
      shouldApplyProposalContextResult({
        requestGeneration: generation,
        currentGeneration: loadGenerationRef.current,
        requestJobId: jobId,
        currentJobId: normalizedJobId,
        requestProposalId: proposalId,
        currentProposalId: normalizedProposalId,
      });

    setRouteError(null);
    setJobRead(createIndependentRead());
    setGraphRead(createIndependentRead());
    setCatalogRead(createIndependentRead());
    setLastSentFrozenAt(null);
    setComparisonGraph(null);

    if (!routeSpineLaunch.allowed) {
      if (!stillCurrent()) return;
      setRouteError(
        routeSpineLaunch.errorMessage ??
          "A valid DB proposal route is required to preview this draft."
      );
      setJobRead(applyIndependentReadFailure(createIndependentRead(), "Route blocked.", false));
      setGraphRead(applyIndependentReadFailure(createIndependentRead(), "Route blocked.", false));
      setCatalogRead(applyIndependentReadFailure(createIndependentRead(), "Route blocked.", false));
      return;
    }

    if (!hasValidParams) {
      if (!stillCurrent()) return;
      setRouteError("A valid job and proposal are required to preview this draft.");
      setGraphRead(
        applyIndependentReadFailure(
          createIndependentRead(),
          "A valid job and proposal are required to preview this draft.",
          false
        )
      );
      return;
    }

    if (sentRequest.mode === "sent_record_invalid") {
      if (!stillCurrent()) return;
      setRouteError(sentRequest.reason);
      setGraphRead(
        applyIndependentReadFailure(createIndependentRead(), sentRequest.reason, false)
      );
      return;
    }

    void getJobById(jobId).then(
      (jobRecord) => {
        if (!stillCurrent()) return;
        setJobRead(applyIndependentReadSuccess(jobRecord));
      },
      (err) => {
        if (!stillCurrent()) return;
        const message =
          err instanceof Error ? err.message : "Could not load job identity.";
        setJobRead(
          applyIndependentReadFailure(createIndependentRead(), message, false)
        );
      }
    );

    void getActiveCatalogItemsByCompany(companyId).then(
      (catalog) => {
        if (!stillCurrent()) return;
        setCatalogRead(applyIndependentReadSuccess(catalog));
      },
      (err) => {
        if (!stillCurrent()) return;
        const message =
          err instanceof Error ? err.message : "Catalog unavailable.";
        setCatalogRead(
          applyIndependentReadFailure(createIndependentRead(), message, true)
        );
      }
    );

    try {
      if (sentRequest.mode === "sent_record") {
        const versionGraph = await getProposalVersionGraph(
          companyId,
          proposalId,
          sentRequest.versionId,
          { requireSentVersion: true }
        );
        if (!stillCurrent()) return;
        const validated = validateProposalSentRecordGraph({
          graph: versionGraph,
          jobId,
          proposalId,
          versionId: sentRequest.versionId,
        });
        if (!validated.ok) {
          setGraphRead(
            applyIndependentReadFailure(createIndependentRead(), validated.reason, false)
          );
          return;
        }
        setGraphRead(
          applyIndependentReadSuccess(asCustomerPreviewGraphFromSentRecord(validated.graph))
        );
        setLastSentFrozenAt(validated.graph.version.frozen_at ?? null);
        try {
          const lineage = await listSentProposalVersionLineage(companyId, proposalId);
          if (!stillCurrent()) return;
          const previousId = resolvePreviousSentVersionId({
            currentSentVersionId: sentRequest.versionId,
            sentVersions: lineage.map((row) => ({
              id: row.id,
              versionNumber: row.version_number,
              frozenAt: row.frozen_at,
              createdAt: row.created_at,
            })),
          });
          if (previousId) {
            const previousGraph = await getProposalVersionGraph(
              companyId,
              proposalId,
              previousId,
              { requireSentVersion: true }
            );
            if (!stillCurrent()) return;
            setComparisonGraph(previousGraph);
          }
        } catch (lineageErr) {
          if (!stillCurrent()) return;
          console.warn("[ProposalCustomerPreviewClient] sent lineage error:", lineageErr);
        }
        return;
      }

      const graph = await getDraftGraph(companyId, proposalId);
      if (!stillCurrent()) return;
      const validation = validateProposalDraftGraphForJob(graph, jobId);
      if (!validation.valid || !graph) {
        setGraphRead(
          applyIndependentReadFailure(
            createIndependentRead(),
            validation.valid
              ? "Could not load persisted proposal draft."
              : validation.message,
            false
          )
        );
        return;
      }
      setGraphRead(applyIndependentReadSuccess(graph));

      if (hasLatestSentProposalVersionId(graph.proposal.latest_sent_version_id)) {
        try {
          const sentGraph = await getLatestSentProposalVersionGraph(
            companyId,
            proposalId
          );
          if (!stillCurrent()) return;
          setLastSentFrozenAt(sentGraph?.version.frozen_at ?? null);
          setComparisonGraph(sentGraph);
        } catch (sentErr) {
          if (!stillCurrent()) return;
          console.warn("[ProposalCustomerPreviewClient] sent chrome error:", sentErr);
        }
      } else {
        setLastSentFrozenAt(null);
        setComparisonGraph(null);
      }

      try {
        const measurement = await getSelectedMeasurementForJob(jobId);
        if (!stillCurrent()) return;
        setSelectedMeasurementId(measurement?.id ?? null);
        setSelectedMeasurementUpdatedAt(measurement?.updated_at ?? null);
      } catch (measurementErr) {
        if (!stillCurrent()) return;
        console.warn(
          "[ProposalCustomerPreviewClient] measurement enrichment error:",
          measurementErr
        );
      }
    } catch (err) {
      if (!stillCurrent()) return;
      const message =
        err instanceof ProposalRecordStoreError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load proposal preview.";
      setGraphRead(
        applyIndependentReadFailure(createIndependentRead(), message, false)
      );
      if (!(err instanceof ProposalRecordStoreError)) {
        console.warn("[ProposalCustomerPreviewClient] graph load error:", err);
      }
    }
  }, [
    companyId,
    hasValidParams,
    normalizedJobId,
    normalizedProposalId,
    routeSpineLaunch.allowed,
    routeSpineLaunch.errorMessage,
    sentRequest,
  ]);

  const refreshSentFrozenChrome = useCallback(async () => {
    if (isSentRecord || !hasValidParams) return;
    const generation = loadGenerationRef.current;
    const jobId = normalizedJobId;
    const proposalId = normalizedProposalId;
    try {
      const graph = await getDraftGraph(companyId, proposalId);
      if (
        !shouldApplyProposalContextResult({
          requestGeneration: generation,
          currentGeneration: loadGenerationRef.current,
          requestJobId: jobId,
          currentJobId: normalizedJobId,
          requestProposalId: proposalId,
          currentProposalId: normalizedProposalId,
        })
      ) {
        return;
      }
      if (!graph) return;
      setGraphRead(applyIndependentReadSuccess(graph));
      if (hasLatestSentProposalVersionId(graph.proposal.latest_sent_version_id)) {
        const sentGraph = await getLatestSentProposalVersionGraph(
          companyId,
          proposalId
        );
        if (loadGenerationRef.current !== generation) return;
        setLastSentFrozenAt(sentGraph?.version.frozen_at ?? null);
        setComparisonGraph(sentGraph);
      } else {
        setLastSentFrozenAt(null);
        setComparisonGraph(null);
      }
    } catch (err) {
      console.warn("[ProposalCustomerPreviewClient] sent chrome refresh error:", err);
    }
  }, [companyId, hasValidParams, isSentRecord, normalizedJobId, normalizedProposalId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const job = jobRead.status === "ready" ? jobRead.value : null;
  useEffect(() => {
    if (!hasValidParams) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(
        `/api/proposals/${encodeURIComponent(normalizedProposalId)}/payment-terms`
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        terms?: ProposalPaymentTerms;
      };
      if (cancelled || !response.ok || payload.ok !== true || !payload.terms) return;
      setPaymentTerms(payload.terms);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasValidParams, normalizedProposalId]);

  const persistedGraph =
    graphRead.status === "ready" ? graphRead.value : null;
  const catalogItems =
    catalogRead.status === "ready" && Array.isArray(catalogRead.value)
      ? catalogRead.value
      : [];
  const previewSurface = decidePreviewSurface({
    job: jobRead,
    graph: graphRead,
    catalog: catalogRead,
    routeError,
  });

  const pricingStale = useMemo(() => {
    if (isSentRecord || !persistedGraph) {
      return { stale: false, reason: null };
    }
    const adapter = adaptProposalDraftGraphToBuilderPreview(persistedGraph);
    return deriveProposalPricingStale({
      snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
      currentMeasurementId: selectedMeasurementId,
      snapshotUpdatedAt: persistedGraph.proposal.updated_at,
      measurementUpdatedAt: selectedMeasurementUpdatedAt,
    });
  }, [
    isSentRecord,
    persistedGraph,
    selectedMeasurementId,
    selectedMeasurementUpdatedAt,
  ]);

  const previewDocument = useMemo(() => {
    if (!persistedGraph) return null;
    return buildProposalCustomerPreviewDocument(persistedGraph, {
      pricingStale,
    });
  }, [persistedGraph, pricingStale]);

  const builderHref = buildProposalBuilderHref(normalizedJobId, normalizedProposalId);
  const jobCardHref = buildJobCardHref(normalizedJobId, { tab: "proposals" });
  const jobIdentity = resolveJobIdentityDisplay(
    job,
    previewJobIdentityFallback(previewSurface.jobIdentityMode)
  );
  const sentRecordChrome = useMemo(
    () =>
      isSentRecord
        ? buildProposalPreviewSentRecordChrome({
            frozenAt: lastSentFrozenAt,
          })
        : null,
    [isSentRecord, lastSentFrozenAt]
  );

  const estimatePage = previewDocument?.pages.find((page) => page.kind === "estimate");
  const selectedPackageLabel =
    estimatePage?.kind === "estimate" ? estimatePage.selectedOptionLabel : null;
  const totalLabel = persistedGraph
    ? resolveProposalCustomerPreviewSelectedTotalLabel(persistedGraph)
    : null;
  const hasRecipientEmail = Boolean(
    persistedGraph &&
      (resolveSendGateRecipientEmail({ graph: persistedGraph, job }) ?? "").trim()
  );
  const coverPage = previewDocument?.pages.find((page) => page.kind === "cover");
  const companyLogoMissing =
    coverPage?.kind === "cover" &&
    coverPage.viewModel.company.hasAnyField &&
    !coverPage.viewModel.company.logoUrl;

  const sentFrozenChrome = useMemo(
    () =>
      buildProposalPreviewSentFrozenChrome({
        latestSentVersionId: persistedGraph?.proposal.latest_sent_version_id ?? null,
        lastSentFrozenAt,
      }),
    [lastSentFrozenAt, persistedGraph?.proposal.latest_sent_version_id]
  );

  const changeSummary = useMemo(
    () =>
      persistedGraph
        ? buildRevisionChangeSummary({
            mode: isSentRecord ? "sent_record" : "revision_preview",
            current: persistedGraph,
            previous: comparisonGraph,
          })
        : null,
    [comparisonGraph, isSentRecord, persistedGraph]
  );

  const openSendSharing = () => {
    setSendSharingOpen(true);
  };

  return (
    <div className={PREVIEW_WORKSPACE_BG} data-preview-contractor-workspace>
      {previewSurface.overall === "loading" && !previewSurface.canRenderProposal ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-6`}>
          <div className="text-sm text-slate-500">Loading preview…</div>
        </div>
      ) : previewSurface.blockingError && !previewSurface.canRenderProposal ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-6`}>
          <div
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/70"
            data-preview-graph-error
          >
            {previewSurface.blockingError}
          </div>
        </div>
      ) : previewDocument && persistedGraph && previewSurface.canRenderProposal ? (
        <div
          className={`${PREVIEW_WORKSPACE_STAGE} space-y-3 pt-3 sm:pt-4`}
          data-preview-workspace-layout
          data-preview-review-desk
          data-preview-shell-v2c1
          data-preview-sent-record={isSentRecord ? "true" : "false"}
        >
          {previewSurface.catalogError ? (
            <p
              className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600"
              data-preview-catalog-error
            >
              Catalog unavailable for display enrichment. Proposal totals remain the frozen proposal truth.
            </p>
          ) : null}
          {previewSurface.jobIdentityMode === "unavailable" ||
          previewSurface.jobIdentityMode === "not_found" ? (
            <p
              className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600"
              data-preview-job-identity-error
            >
              {jobIdentity.primaryLabel}
            </p>
          ) : null}
          <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
            <ProposalPreviewHeader
              builderHref={builderHref}
              backHref={isSentRecord ? jobCardHref : undefined}
              customerName={jobIdentity.primaryLabel}
              projectAddress={jobIdentity.secondaryAddress}
              selectedPackageLabel={selectedPackageLabel}
              totalLabel={totalLabel}
              sentFrozenChrome={sentFrozenChrome}
              sentRecordChrome={sentRecordChrome}
              onSendSharing={() => openSendSharing()}
              showSendSharing={!isSentRecord}
              pdfDownload={
                isSentRecord && sentRequest.mode === "sent_record"
                  ? {
                      companyId,
                      proposalId: normalizedProposalId,
                      versionId: sentRequest.versionId,
                    }
                  : null
              }
            />
            {isSentRecord ? null : (
              <>
                <ProposalPreviewReadinessSummary
                  blockingLineCount={previewDocument.readiness.blockingLineCount}
                  pricingComplete={previewDocument.readiness.pricingComplete}
                  hasRecipientEmail={hasRecipientEmail}
                  builderHref={builderHref}
                />
                <ProposalPreviewRequestAwareness
                  proposalId={normalizedProposalId}
                  jobId={normalizedJobId}
                />
              </>
            )}
            {changeSummary ? (
              <ProposalPreviewChangeSummary summary={changeSummary} />
            ) : null}
          </div>

          <ProposalPreviewReviewSurface>
            <ProposalCustomerPreviewDocumentView
              document={previewDocument}
              draftGraph={persistedGraph}
              catalogItems={catalogItems}
              paymentTerms={paymentTerms}
              selectedTotalCents={
                persistedGraph?.options.find(
                  (option) => option.id === persistedGraph.proposal.selected_option_id
                )?.customer_total_cents ?? null
              }
            />
          </ProposalPreviewReviewSurface>

          {isSentRecord ? null : (
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
            companyLogoMissing={companyLogoMissing}
            builderHref={builderHref}
            sentFrozenChrome={sentFrozenChrome}
            isRevisionSend={
              isMutableDraftDirtyAfterSentFreeze({
                draftContentChangedAt: persistedGraph.proposal.draft_content_changed_at,
                latestSentFrozenAt: lastSentFrozenAt,
              })
            }
            onSendCompleted={() => {
              void refreshSentFrozenChrome();
            }}
          />
          )}
        </div>
      ) : null}
    </div>
  );
}
