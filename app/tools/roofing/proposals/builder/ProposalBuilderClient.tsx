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
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import { resolveMeasurementWorkspaceState } from "@/app/lib/measurementReadiness";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import { deriveProposalBuilderReadiness } from "@/app/lib/proposalBuilderReadiness";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { getDefaultSelectedOptionId } from "@/app/lib/proposalBuilderPreview";
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

  const [job, setJob] = useState<JobRecord | null>(null);
  const [jobLoadComplete, setJobLoadComplete] = useState(false);

  const [measurementHandoff, setMeasurementHandoff] = useState<MeasurementProposalHandoff | null>(
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

  const loadJobContext = useCallback(async () => {
    setJobLoadComplete(false);
    setMeasurementLoadComplete(false);
    setJob(null);
    setMeasurementHandoff(null);

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
      } else {
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

  useEffect(() => {
    void loadJobContext();
  }, [loadJobContext]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!starterGraph) {
      setSelectedOptionId(null);
      return;
    }
    setSelectedOptionId(getDefaultSelectedOptionId(starterGraph));
  }, [starterGraph?.template.id]);

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

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

  const builderReadiness = useMemo(
    () =>
      deriveProposalBuilderReadiness({
        jobIdParam,
        job,
        jobLoadComplete,
        measurementHandoff,
        measurementLoadComplete,
        catalogReadiness,
        catalogLoadComplete,
        templateReadiness,
        templateLoadComplete,
      }),
    [
      jobIdParam,
      job,
      jobLoadComplete,
      measurementHandoff,
      measurementLoadComplete,
      catalogReadiness,
      catalogLoadComplete,
      templateReadiness,
      templateLoadComplete,
    ]
  );

  const loadError = catalogError ?? templateError;
  const shellReady = builderReadiness.ready;
  const normalizedJobId = (jobIdParam ?? "").trim() || null;

  return (
    <div className="space-y-6">
      <ProposalBuilderPageHeader
        job={job}
        jobId={normalizedJobId}
        shellReady={shellReady}
      />
      <ProposalBuilderPageAlerts loadError={loadError} shellReady={shellReady} />
      {shellReady ? (
        <ProposalBuilderWorkspaceLayout
          sectionNav={<ProposalBuilderSectionNav activeSectionId="overview" />}
          canvas={
            <ProposalBuilderCanvas
              starterGraph={starterGraph}
              selectedOptionId={selectedOptionId}
              onSelectOption={setSelectedOptionId}
              catalogItems={activeCatalogItems}
              measurementHandoff={measurementHandoff}
            />
          }
          summaryRail={
            <ProposalBuilderSummaryRail
              measurementHandoff={measurementHandoff}
              catalogReadiness={catalogReadiness}
              templateReadiness={templateReadiness}
              starterGraph={starterGraph}
            />
          }
        />
      ) : (
        <ProposalBuilderBlockedState
          loading={builderReadiness.loading}
          primaryGate={builderReadiness.primaryGate}
          blockedGates={builderReadiness.blockedGates}
          jobId={normalizedJobId}
          measurementHandoff={measurementHandoff}
          catalogReadiness={catalogReadiness}
          templateReadiness={templateReadiness}
        />
      )}
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
