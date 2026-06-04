"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MIN_MEASUREMENT_MAPPED_FOR_READY,
  countUnpricedCatalogItems,
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
} from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  installDefaultRoofingProposalTemplates,
  type InstallDefaultRoofingProposalTemplatesResult,
} from "@/app/lib/defaultRoofingProposalTemplateInstall";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import {
  TEMPLATES_CARD,
  TEMPLATES_ERROR_BANNER,
  TEMPLATES_MESSAGE_BANNER,
  TEMPLATES_METRIC_TILE,
  catalogReadinessStatusPillClass,
} from "./templatesConstants";
import TemplatesCatalogGate from "./TemplatesCatalogGate";
import TemplatesInstallResult from "./TemplatesInstallResult";
import TemplatesInstalledSummary from "./TemplatesInstalledSummary";
import TemplatesSetupSpine from "./TemplatesSetupSpine";
import { deriveInstallFeedback, findStarterProposalTemplate } from "./templatesSetupUtils";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function TemplatesSetupClient({ companyId }: { companyId: string }) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
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

  const readiness = useMemo(
    () => deriveCatalogReadiness(activeItems, CATALOG_STARTER_DEFINITION_COUNT),
    [activeItems]
  );

  const catalogReady = readiness.state === "ready_for_templates";
  const catalogStatusLabel = formatCatalogReadinessLabel(readiness);
  const unpricedCount = useMemo(() => countUnpricedCatalogItems(activeItems), [activeItems]);
  const starterInstalled = starterGraph != null;
  const loading = catalogLoading || templatesLoading;
  const loadError = catalogError ?? templatesError;

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

  const statusPillClass = catalogReadinessStatusPillClass(readiness.state);

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Proposal templates</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          Company-wide reusable proposal packages. Template line items come from your catalog.
          Install and configure templates here before using Proposal Builder on individual jobs.
        </p>
      </header>

      {loadError ? (
        <p className={TEMPLATES_ERROR_BANNER} role="alert">
          {loadError}
        </p>
      ) : null}

      {installMessage ? (
        <p className={TEMPLATES_MESSAGE_BANNER} role="status">
          {installMessage}
        </p>
      ) : null}

      {installError ? (
        <p className={TEMPLATES_ERROR_BANNER} role="alert">
          {installError}
        </p>
      ) : null}

      <section className={TEMPLATES_CARD} aria-labelledby="templates-readiness-strip-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="templates-readiness-strip-heading" className="text-sm font-semibold text-slate-900">
              Setup readiness
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Live catalog checks for template install. Threshold: {MIN_MEASUREMENT_MAPPED_FOR_READY}{" "}
              measurement-mapped items.
            </p>
          </div>
          {!loading && !catalogError && <span className={statusPillClass}>{catalogStatusLabel}</span>}
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading readiness…</p>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Active items
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.activeItemCount}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Measurement-mapped
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.measurementMappedItemCount}
                <span className="text-xs font-normal text-slate-500">
                  {" "}
                  / {MIN_MEASUREMENT_MAPPED_FOR_READY}
                </span>
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Priced items
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.pricedItemCount}
                {unpricedCount > 0 && (
                  <span className="text-xs font-normal text-amber-700">
                    {" "}
                    · {unpricedCount} unpriced
                  </span>
                )}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Starter template
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {templatesLoading || installing ? "…" : starterInstalled ? "Installed" : "Not installed"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <TemplatesCatalogGate
        loading={catalogLoading}
        error={catalogError}
        readiness={readiness}
        unpricedCount={unpricedCount}
        catalogReady={catalogReady}
      />

      <TemplatesSetupSpine
        loading={loading}
        catalogReady={catalogReady}
        installing={installing}
        readiness={readiness}
        starterInstalled={starterInstalled}
        catalogStatusLabel={catalogStatusLabel}
        installButtonLabel={installButtonLabel}
        installDisabled={installDisabled}
        installDisabledTitle={installDisabledTitle}
        onInstallStarter={handleInstallStarter}
      />

      {installResult ? <TemplatesInstallResult result={installResult} /> : null}

      <TemplatesInstalledSummary
        loading={templatesLoading || installing}
        graph={starterGraph}
        catalogReady={catalogReady}
      />

      <section className={TEMPLATES_CARD} aria-labelledby="templates-scope-heading">
        <h2 id="templates-scope-heading" className="text-base font-semibold text-slate-900">
          On this page
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>Live catalog gate and readiness metrics</li>
          <li>Starter template install and recheck (insert-only, idempotent)</li>
          <li>Read-only summary of installed starter template</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-slate-700">Coming in later passes:</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-slate-500">
          <li>Template readiness before Proposal Builder</li>
          <li>Proposal Builder or creating proposals from jobs</li>
          <li>Template editing, pricing bridge, PDF, send, or approval workflows</li>
        </ul>
      </section>
    </div>
  );
}
