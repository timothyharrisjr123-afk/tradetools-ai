"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { getPreferredSetupTemplateId } from "@/app/lib/companyTemplatePreferenceStore";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import {
  buildManualMeasurementDraftFromFields,
  type JobCardManualMeasurementFields,
} from "@/app/lib/jobCardManualMeasurementDraft";
import {
  formatMeasurementDisplayName,
  resolveCanonicalJobMeasurement,
} from "@/app/lib/jobCardMeasurementPresentation";
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
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectBusy, setSelectBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);

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

  const loadCreateDependencies = useCallback(async () => {
    if (!cid || !isUuidLike(cid)) return;
    const [templateRows, items, preferred] = await Promise.all([
      getProposalTemplatesByCompany(cid),
      getActiveCatalogItemsByCompany(cid),
      getPreferredSetupTemplateId(cid),
    ]);
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
          (row) => row.id === prev && row.status !== "archived" && row.active !== false
        )
      ) {
        return prev;
      }
      return defaultId;
    });
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
    setModalOpen(true);
    void loadCreateDependencies();
    void reloadMeasurements();
  }, [loadCreateDependencies, reloadMeasurements]);

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
    (origin: Exclude<CaptureOrigin, null>) => {
      const current = selected;
      const editExisting =
        current != null &&
        current.source_type === "manual" &&
        !deriveEstimateReadiness(current).ready;
      setCaptureOrigin(origin);
      setEditingMeasurementId(editExisting ? current.id : null);
      setSaveError(null);
      setCaptureOpen(true);
    },
    [selected]
  );

  const closeCapture = useCallback(() => {
    if (saving) return;
    setCaptureOpen(false);
    setCaptureOrigin(null);
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
        if (editingMeasurementId) {
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
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Could not save measurement. Try again."
        );
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [cid, jid, editingMeasurementId, persistSelected, reloadMeasurements]
  );

  const selectMeasurement = useCallback(
    async (measurementId: string) => {
      const next = records.find((row) => row.id === measurementId);
      if (!next || selectBusy) return;
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
    [persistSelected, records, selectBusy]
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
    (packageSetup.choices.length === 0 ||
      (packageSetup.selected != null && (packageSetup.selected.issueCount ?? 0) === 0));

  const createProposal = useCallback(() => {
    if (createInFlightRef.current || !createEnabled || !jid || !cid) return;
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
  ]);

  const captureInitial: Partial<JobCardManualMeasurementFields> | null =
    editingMeasurementId && selected?.id === editingMeasurementId
      ? {
          roof_area_sqft: selected.roof_area_sqft ?? 0,
          waste_percent: selected.waste_percent ?? 10,
          pitch_label: selected.pitch_label ?? "",
          stories: selected.stories ?? "",
        }
      : null;

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
    starterTemplateId: findStarterProposalTemplate(templates)?.id ?? null,
    templateEligibility,
    packageSetup,
    selectedPackageOptionId: packageSetup.selectedOptionId,
    setSelectedPackageOptionId,
    proposalHandoff,
    createEnabled,
    creating,
    createError,
    createProposal,
    captureOpen,
    captureOrigin,
    captureInitial,
    openCapture,
    closeCapture,
    saveMeasurement,
    saving,
    saveError,
    selectMeasurement,
    selectBusy,
  };
}
