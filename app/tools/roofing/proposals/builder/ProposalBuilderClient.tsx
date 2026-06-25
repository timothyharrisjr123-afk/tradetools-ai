"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import { resolveMeasurementWorkspaceState } from "@/app/lib/measurementReadiness";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import type { MeasurementQuantityMap, MeasurementRecord } from "@/app/lib/measurementTypes";
import { deriveProposalBuilderReadiness } from "@/app/lib/proposalBuilderReadiness";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { getDefaultSelectedOptionId } from "@/app/lib/proposalBuilderPreview";
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
  updateDraftProposalPageSettings,
  updateDraftProposalPageVisibility,
  updateDraftSelectedOption,
  type ProposalDraftGraph,
} from "@/app/lib/proposalRecordStore";
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
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { EstimateSettingsToggleKey } from "@/app/tools/roofing/templates/templatesStructureEditorUtils";
import {
  BUILDER_DEFAULT_PAGE_CONTEXT,
  buildPageContextStripItems,
  resolvePersistedPageByContextId,
  type BuilderPageContextId,
} from "@/app/lib/proposalBuilderNavigation";
import {
  BUILDER_UNSAVED_PAGE_EDIT_CONFIRM,
  WORKBENCH_EXCLUDE_SUCCESS,
  WORKBENCH_HIDE_SUCCESS,
  WORKBENCH_RESTORE_EXCLUDED_SUCCESS,
  WORKBENCH_RESTORE_VISIBILITY_SUCCESS,
} from "./proposalBuilderConstants";
import { buildProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import {
  deriveProposalBuilderGuidance,
  type ProposalBuilderGuardrailStatus,
  type ProposalBuilderGuidanceTarget,
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
import ProposalBuilderPageContextStrip from "./ProposalBuilderPageContextStrip";
import ProposalBuilderPageHeader from "./ProposalBuilderPageHeader";
import ProposalBuilderSummaryRail from "./ProposalBuilderSummaryRail";
import ProposalBuilderWorkspaceLayout from "./ProposalBuilderWorkspaceLayout";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function ProposalBuilderClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job");
  const proposalIdParam = searchParams.get("proposal");
  const hasPersistedProposalParam =
    proposalIdParam != null && isUuidLike(proposalIdParam.trim());

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
  const excludeInFlightRef = useRef(false);
  const [visibilityInFlight, setVisibilityInFlight] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const visibilityInFlightRef = useRef(false);
  const pageVisibilityToggleInFlightRef = useRef(false);
  const [estimateSettingsSaveInFlight, setEstimateSettingsSaveInFlight] = useState(false);
  const [estimateSettingsSaveError, setEstimateSettingsSaveError] = useState<string | null>(null);
  const estimateSettingsSaveInFlightRef = useRef(false);

  const loadJobContext = useCallback(async () => {
    setJobLoadComplete(false);
    setMeasurementLoadComplete(false);
    setJob(null);
    setMeasurementHandoff(null);
    setMeasurementQuantityMap(null);
    setSelectedMeasurementId(null);
    setSelectedMeasurementUpdatedAt(null);

    const jobId = (jobIdParam ?? "").trim();
    if (!jobId || !isUuidLike(jobId)) {
      setJobLoadComplete(true);
      setMeasurementLoadComplete(true);
      return;
    }

    try {
      const record = await getJobById(jobId);
      setJob(record);

      if (!record) {
        setMeasurementLoadComplete(true);
        return;
      }

      const measurement = await getSelectedMeasurementForJob(jobId);
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
      setJob(null);
      setMeasurementHandoff(null);
      setMeasurementQuantityMap(null);
      setSelectedMeasurementId(null);
      setSelectedMeasurementUpdatedAt(null);
    } finally {
      setJobLoadComplete(true);
      setMeasurementLoadComplete(true);
    }
  }, [jobIdParam]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoadComplete(false);
    setCatalogError(null);
    try {
      const rows = await getActiveCatalogItemsByCompany(companyId);
      setCatalogItems(rows);
    } catch (err) {
      console.warn("[ProposalBuilderClient] catalog fetch error:", err);
      setCatalogError("Could not load catalog items.");
      setCatalogItems([]);
    } finally {
      setCatalogLoadComplete(true);
    }
  }, [companyId]);

  const loadTemplates = useCallback(async () => {
    setTemplateLoadComplete(false);
    setTemplateError(null);
    try {
      const templates = await getProposalTemplatesByCompany(companyId);
      setCompanyTemplateCount(templates.length);
      const starter = findStarterProposalTemplate(templates);
      if (!starter?.id) {
        setStarterGraph(null);
        return;
      }
      const graph = await getProposalTemplateGraph(starter.id, { companyId });
      setStarterGraph(graph);
    } catch (err) {
      console.warn("[ProposalBuilderClient] template fetch error:", err);
      setTemplateError("Could not load proposal templates.");
      setStarterGraph(null);
      setCompanyTemplateCount(0);
    } finally {
      setTemplateLoadComplete(true);
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
    if (!hasPersistedProposalParam) {
      setPersistedGraph(null);
      setDraftGraphError(null);
      setDraftGraphLoadComplete(true);
      return;
    }

    setDraftGraphLoadComplete(false);
    setDraftGraphError(null);
    setPersistedGraph(null);

    const proposalId = proposalIdParam!.trim();
    try {
      const graph = await getDraftGraph(companyId, proposalId);
      const validation = validateProposalDraftGraphForJob(graph, jobIdParam);
      if (!validation.valid) {
        setDraftGraphError(validation.message);
        return;
      }
      setPersistedGraph(graph);
    } catch (err) {
      console.warn("[ProposalBuilderClient] persisted draft load error:", err);
      setDraftGraphError("Could not load persisted proposal draft.");
    } finally {
      setDraftGraphLoadComplete(true);
    }
  }, [companyId, hasPersistedProposalParam, jobIdParam, proposalIdParam]);

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
    if (hasPersistedProposalParam) return;
    void loadTemplates();
  }, [loadTemplates, hasPersistedProposalParam]);

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
          message: "Manual quantity saved and draft pricing refreshed.",
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
          "Remove from option requires a saved proposal draft."
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
        throw new ProposalScopeDecisionActionError("Remove from option already in progress.");
      }

      excludeInFlightRef.current = true;
      setExcludeInFlight(true);
      setExcludeError(null);

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
          "Hide from customer requires a saved proposal draft."
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
        throw new ProposalScopeDecisionActionError("Hide from customer already in progress.");
      }

      visibilityInFlightRef.current = true;
      setVisibilityInFlight(true);
      setVisibilityError(null);

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

  const showStaleBanner = Boolean(adapterResult) && proposalPricingStale.stale;

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

  const handleToggleEstimateDisplaySetting = useCallback(
    (key: EstimateSettingsToggleKey, nextValue: boolean) => {
      if (!hasPersistedProposalParam || !persistedGraph || !proposalIdParam) return;
      if (estimateSettingsSaveInFlightRef.current) return;

      const estimatePage = persistedGraph.pages.find((page) => page.page_type === "estimate");
      if (!estimatePage?.id) {
        setEstimateSettingsSaveError("Could not find the estimate page for this draft.");
        return;
      }

      estimateSettingsSaveInFlightRef.current = true;
      setEstimateSettingsSaveInFlight(true);
      setEstimateSettingsSaveError(null);

      void (async () => {
        try {
          const updated = await updateDraftProposalPageSettings(
            companyId,
            proposalIdParam.trim(),
            estimatePage.id,
            { [key]: nextValue }
          );
          if (!updated) {
            throw new Error("Could not save estimate display settings.");
          }
          setPersistedGraph(updated);
        } catch (err) {
          const message =
            err instanceof ProposalRecordStoreError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not save estimate display settings.";
          setEstimateSettingsSaveError(message);
          if (!(err instanceof ProposalRecordStoreError)) {
            console.warn("[ProposalBuilderClient] estimate settings save error:", err);
          }
        } finally {
          estimateSettingsSaveInFlightRef.current = false;
          setEstimateSettingsSaveInFlight(false);
        }
      })();
    },
    [hasPersistedProposalParam, persistedGraph, proposalIdParam, companyId]
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

  const builderReadiness = useMemo(() => {
    const base = deriveProposalBuilderReadiness({
      jobIdParam,
      job,
      jobLoadComplete,
      measurementHandoff,
      measurementLoadComplete,
      catalogReadiness,
      catalogLoadComplete,
      templateReadiness,
      templateLoadComplete,
    });

    if (hasPersistedProposalParam && !draftGraphLoadComplete) {
      return { ...base, ready: false, loading: true };
    }

    return base;
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
  ]);

  const loadError = catalogError ?? templateError;
  const shellReady = builderReadiness.ready && !draftGraphError && !spineRouteError;
  const normalizedJobId = (jobIdParam ?? "").trim() || null;

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
      measurementStale: showStaleBanner,
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
    showStaleBanner,
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

  // 3J4C4: the Estimate document now holds sections, line items, totals, package
  // options, and details inline, so the former workspace-tab targets all resolve
  // to the Estimate document page. Lifecycle (action:preview/send/sign/payment/
  // production) intentionally no-ops — nothing is enabled here.
  const handleGuidanceNavigate = useCallback(
    (target: ProposalBuilderGuidanceTarget) => {
      switch (target) {
        case "workspace:overview":
        case "workspace:options":
        case "workspace:sections":
        case "workspace:line-items":
        case "workspace:quantities":
          handleSelectPageContext("estimate");
          return;
        case "page:cover":
          handleSelectPageContext("cover");
          return;
        case "page:estimate":
          handleSelectPageContext("estimate");
          return;
        case "page:terms":
          handleSelectPageContext("placeholder:terms");
          return;
        case "page:warranty":
          handleSelectPageContext("placeholder:warranty");
          return;
        case "page:project-overview":
          handleSelectPageContext("placeholder:about");
          return;
        case "page:project-photos":
          handleSelectPageContext("placeholder:photos");
          return;
        case "action:refresh-pricing":
          handleRefreshDraftPricing();
          return;
        case "action:preview":
          handleLifecycleAction("preview");
          return;
        case "action:send":
        case "action:sign":
        case "action:payment":
        case "action:production":
        case "none":
        default:
          return;
      }
    },
    [handleRefreshDraftPricing, handleSelectPageContext, handleLifecycleAction]
  );

  return (
    <div className="space-y-6">
      <ProposalBuilderPageHeader
        job={job}
        jobId={normalizedJobId}
        shellReady={shellReady}
        showDraftSavedPill={hasPersistedProposalParam && draftGraphLoadComplete && !draftGraphError}
        guidance={builderGuidance}
        onLifecycleAction={handleLifecycleAction}
      />
      <ProposalBuilderPageAlerts
        loadError={loadError}
        shellReady={shellReady}
        hasPersistedDraft={
          hasPersistedProposalParam &&
          draftGraphLoadComplete &&
          !draftGraphError &&
          persistedGraph != null
        }
      />
      {spineRouteError ? (
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
      {!draftGraphError && shellReady && showStaleBanner ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>{PROPOSAL_PRICING_STALE_BANNER_COPY}</span>
          <button
            type="button"
            onClick={handleRefreshDraftPricing}
            disabled={refreshInFlight}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshInFlight ? "Refreshing…" : "Refresh draft pricing"}
          </button>
        </div>
      ) : null}
      {!draftGraphError && shellReady && refreshFeedback ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            refreshFeedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {refreshFeedback.message}
        </div>
      ) : null}
      {!draftGraphError && shellReady && pageVisibilityToggleError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {pageVisibilityToggleError}
        </div>
      ) : null}
      {!draftGraphError && shellReady && estimateSettingsSaveError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {estimateSettingsSaveError}
        </div>
      ) : null}
      {!draftGraphError && shellReady ? (
        <ProposalBuilderWorkspaceLayout
          pageContextStrip={
            <ProposalBuilderPageContextStrip
              pages={persistedGraph?.pages}
              activePageContextId={activePageContextId}
              onSelectPageContext={handleSelectPageContext}
              persistedProposalDocument={Boolean(adapterResult?.proposalDocumentContext)}
            />
          }
          canvas={
            <ProposalBuilderCanvas
              starterGraph={starterGraph}
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
              onToggleEstimateDisplaySetting={
                hasPersistedProposalParam && persistedGraph && !draftGraphError
                  ? handleToggleEstimateDisplaySetting
                  : undefined
              }
              estimateSettingsSaveInFlight={estimateSettingsSaveInFlight}
              estimateSettingsSaveError={estimateSettingsSaveError}
              persistedDraftEnabled={Boolean(
                hasPersistedProposalParam && persistedGraph && !draftGraphError
              )}
              manualQuantityInFlight={manualQuantityInFlight}
              manualQuantityError={manualQuantityError}
              activeScopeDecisionsForOption={activeScopeDecisionsForOption}
              excludeInFlight={excludeInFlight}
              excludeError={excludeError}
              visibilityInFlight={visibilityInFlight}
              visibilityError={visibilityError}
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
            />
          }
          summaryRail={
            <ProposalBuilderSummaryRail
              guidance={builderGuidance}
              onGuidanceNavigate={handleGuidanceNavigate}
              measurementHandoff={measurementHandoff}
              catalogReadiness={catalogReadiness}
              templateReadiness={templateReadiness}
              starterGraph={starterGraph}
              selectedOptionPricingStatus={selectedOptionPricingStatus}
              selectedOptionInternal={selectedOptionInternal}
              pricingPolicyConfigured={pricingPolicyConfigured}
              pricingPolicyLoadComplete={pricingPolicyLoadComplete}
              isPersistedSnapshot={adapterResult != null}
              snapshotMeasurementDisplay={adapterResult?.snapshotMeasurementDisplay ?? null}
              proposalId={hasPersistedProposalParam ? proposalIdParam?.trim() ?? null : null}
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
