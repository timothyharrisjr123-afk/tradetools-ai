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
import TemplatesBuilderFootnote from "./TemplatesBuilderFootnote";
import TemplatesCatalogPrerequisite from "./TemplatesCatalogPrerequisite";
import TemplatesLibrarySection from "./TemplatesLibrarySection";
import TemplatesPageAlerts from "./TemplatesPageAlerts";
import TemplatesPageHeader from "./TemplatesPageHeader";
import TemplatesSetupChecklist from "./TemplatesSetupChecklist";
import TemplatesStarterHeroCard from "./TemplatesStarterHeroCard";
import TemplatesWorkspaceLayout from "./TemplatesWorkspaceLayout";
import { deriveInstallFeedback, findStarterProposalTemplate } from "./templatesSetupUtils";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function TemplatesSetupClient({ companyId }: { companyId: string }) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [companyTemplateCount, setCompanyTemplateCount] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(true);
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

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
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
      console.warn("[TemplatesSetupClient] template fetch error:", err);
      setTemplatesError("Could not load proposal templates.");
      setStarterGraph(null);
      setCompanyTemplateCount(0);
    } finally {
      setTemplatesLoading(false);
    }
  }, [companyId]);

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

  const activeItems = useMemo(() => catalogItems.filter((item) => item.active), [catalogItems]);

  const catalogReadiness = useMemo(
    () => deriveCatalogReadiness(activeItems, CATALOG_STARTER_DEFINITION_COUNT),
    [activeItems]
  );

  const catalogReady = catalogReadiness.state === "ready_for_templates";
  const starterInstalled = starterGraph != null;
  const loading = catalogLoading || templatesLoading;
  const loadError = catalogError ?? templatesError;

  const proposalReadiness = useMemo(
    () =>
      deriveProposalTemplateReadiness({
        catalogReadiness,
        activeCatalogItems: activeItems,
        starterGraph,
        templateCount: companyTemplateCount,
        activeTemplateCount: starterGraph?.template.active ? 1 : starterGraph ? 1 : 0,
        lastInstallMissingCatalogSeedKeys: installResult?.missingCatalogSeedKeys,
      }),
    [catalogReadiness, activeItems, starterGraph, companyTemplateCount, installResult?.missingCatalogSeedKeys]
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

        await Promise.all([loadCatalog(), loadTemplates()]);
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

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <TemplatesPageHeader />

      <TemplatesPageAlerts
        loadError={loadError}
        installMessage={installMessage}
        installError={installError}
      />

      <TemplatesCatalogPrerequisite
        loading={catalogLoading}
        error={catalogError}
        readiness={catalogReadiness}
        catalogReady={catalogReady}
      />

      <TemplatesWorkspaceLayout
        main={
          <>
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
            />
            <TemplatesLibrarySection
              loading={templatesLoading || installing}
              graph={starterGraph}
              catalogReady={catalogReady}
              proposalReadiness={proposalReadiness}
            />
          </>
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
