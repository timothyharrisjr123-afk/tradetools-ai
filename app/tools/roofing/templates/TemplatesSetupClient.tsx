"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deriveCatalogReadiness } from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  installDefaultRoofingProposalTemplates,
  type InstallDefaultRoofingProposalTemplatesResult,
} from "@/app/lib/defaultRoofingProposalTemplateInstall";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import TemplatesBuilderFootnote from "./TemplatesBuilderFootnote";
import TemplatesCatalogPrerequisite from "./TemplatesCatalogPrerequisite";
import TemplatesContentEditorShell from "./TemplatesContentEditorShell";
import TemplatesLibrarySection from "./TemplatesLibrarySection";
import TemplatesOnboardingZone from "./TemplatesOnboardingZone";
import TemplatesPageAlerts from "./TemplatesPageAlerts";
import TemplatesPageHeader from "./TemplatesPageHeader";
import TemplatesSelectedTemplatePanel from "./TemplatesSelectedTemplatePanel";
import TemplatesSetupChecklist from "./TemplatesSetupChecklist";
import TemplatesStarterHeroCard from "./TemplatesStarterHeroCard";
import TemplatesWorkspaceLayout from "./TemplatesWorkspaceLayout";
import { TEMPLATES_WORKSPACE_ZONE } from "./templatesConstants";
import { deriveInstallFeedback, findStarterProposalTemplate } from "./templatesSetupUtils";
import {
  buildWorkspaceContentViewModel,
  isTemplateWorkspaceActive,
  resolveDefaultSelectedTemplateId,
} from "./templatesWorkspaceUtils";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function TemplatesSetupClient({ companyId }: { companyId: string }) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [companyTemplates, setCompanyTemplates] = useState<ProposalTemplate[]>([]);
  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState<ProposalTemplateGraph | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] =
    useState<InstallDefaultRoofingProposalTemplatesResult | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const rows = await getActiveCatalogItemsByCompany(companyId);
      setCatalogItems(rows);
    } catch (err) {
      console.warn("[TemplatesSetupClient] catalog fetch error:", err);
      setCatalogError("Could not load catalog items.");
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [companyId]);

  const loadTemplateGraph = useCallback(
    async (templateId: string, starterGraphCache: ProposalTemplateGraph | null) => {
      if (starterGraphCache?.template.id === templateId) {
        return starterGraphCache;
      }
      return getProposalTemplateGraph(templateId, { companyId });
    },
    [companyId]
  );

  const loadTemplates = useCallback(
    async (preserveSelectionId?: string | null) => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const templates = await getProposalTemplatesByCompany(companyId);
        setCompanyTemplates(templates);

        const starter = findStarterProposalTemplate(templates);
        let nextStarterGraph: ProposalTemplateGraph | null = null;
        if (starter?.id) {
          nextStarterGraph = await getProposalTemplateGraph(starter.id, { companyId });
        }
        setStarterGraph(nextStarterGraph);

        const nextSelectedId =
          preserveSelectionId && templates.some((row) => row.id === preserveSelectionId)
            ? preserveSelectionId
            : resolveDefaultSelectedTemplateId(templates);
        setSelectedTemplateId(nextSelectedId);

        if (nextSelectedId) {
          const graph = await loadTemplateGraph(nextSelectedId, nextStarterGraph);
          setSelectedGraph(graph);
        } else {
          setSelectedGraph(null);
        }
      } catch (err) {
        console.warn("[TemplatesSetupClient] template fetch error:", err);
        setTemplatesError("Could not load proposal templates.");
        setCompanyTemplates([]);
        setStarterGraph(null);
        setSelectedTemplateId(null);
        setSelectedGraph(null);
      } finally {
        setTemplatesLoading(false);
      }
    },
    [companyId, loadTemplateGraph]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadCatalog();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadTemplates();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTemplates]);

  const handleSelectTemplate = useCallback(
    (templateId: string) => {
      void (async () => {
        if (templateId === selectedTemplateId) return;

        setGraphLoading(true);
        setTemplatesError(null);
        setSelectedTemplateId(templateId);
        try {
          const graph = await loadTemplateGraph(templateId, starterGraph);
          setSelectedGraph(graph);
        } catch (err) {
          console.warn("[TemplatesSetupClient] template graph fetch error:", err);
          setTemplatesError("Could not load the selected template.");
          setSelectedGraph(null);
        } finally {
          setGraphLoading(false);
        }
      })();
    },
    [loadTemplateGraph, selectedTemplateId, starterGraph]
  );

  const activeItems = useMemo(() => catalogItems.filter((item) => item.active), [catalogItems]);

  const catalogReadiness = useMemo(
    () => deriveCatalogReadiness(activeItems, CATALOG_STARTER_DEFINITION_COUNT),
    [activeItems]
  );

  const catalogReady = catalogReadiness.state === "ready_for_templates";
  const starterInstalled = starterGraph != null;
  const loading = catalogLoading || templatesLoading;
  const loadError = catalogError ?? templatesError;
  const workspaceActive = isTemplateWorkspaceActive(companyTemplates, selectedGraph);
  const contentViewModel = useMemo(
    () => buildWorkspaceContentViewModel(selectedGraph),
    [selectedGraph]
  );

  const proposalReadiness = useMemo(
    () =>
      deriveProposalTemplateReadiness({
        catalogReadiness,
        activeCatalogItems: activeItems,
        starterGraph,
        templateCount: companyTemplates.length,
        activeTemplateCount: starterGraph?.template.active ? 1 : starterGraph ? 1 : 0,
        lastInstallMissingCatalogSeedKeys: installResult?.missingCatalogSeedKeys,
      }),
    [
      catalogReadiness,
      activeItems,
      starterGraph,
      companyTemplates.length,
      installResult?.missingCatalogSeedKeys,
    ]
  );

  const handleInstallStarter = useCallback(() => {
    void (async () => {
      if (catalogLoading || templatesLoading || installing || !catalogReady) return;

      setInstalling(true);
      setInstallError(null);
      setInstallMessage(null);
      setInstallResult(null);

      try {
        const result = await installDefaultRoofingProposalTemplates(companyId);
        if (!result) {
          setInstallError("Install failed: invalid company context.");
          return;
        }

        setInstallResult(result);
        const feedback = deriveInstallFeedback(result);
        setInstallMessage(feedback.message);
        setInstallError(feedback.error);

        await Promise.all([loadCatalog(), loadTemplates(selectedTemplateId)]);
      } catch (err) {
        console.warn("[TemplatesSetupClient] install error:", err);
        setInstallError("Install failed unexpectedly.");
      } finally {
        setInstalling(false);
      }
    })();
  }, [
    catalogLoading,
    templatesLoading,
    installing,
    catalogReady,
    companyId,
    loadCatalog,
    loadTemplates,
    selectedTemplateId,
  ]);

  const installDisabled =
    !catalogReady || installing || catalogLoading || templatesLoading;
  const installDisabledTitle = !catalogReady
    ? "Complete catalog setup first"
    : installing
      ? "Installing…"
      : undefined;
  const installButtonLabel = installing
    ? "Installing…"
    : starterInstalled
      ? "Recheck starter template"
      : "Install starter template";

  const starterHero = (
    <TemplatesStarterHeroCard
      loading={loading}
      catalogReady={catalogReady}
      catalogReadiness={catalogReadiness}
      proposalReadiness={proposalReadiness}
      starterInstalled={starterInstalled}
      installButtonLabel={installButtonLabel}
      installDisabled={installDisabled}
      installDisabledTitle={installDisabledTitle}
      onInstallStarter={handleInstallStarter}
      installResult={installResult}
      compact={workspaceActive}
    />
  );

  const catalogPrerequisite = (
    <TemplatesCatalogPrerequisite
      loading={catalogLoading}
      error={catalogError}
      readiness={catalogReadiness}
      catalogReady={catalogReady}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <TemplatesPageHeader />

      <TemplatesPageAlerts
        loadError={loadError}
        installMessage={installMessage}
        installError={installError}
      />

      <TemplatesWorkspaceLayout
        main={
          <div className="space-y-6">
            <TemplatesOnboardingZone
              workspaceActive={workspaceActive}
              catalogPrerequisite={catalogPrerequisite}
              starterHero={starterHero}
            />

            <TemplatesLibrarySection
              loading={templatesLoading || installing || graphLoading}
              templates={companyTemplates}
              selectedTemplateId={selectedTemplateId}
              selectedGraph={selectedGraph}
              catalogReady={catalogReady}
              proposalReadiness={proposalReadiness}
              onSelectTemplate={handleSelectTemplate}
            />

            {workspaceActive && selectedGraph && contentViewModel ? (
              <div className={`${TEMPLATES_WORKSPACE_ZONE} space-y-6 p-5`}>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Template workspace</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Review selected template context and master content by package option.
                  </p>
                </div>

                <TemplatesSelectedTemplatePanel
                  graph={selectedGraph}
                  contentViewModel={contentViewModel}
                />
                <TemplatesContentEditorShell viewModel={contentViewModel} />
              </div>
            ) : null}
          </div>
        }
        aside={
          <TemplatesSetupChecklist
            loading={loading}
            catalogReady={catalogReady}
            readiness={catalogReadiness}
            starterInstalled={starterInstalled}
            proposalReadiness={proposalReadiness}
          />
        }
      />

      <TemplatesBuilderFootnote />
    </div>
  );
}
