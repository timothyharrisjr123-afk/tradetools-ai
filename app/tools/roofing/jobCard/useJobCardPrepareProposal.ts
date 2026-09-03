"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseDollarsToCentsOrNull } from "@/app/admin/catalog/catalogAdminUtils";
import {
  getActiveCatalogItemsByCompany,
  updateCatalogItem,
} from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { getPreferredSetupTemplateId } from "@/app/lib/companyTemplatePreferenceStore";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import { installDefaultRoofingCatalog } from "@/app/lib/defaultRoofingCatalogInstall";
import { installDefaultRoofingProposalTemplates } from "@/app/lib/defaultRoofingProposalTemplateInstall";
import {
  getResolvedCompanyPricingPolicy,
  upsertCompanyPricingPolicy,
} from "@/app/lib/companyPricingPolicyStore";
import {
  FIRST_PROPOSAL_PREPARING,
  FIRST_PROPOSAL_PRICE_SAVE_FAILED,
  FIRST_PROPOSAL_RULES_SAVE_FAILED,
  FIRST_PROPOSAL_STRUCTURE_FAILED,
  buildFirstProposalPricingPolicyFromDraft,
  collectLinkedCatalogPricingLines,
  emptyFirstProposalPricingRulesDraft,
  firstProposalPricingComplete,
  resolveFirstProposalStructureNeed,
  resolveShowFirstProposalPricing,
  type FirstProposalPricingLine,
  type FirstProposalPricingRulesDraft,
} from "@/app/lib/firstProposalPrepare";
import {
  buildManualMeasurementDraftFromFields,
  type JobCardManualMeasurementFields,
} from "@/app/lib/jobCardManualMeasurementDraft";
import {
  formatMeasurementDisplayName,
  resolveCanonicalJobMeasurement,
} from "@/app/lib/jobCardMeasurementPresentation";
import {
  canMakeMeasurementCurrent,
  resolveManualMeasurementEditMode,
  resolveManualMeasurementSaveMode,
} from "@/app/lib/jobCardMeasurementReportModel";
import { updateJob } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";
import { deriveEstimateReadiness, formatSourceTypeLabel, hasRoofSize } from "@/app/lib/measurementReadiness";
import {
  buildMeasurementProposalHandoff,
  deriveQuantityMapFromRecord,
} from "@/app/lib/measurementProposalHandoff";
import {
  createMeasurementRecord,
  getMeasurementsForJob,
  selectMeasurementRecord,
  updateMeasurementRecord,
} from "@/app/lib/measurementStore";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  createNewProposalDraftEntry,
  isExpectedProposalDraftEntryFailure,
} from "@/app/lib/proposalDraftEntry";
import { createDraftProposal } from "@/app/lib/proposalRecordStore";
import type { ProductSpineRouteHints } from "@/app/lib/productSpine";
import {
  getProposalTemplateGraph,
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import { isUuidLike } from "@/app/lib/uuid";
import {
  buildCreateProposalMeasurementChoice,
  resolvePrepareProposalMeasurement,
  type CreateProposalMeasurementChoice,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import type { JobCardCreateProposalModalTemplateChoice } from "@/app/tools/roofing/jobCard/JobCardCreateProposalModal";
import {
  buildJobCardPackageSetup,
  deriveJobCardSelectedTemplateEligibility,
  filterJobCardCreateProposalTemplates,
  resolveDefaultJobCardTemplateId,
  resolveDefaultPackageOptionId,
} from "@/app/tools/roofing/jobCard/jobCardProposalSetup";
import { findStarterProposalTemplate } from "@/app/tools/roofing/templates/templatesSetupUtils";

type CaptureOrigin = "tab" | "prepare" | null;
type CaptureKind = "add" | "edit" | null;

type UseJobCardPrepareProposalInput = {
  companyId?: string | null;
  jobId: string | null;
  customerId?: string | null;
  selectedMeasurementId?: string | null;
  routeHints?: ProductSpineRouteHints | null;
  prepareRequested?: boolean;
  onJobUpdated?: (job: JobRecord) => void;
  onPrepareConsumed?: () => void;
  onCreatedProposal?: (proposalId: string) => void;
};

export function useJobCardPrepareProposal({
  companyId,
  jobId,
  customerId,
  selectedMeasurementId = null,
  routeHints = null,
  prepareRequested = false,
  onJobUpdated,
  onPrepareConsumed,
  onCreatedProposal,
}: UseJobCardPrepareProposalInput) {
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [selected, setSelected] = useState<MeasurementRecord | null>(null);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [templateGraph, setTemplateGraph] = useState<ProposalTemplateGraph | null>(
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(
    null
  );
  const [selectedPackageOptionId, setSelectedPackageOptionId] = useState<
    string | null
  >(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureOrigin, setCaptureOrigin] = useState<CaptureOrigin>(null);
  const [captureKind, setCaptureKind] = useState<CaptureKind>(null);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectBusy, setSelectBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [preparingStructure, setPreparingStructure] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, string>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSaveError, setPricingSaveError] = useState<string | null>(null);
  const [pricingPolicyConfigured, setPricingPolicyConfigured] = useState<
    boolean | null
  >(null);
  const [pricingRulesDraft, setPricingRulesDraft] =
    useState<FirstProposalPricingRulesDraft>(() => emptyFirstProposalPricingRulesDraft());
  const [pricingRulesSaving, setPricingRulesSaving] = useState(false);
  const [pricingRulesSaveError, setPricingRulesSaveError] = useState<string | null>(
    null
  );
  const createInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const bootstrapInFlightRef = useRef(false);
  const priceSaveInFlightRef = useRef(false);
  const pricingRulesSaveInFlightRef = useRef(false);
  const pricingPolicyLoadInFlightRef = useRef(false);

  const cid = (companyId ?? "").trim();
  const jid = (jobId ?? "").trim();

  const reloadMeasurements = useCallback(async () => {
    if (!jid || !isUuidLike(jid)) {
      setRecords([]);
      setSelected(null);
      return;
    }
    setLoadingMeasurements(true);
    try {
      const rows = await getMeasurementsForJob(jid);
      setRecords(rows);
      setSelected(
        resolveCanonicalJobMeasurement({
          records: rows,
          selectedMeasurementId,
        })
      );
    } catch {
      setRecords([]);
      setSelected(null);
    } finally {
      setLoadingMeasurements(false);
    }
  }, [jid, selectedMeasurementId]);

  useEffect(() => {
    void reloadMeasurements();
  }, [reloadMeasurements]);

  const applyCreateDependencies = useCallback(
    (templateRows: ProposalTemplate[], items: CatalogItem[], preferred: string | null) => {
      setTemplates(templateRows);
      setCatalogItems(items);
      setPreferredTemplateId(preferred);
      const visible = filterContractorVisibleTemplates(templateRows);
      const starter = findStarterProposalTemplate(templateRows);
      const defaultId = resolveDefaultJobCardTemplateId(
        visible,
        starter?.id ?? null,
        preferred
      );
      setSelectedTemplateId((prev) => {
        if (
          prev &&
          visible.some(
            (row) =>
              row.id === prev && row.status !== "archived" && row.active !== false
          )
        ) {
          return prev;
        }
        return defaultId;
      });
    },
    []
  );

  const ensureFirstProposalStructure = useCallback(async () => {
    if (!cid || !isUuidLike(cid) || bootstrapInFlightRef.current) return;
    bootstrapInFlightRef.current = true;
    setStructureError(null);
    setPreparingStructure(true);
    try {
      const [templateRows, items, preferred] = await Promise.all([
        getProposalTemplatesByCompany(cid),
        getActiveCatalogItemsByCompany(cid),
        getPreferredSetupTemplateId(cid),
      ]);
      const starter = findStarterProposalTemplate(templateRows);
      const need = resolveFirstProposalStructureNeed({
        activeCatalogItems: items,
        templates: templateRows,
        preferredTemplateId: preferred,
        starterTemplateId: starter?.id ?? null,
      });

      if (!need.mayBootstrapStarterStructure) {
        applyCreateDependencies(templateRows, items, preferred);
        return;
      }

      if (need.needsCatalogStructure) {
        const catalogResult = await installDefaultRoofingCatalog(cid);
        if (!catalogResult || (catalogResult.failedCount > 0 && catalogResult.createdCount === 0)) {
          setStructureError(FIRST_PROPOSAL_STRUCTURE_FAILED);
          applyCreateDependencies(templateRows, items, preferred);
          return;
        }
      }

      const catalogAfter = need.needsCatalogStructure
        ? await getActiveCatalogItemsByCompany(cid)
        : items;

      if (need.needsTemplateStructure || need.needsCatalogStructure) {
        const templateResult = await installDefaultRoofingProposalTemplates(cid);
        if (
          !templateResult ||
          (templateResult.failedCount > 0 &&
            !templateResult.templateId &&
            templateResult.createdTemplateCount === 0 &&
            templateResult.skippedTemplateCount === 0)
        ) {
          setStructureError(FIRST_PROPOSAL_STRUCTURE_FAILED);
          applyCreateDependencies(
            await getProposalTemplatesByCompany(cid),
            catalogAfter,
            preferred
          );
          return;
        }
      }

      const [nextTemplates, nextItems] = await Promise.all([
        getProposalTemplatesByCompany(cid),
        getActiveCatalogItemsByCompany(cid),
      ]);
      applyCreateDependencies(nextTemplates, nextItems, preferred);
    } catch {
      setStructureError(FIRST_PROPOSAL_STRUCTURE_FAILED);
    } finally {
      bootstrapInFlightRef.current = false;
      setPreparingStructure(false);
    }
  }, [cid, applyCreateDependencies]);

  const loadCompanyPricingPolicy = useCallback(async () => {
    if (!cid || !isUuidLike(cid) || pricingPolicyLoadInFlightRef.current) return;
    pricingPolicyLoadInFlightRef.current = true;
    setPricingRulesSaveError(null);
    try {
      const resolution = await getResolvedCompanyPricingPolicy(cid);
      const configured = resolution.configured === true;
      setPricingPolicyConfigured(configured);
      if (!configured) {
        setPricingRulesDraft(emptyFirstProposalPricingRulesDraft());
      }
    } catch {
      setPricingPolicyConfigured(false);
      setPricingRulesDraft(emptyFirstProposalPricingRulesDraft());
    } finally {
      pricingPolicyLoadInFlightRef.current = false;
    }
  }, [cid]);

  useEffect(() => {
    if (!selectedTemplateId || !cid || !isUuidLike(cid)) {
      setTemplateGraph(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const graph = await getProposalTemplateGraph(selectedTemplateId, {
          companyId: cid,
        });
        if (cancelled) return;
        setTemplateGraph(graph);
        setSelectedPackageOptionId(resolveDefaultPackageOptionId(graph));
      } catch {
        if (!cancelled) {
          setTemplateGraph(null);
          setSelectedPackageOptionId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, selectedTemplateId]);

  const openModal = useCallback(() => {
    setCreateError(null);
    setStructureError(null);
    setPricingSaveError(null);
    setPricingRulesSaveError(null);
    setPricingPolicyConfigured(null);
    setModalOpen(true);
    void ensureFirstProposalStructure();
    void loadCompanyPricingPolicy();
    void reloadMeasurements();
  }, [ensureFirstProposalStructure, loadCompanyPricingPolicy, reloadMeasurements]);

  const closeModal = useCallback(() => {
    if (createInFlightRef.current || creating) return;
    setModalOpen(false);
    setCreateError(null);
  }, [creating]);

  useEffect(() => {
    if (!prepareRequested) return;
    openModal();
    onPrepareConsumed?.();
  }, [prepareRequested, openModal, onPrepareConsumed]);

  const openCapture = useCallback(
    (origin: Exclude<CaptureOrigin, null>, kind: Exclude<CaptureKind, null> = "add") => {
      const current = selected;
      if (kind === "edit") {
        const mode = resolveManualMeasurementEditMode(current);
        if (mode === "none") return;
        setEditingMeasurementId(mode === "inplace" ? current?.id ?? null : null);
      } else {
        setEditingMeasurementId(null);
      }
      setCaptureKind(kind);
      setCaptureOrigin(origin);
      setSaveError(null);
      setCaptureOpen(true);
    },
    [selected]
  );

  const closeCapture = useCallback(() => {
    if (saving) return;
    setCaptureOpen(false);
    setCaptureOrigin(null);
    setCaptureKind(null);
    setEditingMeasurementId(null);
    setSaveError(null);
  }, [saving]);

  const persistSelected = useCallback(
    async (record: MeasurementRecord) => {
      if (!jid || !isUuidLike(jid)) return record;
      const selectedRecord = await selectMeasurementRecord(record.id, { jobId: jid });
      const next = selectedRecord ?? record;
      const linked = await updateJob(jid, { selected_measurement_id: next.id });
      if (linked) onJobUpdated?.(linked);
      setSelected(next);
      return next;
    },
    [jid, onJobUpdated]
  );

  const saveMeasurement = useCallback(
    async (fields: JobCardManualMeasurementFields) => {
      if (!cid || !jid || !isUuidLike(jid) || saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const draft = buildManualMeasurementDraftFromFields({
          companyId: cid,
          jobId: jid,
          fields,
        });
        let record: MeasurementRecord | null = null;
        const saveMode = resolveManualMeasurementSaveMode({
          editingMeasurementId,
          current: selected,
        });
        if (saveMode === "update-incomplete" && editingMeasurementId) {
          const { is_selected: _ignored, ...patch } = draft;
          record = await updateMeasurementRecord(editingMeasurementId, patch);
        } else {
          record = await createMeasurementRecord(draft);
        }
        if (!record?.id) {
          throw new Error("Could not save measurement.");
        }
        const next = await persistSelected(record);
        await reloadMeasurements();
        setSelected(next);
        setCaptureOpen(false);
        setEditingMeasurementId(null);
        setCaptureOrigin(null);
        setCaptureKind(null);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Could not save measurement. Try again."
        );
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [cid, jid, editingMeasurementId, selected, persistSelected, reloadMeasurements]
  );

  const selectMeasurement = useCallback(
    async (measurementId: string) => {
      const next = records.find((row) => row.id === measurementId);
      if (!next || selectBusy) return;
      if (!canMakeMeasurementCurrent(next, selected?.id ?? null)) return;
      setSelectBusy(true);
      try {
        await persistSelected(next);
        setRecords((prev) =>
          prev.map((row) => ({ ...row, is_selected: row.id === next.id }))
        );
      } finally {
        setSelectBusy(false);
      }
    },
    [persistSelected, records, selectBusy, selected?.id]
  );

  const eligibleChoices: CreateProposalMeasurementChoice[] = useMemo(
    () =>
      records
        .filter(
          (row) =>
            row.status !== "stale" &&
            row.status !== "rejected" &&
            deriveEstimateReadiness(row).ready
        )
        .map((row) =>
          buildCreateProposalMeasurementChoice({
            id: row.id,
            selectedLabel:
              row.source_type === "manual"
                ? "Saved manual"
                : formatSourceTypeLabel(row.source_type) ||
                  formatMeasurementDisplayName(row),
            roofAreaSqft: row.roof_area_sqft,
            wastePercent: row.waste_percent,
            ready: true,
          })
        ),
    [records]
  );

  useEffect(() => {
    if (!modalOpen) return;
    const prepared = resolvePrepareProposalMeasurement({
      eligible: eligibleChoices,
      selectedId: selected?.id ?? null,
    });
    if (prepared.preparedId && prepared.preparedId !== selected?.id) {
      const next = records.find((row) => row.id === prepared.preparedId);
      if (next) setSelected(next);
    }
  }, [modalOpen, eligibleChoices, records, selected?.id]);

  const packageSetup = useMemo(
    () =>
      buildJobCardPackageSetup(
        templateGraph,
        catalogItems,
        selectedPackageOptionId
      ),
    [templateGraph, catalogItems, selectedPackageOptionId]
  );

  const templateEligibility = useMemo(
    () =>
      deriveJobCardSelectedTemplateEligibility({
        selectedTemplateId,
        graph: templateGraph,
        catalogItems,
        selectedOptionId: selectedPackageOptionId,
      }),
    [selectedTemplateId, templateGraph, catalogItems, selectedPackageOptionId]
  );

  const modalTemplates: JobCardCreateProposalModalTemplateChoice[] = useMemo(() => {
    return filterJobCardCreateProposalTemplates(templates, selectedTemplateId).map(
      (row) => {
        const selectedRow = row.id === selectedTemplateId;
        const graphMatched =
          selectedRow && templateEligibility.graphMatchesSelection;
        const packageCount = graphMatched ? packageSetup.choices.length : 0;
        const linkedItemCount = graphMatched
          ? packageSetup.selected?.linkedItemCount ?? 0
          : 0;
        const availableUpgradeCount = graphMatched
          ? packageSetup.createsSummary?.availableUpgradeCount ??
            packageSetup.availableUpgradeCount
          : 0;
        const packageMode = graphMatched
          ? packageSetup.packagePresentationMode
          : packageCount > 1
            ? "multi"
            : packageCount === 1
              ? "single"
              : "simple";
        return {
          id: row.id,
          name: (row.name ?? "").trim() || "Template",
          ready: selectedRow ? templateEligibility.usable : row.active !== false,
          linkedItemCount,
          packageCount,
          availableUpgradeCount,
          packageMode,
          archived: row.status === "archived",
        };
      }
    );
  }, [
    templates,
    selectedTemplateId,
    templateEligibility,
    packageSetup,
  ]);

  const proposalHandoff = selected
    ? buildMeasurementProposalHandoff({
        record: selected,
        persistedRecord: selected,
        hasUnsavedChanges: false,
        workspace: {
          recordLabel: formatMeasurementDisplayName(selected),
          headerStatus: "",
          sourceLabel: formatSourceTypeLabel(selected.source_type),
          isPersistedManual: selected.source_type === "manual",
          isPersistedNonManual: selected.source_type !== "manual",
          isLocalDraft: false,
          hasUnsavedChanges: false,
          hasLocalRoofSize: hasRoofSize(selected),
        },
      })
    : null;

  const starterTemplateId = findStarterProposalTemplate(templates)?.id ?? null;

  const pricingLines: FirstProposalPricingLine[] = useMemo(
    () => collectLinkedCatalogPricingLines(templateGraph, catalogItems),
    [templateGraph, catalogItems]
  );

  const showFirstProposalPricing = useMemo(
    () =>
      resolveShowFirstProposalPricing({
        preferredTemplateId,
        starterTemplateId,
        selectedTemplateId,
        pricingLines,
      }),
    [preferredTemplateId, starterTemplateId, selectedTemplateId, pricingLines]
  );

  const showFirstProposalPricingRules = pricingPolicyConfigured === false;

  const pricingRulesComplete = pricingPolicyConfigured === true;

  const pricingComplete = useMemo(
    () =>
      !showFirstProposalPricing || firstProposalPricingComplete(pricingLines),
    [showFirstProposalPricing, pricingLines]
  );

  const setPricingDraft = useCallback((catalogItemId: string, value: string) => {
    setPricingDrafts((prev) => ({ ...prev, [catalogItemId]: value }));
    setPricingSaveError(null);
  }, []);

  const patchPricingRulesDraft = useCallback(
    (patch: Partial<FirstProposalPricingRulesDraft>) => {
      setPricingRulesDraft((prev) => ({ ...prev, ...patch }));
      setPricingRulesSaveError(null);
    },
    []
  );

  const saveFirstProposalPricingRules = useCallback(async () => {
    if (
      !cid ||
      !isUuidLike(cid) ||
      pricingRulesSaveInFlightRef.current ||
      pricingPolicyConfigured === true
    ) {
      return;
    }
    pricingRulesSaveInFlightRef.current = true;
    setPricingRulesSaving(true);
    setPricingRulesSaveError(null);
    try {
      const built = buildFirstProposalPricingPolicyFromDraft(pricingRulesDraft);
      if (!built.ok) {
        setPricingRulesSaveError(built.reason);
        return;
      }
      const saved = await upsertCompanyPricingPolicy(cid, built.policy);
      if (!saved) {
        setPricingRulesSaveError(FIRST_PROPOSAL_RULES_SAVE_FAILED);
        return;
      }
      const resolution = await getResolvedCompanyPricingPolicy(cid);
      if (resolution.configured !== true) {
        setPricingRulesSaveError(FIRST_PROPOSAL_RULES_SAVE_FAILED);
        setPricingPolicyConfigured(false);
        return;
      }
      setPricingPolicyConfigured(true);
    } catch {
      setPricingRulesSaveError(FIRST_PROPOSAL_RULES_SAVE_FAILED);
    } finally {
      pricingRulesSaveInFlightRef.current = false;
      setPricingRulesSaving(false);
    }
  }, [cid, pricingRulesDraft, pricingPolicyConfigured]);

  const saveFirstProposalPrices = useCallback(async () => {
    if (!cid || !isUuidLike(cid) || priceSaveInFlightRef.current) return;
    priceSaveInFlightRef.current = true;
    setPricingSaving(true);
    setPricingSaveError(null);
    try {
      const lines = collectLinkedCatalogPricingLines(templateGraph, catalogItems);
      for (const line of lines) {
        const raw =
          pricingDrafts[line.catalogItemId] !== undefined
            ? pricingDrafts[line.catalogItemId]
            : line.unitPriceCents != null
              ? String(line.unitPriceCents / 100)
              : "";
        if (!line.needsPrice && pricingDrafts[line.catalogItemId] === undefined) {
          continue;
        }
        const parsed = parseDollarsToCentsOrNull(raw, "Price");
        if (parsed.error) {
          setPricingSaveError(parsed.error);
          return;
        }
        if (parsed.cents == null) {
          if (line.needsPrice) {
            setPricingSaveError(FIRST_PROPOSAL_PRICE_SAVE_FAILED);
            return;
          }
          continue;
        }
        const updated = await updateCatalogItem(
          line.catalogItemId,
          { unit_price_cents: parsed.cents },
          { companyId: cid }
        );
        if (!updated) {
          setPricingSaveError(FIRST_PROPOSAL_PRICE_SAVE_FAILED);
          return;
        }
      }
      const nextItems = await getActiveCatalogItemsByCompany(cid);
      setCatalogItems(nextItems);
      setPricingDrafts({});
    } catch {
      setPricingSaveError(FIRST_PROPOSAL_PRICE_SAVE_FAILED);
    } finally {
      priceSaveInFlightRef.current = false;
      setPricingSaving(false);
    }
  }, [cid, templateGraph, catalogItems, pricingDrafts]);

  const createPayload =
    selected &&
    proposalHandoff?.proposalReady &&
    templateEligibility.usable &&
    templateGraph?.template.id &&
    templateGraph.template.id === selectedTemplateId &&
    isUuidLike(customerId ?? "") &&
    isUuidLike(selected.id)
      ? {
          customer_id: customerId!,
          template_id: templateGraph.template.id,
          measurement_record_id: selected.id,
          quantity_context: {
            measurementHandoff: proposalHandoff,
            quantityMap: deriveQuantityMapFromRecord(selected),
          },
          selected_template_option_id: packageSetup.selectedOptionId,
          title: templateGraph.template.name ?? null,
        }
      : null;

  const createEnabled =
    createPayload != null &&
    pricingRulesComplete &&
    pricingComplete &&
    !preparingStructure &&
    !structureError &&
    (packageSetup.choices.length === 0 ||
      (packageSetup.selected != null && (packageSetup.selected.issueCount ?? 0) === 0));

  const createProposal = useCallback(() => {
    if (createInFlightRef.current || !createEnabled || !jid || !cid) return;
    if (!pricingRulesComplete) return;
    if (showFirstProposalPricing && !pricingComplete) return;
    createInFlightRef.current = true;
    setCreating(true);
    setCreateError(null);
    void (async () => {
      try {
        const result = await createNewProposalDraftEntry(
          {
            companyId: cid,
            jobId: jid,
            createPayload,
            routeHints,
          },
          { createDraftProposal }
        );
        if (result.proposalId && result.created) {
          setModalOpen(false);
          onCreatedProposal?.(result.proposalId);
          return;
        }
        if (result.errorMessage) {
          setCreateError(result.errorMessage);
          if (!isExpectedProposalDraftEntryFailure(result.reason)) {
            console.error(
              "[JobCardClient] create proposal failed:",
              result.reason,
              result.errorMessage
            );
          }
        }
      } finally {
        createInFlightRef.current = false;
        setCreating(false);
      }
    })();
  }, [
    createEnabled,
    createPayload,
    cid,
    jid,
    routeHints,
    onCreatedProposal,
    showFirstProposalPricing,
    pricingComplete,
    pricingRulesComplete,
  ]);

  const captureInitial: Partial<JobCardManualMeasurementFields> | null =
    captureOpen && captureKind === "edit" && selected
      ? {
          roof_area_sqft: selected.roof_area_sqft ?? 0,
          waste_percent: selected.waste_percent ?? 10,
          pitch_label: selected.pitch_label ?? "",
          stories: selected.stories ?? "",
        }
      : null;

  const captureTitle =
    captureKind === "edit" ? "Edit measurement" : "Add measurement";

  return {
    records,
    selected,
    selectedId: selected?.id ?? null,
    loadingMeasurements,
    reloadMeasurements,
    modalOpen,
    openModal,
    closeModal,
    eligibleChoices,
    modalTemplates,
    selectedTemplateId,
    setSelectedTemplateId: (templateId: string) => {
      setSelectedTemplateId(templateId);
      setSelectedPackageOptionId(null);
    },
    preferredTemplateId,
    starterTemplateId,
    templateEligibility,
    packageSetup,
    selectedPackageOptionId: packageSetup.selectedOptionId,
    setSelectedPackageOptionId,
    proposalHandoff,
    createEnabled,
    creating,
    createError,
    createProposal,
    preparingStructure,
    structureError,
    preparingStructureLabel: FIRST_PROPOSAL_PREPARING,
    showFirstProposalPricingRules,
    firstProposalPricingRulesDraft: pricingRulesDraft,
    patchFirstProposalPricingRulesDraft: patchPricingRulesDraft,
    saveFirstProposalPricingRules,
    firstProposalPricingRulesSaving: pricingRulesSaving,
    firstProposalPricingRulesSaveError: pricingRulesSaveError,
    firstProposalPricingRulesComplete: pricingRulesComplete,
    showFirstProposalPricing,
    firstProposalPricingLines: pricingLines,
    firstProposalPricingDrafts: pricingDrafts,
    setFirstProposalPricingDraft: setPricingDraft,
    saveFirstProposalPrices,
    firstProposalPricingSaving: pricingSaving,
    firstProposalPricingSaveError: pricingSaveError,
    firstProposalPricingComplete: pricingComplete,
    captureOpen,
    captureOrigin,
    captureKind,
    captureInitial,
    captureTitle,
    openCapture,
    closeCapture,
    saveMeasurement,
    saving,
    saveError,
    selectMeasurement,
    selectBusy,
  };
}
