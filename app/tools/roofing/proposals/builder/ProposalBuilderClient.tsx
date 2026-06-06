"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import { getJobById, isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
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
  validateProposalDraftGraphForJob,
} from "@/app/lib/proposalDraftGraphAdapter";
import { getDraftGraph, type ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import { getResolvedCompanyPricingPolicy } from "@/app/lib/companyPricingPolicyStore";
import type { CompanyPricingPolicyResolution } from "@/app/lib/companyPricingPolicy";
import type { PricingPolicy } from "@/app/lib/proposalPricingTypes";
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";
import ProposalBuilderBlockedState from "./ProposalBuilderBlockedState";
import ProposalBuilderCanvas from "./ProposalBuilderCanvas";
import ProposalBuilderPageAlerts from "./ProposalBuilderPageAlerts";
import ProposalBuilderPageHeader from "./ProposalBuilderPageHeader";
import ProposalBuilderSectionNav from "./ProposalBuilderSectionNav";
import ProposalBuilderSummaryRail from "./ProposalBuilderSummaryRail";
import ProposalBuilderWorkspaceLayout from "./ProposalBuilderWorkspaceLayout";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function ProposalBuilderClient({ companyId }: { companyId: string }) {
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job");
  const proposalIdParam = searchParams.get("proposal");
  const hasPersistedProposalParam =
    proposalIdParam != null && isUuidLike(proposalIdParam.trim());

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
  const [measurementLoadComplete, setMeasurementLoadComplete] = useState(false);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoadComplete, setCatalogLoadComplete] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [companyTemplateCount, setCompanyTemplateCount] = useState(0);
  const [templateLoadComplete, setTemplateLoadComplete] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // 3I-3B3c: resolved company pricing policy. Builder reads ONLY the resolver
  // (getResolvedCompanyPricingPolicy) — never raw getCompanyPricingPolicy — and
  // never auto-saves or writes any policy from here.
  const [pricingResolution, setPricingResolution] =
    useState<CompanyPricingPolicyResolution | null>(null);
  const [pricingPolicyLoadComplete, setPricingPolicyLoadComplete] = useState(false);

  const loadJobContext = useCallback(async () => {
    setJobLoadComplete(false);
    setMeasurementLoadComplete(false);
    setJob(null);
    setMeasurementHandoff(null);
    setMeasurementQuantityMap(null);

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
      } else {
        setMeasurementQuantityMap(null);
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
      return;
    }
    if (!starterGraph) {
      setSelectedOptionId(null);
      return;
    }
    setSelectedOptionId(getDefaultSelectedOptionId(starterGraph));
  }, [adapterResult?.selectedTemplateOptionId, starterGraph?.template.id]);

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
  const shellReady = builderReadiness.ready && !draftGraphError;
  const normalizedJobId = (jobIdParam ?? "").trim() || null;

  return (
    <div className="space-y-6">
      <ProposalBuilderPageHeader
        job={job}
        jobId={normalizedJobId}
        shellReady={shellReady}
      />
      <ProposalBuilderPageAlerts loadError={loadError} shellReady={shellReady} />
      {draftGraphError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {draftGraphError}
        </div>
      ) : null}
      {!draftGraphError && shellReady ? (
        <ProposalBuilderWorkspaceLayout
          sectionNav={<ProposalBuilderSectionNav activeSectionId="overview" />}
          canvas={
            <ProposalBuilderCanvas
              starterGraph={starterGraph}
              selectedOptionId={selectedOptionId}
              onSelectOption={setSelectedOptionId}
              catalogItems={activeCatalogItems}
              measurementHandoff={measurementHandoff}
              measurementQuantityMap={measurementQuantityMap}
              pricingPreview={pricingPreview}
              pricingPolicyConfigured={pricingPolicyConfigured}
            />
          }
          summaryRail={
            <ProposalBuilderSummaryRail
              measurementHandoff={measurementHandoff}
              catalogReadiness={catalogReadiness}
              templateReadiness={templateReadiness}
              starterGraph={starterGraph}
              selectedOptionPricingStatus={selectedOptionPricingStatus}
              selectedOptionInternal={selectedOptionInternal}
              pricingPolicyConfigured={pricingPolicyConfigured}
              pricingPolicyLoadComplete={pricingPolicyLoadComplete}
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
