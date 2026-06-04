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
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD, TEMPLATES_METRIC_TILE, catalogReadinessStatusPillClass } from "./templatesConstants";
import TemplatesCatalogGate from "./TemplatesCatalogGate";
import TemplatesInstalledSummary from "./TemplatesInstalledSummary";
import TemplatesSetupSpine from "./TemplatesSetupSpine";
import { findStarterProposalTemplate } from "./templatesSetupUtils";

const CATALOG_STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

export default function TemplatesSetupClient({ companyId }: { companyId: string }) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [starterGraph, setStarterGraph] = useState<ProposalTemplateGraph | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

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
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {loadError}
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
                {templatesLoading ? "…" : starterInstalled ? "Installed" : "Not installed"}
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
        readiness={readiness}
        starterInstalled={starterInstalled}
        catalogStatusLabel={catalogStatusLabel}
      />

      <TemplatesInstalledSummary
        loading={templatesLoading}
        graph={starterGraph}
        catalogReady={catalogReady}
      />

      <section className={TEMPLATES_CARD} aria-labelledby="templates-scope-heading">
        <h2 id="templates-scope-heading" className="text-base font-semibold text-slate-900">
          On this page
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>Live catalog gate and readiness metrics</li>
          <li>Read-only summary of installed starter template</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-slate-700">Coming in later passes:</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-slate-500">
          <li>Starter template install and recheck (insert-only)</li>
          <li>Template readiness before Proposal Builder</li>
          <li>Proposal Builder or creating proposals from jobs</li>
          <li>Template editing, pricing bridge, PDF, send, or approval workflows</li>
        </ul>
      </section>
    </div>
  );
}
