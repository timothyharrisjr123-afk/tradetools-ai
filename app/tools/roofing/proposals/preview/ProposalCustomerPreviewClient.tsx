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
  ProposalRecordStoreError,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
import { resolveSendGateRecipientEmail } from "@/app/lib/proposalSendGateReadiness";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import {
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewSendSharingDrawer from "./ProposalCustomerPreviewSendSharingDrawer";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReadinessSummary from "./ProposalPreviewReadinessSummary";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_UNIFIED_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

function formatLastSavedLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today at ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * FieldDive Proposal Preview — contractor review-and-send workspace.
 *
 * Default: operational header + readiness cue + integrated proposal review surface.
 * Send / link / activity open only via Send / sharing.
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
  const [templateGraph, setTemplateGraph] = useState<ProposalTemplateGraph | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadComplete, setLoadComplete] = useState(false);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementUpdatedAt, setSelectedMeasurementUpdatedAt] = useState<string | null>(
    null
  );
  const [sendSharingOpen, setSendSharingOpen] = useState(false);
  const [sendSharingTab, setSendSharingTab] = useState<"send" | "link" | "activity">("send");

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
  const jobIdentity = resolveJobIdentityDisplay(job, "Proposal preview");

  const estimatePage = previewDocument?.pages.find((page) => page.kind === "estimate");
  const selectedPackageLabel =
    estimatePage?.kind === "estimate" ? estimatePage.selectedOptionLabel : null;
  const lastSavedLabel = formatLastSavedLabel(persistedGraph?.proposal.updated_at);
  const hasRecipientEmail = Boolean(
    persistedGraph && resolveSendGateRecipientEmail({ graph: persistedGraph, job }).trim()
  );
  const coverPage = previewDocument?.pages.find((page) => page.kind === "cover");
  const companyLogoMissing =
    coverPage?.kind === "cover" &&
    coverPage.viewModel.company.hasAnyField &&
    !coverPage.viewModel.company.logoUrl;

  const openSendSharing = (tab: "send" | "link" | "activity" = "send") => {
    setSendSharingTab(tab);
    setSendSharingOpen(true);
  };

  return (
    <div className={PREVIEW_WORKSPACE_BG} data-preview-contractor-workspace>
      {!loadComplete ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-10`}>
          <div className="text-sm text-slate-500">Loading preview…</div>
        </div>
      ) : loadError ? (
        <div className={`${PREVIEW_WORKSPACE_STAGE} pt-10`}>
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/70">
            {loadError}
          </div>
        </div>
      ) : previewDocument && persistedGraph ? (
        <div
          className={`${PREVIEW_WORKSPACE_STAGE} space-y-4 pt-5`}
          data-preview-workspace-layout
          data-preview-review-desk
        >
          <section className={PREVIEW_UNIFIED_SURFACE} data-preview-unified-surface>
            <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
              <ProposalPreviewHeader
                builderHref={builderHref}
                customerName={jobIdentity.primaryLabel}
                projectAddress={jobIdentity.secondaryAddress}
                selectedPackageLabel={selectedPackageLabel}
                lastSavedLabel={lastSavedLabel}
                onSendSharing={() => openSendSharing("send")}
                showSendSharing
              />
              <ProposalPreviewReadinessSummary
                blockingLineCount={previewDocument.readiness.blockingLineCount}
                pricingComplete={previewDocument.readiness.pricingComplete}
                hasRecipientEmail={hasRecipientEmail}
                builderHref={builderHref}
                companyLogoMissing={companyLogoMissing}
              />
            </div>

            <ProposalPreviewReviewSurface>
              <ProposalCustomerPreviewDocumentView
                document={previewDocument}
                templateGraph={templateGraph}
                catalogItems={catalogItems}
              />
            </ProposalPreviewReviewSurface>
          </section>

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
            initialTab={sendSharingTab}
          />
        </div>
      ) : null}
    </div>
  );
}
