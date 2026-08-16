"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { resolveJobIdentityDisplay } from "@/app/lib/jobIdentityDisplay";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
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

  const [job, setJob] = useState<JobRecord | null>(null);
  const [persistedGraph, setPersistedGraph] = useState<ProposalDraftGraph | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadComplete, setLoadComplete] = useState(false);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementUpdatedAt, setSelectedMeasurementUpdatedAt] = useState<string | null>(
    null
  );
  const [sendSharingOpen, setSendSharingOpen] = useState(false);
  const [lastSentFrozenAt, setLastSentFrozenAt] = useState<string | null>(null);
  const [comparisonGraph, setComparisonGraph] = useState<ProposalVersionGraph | null>(null);

  const loadPreview = useCallback(async () => {
    setLoadComplete(false);
    setLoadError(null);
    setPersistedGraph(null);
    setCatalogItems([]);
    setJob(null);
    setLastSentFrozenAt(null);
    setComparisonGraph(null);

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

    if (sentRequest.mode === "sent_record_invalid") {
      setLoadError(sentRequest.reason);
      setLoadComplete(true);
      return;
    }

    try {
      if (sentRequest.mode === "sent_record") {
        const [jobRecord, versionGraph, catalog] = await Promise.all([
          getJobById(normalizedJobId),
          getProposalVersionGraph(
            companyId,
            normalizedProposalId,
            sentRequest.versionId,
            { requireSentVersion: true }
          ),
          getActiveCatalogItemsByCompany(companyId),
        ]);
        setJob(jobRecord);
        setCatalogItems(catalog);
        const validated = validateProposalSentRecordGraph({
          graph: versionGraph,
          jobId: normalizedJobId,
          proposalId: normalizedProposalId,
          versionId: sentRequest.versionId,
        });
        if (!validated.ok) {
          setLoadError(validated.reason);
          return;
        }
        setPersistedGraph(asCustomerPreviewGraphFromSentRecord(validated.graph));
        setLastSentFrozenAt(validated.graph.version.frozen_at ?? null);
        const lineage = await listSentProposalVersionLineage(
          companyId,
          normalizedProposalId
        );
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
            normalizedProposalId,
            previousId,
            { requireSentVersion: true }
          );
          setComparisonGraph(previousGraph);
        }
        return;
      }

      const [jobRecord, graph, catalog] = await Promise.all([
        getJobById(normalizedJobId),
        getDraftGraph(companyId, normalizedProposalId),
        getActiveCatalogItemsByCompany(companyId),
      ]);

      setJob(jobRecord);
      setCatalogItems(catalog);

      const validation = validateProposalDraftGraphForJob(graph, normalizedJobId);
      if (!validation.valid || !graph) {
        setLoadError(validation.valid ? "Could not load persisted proposal draft." : validation.message);
        return;
      }

      setPersistedGraph(graph);

      if (hasLatestSentProposalVersionId(graph.proposal.latest_sent_version_id)) {
        const sentGraph = await getLatestSentProposalVersionGraph(
          companyId,
          normalizedProposalId
        );
        setLastSentFrozenAt(sentGraph?.version.frozen_at ?? null);
        setComparisonGraph(sentGraph);
      } else {
        setLastSentFrozenAt(null);
        setComparisonGraph(null);
      }

      const measurement = await getSelectedMeasurementForJob(normalizedJobId);
      setSelectedMeasurementId(measurement?.id ?? null);
      setSelectedMeasurementUpdatedAt(measurement?.updated_at ?? null);
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
    sentRequest,
  ]);

  const refreshSentFrozenChrome = useCallback(async () => {
    if (isSentRecord || !hasValidParams) return;
    try {
      const graph = await getDraftGraph(companyId, normalizedProposalId);
      if (!graph) return;
      setPersistedGraph(graph);
      if (hasLatestSentProposalVersionId(graph.proposal.latest_sent_version_id)) {
        const sentGraph = await getLatestSentProposalVersionGraph(
          companyId,
          normalizedProposalId
        );
        setLastSentFrozenAt(sentGraph?.version.frozen_at ?? null);
        setComparisonGraph(sentGraph);
      } else {
        setLastSentFrozenAt(null);
        setComparisonGraph(null);
      }
    } catch (err) {
      console.warn("[ProposalCustomerPreviewClient] sent chrome refresh error:", err);
    }
  }, [companyId, hasValidParams, isSentRecord, normalizedProposalId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

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
  const jobIdentity = resolveJobIdentityDisplay(job, "Proposal preview");
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
      {!loadComplete ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-6`}>
          <div className="text-sm text-slate-500">Loading preview…</div>
        </div>
      ) : loadError ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-6`}>
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/70">
            {loadError}
          </div>
        </div>
      ) : previewDocument && persistedGraph ? (
        <div
          className={`${PREVIEW_WORKSPACE_STAGE} space-y-3 pt-3 sm:pt-4`}
          data-preview-workspace-layout
          data-preview-review-desk
          data-preview-shell-v2c1
          data-preview-sent-record={isSentRecord ? "true" : "false"}
        >
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
            />
            {isSentRecord ? null : (
              <>
                <ProposalPreviewReadinessSummary
                  blockingLineCount={previewDocument.readiness.blockingLineCount}
                  pricingComplete={previewDocument.readiness.pricingComplete}
                  hasRecipientEmail={hasRecipientEmail}
                  builderHref={builderHref}
                  companyLogoMissing={companyLogoMissing}
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
