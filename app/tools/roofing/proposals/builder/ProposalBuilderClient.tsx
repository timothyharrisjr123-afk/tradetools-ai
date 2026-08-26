"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getCatalogItemsByCompany } from "@/app/lib/catalogStore";
import {
  PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY,
  deriveDraftCatalogEconomicsStale,
  formatDraftCatalogEconomicsStaleBanner,
} from "@/app/lib/proposalCatalogEconomicsStaleness";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { shouldApplyProposalContextResult } from "@/app/lib/proposalPreviewReadOwnership";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import { resolveMeasurementWorkspaceState } from "@/app/lib/measurementReadiness";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import type { MeasurementQuantityMap, MeasurementRecord } from "@/app/lib/measurementTypes";
import { resolveProposalBuilderQuantityPreflightMetadata } from "@/app/lib/proposalBuilderQuantityPreflightMetadata";
import { composeProposalBuilderInternalTrustSignals } from "@/app/lib/proposalBuilderTrustSignals";
import ProposalBuilderCustomerRequestBanner from "@/app/tools/roofing/proposals/builder/ProposalBuilderCustomerRequestBanner";
import {
  buildJobCardHref,
  deriveProposalBuilderReadiness,
} from "@/app/lib/proposalBuilderReadiness";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { getDefaultSelectedOptionId } from "@/app/lib/proposalBuilderPreview";
import { scopeTemplateGraphToDraftPackageOptions } from "@/app/lib/proposalBuilderDraftPackageOptions";
import {
  buildProposalBuilderPricingPreview,
  type ProposalBuilderPricingPreview,
} from "@/app/lib/proposalBuilderPricingPreview";
import {
  adaptProposalDraftGraphToBuilderPreview,
  resolveRuntimeOptionIdFromTemplateOptionId,
  validateProposalDraftGraphForJob,
} from "@/app/lib/proposalDraftGraphAdapter";
import {
  applyManualQuantityScopeDecision,
  clearCustomerVisibilityHide,
  clearExcludedLine,
  clearManualQuantityScopeDecision,
  excludeLineFromProposalOption,
  hideLineFromCustomer,
  ProposalScopeDecisionActionError,
} from "@/app/lib/proposalScopeDecisionActions";
import {
  getDraftGraph,
  ProposalRecordStoreError,
  refreshDraftPricing,
  updateDraftProposalPageContent,
  updateDraftProposalPageVisibility,
  updateDraftSelectedOption,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
import { upsertUpgradeChoiceSelection } from "@/app/lib/proposalUpgradeChoiceStore";
import {
  bodyMarkdownChanged,
} from "@/app/lib/proposalPageContentEditing";
import {
  deriveProposalPricingStale,
  PROPOSAL_PRICING_STALE_BANNER_COPY,
} from "@/app/lib/proposalStaleness";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import type { CompanyPricingPolicyResolution } from "@/app/lib/companyPricingPolicy";
import type { PricingPolicy } from "@/app/lib/proposalPricingTypes";
import {
  BUILDER_DEFAULT_PAGE_CONTEXT,
  buildPageContextStripItems,
  resolvePersistedPageByContextId,
  type BuilderPageContextId,
} from "@/app/lib/proposalBuilderNavigation";
import {
  BUILDER_STAGE,
  BUILDER_UNSAVED_PAGE_EDIT_CONFIRM,
  WORKBENCH_EXCLUDE_SUCCESS,
  WORKBENCH_HIDE_SUCCESS,
  WORKBENCH_RESTORE_EXCLUDED_SUCCESS,
  WORKBENCH_RESTORE_VISIBILITY_SUCCESS,
  formatPriceCents,
} from "./proposalBuilderConstants";
import { buildProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import {
  deriveProposalBuilderGuidance,
  type ProposalBuilderGuardrailStatus,
  type ProposalBuilderLifecycleActionId,
} from "@/app/lib/proposalBuilderGuidance";
import { buildProposalCustomerPreviewHref } from "@/app/lib/proposalCustomerPreviewViewModel";
import {
  evaluateDbProposalLaunchSpine,
  productSpineRouteHintsFromSearchParams,
} from "@/app/lib/productSpine";
import ProposalBuilderBlockedState from "./ProposalBuilderBlockedState";
import ProposalBuilderCanvas from "./ProposalBuilderCanvas";
import ProposalBuilderPageAlerts from "./ProposalBuilderPageAlerts";
import ProposalBuilderPageHeader from "./ProposalBuilderPageHeader";
import ProposalBuilderSectionNav from "./ProposalBuilderSectionNav";
import ProposalBuilderWorkspaceLayout from "./ProposalBuilderWorkspaceLayout";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

function formatBuilderLastSavedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ProposalBuilderClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job");
  const proposalIdParam = searchParams.get("proposal");
  const hasPersistedProposalParam =
    proposalIdParam != null && isUuidLike(proposalIdParam.trim());
  const hasJobUuid = jobIdParam != null && isUuidLike(jobIdParam.trim());
  const setupPreviewRetired = hasJobUuid && !hasPersistedProposalParam;

  const routeSpineLaunch = useMemo(
    () =>
      evaluateDbProposalLaunchSpine(
        productSpineRouteHintsFromSearchParams(
          "/tools/roofing/proposals/builder",
          searchParams
        )
      ),
    [searchParams]
  );
  const spineRouteError = routeSpineLaunch.allowed ? null : routeSpineLaunch.errorMessage;

  const [job, setJob] = useState<JobRecord | null>(null);
  const [jobLoadComplete, setJobLoadComplete] = useState(false);

  const [persistedGraph, setPersistedGraph] = useState<ProposalDraftGraph | null>(null);
  const [draftGraphError, setDraftGraphError] = useState<string | null>(null);
  const [draftGraphLoadComplete, setDraftGraphLoadComplete] = useState(
    !hasPersistedProposalParam
  );

  const [measurementHandoff, setMeasurementHandoff] = useState<MeasurementProposalHandoff | null>(
    null
  );
  const [measurementQuantityMap, setMeasurementQuantityMap] = useState<MeasurementQuantityMap | null>(
    null
  );
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedMeasurementUpdatedAt, setSelectedMeasurementUpdatedAt] = useState<string | null>(
    null
  );
  const [measurementLoadComplete, setMeasurementLoadComplete] = useState(false);

  const [refreshInFlight, setRefreshInFlight] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const refreshInFlightRef = useRef(false);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoadComplete, setCatalogLoadComplete] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [companyTemplateCount, setCompanyTemplateCount] = useState(0);
  const [templateLoadComplete, setTemplateLoadComplete] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [optionPersistError, setOptionPersistError] = useState<string | null>(null);
  const optionPersistInFlightRef = useRef(false);
  const persistedTemplateOptionIdRef = useRef<string | null>(null);

  // 3I-3B3c: resolved company pricing policy. Builder reads ONLY the resolver
  // (getResolvedCompanyPricingPolicy) — never raw getCompanyPricingPolicy — and
  // never auto-saves or writes any policy from here.
  const [pricingResolution, setPricingResolution] =
    useState<CompanyPricingPolicyResolution | null>(null);
  const [pricingPolicyLoadComplete, setPricingPolicyLoadComplete] = useState(false);

  const [activePageContextId, setActivePageContextId] =
    useState<BuilderPageContextId>(BUILDER_DEFAULT_PAGE_CONTEXT);

  const [pageEditActiveContextId, setPageEditActiveContextId] =
    useState<BuilderPageContextId | null>(null);
  const [pageEditDraftBody, setPageEditDraftBody] = useState("");
  const [pageEditOriginalBody, setPageEditOriginalBody] = useState("");
  const [pageEditSaveInFlight, setPageEditSaveInFlight] = useState(false);
  const [pageEditSaveError, setPageEditSaveError] = useState<string | null>(null);
  const pageEditSaveInFlightRef = useRef(false);
  const [pageVisibilityToggleInFlight, setPageVisibilityToggleInFlight] = useState(false);
  const [pageVisibilityToggleError, setPageVisibilityToggleError] = useState<string | null>(null);

  const [manualQuantityInFlight, setManualQuantityInFlight] = useState(false);
  const [manualQuantityError, setManualQuantityError] = useState<string | null>(null);
  const manualQuantityInFlightRef = useRef(false);
  const [excludeInFlight, setExcludeInFlight] = useState(false);
  const [excludeError, setExcludeError] = useState<string | null>(null);
  const [excludeErrorLineId, setExcludeErrorLineId] = useState<string | null>(null);
  const excludeInFlightRef = useRef(false);
  const [visibilityInFlight, setVisibilityInFlight] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [visibilityErrorLineId, setVisibilityErrorLineId] = useState<string | null>(null);
  const visibilityInFlightRef = useRef(false);
  const [upgradeSelectionInFlight, setUpgradeSelectionInFlight] = useState(false);
  const [upgradeSelectionError, setUpgradeSelectionError] = useState<string | null>(null);
  const upgradeSelectionInFlightRef = useRef(false);
  const pageVisibilityToggleInFlightRef = useRef(false);
  const jobContextGenerationRef = useRef(0);
  const catalogLoadGenerationRef = useRef(0);
  const draftLoadGenerationRef = useRef(0);

  const loadJobContext = useCallback(async () => {
    const generation = ++jobContextGenerationRef.current;
    const jobId = (jobIdParam ?? "").trim();
    const proposalId = (proposalIdParam ?? "").trim();
    const stillCurrent = () =>
      shouldApplyProposalContextResult({
        requestGeneration: generation,
        currentGeneration: jobContextGenerationRef.current,
        requestJobId: jobId,
        currentJobId: (jobIdParam ?? "").trim(),
        requestProposalId: proposalId,
        currentProposalId: (proposalIdParam ?? "").trim(),
      });

    setJobLoadComplete(false);
    setMeasurementLoadComplete(false);

    if (!jobId || !isUuidLike(jobId)) {
      setJob(null);
      setMeasurementHandoff(null);
      setMeasurementQuantityMap(null);
      setSelectedMeasurementId(null);
      setSelectedMeasurementUpdatedAt(null);
      setJobLoadComplete(true);
      setMeasurementLoadComplete(true);
      return;
    }

    try {
      const record = await getJobById(jobId);
      if (!stillCurrent()) return;
      setJob(record);

      if (!record) {
        setMeasurementLoadComplete(true);
        return;
      }

      const measurement = await getSelectedMeasurementForJob(jobId);
      if (!stillCurrent()) return;
      if (measurement) {
        const handoff = buildMeasurementHandoffFromPersisted(measurement);
        setMeasurementHandoff(handoff);
        setMeasurementQuantityMap(deriveQuantityMapFromRecord(measurement));
        setSelectedMeasurementId(measurement.id ?? null);
        setSelectedMeasurementUpdatedAt(measurement.updated_at ?? null);
      } else {
        setMeasurementQuantityMap(null);
        setSelectedMeasurementId(null);
        setSelectedMeasurementUpdatedAt(null);
        setMeasurementHandoff({
          proposalReady: false,
          blockers: ["Save measurement first"],
          selectedLabel: "Not saved",
          quantities: {
            roof_squares: null,
            adjusted_roof_squares: null,
            roof_area_sqft: null,
            waste_percent: null,
            eaves_lf: null,
            rakes_lf: null,
            ridges_lf: null,
            hips_lf: null,
            valleys_lf: null,
            wall_flashing_lf: null,
            step_flashing_lf: null,
            transitions_lf: null,
            parapet_wall_lf: null,
            drip_edge_lf: null,
            starter_lf: null,
            ridge_cap_lf: null,
            pipe_boots_count: null,
            vents_count: null,
            skylights_count: null,
            chimneys_count: null,
            satellite_dishes_count: null,
          },
          estimateReady: false,
          productionReady: false,
        });
      }
    } catch (err) {
      console.warn("[ProposalBuilderClient] job/measurement load error:", err);
      if (!stillCurrent()) return;
      setJob((prev) => (prev?.id === jobId ? prev : null));
      setMeasurementHandoff(null);
      setMeasurementQuantityMap(null);
      setSelectedMeasurementId(null);
      setSelectedMeasurementUpdatedAt(null);
    } finally {
      if (!stillCurrent()) return;
      setJobLoadComplete(true);
      setMeasurementLoadComplete(true);
    }
  }, [jobIdParam, proposalIdParam]);

  const loadCatalog = useCallback(async () => {
    const generation = ++catalogLoadGenerationRef.current;
    setCatalogLoadComplete(false);
    setCatalogError(null);
    try {
      // Full catalog (active + inactive) so draft Catalog-link staleness can
      // distinguish missing vs inactive. Pricing preview still uses active-only.
      const rows = await getCatalogItemsByCompany(companyId);
      if (catalogLoadGenerationRef.current !== generation) return;
      setCatalogItems(rows);
    } catch (err) {
      console.warn("[ProposalBuilderClient] catalog fetch error:", err);
      if (catalogLoadGenerationRef.current !== generation) return;
      setCatalogError("Could not load catalog items.");
    } finally {
      if (catalogLoadGenerationRef.current !== generation) return;
      setCatalogLoadComplete(true);
    }
  }, [companyId]);

  const loadPricingPolicy = useCallback(async () => {
    setPricingPolicyLoadComplete(false);
    try {
      const resolution = await getResolvedCompanyPricingPolicy(companyId);
      setPricingResolution(resolution);
    } catch (err) {
      console.warn("[ProposalBuilderClient] pricing policy resolve error:", err);
      setPricingResolution(null);
    } finally {
      setPricingPolicyLoadComplete(true);
    }
  }, [companyId]);

  const loadPersistedDraft = useCallback(async () => {
    const generation = ++draftLoadGenerationRef.current;
    const jobId = (jobIdParam ?? "").trim();
    const proposalId = (proposalIdParam ?? "").trim();
    const stillCurrent = () =>
      shouldApplyProposalContextResult({
        requestGeneration: generation,
        currentGeneration: draftLoadGenerationRef.current,
        requestJobId: jobId,
        currentJobId: (jobIdParam ?? "").trim(),
        requestProposalId: proposalId,
        currentProposalId: (proposalIdParam ?? "").trim(),
      });

    if (!hasPersistedProposalParam) {
      setPersistedGraph(null);
      setDraftGraphError(null);
      setDraftGraphLoadComplete(true);
      return;
    }

    setDraftGraphLoadComplete(false);
    setDraftGraphError(null);

    try {
      const graph = await getDraftGraph(companyId, proposalId);
      if (!stillCurrent()) return;
      const validation = validateProposalDraftGraphForJob(graph, jobIdParam);
      if (!validation.valid) {
        setDraftGraphError(validation.message);
        setPersistedGraph(null);
        return;
      }
      setPersistedGraph(graph);
    } catch (err) {
      console.warn("[ProposalBuilderClient] persisted draft load error:", err);
      if (!stillCurrent()) return;
      setDraftGraphError("Could not load persisted proposal draft.");
    } finally {
      if (!stillCurrent()) return;
      setDraftGraphLoadComplete(true);
    }
  }, [companyId, hasPersistedProposalParam, jobIdParam, proposalIdParam]);

  useEffect(() => {
    if (!refreshFeedback || refreshFeedback.kind !== "success") return;
    const timer = window.setTimeout(() => setRefreshFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [refreshFeedback]);

  useEffect(() => {
    if (!setupPreviewRetired || !jobIdParam) return;
    router.replace(buildJobCardHref(jobIdParam.trim(), { tab: "proposals" }));
  }, [setupPreviewRetired, jobIdParam, router]);

  useEffect(() => {
    void loadJobContext();
  }, [loadJobContext]);

  useEffect(() => {
    void loadPersistedDraft();
  }, [loadPersistedDraft]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!persistedGraph?.proposal.template_id) return;

    let cancelled = false;
    void (async () => {
      setTemplateLoadComplete(false);
      setTemplateError(null);
      try {
        const graph = await getProposalTemplateGraph(persistedGraph.proposal.template_id, {
          companyId,
        });
        if (cancelled) return;
        setStarterGraph(graph);
        setCompanyTemplateCount(graph ? 1 : 0);
      } catch (err) {
        if (cancelled) return;
        console.warn("[ProposalBuilderClient] persisted template fetch error:", err);
        setTemplateError("Could not load proposal template for this draft.");
        setStarterGraph(null);
        setCompanyTemplateCount(0);
      } finally {
        if (!cancelled) setTemplateLoadComplete(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, persistedGraph?.proposal.template_id]);

  useEffect(() => {
    void loadPricingPolicy();
  }, [loadPricingPolicy]);

  const adapterResult = useMemo(
    () => (persistedGraph ? adaptProposalDraftGraphToBuilderPreview(persistedGraph) : null),
    [persistedGraph]
  );

  // Block A / Phase 6 — quantity preflight metadata for contractor helper rail
  // (read-only status; no banner, no blocking, no auto-refresh).
  const quantityPreflight = useMemo(
    () =>
      resolveProposalBuilderQuantityPreflightMetadata({
        draftGraph: persistedGraph,
        templateItems: starterGraph?.items ?? null,
        catalogItems,
        quantityContext:
          measurementHandoff && measurementQuantityMap
            ? {
                measurementHandoff,
                quantityMap: measurementQuantityMap,
              }
            : null,
      }),
    [
      persistedGraph,
      starterGraph?.items,
      catalogItems,
      measurementHandoff,
      measurementQuantityMap,
    ]
  );

  // Slice A / Phase 6 — sibling internal trust compose (not merged into pricing stale).
  const quantityPreflightTrust = useMemo(
    () =>
      composeProposalBuilderInternalTrustSignals({ quantityPreflight })
        .quantityPreflightTrust,
    [quantityPreflight]
  );

  useEffect(() => {
    if (adapterResult?.selectedTemplateOptionId) {
      setSelectedOptionId(adapterResult.selectedTemplateOptionId);
      persistedTemplateOptionIdRef.current = adapterResult.selectedTemplateOptionId;
      return;
    }
    if (!starterGraph) {
      setSelectedOptionId(null);
      persistedTemplateOptionIdRef.current = null;
      return;
    }
    const defaultId = getDefaultSelectedOptionId(starterGraph);
    setSelectedOptionId(defaultId);
    persistedTemplateOptionIdRef.current = null;
  }, [adapterResult?.selectedTemplateOptionId, starterGraph?.template.id]);

  const packageSelectorGraph = useMemo(
    () => scopeTemplateGraphToDraftPackageOptions(starterGraph, persistedGraph),
    [starterGraph, persistedGraph]
  );
  const draftScopedPackagePicker = Boolean(
    hasPersistedProposalParam && persistedGraph && !draftGraphError
  );

  const handleSelectOption = useCallback(
    (templateOptionId: string) => {
      const nextTemplateOptionId = (templateOptionId ?? "").trim();
      if (!nextTemplateOptionId) return;

      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        setSelectedOptionId(nextTemplateOptionId);
        setOptionPersistError(null);
        return;
      }

      const previousTemplateOptionId =
        selectedOptionId ?? persistedTemplateOptionIdRef.current ?? null;
      if (nextTemplateOptionId === previousTemplateOptionId) return;
      if (optionPersistInFlightRef.current) return;

      // Persist only options that exist on this draft snapshot (not live-template-only).
      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        nextTemplateOptionId
      );
      if (!runtimeOptionId) {
        setOptionPersistError("Selected option is not available on this proposal draft.");
        return;
      }

      setSelectedOptionId(nextTemplateOptionId);
      setOptionPersistError(null);
      optionPersistInFlightRef.current = true;

      void (async () => {
        try {
          const updated = await updateDraftSelectedOption(
            companyId,
            proposalIdParam.trim(),
            runtimeOptionId
          );
          if (!updated) {
            throw new Error("Could not save selected option.");
          }

          setPersistedGraph((prev) =>
            prev
              ? {
                  ...prev,
                  proposal: { ...prev.proposal, selected_option_id: runtimeOptionId },
                }
              : prev
          );
          persistedTemplateOptionIdRef.current = nextTemplateOptionId;
        } catch (err) {
          setSelectedOptionId(previousTemplateOptionId);
          const message =
            err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not save selected option.";
          setOptionPersistError(message);
          if (!(err instanceof ProposalRecordStoreError)) {
            console.warn("[ProposalBuilderClient] option persist error:", err);
          }
        } finally {
          optionPersistInFlightRef.current = false;
        }
      })();
    },
    [
      companyId,
      hasPersistedProposalParam,
      persistedGraph,
      proposalIdParam,
      selectedOptionId,
    ]
  );

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

  // 3I-3B3c: Only a resolved, configured company policy is used. Starter/default
  // never masquerades as configured — when not configured we leave `policy`
  // undefined so the orchestrator's placeholder fallback applies.
  const configuredPolicy = useMemo<PricingPolicy | null>(
    () =>
      pricingResolution?.configured && pricingResolution.policy
        ? pricingResolution.policy
        : null,
    [pricingResolution]
  );

  const pricingPreview = useMemo<ProposalBuilderPricingPreview | null>(() => {
    if (adapterResult) return adapterResult.pricingPreview;
    if (!starterGraph || activeCatalogItems.length === 0) return null;
    return buildProposalBuilderPricingPreview({
      graph: starterGraph,
      catalogItems: activeCatalogItems,
      quantityContext: {
        measurementHandoff,
        quantityMap: measurementQuantityMap,
      },
      selectedOptionId,
      ...(configuredPolicy ? { policy: configuredPolicy } : {}),
    });
  }, [
    adapterResult,
    starterGraph,
    activeCatalogItems,
    measurementHandoff,
    measurementQuantityMap,
    selectedOptionId,
    configuredPolicy,
  ]);

  const pricingPolicyConfigured = adapterResult
    ? adapterResult.pricingPolicyConfigured
    : configuredPolicy != null;

  const effectiveSelectedOptionId = useMemo(
    () =>
      selectedOptionId ??
      (starterGraph ? getDefaultSelectedOptionId(starterGraph) : null),
    [selectedOptionId, starterGraph]
  );

  // No mixed truth: in the persisted path, line quantities come from the same
  // snapshot as the prices (selected option only).
  const snapshotQuantityByTemplateItemId = useMemo(() => {
    if (!adapterResult || !effectiveSelectedOptionId) return null;
    return adapterResult.snapshotQuantityByOptionId[effectiveSelectedOptionId] ?? null;
  }, [adapterResult, effectiveSelectedOptionId]);

  const activeScopeDecisionsForOption = useMemo(() => {
    if (!persistedGraph?.scopeDecisions?.length || !effectiveSelectedOptionId) {
      return [];
    }
    const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
      persistedGraph,
      effectiveSelectedOptionId
    );
    if (!runtimeOptionId) return [];
    return persistedGraph.scopeDecisions.filter(
      (decision) => decision.active && decision.proposalOptionId === runtimeOptionId
    );
  }, [persistedGraph, effectiveSelectedOptionId]);

  // Stale detection: snapshot measurement id vs currently selected measurement.
  const proposalPricingStale = useMemo(() => {
    if (!adapterResult) return { stale: false, reason: null as string | null };
    return deriveProposalPricingStale({
      snapshotMeasurementId: adapterResult.snapshotMeasurementRecordId,
      currentMeasurementId: selectedMeasurementId,
      snapshotUpdatedAt: persistedGraph?.proposal.updated_at ?? null,
      measurementUpdatedAt: selectedMeasurementUpdatedAt,
    });
  }, [
    adapterResult,
    selectedMeasurementId,
    selectedMeasurementUpdatedAt,
    persistedGraph?.proposal.updated_at,
  ]);

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalogItems) map.set(item.id, item);
    return map;
  }, [catalogItems]);

  // Catalog economics drift vs frozen draft lines (updated_at / missing / inactive).
  const draftCatalogEconomicsStale = useMemo(() => {
    if (!adapterResult || !persistedGraph?.lineItems?.length) {
      return {
        stale: false,
        reason: null as ReturnType<typeof deriveDraftCatalogEconomicsStale>["reason"],
        affectedCount: 0,
        updatedCount: 0,
        missingCount: 0,
        inactiveCount: 0,
      };
    }
    return deriveDraftCatalogEconomicsStale({
      snapshotLines: persistedGraph.lineItems,
      liveCatalogById: catalogById,
      snapshotUpdatedAt: persistedGraph.proposal.updated_at ?? null,
    });
  }, [adapterResult, catalogById, persistedGraph]);

  const staleBannerCopy = useMemo(() => {
    const measurementStale = proposalPricingStale.stale;
    const catalogBanner = formatDraftCatalogEconomicsStaleBanner(draftCatalogEconomicsStale);
    if (measurementStale && catalogBanner) {
      return `${PROPOSAL_PRICING_STALE_BANNER_COPY} Linked Catalog items also changed after this snapshot — refresh draft pricing to re-pull measurement quantities and live Catalog economics.`;
    }
    if (measurementStale) return PROPOSAL_PRICING_STALE_BANNER_COPY;
    return catalogBanner;
  }, [draftCatalogEconomicsStale, proposalPricingStale.stale]);

  const handleRefreshDraftPricing = useCallback(() => {
    if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) return;
    if (persistedGraph.proposal.status !== "draft") {
      setRefreshFeedback({
        kind: "error",
        message: "Only draft proposals can refresh pricing.",
      });
      return;
    }
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setRefreshInFlight(true);
    setRefreshFeedback(null);

    const measurementDisplay = measurementHandoff
      ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
      : null;

    void (async () => {
      try {
        const updatedGraph = await refreshDraftPricing(companyId, proposalIdParam.trim(), {
          quantity_context: {
            measurementHandoff,
            quantityMap: measurementQuantityMap,
          },
          measurement_record_id: selectedMeasurementId,
          measurement_quantities_display:
            measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
        });

        if (!updatedGraph) {
          throw new Error("Could not refresh draft pricing.");
        }

        setPersistedGraph(updatedGraph);
        setRefreshFeedback({ kind: "success", message: "Draft pricing refreshed." });
      } catch (err) {
        const message =
          err instanceof ProposalRecordStoreError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not refresh draft pricing.";
        setRefreshFeedback({ kind: "error", message });
        if (!(err instanceof ProposalRecordStoreError)) {
          console.warn("[ProposalBuilderClient] refresh draft pricing error:", err);
        }
      } finally {
        refreshInFlightRef.current = false;
        setRefreshInFlight(false);
      }
    })();
  }, [
    companyId,
    hasPersistedProposalParam,
    persistedGraph,
    proposalIdParam,
    measurementHandoff,
    measurementQuantityMap,
    selectedMeasurementId,
  ]);

  const handleApplyManualQuantity = useCallback(
    async (
      templateItemId: string,
      quantity: string,
      quantityDisplayLabel?: string | null
    ) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Manual quantity requires a saved proposal draft."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (manualQuantityInFlightRef.current || excludeInFlightRef.current || visibilityInFlightRef.current) {
        throw new ProposalScopeDecisionActionError("Manual quantity save already in progress.");
      }

      manualQuantityInFlightRef.current = true;
      setManualQuantityInFlight(true);
      setManualQuantityError(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await applyManualQuantityScopeDecision({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          quantity,
          quantityDisplayLabel,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: "Quantity saved. Pricing refreshed.",
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not save manual quantity.";
        setManualQuantityError(message);
        throw err;
      } finally {
        manualQuantityInFlightRef.current = false;
        setManualQuantityInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleClearManualQuantity = useCallback(
    async (templateItemId: string) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Manual quantity requires a saved proposal draft."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (manualQuantityInFlightRef.current || excludeInFlightRef.current || visibilityInFlightRef.current) {
        throw new ProposalScopeDecisionActionError("Manual quantity action already in progress.");
      }

      manualQuantityInFlightRef.current = true;
      setManualQuantityInFlight(true);
      setManualQuantityError(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await clearManualQuantityScopeDecision({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: "Manual quantity cleared and draft pricing refreshed.",
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not clear manual quantity.";
        setManualQuantityError(message);
        throw err;
      } finally {
        manualQuantityInFlightRef.current = false;
        setManualQuantityInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleExcludeLine = useCallback(
    async (templateItemId: string) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Remove from proposal requires a saved proposal."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (excludeInFlightRef.current || manualQuantityInFlightRef.current || visibilityInFlightRef.current) {
        throw new ProposalScopeDecisionActionError("Remove from proposal already in progress.");
      }

      excludeInFlightRef.current = true;
      setExcludeInFlight(true);
      setExcludeError(null);
      setExcludeErrorLineId(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await excludeLineFromProposalOption({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: WORKBENCH_EXCLUDE_SUCCESS,
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not remove line from this option.";
        setExcludeError(message);
        setExcludeErrorLineId(templateItemId);
        throw err;
      } finally {
        excludeInFlightRef.current = false;
        setExcludeInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleRestoreExcludedLine = useCallback(
    async (templateItemId: string) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Restore requires a saved proposal draft."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (excludeInFlightRef.current || manualQuantityInFlightRef.current || visibilityInFlightRef.current) {
        throw new ProposalScopeDecisionActionError("Restore already in progress.");
      }

      excludeInFlightRef.current = true;
      setExcludeInFlight(true);
      setExcludeError(null);
      setExcludeErrorLineId(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await clearExcludedLine({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: WORKBENCH_RESTORE_EXCLUDED_SUCCESS,
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not restore line to this option.";
        setExcludeError(message);
        setExcludeErrorLineId(templateItemId);
        throw err;
      } finally {
        excludeInFlightRef.current = false;
        setExcludeInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleHideLine = useCallback(
    async (templateItemId: string) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Line display update requires a saved proposal."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (
        visibilityInFlightRef.current ||
        excludeInFlightRef.current ||
        manualQuantityInFlightRef.current
      ) {
        throw new ProposalScopeDecisionActionError("Line display update already in progress.");
      }

      visibilityInFlightRef.current = true;
      setVisibilityInFlight(true);
      setVisibilityError(null);
      setVisibilityErrorLineId(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await hideLineFromCustomer({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: WORKBENCH_HIDE_SUCCESS,
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not hide line from customer proposal.";
        setVisibilityError(message);
        setVisibilityErrorLineId(templateItemId);
        throw err;
      } finally {
        visibilityInFlightRef.current = false;
        setVisibilityInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleRestoreVisibility = useCallback(
    async (templateItemId: string) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalScopeDecisionActionError(
          "Restore visibility requires a saved proposal draft."
        );
      }

      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalScopeDecisionActionError(
          "Selected option is not available on this proposal draft."
        );
      }

      if (
        visibilityInFlightRef.current ||
        excludeInFlightRef.current ||
        manualQuantityInFlightRef.current
      ) {
        throw new ProposalScopeDecisionActionError("Restore visibility already in progress.");
      }

      visibilityInFlightRef.current = true;
      setVisibilityInFlight(true);
      setVisibilityError(null);
      setVisibilityErrorLineId(null);

      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        const { graph } = await clearCustomerVisibilityHide({
          companyId,
          proposalId: proposalIdParam.trim(),
          runtimeProposalOptionId: runtimeOptionId,
          sourceTemplateItemId: templateItemId,
          refreshContext: {
            quantity_context: {
              measurementHandoff,
              quantityMap: measurementQuantityMap,
            },
            measurement_record_id: selectedMeasurementId,
            measurement_quantities_display:
              measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
          },
        });

        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: WORKBENCH_RESTORE_VISIBILITY_SUCCESS,
        });
      } catch (err) {
        const message =
          err instanceof ProposalScopeDecisionActionError
            ? err.message
            : err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not restore line visibility.";
        setVisibilityError(message);
        setVisibilityErrorLineId(templateItemId);
        throw err;
      } finally {
        visibilityInFlightRef.current = false;
        setVisibilityInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const handleSetUpgradeSelected = useCallback(
    async (templateItemId: string, selected: boolean) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) {
        throw new ProposalRecordStoreError(
          "Upgrade selection requires a saved proposal draft."
        );
      }
      const runtimeOptionId = resolveRuntimeOptionIdFromTemplateOptionId(
        persistedGraph,
        effectiveSelectedOptionId
      );
      if (!runtimeOptionId) {
        throw new ProposalRecordStoreError(
          "Selected option is not available on this proposal draft."
        );
      }
      if (
        upgradeSelectionInFlightRef.current ||
        manualQuantityInFlightRef.current ||
        excludeInFlightRef.current ||
        visibilityInFlightRef.current
      ) {
        throw new ProposalRecordStoreError("Upgrade selection already in progress.");
      }

      upgradeSelectionInFlightRef.current = true;
      setUpgradeSelectionInFlight(true);
      setUpgradeSelectionError(null);
      const measurementDisplay = measurementHandoff
        ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
        : null;

      try {
        await upsertUpgradeChoiceSelection(
          companyId,
          runtimeOptionId,
          templateItemId,
          selected ? "selected" : "not_selected"
        );
        const graph = await refreshDraftPricing(companyId, proposalIdParam.trim(), {
          quantity_context: {
            measurementHandoff,
            quantityMap: measurementQuantityMap,
          },
          measurement_record_id: selectedMeasurementId,
          measurement_quantities_display:
            measurementDisplay && measurementDisplay !== "—" ? measurementDisplay : null,
        });
        if (!graph) throw new Error("Could not refresh draft pricing.");
        setPersistedGraph(graph);
        setRefreshFeedback({
          kind: "success",
          message: selected
            ? "Upgrade added. Pricing refreshed."
            : "Upgrade removed. Pricing refreshed.",
        });
      } catch (err) {
        const message =
          err instanceof ProposalRecordStoreError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not update upgrade selection.";
        setUpgradeSelectionError(message);
        throw err;
      } finally {
        upgradeSelectionInFlightRef.current = false;
        setUpgradeSelectionInFlight(false);
      }
    },
    [
      companyId,
      effectiveSelectedOptionId,
      hasPersistedProposalParam,
      measurementHandoff,
      measurementQuantityMap,
      persistedGraph,
      proposalIdParam,
      selectedMeasurementId,
    ]
  );

  const showStaleBanner =
    Boolean(adapterResult) &&
    (proposalPricingStale.stale || draftCatalogEconomicsStale.stale);

  const clearPageEditSession = useCallback(() => {
    setPageEditActiveContextId(null);
    setPageEditDraftBody("");
    setPageEditOriginalBody("");
    setPageEditSaveError(null);
  }, []);

  const pageEditIsDirty = useMemo(
    () => bodyMarkdownChanged(pageEditOriginalBody, pageEditDraftBody),
    [pageEditOriginalBody, pageEditDraftBody]
  );

  const handleSelectPageContext = useCallback(
    (id: BuilderPageContextId) => {
      if (
        pageEditActiveContextId != null &&
        pageEditIsDirty &&
        !window.confirm(BUILDER_UNSAVED_PAGE_EDIT_CONFIRM)
      ) {
        return;
      }
      clearPageEditSession();
      setActivePageContextId(id);
    },
    [pageEditActiveContextId, pageEditIsDirty, clearPageEditSession]
  );

  const handleStartPageEdit = useCallback(
    (contextId: BuilderPageContextId, rawBody: string | null) => {
      setPageEditActiveContextId(contextId);
      setPageEditDraftBody(rawBody ?? "");
      setPageEditOriginalBody(rawBody ?? "");
      setPageEditSaveError(null);
    },
    []
  );

  const handleCancelPageEdit = useCallback(() => {
    clearPageEditSession();
  }, [clearPageEditSession]);

  const handleSavePageEdit = useCallback(() => {
    if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) return;
    if (pageEditActiveContextId == null) return;
    if (pageEditSaveInFlightRef.current) return;

    const persistedPage = resolvePersistedPageByContextId(
      persistedGraph.pages,
      pageEditActiveContextId
    );
    if (!persistedPage?.id) {
      setPageEditSaveError("Could not find this draft page to save.");
      return;
    }

    if (!pageEditIsDirty) {
      clearPageEditSession();
      return;
    }

    pageEditSaveInFlightRef.current = true;
    setPageEditSaveInFlight(true);
    setPageEditSaveError(null);

    void (async () => {
      try {
        const updated = await updateDraftProposalPageContent(
          companyId,
          proposalIdParam.trim(),
          persistedPage.id,
          pageEditDraftBody
        );
        if (!updated) {
          throw new Error("Could not save page content.");
        }
        setPersistedGraph(updated);
        clearPageEditSession();
      } catch (err) {
        const message =
          err instanceof ProposalRecordStoreError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not save page content.";
        setPageEditSaveError(message);
        if (!(err instanceof ProposalRecordStoreError)) {
          console.warn("[ProposalBuilderClient] page content save error:", err);
        }
      } finally {
        pageEditSaveInFlightRef.current = false;
        setPageEditSaveInFlight(false);
      }
    })();
  }, [
    hasPersistedProposalParam,
    persistedGraph,
    proposalIdParam,
    pageEditActiveContextId,
    pageEditIsDirty,
    pageEditDraftBody,
    companyId,
    clearPageEditSession,
  ]);

  const handleTogglePageVisibility = useCallback(
    (pageId: string, visibleToCustomer: boolean) => {
      if (!hasPersistedProposalParam || !proposalIdParam) return;
      if (pageVisibilityToggleInFlightRef.current) return;

      pageVisibilityToggleInFlightRef.current = true;
      setPageVisibilityToggleInFlight(true);
      setPageVisibilityToggleError(null);

      void (async () => {
        try {
          const updated = await updateDraftProposalPageVisibility(
            companyId,
            proposalIdParam.trim(),
            pageId,
            visibleToCustomer
          );
          if (!updated) {
            throw new Error("Could not update page visibility.");
          }
          setPersistedGraph(updated);
        } catch (err) {
          const message =
            err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not update page visibility.";
          setPageVisibilityToggleError(message);
          if (!(err instanceof ProposalRecordStoreError)) {
            console.warn("[ProposalBuilderClient] page visibility toggle error:", err);
          }
        } finally {
          pageVisibilityToggleInFlightRef.current = false;
          setPageVisibilityToggleInFlight(false);
        }
      })();
    },
    [hasPersistedProposalParam, proposalIdParam, companyId]
  );

  const selectedOptionPricingStatus = useMemo(() => {
    if (!pricingPreview || !effectiveSelectedOptionId) return null;
    return pricingPreview.byOptionId[effectiveSelectedOptionId]?.status ?? null;
  }, [pricingPreview, effectiveSelectedOptionId]);

  const selectedOptionInternal = useMemo(() => {
    if (!pricingPreview || !effectiveSelectedOptionId) return null;
    return pricingPreview.byOptionId[effectiveSelectedOptionId]?.internal ?? null;
  }, [pricingPreview, effectiveSelectedOptionId]);

  const catalogReadiness = useMemo(
    () => deriveCatalogReadiness(activeCatalogItems, CATALOG_STARTER_DEFINITION_COUNT),
    [activeCatalogItems]
  );

  const templateReadiness = useMemo(
    () =>
      deriveProposalTemplateReadiness({
        catalogReadiness,
        activeCatalogItems,
        starterGraph,
        templateCount: companyTemplateCount,
        activeTemplateCount: starterGraph?.template.active ? 1 : starterGraph ? 1 : 0,
      }),
    [catalogReadiness, activeCatalogItems, starterGraph, companyTemplateCount]
  );

  const hasValidPersistedDraft =
    hasPersistedProposalParam &&
    draftGraphLoadComplete &&
    persistedGraph != null &&
    !draftGraphError;

  const builderReadiness = useMemo(() => {
    if (hasPersistedProposalParam && !draftGraphLoadComplete) {
      return {
        ready: false,
        loading: true,
        blockedGates: [],
        primaryGate: null,
      };
    }

    return deriveProposalBuilderReadiness({
      jobIdParam,
      job,
      jobLoadComplete,
      measurementHandoff,
      measurementLoadComplete,
      catalogReadiness,
      catalogLoadComplete,
      templateReadiness,
      templateLoadComplete,
      hasValidPersistedDraft,
    });
  }, [
    jobIdParam,
    job,
    jobLoadComplete,
    measurementHandoff,
    measurementLoadComplete,
    catalogReadiness,
    catalogLoadComplete,
    templateReadiness,
    templateLoadComplete,
    hasPersistedProposalParam,
    draftGraphLoadComplete,
    hasValidPersistedDraft,
  ]);

  const loadError = catalogError ?? templateError;
  const shellReady = builderReadiness.ready && !draftGraphError && !spineRouteError;
  const normalizedJobId = (jobIdParam ?? "").trim() || null;
  const lastSavedLabel = formatBuilderLastSavedLabel(persistedGraph?.proposal.updated_at);
  const selectedOptionCustomerView =
    pricingPreview && effectiveSelectedOptionId
      ? pricingPreview.byOptionId[effectiveSelectedOptionId]?.customer ?? null
      : null;
  const proposalTotalLabel =
    shellReady &&
    selectedOptionCustomerView?.pricingComplete &&
    typeof selectedOptionCustomerView.customerTotalCents === "number"
      ? formatPriceCents(selectedOptionCustomerView.customerTotalCents)
      : null;

  // 3J4B3: single guided-flow source of truth. Preview enablement is R17B-only;
  // Send/Sign/Payment/Production remain disabled.
  const hasPlaceholderPages = useMemo(() => {
    const { items } = buildPageContextStripItems(persistedGraph?.pages, {
      persistedProposalDocument: Boolean(adapterResult?.proposalDocumentContext),
    });
    return items.some((item) => item.kind === "placeholder");
  }, [persistedGraph?.pages, adapterResult?.proposalDocumentContext]);

  const coverViewModel = useMemo(() => {
    if (!adapterResult?.proposalDocumentContext) return null;
    return buildProposalCoverViewModel(adapterResult.proposalDocumentContext, {
      pricingComplete: selectedOptionPricingStatus?.pricingComplete ?? false,
    });
  }, [
    adapterResult?.proposalDocumentContext,
    selectedOptionPricingStatus?.pricingComplete,
  ]);

  const guidanceGuardrailStatus = useMemo<ProposalBuilderGuardrailStatus>(() => {
    const outcome = selectedOptionPricingStatus?.guardrailOutcome ?? null;
    if (outcome == null) return "unknown";
    if (outcome === "pass") return "pass";
    if (outcome === "warn") return "attention";
    return "blocked";
  }, [selectedOptionPricingStatus]);

  const builderGuidance = useMemo(() => {
    if (!shellReady) return null;
    const previewEnabled =
      hasPersistedProposalParam &&
      draftGraphLoadComplete &&
      !draftGraphError &&
      persistedGraph != null;
    return deriveProposalBuilderGuidance({
      hasPersistedProposal: hasPersistedProposalParam,
      selectedOptionId: effectiveSelectedOptionId,
      templateReady: templateReadiness.status === "ready_for_builder",
      measurementReady: Boolean(measurementHandoff?.proposalReady),
      measurementStale: proposalPricingStale.stale,
      pricingComplete: selectedOptionPricingStatus?.pricingComplete ?? false,
      blockingLineCount: selectedOptionPricingStatus?.blockingLineCount ?? 0,
      guardrailStatus: guidanceGuardrailStatus,
      hasProposalPages: (persistedGraph?.pages?.length ?? 0) > 0,
      hasPlaceholderPages,
      previewEnabled,
      sendEnabled: false,
      signEnabled: false,
      paymentEnabled: false,
      productionEnabled: false,
    });
  }, [
    shellReady,
    hasPersistedProposalParam,
    draftGraphLoadComplete,
    draftGraphError,
    persistedGraph,
    effectiveSelectedOptionId,
    templateReadiness.status,
    measurementHandoff?.proposalReady,
    proposalPricingStale.stale,
    selectedOptionPricingStatus,
    guidanceGuardrailStatus,
    persistedGraph?.pages,
    hasPlaceholderPages,
  ]);

  const handleLifecycleAction = useCallback(
    (actionId: ProposalBuilderLifecycleActionId) => {
      if (actionId !== "preview") return;
      const jobId = (jobIdParam ?? "").trim();
      const proposalId = (proposalIdParam ?? "").trim();
      if (!isUuidLike(jobId) || !isUuidLike(proposalId)) return;

      if (
        pageEditActiveContextId != null &&
        pageEditIsDirty &&
        !window.confirm(BUILDER_UNSAVED_PAGE_EDIT_CONFIRM)
      ) {
        return;
      }

      clearPageEditSession();
      router.push(buildProposalCustomerPreviewHref(jobId, proposalId));
    },
    [
      jobIdParam,
      proposalIdParam,
      pageEditActiveContextId,
      pageEditIsDirty,
      clearPageEditSession,
      router,
    ]
  );

  if (setupPreviewRetired) {
    return (
      <div
        className="space-y-3 pb-12 pt-2"
        data-builder-contractor-workspace
        data-builder-setup-preview-retired
      >
        <ProposalBuilderPageHeader
          job={null}
          jobId={(jobIdParam ?? "").trim() || null}
          shellReady={false}
        />
        <p className="px-5 text-[14px] text-slate-500" role="status">
          Opening Job Card…
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-3 pb-12 pt-2"
      data-builder-contractor-workspace
      data-builder-quantity-preflight={quantityPreflight?.status ?? "none"}
      data-builder-quantity-preflight-current={String(quantityPreflight?.currentCount ?? 0)}
      data-builder-quantity-preflight-stale={String(quantityPreflight?.staleCount ?? 0)}
      data-builder-quantity-preflight-unknown={String(quantityPreflight?.unknownCount ?? 0)}
      data-builder-quantity-trust-status={quantityPreflightTrust?.status ?? "unknown"}
      data-builder-quantity-trust-severity={quantityPreflightTrust?.severity ?? "neutral"}
      data-builder-quantity-trust-block={String(quantityPreflightTrust?.shouldBlock ?? false)}
      data-builder-quantity-trust-autorefresh={String(
        quantityPreflightTrust?.shouldAutoRefresh ?? false
      )}
    >
      <ProposalBuilderPageHeader
        job={job}
        jobId={normalizedJobId}
        shellReady={shellReady}
        showDraftSavedPill={
          Boolean(
            shellReady &&
              hasPersistedProposalParam &&
              draftGraphLoadComplete &&
              !draftGraphError &&
              persistedGraph != null
          )
        }
        selectedPackageLabel={
          shellReady
            ? (() => {
                const runtimeId = effectiveSelectedOptionId;
                if (!runtimeId) return null;
                const fromDraft = persistedGraph?.options.find((o) => o.id === runtimeId);
                if (fromDraft?.name?.trim()) return fromDraft.name.trim();
                const fromTemplate = starterGraph?.options.find((o) => o.id === runtimeId);
                return (fromTemplate?.name ?? "").trim() || null;
              })()
            : null
        }
        savedPricingDetails={
          !draftGraphError &&
          shellReady &&
          hasPersistedProposalParam &&
          draftGraphLoadComplete &&
          persistedGraph != null
            ? PROPOSAL_SNAPSHOT_FROZEN_HELPER_COPY
            : null
        }
        lastSavedLabel={shellReady ? lastSavedLabel : null}
        proposalTotalLabel={proposalTotalLabel}
        guidance={builderGuidance}
        onLifecycleAction={handleLifecycleAction}
      />
      <ProposalBuilderPageAlerts loadError={loadError} />
      {shellReady && hasPersistedProposalParam ? (
        <ProposalBuilderCustomerRequestBanner
          proposalId={proposalIdParam}
          jobId={jobIdParam}
        />
      ) : null}
      {spineRouteError && builderReadiness.primaryGate !== "missing_job" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {spineRouteError}
        </div>
      ) : null}
      {draftGraphError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {draftGraphError}
        </div>
      ) : null}
      {optionPersistError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {optionPersistError}
        </div>
      ) : null}
      {!draftGraphError && shellReady && showStaleBanner && staleBannerCopy ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
          data-builder-stale-banner
          data-builder-stale-reason={
            proposalPricingStale.stale && draftCatalogEconomicsStale.stale
              ? "measurement_and_catalog"
              : proposalPricingStale.stale
                ? "measurement"
                : draftCatalogEconomicsStale.reason ?? "catalog"
          }
        >
          <span>{staleBannerCopy}</span>
          <button
            type="button"
            onClick={handleRefreshDraftPricing}
            disabled={refreshInFlight || persistedGraph?.proposal.status !== "draft"}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0"
            data-builder-refresh-draft-pricing
          >
            {refreshInFlight ? "Refreshing…" : "Refresh draft pricing"}
          </button>
        </div>
      ) : null}
      {!draftGraphError && shellReady && refreshFeedback ? (
        <div className={BUILDER_STAGE} data-builder-refresh-feedback>
          <div
            className={`inline-flex max-w-md items-center rounded-md border px-3 py-1.5 text-[13px] font-medium shadow-sm ${
              refreshFeedback.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role="status"
          >
            {refreshFeedback.message}
          </div>
        </div>
      ) : null}
      {!draftGraphError && shellReady && pageVisibilityToggleError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {pageVisibilityToggleError}
        </div>
      ) : null}
      {!draftGraphError && shellReady ? (
        <ProposalBuilderWorkspaceLayout
          sectionNav={
            <ProposalBuilderSectionNav
              pages={persistedGraph?.pages}
              activePageContextId={activePageContextId}
              onSelectPageContext={handleSelectPageContext}
              persistedProposalDocument={Boolean(adapterResult?.proposalDocumentContext)}
            />
          }
          canvas={
            <ProposalBuilderCanvas
              starterGraph={starterGraph}
              packageSelectorGraph={packageSelectorGraph}
              draftScopedPackagePicker={draftScopedPackagePicker}
              selectedOptionId={selectedOptionId}
              onSelectOption={handleSelectOption}
              catalogItems={activeCatalogItems}
              measurementHandoff={measurementHandoff}
              measurementQuantityMap={measurementQuantityMap}
              pricingPreview={pricingPreview}
              snapshotQuantityByTemplateItemId={snapshotQuantityByTemplateItemId}
              pricingPolicyConfigured={pricingPolicyConfigured}
              activePageContextId={activePageContextId}
              persistedPages={persistedGraph?.pages}
              coverViewModel={coverViewModel}
              proposalDocumentContext={adapterResult?.proposalDocumentContext ?? null}
              pricingComplete={selectedOptionPricingStatus?.pricingComplete ?? false}
              persistedProposalPath={Boolean(adapterResult && persistedGraph?.pages?.length)}
              pageEditActiveContextId={pageEditActiveContextId}
              pageEditDraftBody={pageEditDraftBody}
              onPageEditDraftBodyChange={setPageEditDraftBody}
              onStartPageEdit={handleStartPageEdit}
              onCancelPageEdit={handleCancelPageEdit}
              onSavePageEdit={handleSavePageEdit}
              pageEditSaveDisabled={!pageEditIsDirty}
              pageEditSaveInFlight={pageEditSaveInFlight}
              pageEditSaveError={pageEditSaveError}
              onTogglePageVisibility={handleTogglePageVisibility}
              pageVisibilityToggleInFlight={pageVisibilityToggleInFlight}
              persistedDraftEnabled={Boolean(
                hasPersistedProposalParam && persistedGraph && !draftGraphError
              )}
              proposalId={
                hasPersistedProposalParam && proposalIdParam
                  ? proposalIdParam.trim()
                  : null
              }
              manualQuantityInFlight={manualQuantityInFlight}
              manualQuantityError={manualQuantityError}
              activeScopeDecisionsForOption={activeScopeDecisionsForOption}
              excludeInFlight={excludeInFlight}
              excludeError={excludeError}
              excludeErrorLineId={excludeErrorLineId}
              visibilityInFlight={visibilityInFlight}
              visibilityError={visibilityError}
              visibilityErrorLineId={visibilityErrorLineId}
              upgradeSelectionInFlight={upgradeSelectionInFlight}
              upgradeSelectionError={upgradeSelectionError}
              onApplyManualQuantity={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleApplyManualQuantity
                  : undefined
              }
              onClearManualQuantity={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleClearManualQuantity
                  : undefined
              }
              onExcludeLine={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleExcludeLine
                  : undefined
              }
              onRestoreExcludedLine={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleRestoreExcludedLine
                  : undefined
              }
              onHideLine={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleHideLine
                  : undefined
              }
              onRestoreVisibility={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleRestoreVisibility
                  : undefined
              }
              onSetUpgradeSelected={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleSetUpgradeSelected
                  : undefined
              }
            />
          }
        />
      ) : !draftGraphError ? (
        <ProposalBuilderBlockedState
          loading={builderReadiness.loading}
          primaryGate={builderReadiness.primaryGate}
          blockedGates={builderReadiness.blockedGates}
          jobId={normalizedJobId}
          measurementHandoff={measurementHandoff}
          catalogReadiness={catalogReadiness}
          templateReadiness={templateReadiness}
        />
      ) : null}
    </div>
  );
}

function buildMeasurementHandoffFromPersisted(
  measurement: MeasurementRecord
): MeasurementProposalHandoff {
  const workspace = resolveMeasurementWorkspaceState({
    localRecord: measurement,
    persistedRecord: measurement,
    hasUnsavedChanges: false,
  });
  return buildMeasurementProposalHandoff({
    record: measurement,
    workspace,
    hasUnsavedChanges: false,
    persistedRecord: measurement,
  });
}
