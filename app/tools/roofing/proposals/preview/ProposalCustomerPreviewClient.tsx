"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  getDraftGraph,
  getLatestSentProposalVersionGraph,
  ProposalRecordStoreError,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
import {
  buildProposalPreviewSentFrozenChrome,
  hasLatestSentProposalVersionId,
} from "@/app/lib/proposalPreviewSentFrozenChrome";
import { resolveSendGateRecipientEmail } from "@/app/lib/proposalSendGateReadiness";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewSendSharingDrawer from "./ProposalCustomerPreviewSendSharingDrawer";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReadinessSummary from "./ProposalPreviewReadinessSummary";
import ProposalPreviewRequestAwareness from "./ProposalPreviewRequestAwareness";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

function resolveAuthoritativeTotalLabel(graph: ProposalDraftGraph): string | null {
  const selectedOptionId = (graph.proposal.selected_option_id ?? "").trim();
  if (!selectedOptionId) return null;
  const selected = graph.options.find((option) => option.id === selectedOptionId);
  if (selected?.customer_total_cents == null) return null;
  return formatPriceCents(selected.customer_total_cents);
}

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

  const loadPreview = useCallback(async () => {
    setLoadComplete(false);
    setLoadError(null);
    setPersistedGraph(null);
    setCatalogItems([]);
    setJob(null);
    setLastSentFrozenAt(null);

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
      } else {
        setLastSentFrozenAt(null);
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
  ]);

  const refreshSentFrozenChrome = useCallback(async () => {
    if (!hasValidParams) return;
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
      } else {
        setLastSentFrozenAt(null);
      }
    } catch (err) {
      console.warn("[ProposalCustomerPreviewClient] sent chrome refresh error:", err);
    }
  }, [companyId, hasValidParams, normalizedProposalId]);

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

  const estimatePage = previewDocument?.pages.find((page) => page.kind === "estimate");
  const selectedPackageLabel =
    estimatePage?.kind === "estimate" ? estimatePage.selectedOptionLabel : null;
  const totalLabel = persistedGraph ? resolveAuthoritativeTotalLabel(persistedGraph) : null;
  const hasRecipientEmail = Boolean(
    persistedGraph && resolveSendGateRecipientEmail({ graph: persistedGraph, job }).trim()
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
        >
          <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
            <ProposalPreviewHeader
              builderHref={builderHref}
              customerName={jobIdentity.primaryLabel}
              projectAddress={jobIdentity.secondaryAddress}
              selectedPackageLabel={selectedPackageLabel}
              totalLabel={totalLabel}
              sentFrozenChrome={sentFrozenChrome}
              onSendSharing={() => openSendSharing()}
              showSendSharing
            />
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
          </div>

          <ProposalPreviewReviewSurface>
            <ProposalCustomerPreviewDocumentView
              document={previewDocument}
              draftGraph={persistedGraph}
              catalogItems={catalogItems}
            />
          </ProposalPreviewReviewSurface>

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
            onSendCompleted={() => {
              void refreshSentFrozenChrome();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
