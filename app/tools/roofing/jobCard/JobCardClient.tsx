"use client";

import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import { LAST_DB_JOB_ID_STORAGE_KEY } from "@/app/lib/jobBoardAdapter";
import { findApproveJobAcceptanceItem } from "@/app/lib/boardGuardedMovement";
import { filterJobCardWorkspaceAttentionItems } from "@/app/lib/jobCardWorkspaceAttention";
import {
  JOB_CARD_AWAITING_CONTRACTOR_APPROVAL,
  resolveJobCardOverviewForwardAction,
} from "@/app/lib/jobCardForwardLifecycleAction";
import { formatMeasurementQuantityLine } from "@/app/lib/jobCardMeasurementPresentation";
import {
  pickMeasurementProposalRefs,
  resolveMeasurementProposalBinding,
} from "@/app/lib/jobCardMeasurementReportModel";
import { productSpineRouteHintsFromSearchParams } from "@/app/lib/productSpine";
import {
  resolveCanonicalJobStage,
  resolveCanonicalJobStageLabel,
} from "@/app/lib/jobLifecycleMapper";
import { resolveCanonicalJobActionEligibilityFromFacts } from "@/app/lib/jobLifecycleActionEligibility";
import {
  applyKnownDispositionToJobRecord,
  dispositionBlockedWorkCopy,
  visibleDispositionLabel,
} from "@/app/lib/jobDispositionManagement";
import { isUuidLike } from "@/app/lib/uuid";
import { resolveTrustedJobCardSeed } from "@/app/lib/jobCardServerSeed";
import { useJobCardCanonicalRead } from "@/app/tools/roofing/jobCard/useJobCardCanonicalRead";
import {
  parseJobCardSchedulesApiPayload,
  shouldRetryJobCardScheduleFetch,
} from "@/app/lib/jobCardScheduleHydrate";
import {
  createIdleJobCardScheduleSettlement,
  preserveOrBeginJobCardScheduleSettlement,
  settleJobCardScheduleError,
  settleJobCardScheduleSuccess,
  shouldEnableJobCardSecondaryEffects,
  type JobCardScheduleSettlement,
} from "@/app/lib/jobCardPerfBoundary";
import { resolveJobCardScheduleDisplay } from "@/app/lib/jobCardScheduleDisplay";
import {
  applyListedProposalFetchResult,
  type ListedProposalReadStatus,
} from "@/app/lib/jobCardListedProposalState";
import { useJobAttentionDetail } from "@/app/lib/useJobAttention";
import { notifyJobAttentionChanged } from "@/app/lib/jobAttentionReadClient";
import {
  buildJobCardProposalAttentionHref,
  type JobAttentionSafeItem,
} from "@/app/lib/jobAttentionReadModel";
import { useJobPayments } from "@/app/lib/useJobPayments";
import {
  companyTimezoneForScheduling,
  parseCompanyTimezoneGetResult,
  parseJobScheduleRow,
  resolveCompanyTimezoneReadState,
  upsertJobScheduleRow,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import type { JobRecord } from "@/app/lib/jobTypes";
import {
  composeProposalAcceptanceActivityItems,
  listJobProposalAcceptances,
  type ProposalAcceptanceActivityItem,
} from "@/app/lib/proposalAcceptanceActivity";
import {
  composeProposalSignatureActivityItems,
  listJobProposalSignatures,
  type ProposalSignatureActivityItem,
} from "@/app/lib/proposalSignatureActivity";
import {
  getProposalOptionLabel,
  listProposalsForJob,
} from "@/app/lib/proposalRecordStore";
import { loadJobCardProposalSentFacts } from "@/app/lib/proposalJobCardLifecycleRead";
import type { JobCardProposalSentFactsById } from "@/app/lib/proposalJobCardLifecycleRead";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import {
  filterContractorVisibleProposals,
  pickContractorVisibleJobDraft,
} from "@/app/lib/contractorFixtureIsolation";
import {
  buildProposalBuilderHref,
  buildProposalPreviewHref,
  buildProposalPreviewSentHref,
} from "@/app/lib/proposalBuilderReadiness";
import { updateProposalCustomerRequestStatus } from "@/app/lib/proposalCustomerRequestReviewClient";
import { formatJobCardContractorProposalStatusLabel } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import {
  buildJobCardProposalRowViews,
  JOB_CARD_PROPOSALS_TAB_SUBTITLE,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import JobCardHeader from "@/app/tools/roofing/jobCard/JobCardHeader";
import JobCardDispositionControl from "@/app/tools/roofing/jobCard/JobCardDispositionControl";
import JobCardNextActionPanel from "@/app/tools/roofing/jobCard/JobCardNextActionPanel";
import JobCardTabs, { type JobCardTabId } from "@/app/tools/roofing/jobCard/JobCardTabs";
import {
  applyJobCardTabToSearch,
  coerceJobCardVisibleTab,
} from "@/app/tools/roofing/jobCard/jobCardTypes";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import JobCardForwardLifecycleAction from "@/app/tools/roofing/jobCard/JobCardForwardLifecycleAction";
import JobCardScheduleSection from "@/app/tools/roofing/jobCard/JobCardScheduleSection";
import JobCardScheduleWorkspacePanel from "@/app/tools/roofing/jobCard/JobCardScheduleWorkspacePanel";
import JobCardPaymentsWorkspace from "@/app/tools/roofing/jobCard/JobCardPaymentsWorkspace";
import JobCardProposalsTab, {
  JobCardProposalsAddHeaderButton,
} from "@/app/tools/roofing/jobCard/JobCardProposalsTab";
import { JobCardCreateProposalModal } from "@/app/tools/roofing/jobCard/JobCardCreateProposalModal";
import JobCardMeasurementsWorkspace from "@/app/tools/roofing/jobCard/JobCardMeasurementsWorkspace";
import JobCardMeasurementCapture from "@/app/tools/roofing/jobCard/JobCardMeasurementCapture";
import { PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT } from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import { useJobCardPrepareProposal } from "@/app/tools/roofing/jobCard/useJobCardPrepareProposal";
import JobCardActivityPanelWithCustomerRequests from "@/app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests";
import { resolveJobCardIdentityFromRecord } from "@/app/tools/roofing/jobCard/jobCardIdentityUtils";
import {
  buildCustomerWorkspaceHref,
  buildPropertyWorkspaceHref,
} from "@/app/lib/propertyAddressNormalize";
import type { JobCardDisplayModel } from "@/app/tools/roofing/jobCard/jobCardDisplayTypes";
import type { JobScheduleWorkspaceSubmit } from "@/app/tools/roofing/jobCard/JobScheduleWorkspace";

const JobCardSecondaryPanels = dynamic(
  () => import("@/app/tools/roofing/jobCard/JobCardSecondaryPanels"),
  { ssr: false }
);

export default function JobCardClient({
  companyId,
  serverJobRecord = null,
}: {
  companyId?: string;
  serverJobRecord?: JobRecord | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const jobParam = searchParams.get("job");
  const fromParam = searchParams.get("from");
  const attentionParam = searchParams.get("attention");
  const focusedRequestParam = searchParams.get("request");
  const tabParam = searchParams.get("tab");
  const prepareParam = searchParams.get("prepare") === "1";
  const isBoardOriginParam = fromParam === "board";
  const entryMode = "job-card" as const;
  const loadSavedId = null;
  const initialTrustedServerJobSeed = resolveTrustedJobCardSeed({
    entryMode,
    loadSavedId,
    jobParam,
    companyId,
    serverJobRecord,
  });
  const [currentJobId, setCurrentJobId] = useState<string | null>(
    initialTrustedServerJobSeed?.id ??
      (jobParam && isUuidLike(jobParam) ? jobParam : null)
  );
  const [restoreTick, setRestoreTick] = useState(0);
  const [jobCardTab, setJobCardTabRaw] = useState<JobCardTabId>(
    coerceJobCardVisibleTab(tabParam)
  );
  const setJobCardTab = useCallback(
    (tab: JobCardTabId) => {
      const next = coerceJobCardVisibleTab(tab);
      setJobCardTabRaw(next);
      const qs = applyJobCardTabToSearch(searchParams.toString(), next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  useEffect(() => {
    setJobCardTabRaw(coerceJobCardVisibleTab(searchParams.get("tab")));
  }, [searchParams]);
  const [jobCardBoardOrigin, setJobCardBoardOrigin] = useState(isBoardOriginParam);
  const isRestoringRef = useRef(false);
  const loadAppliedRef = useRef(true);
  const requestedAttentionId =
    attentionParam && isUuidLike(attentionParam) ? attentionParam : null;
  const jobAttention = useJobAttentionDetail({
    jobId: currentJobId,
    requestedAttentionId,
    enabled: true,
  });
  const jobPayments = useJobPayments(currentJobId);
  const [pendingAttentionId, setPendingAttentionId] = useState<string | null>(
    null
  );
  const [jobScheduleRows, setJobScheduleRows] = useState<JobSchedule[]>([]);
  const [jobSchedulesLoadedForJobId, setJobSchedulesLoadedForJobId] = useState<
    string | null
  >(null);
  const [jobScheduleSettlement, setJobScheduleSettlement] =
    useState<JobCardScheduleSettlement>(() =>
      createIdleJobCardScheduleSettlement()
    );
  const [companyTimezone, setCompanyTimezone] = useState<string | null>(null);
  const [companyTimezoneLoadStatus, setCompanyTimezoneLoadStatus] =
    useState<CompanyTimezoneLoadStatus>("loading");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [startWorkBusy, setStartWorkBusy] = useState(false);
  const [startWorkError, setStartWorkError] = useState<string | null>(null);
  const [completeJobBusy, setCompleteJobBusy] = useState(false);
  const [completeJobError, setCompleteJobError] = useState<string | null>(null);
  const [scheduleActivityTick, setScheduleActivityTick] = useState(0);
  const [scheduleHydrateRetryTick, setScheduleHydrateRetryTick] = useState(0);
  const [jobCardSecondaryEnabled, setJobCardSecondaryEnabled] = useState(false);
  const [listedJobDraftSummaries, setListedJobDraftSummaries] = useState<
    ProposalRecordStatusSummary[]
  >([]);
  const [listedJobDraftProposalId, setListedJobDraftProposalId] = useState<
    string | null
  >(null);
  const [listedJobDraftPackageLabels, setListedJobDraftPackageLabels] = useState<
    Record<string, string | null>
  >({});
  const [listedJobSentFacts, setListedJobSentFacts] =
    useState<JobCardProposalSentFactsById>({});
  const [listedJobDraftStatus, setListedJobDraftStatus] =
    useState<ListedProposalReadStatus>("idle");
  const [listedJobDraftError, setListedJobDraftError] = useState<string | null>(
    null
  );
  const [jobAcceptedProposalIds, setJobAcceptedProposalIds] = useState<
    Record<string, boolean>
  >({});
  const [acceptanceFactsReady, setAcceptanceFactsReady] = useState(false);
  const [jobSignedProposalIds, setJobSignedProposalIds] = useState<
    Record<string, boolean>
  >({});
  const [jobAcceptanceActivityItems, setJobAcceptanceActivityItems] = useState<
    ProposalAcceptanceActivityItem[]
  >([]);
  const [jobSignatureActivityItems, setJobSignatureActivityItems] = useState<
    ProposalSignatureActivityItem[]
  >([]);
  const listedDraftFetchInFlightRef = useRef<string | null>(null);

  const hydrateJobDisplayFromRecord = useCallback(() => {
    /* identity is read from the Job record, not estimator form fields */
  }, []);

  const {
    hydratedJobRecord,
    setHydratedJobRecord,
    jobHydrateStatus,
    refreshHydratedJobRecord,
  } = useJobCardCanonicalRead({
    entryMode,
    companyId,
    serverJobRecord,
    loadSavedId,
    isBoardOriginParam,
    jobCardBoardOrigin,
    jobParam,
    searchParams,
    isJobCardBoardContext: jobCardBoardOrigin,
    isRestoringRef,
    loadAppliedRef,
    hydrateJobDisplayFromRecord,
    setCurrentJobId,
    restoreTick,
    onRestoreRetry: () => setRestoreTick((n) => n + 1),
  });

  const consumePrepareQuery = useCallback(() => {
    if (searchParams.get("prepare") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("prepare");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const prepare = useJobCardPrepareProposal({
    companyId,
    jobId: currentJobId,
    customerId: hydratedJobRecord?.customer_id ?? null,
    selectedMeasurementId: hydratedJobRecord?.selected_measurement_id ?? null,
    routeHints: productSpineRouteHintsFromSearchParams("/tools/roofing", searchParams),
    prepareRequested: prepareParam,
    onJobUpdated: setHydratedJobRecord,
    onPrepareConsumed: consumePrepareQuery,
    onCreatedProposal: (proposalId) => {
      if (!currentJobId) return;
      void refreshHydratedJobRecord(currentJobId);
      router.push(buildProposalBuilderHref(currentJobId, proposalId));
    },
  });

  useEffect(() => {
    if (jobParam && isUuidLike(jobParam)) setCurrentJobId(jobParam);
  }, [jobParam]);

  useEffect(() => {
    setJobCardBoardOrigin(isBoardOriginParam);
  }, [isBoardOriginParam]);

  useEffect(() => {
    if (!currentJobId || !isUuidLike(currentJobId)) return;
    try {
      window.localStorage.setItem(LAST_DB_JOB_ID_STORAGE_KEY, currentJobId);
    } catch {
      /* ignore */
    }
  }, [currentJobId]);

  useEffect(() => {
    setJobCardSecondaryEnabled(false);
    setJobScheduleSettlement(createIdleJobCardScheduleSettlement());
    setJobAcceptedProposalIds({});
    setAcceptanceFactsReady(false);
    setJobSignedProposalIds({});
  }, [currentJobId]);

  useEffect(() => {
    if (jobCardSecondaryEnabled) return;
    if (
      shouldEnableJobCardSecondaryEffects({
        entryMode,
        jobHydrateStatus,
        currentJobId,
        scheduleSettlement: jobScheduleSettlement,
        secondaryEnabled: false,
      })
    ) {
      setJobCardSecondaryEnabled(true);
    }
  }, [jobHydrateStatus, currentJobId, jobScheduleSettlement, jobCardSecondaryEnabled]);

  useEffect(() => {
    let cancelled = false;
    setCompanyTimezoneLoadStatus("loading");
    void fetch("/api/company/timezone", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        const tzParsed = parseCompanyTimezoneGetResult(res.ok, json);
        if (tzParsed.status === "error") {
          setCompanyTimezoneLoadStatus("error");
        } else {
          setCompanyTimezoneLoadStatus("ready");
          setCompanyTimezone(tzParsed.timezone);
        }
      })
      .catch(() => {
        if (!cancelled) setCompanyTimezoneLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentJobId || !isUuidLike(currentJobId)) {
      setJobScheduleRows([]);
      setJobSchedulesLoadedForJobId(null);
      setJobScheduleSettlement(createIdleJobCardScheduleSettlement());
      return;
    }
    let cancelled = false;
    setJobSchedulesLoadedForJobId((current) =>
      current === currentJobId ? current : null
    );
    setJobScheduleSettlement((prev) =>
      preserveOrBeginJobCardScheduleSettlement(prev, currentJobId)
    );
    const settleScheduleError = () => {
      setJobScheduleSettlement(settleJobCardScheduleError(currentJobId));
    };
    const loadSchedules = async (attempt = 0): Promise<void> => {
      try {
        const res = await fetch(
          `/api/jobs/schedules?jobId=${encodeURIComponent(currentJobId)}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        const schedulesJson = await res.json().catch(() => null);
        if (cancelled) return;
        const schedules = parseJobCardSchedulesApiPayload(schedulesJson);
        if (schedules) {
          setJobScheduleRows(schedules);
          setJobSchedulesLoadedForJobId(currentJobId);
          setJobScheduleSettlement(settleJobCardScheduleSuccess(currentJobId));
          return;
        }
        if (shouldRetryJobCardScheduleFetch(res.ok, schedulesJson, attempt)) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, 400 * (attempt + 1))
          );
          if (!cancelled) return loadSchedules(attempt + 1);
          return;
        }
        settleScheduleError();
        if (!cancelled) {
          window.setTimeout(() => setScheduleHydrateRetryTick((n) => n + 1), 2000);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 4) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, 400 * (attempt + 1))
          );
          if (!cancelled) return loadSchedules(attempt + 1);
          return;
        }
        settleScheduleError();
        if (!cancelled) {
          window.setTimeout(() => setScheduleHydrateRetryTick((n) => n + 1), 2000);
        }
      }
    };
    void loadSchedules();
    return () => {
      cancelled = true;
    };
  }, [currentJobId, scheduleActivityTick, scheduleHydrateRetryTick]);

  useEffect(() => {
    const cid = (companyId ?? "").trim();
    const jid = (currentJobId ?? "").trim();
    if (!jobCardSecondaryEnabled || !cid || !isUuidLike(cid) || !jid || !isUuidLike(jid)) {
      return;
    }
    const fetchKey = `${cid}:${jid}`;
    listedDraftFetchInFlightRef.current = fetchKey;
    setListedJobDraftStatus((prev) => (prev === "idle" ? "loading" : prev));
    void (async () => {
      try {
        const summaries = await listProposalsForJob(cid, jid);
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        const contractorRows = filterContractorVisibleProposals(
          summaries.filter((row) => isUuidLike(row.id))
        );
        const applied = applyListedProposalFetchResult({
          previousItems: [],
          previousStatus: "loading",
          result: { ok: true, items: contractorRows },
        });
        setListedJobDraftStatus(applied.status);
        setListedJobDraftError(null);
        setListedJobDraftSummaries(applied.items);
        const draft = pickContractorVisibleJobDraft(
          contractorRows.filter((row) => row.status === "draft"),
          hydratedJobRecord?.active_proposal_id &&
            isUuidLike(hydratedJobRecord.active_proposal_id)
            ? hydratedJobRecord.active_proposal_id
            : null
        );
        setListedJobDraftProposalId(draft?.id ?? null);
        const labelEntries = await Promise.all(
          contractorRows.map(async (row) => {
            if (!row.selected_option_id || !isUuidLike(row.selected_option_id)) {
              return [row.id, null] as const;
            }
            return [
              row.id,
              await getProposalOptionLabel(cid, row.selected_option_id),
            ] as const;
          })
        );
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        const labels: Record<string, string | null> = {};
        for (const [id, label] of labelEntries) labels[id] = label;
        setListedJobDraftPackageLabels(labels);
        const latestSentByProposal: Record<string, string | null> = {};
        for (const row of contractorRows) {
          latestSentByProposal[row.id] = row.latest_sent_version_id;
        }
        setListedJobSentFacts(
          await loadJobCardProposalSentFacts({
            companyId: cid,
            proposalIds: contractorRows.map((row) => row.id),
            latestSentVersionIdByProposalId: latestSentByProposal,
          })
        );
      } catch {
        if (listedDraftFetchInFlightRef.current !== fetchKey) return;
        setListedJobDraftSummaries((previousItems) => {
          const applied = applyListedProposalFetchResult({
            previousItems,
            previousStatus: "ready_items",
            result: { ok: false, error: "Proposals could not be loaded." },
          });
          setListedJobDraftStatus(applied.status);
          setListedJobDraftError(applied.error);
          return applied.items;
        });
      }
    })();
  }, [
    jobCardSecondaryEnabled,
    companyId,
    currentJobId,
    hydratedJobRecord?.active_proposal_id,
  ]);

  useEffect(() => {
    if (!jobCardSecondaryEnabled || !currentJobId || !isUuidLike(currentJobId)) {
      return;
    }
    let cancelled = false;
    void listJobProposalAcceptances(currentJobId).then((acceptances) => {
      if (cancelled) return;
      const acceptedIds: Record<string, boolean> = {};
      for (const row of acceptances) {
        const proposalId = (row.proposal_id ?? "").trim();
        if (proposalId) acceptedIds[proposalId] = true;
      }
      setJobAcceptedProposalIds(acceptedIds);
      setAcceptanceFactsReady(true);
      setJobAcceptanceActivityItems(
        composeProposalAcceptanceActivityItems(acceptances)
      );
    });
    return () => {
      cancelled = true;
    };
  }, [jobCardSecondaryEnabled, currentJobId]);

  useEffect(() => {
    if (!jobCardSecondaryEnabled || !currentJobId || !isUuidLike(currentJobId)) {
      return;
    }
    let cancelled = false;
    void listJobProposalSignatures(currentJobId).then((signatures) => {
      if (cancelled) return;
      const signedIds: Record<string, boolean> = {};
      for (const row of signatures) {
        const proposalId = (row.proposal_id ?? "").trim();
        if (proposalId) signedIds[proposalId] = true;
      }
      setJobSignedProposalIds(signedIds);
      setJobSignatureActivityItems(
        composeProposalSignatureActivityItems(signatures)
      );
    });
    return () => {
      cancelled = true;
    };
  }, [jobCardSecondaryEnabled, currentJobId]);

  const persistJobScheduleAction = useCallback(
    async (
      path: "/api/jobs/schedule" | "/api/jobs/reschedule" | "/api/jobs/unschedule",
      body: Record<string, unknown>
    ) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json().catch(() => null);
    },
    []
  );

  const applyReturnedSchedule = useCallback((raw: unknown, jobId: string) => {
    const parsed = parseJobScheduleRow(raw);
    if (!parsed || parsed.job_id !== jobId) return;
    setJobScheduleRows((prev) => upsertJobScheduleRow(prev, parsed));
    setJobSchedulesLoadedForJobId(jobId);
    setJobScheduleSettlement(settleJobCardScheduleSuccess(jobId));
  }, []);

  const identity = hydratedJobRecord
    ? resolveJobCardIdentityFromRecord(hydratedJobRecord)
    : {
        displayName: "Loading…",
        phone: "",
        email: "",
        hasAddress: false,
        addressLine: "Property details not complete",
      };

  const canonicalJobStage = resolveCanonicalJobStage(
    hydratedJobRecord ?? { stage: "intake" }
  );
  const jobCardSchedule = resolveJobCardScheduleDisplay({
    jobId: currentJobId,
    rows: jobScheduleRows,
    loadedForJobId: jobSchedulesLoadedForJobId,
    settlement: jobScheduleSettlement,
  });
  const jobCardActionEligibility = resolveCanonicalJobActionEligibilityFromFacts({
    stage: hydratedJobRecord?.stage,
    disposition: hydratedJobRecord?.status,
    schedule: jobCardSchedule.active,
    approvalAcceptancePending: Boolean(
      findApproveJobAcceptanceItem(jobAttention.items)
    ),
  });
  const approveAcceptanceItem = findApproveJobAcceptanceItem(jobAttention.items);
  const overviewForward = resolveJobCardOverviewForwardAction(
    jobCardActionEligibility
  );
  const workspaceAttentionItems = filterJobCardWorkspaceAttentionItems(
    jobAttention.items,
    { overviewOwnsApprove: jobCardActionEligibility.canApproveJob }
  );
  const workspaceSelectedAttention =
    workspaceAttentionItems.find(
      (item) => item.id === jobAttention.selectedItem?.id
    ) ??
    workspaceAttentionItems[0] ??
    null;

  const submitJobCardSchedule = (input: JobScheduleWorkspaceSubmit) => {
    if (!currentJobId || scheduleBusy) return;
    const path = jobCardSchedule.active
      ? "/api/jobs/reschedule"
      : "/api/jobs/schedule";
    setScheduleBusy(true);
    setScheduleError(null);
    void persistJobScheduleAction(path, {
      jobId: currentJobId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      allDay: input.allDay,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
      notes: input.notes,
      expectedRowVersion: jobCardSchedule.active?.row_version,
    })
      .then(async (json) => {
        if (!json?.ok) {
          setScheduleError("Could not save the schedule.");
          return;
        }
        applyReturnedSchedule(json.schedule, currentJobId);
        setScheduleActivityTick((n) => n + 1);
        await refreshHydratedJobRecord(currentJobId);
      })
      .finally(() => setScheduleBusy(false));
  };

  const unscheduleJobCard = () => {
    if (!currentJobId || scheduleBusy) return;
    setScheduleBusy(true);
    setScheduleError(null);
    void persistJobScheduleAction("/api/jobs/unschedule", {
      jobId: currentJobId,
      expectedRowVersion: jobCardSchedule.active?.row_version,
    })
      .then(async (json) => {
        if (!json?.ok) {
          setScheduleError("Could not unschedule this job.");
          return;
        }
        applyReturnedSchedule(json.schedule, currentJobId);
        setScheduleActivityTick((n) => n + 1);
        await refreshHydratedJobRecord(currentJobId);
      })
      .finally(() => setScheduleBusy(false));
  };

  const jobCardProposalRows = useMemo(
    () =>
      buildJobCardProposalRowViews({
        summaries: listedJobDraftSummaries,
        packageLabelsByProposalId: listedJobDraftPackageLabels,
        templateNameByTemplateId: {},
        sentFactsByProposalId: listedJobSentFacts,
        acceptedProposalIds: jobAcceptedProposalIds,
        signedProposalIds: jobSignedProposalIds,
        activeProposalId: hydratedJobRecord?.active_proposal_id ?? null,
        hrefs: currentJobId
          ? {
              builderHref: (proposalId) =>
                buildProposalBuilderHref(currentJobId, proposalId),
              previewHref: (proposalId) =>
                buildProposalPreviewHref(currentJobId, proposalId),
              sentRecordHref: (proposalId, versionId) =>
                buildProposalPreviewSentHref(currentJobId, proposalId, versionId),
            }
          : undefined,
      }),
    [
      listedJobDraftSummaries,
      listedJobDraftPackageLabels,
      listedJobSentFacts,
      jobAcceptedProposalIds,
      jobSignedProposalIds,
      currentJobId,
      hydratedJobRecord?.active_proposal_id,
    ]
  );

  const measurementProposalRefs = useMemo(
    () =>
      pickMeasurementProposalRefs({
        summaries: listedJobDraftSummaries,
        draftProposalId: listedJobDraftProposalId,
      }),
    [listedJobDraftSummaries, listedJobDraftProposalId]
  );

  const measurementProposalBinding = useMemo(
    () =>
      resolveMeasurementProposalBinding({
        currentMeasurementId: prepare.selectedId,
        currentMeasurementUpdatedAt: prepare.selected?.updated_at ?? null,
        draft: measurementProposalRefs.draft,
        sent: measurementProposalRefs.sent,
        reviewHref:
          currentJobId && measurementProposalRefs.draft?.proposalId
            ? buildProposalBuilderHref(
                currentJobId,
                measurementProposalRefs.draft.proposalId
              )
            : null,
      }),
    [
      prepare.selectedId,
      prepare.selected?.updated_at,
      measurementProposalRefs,
      currentJobId,
    ]
  );

  const display: JobCardDisplayModel = {
    customerName: identity.displayName,
    address: identity.addressLine,
    stageLabel: hydratedJobRecord
      ? resolveCanonicalJobStageLabel(hydratedJobRecord)
      : jobHydrateStatus === "unavailable"
        ? "Unavailable"
        : "Loading",
    dispositionLabel: visibleDispositionLabel(hydratedJobRecord?.status),
    valueLabel: null,
    lastUpdatedDisplay: null,
    timeInStage: null,
    timeInStageTone: "neutral",
    reportLabel: prepare.selected
      ? formatMeasurementQuantityLine(prepare.selected)
      : "No measurement",
    proposalLabel: formatJobCardContractorProposalStatusLabel({
      visibleSummaries: listedJobDraftSummaries,
      packageLabelsByProposalId: listedJobDraftPackageLabels,
      sentFactsByProposalId: listedJobSentFacts,
      acceptedProposalIds: jobAcceptedProposalIds,
      signedProposalIds: jobSignedProposalIds,
      acceptanceFactsReady,
      activeProposalId: hydratedJobRecord?.active_proposal_id ?? null,
      latestProposalId: hydratedJobRecord?.latest_proposal_id ?? null,
      stage: hydratedJobRecord?.stage ?? null,
    }),
    tasksLabel: "No tasks",
  };

  const confirmJobAcceptance = async () => {
    if (!currentJobId || !approveAcceptanceItem?.acceptance) return;
    setPendingAttentionId(approveAcceptanceItem.id);
    try {
      await fetch("/api/jobs/confirm-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentJobId,
          acceptanceId: approveAcceptanceItem.acceptance.acceptanceId,
        }),
      });
      await Promise.all([
        jobAttention.reload(),
        refreshHydratedJobRecord(currentJobId),
      ]);
      notifyJobAttentionChanged({ jobId: currentJobId });
    } finally {
      setPendingAttentionId(null);
    }
  };

  const startCurrentJobWork = async () => {
    if (!currentJobId || startWorkBusy) return;
    setStartWorkBusy(true);
    setStartWorkError(null);
    try {
      const response = await fetch("/api/jobs/start-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJobId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setStartWorkError("Work could not be started. Refresh and try again.");
        await refreshHydratedJobRecord(currentJobId);
        return;
      }
      await refreshHydratedJobRecord(currentJobId);
      applyReturnedSchedule(result?.schedule, currentJobId);
      setScheduleActivityTick((value) => value + 1);
    } catch {
      setStartWorkError(
        "Could not confirm whether work started. Refreshing current Job status."
      );
      await refreshHydratedJobRecord(currentJobId);
    } finally {
      setStartWorkBusy(false);
    }
  };

  const completeCurrentJobWork = async () => {
    if (!currentJobId || completeJobBusy) return;
    setCompleteJobBusy(true);
    setCompleteJobError(null);
    try {
      const response = await fetch("/api/jobs/complete-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJobId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setCompleteJobError("This Job could not be completed. Refresh and try again.");
        await refreshHydratedJobRecord(currentJobId);
        return;
      }
      await refreshHydratedJobRecord(currentJobId);
      applyReturnedSchedule(result?.schedule, currentJobId);
      setScheduleActivityTick((value) => value + 1);
    } catch {
      setCompleteJobError(
        "Could not confirm whether the Job was completed. Refreshing current Job status."
      );
      await refreshHydratedJobRecord(currentJobId);
    } finally {
      setCompleteJobBusy(false);
    }
  };

  return (
    <FieldDiveAppShell activeNav="jobs" activeSubId="job-card">
      <div
        className="min-h-0 min-w-0 w-full overflow-x-hidden pb-8 pt-1 pl-3 pr-4 sm:pl-4 sm:pr-5 lg:pl-5 lg:pr-6"
        data-jobcard-client="owned"
        data-jobcard-secondary-ready={jobCardSecondaryEnabled ? "true" : "false"}
      >
        <div className="w-full min-w-0 max-w-[100rem]">
          <div className="min-w-0 overflow-x-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <JobCardHeader
              display={display}
              isBoardOrigin={jobCardBoardOrigin}
              phone={identity.phone}
              email={identity.email}
              customerHref={
                hydratedJobRecord?.customer_id
                  ? buildCustomerWorkspaceHref(hydratedJobRecord.customer_id)
                  : null
              }
              propertyHref={
                hydratedJobRecord?.property_id
                  ? buildPropertyWorkspaceHref(hydratedJobRecord.property_id)
                  : null
              }
              dispositionNote={dispositionBlockedWorkCopy(
                hydratedJobRecord?.status
              )}
              actions={
                <JobCardDispositionControl
                  jobId={currentJobId}
                  disposition={hydratedJobRecord?.status ?? null}
                  stage={canonicalJobStage}
                  stageLabel={display.stageLabel}
                  disabled={
                    !hydratedJobRecord ||
                    startWorkBusy ||
                    completeJobBusy ||
                    scheduleBusy
                  }
                  onApplied={async (result) => {
                    try {
                      const refreshed = await refreshHydratedJobRecord(
                        result.job_id
                      );
                      if (!refreshed) {
                        setHydratedJobRecord((prev) =>
                          applyKnownDispositionToJobRecord(
                            prev,
                            result.job_id,
                            result.to_status
                          )
                        );
                      }
                    } finally {
                      setScheduleActivityTick((value) => value + 1);
                    }
                  }}
                />
              }
            />
            <JobCardNextActionPanel
              items={workspaceAttentionItems}
              selectedItem={workspaceSelectedAttention}
              focusRequested={
                requestedAttentionId != null &&
                jobAttention.selectedAttentionId === requestedAttentionId
              }
              fallbackPhone={identity.phone}
              fallbackEmail={identity.email}
              pendingAttentionId={pendingAttentionId}
              detailStatus={jobAttention.status}
              detailError={jobAttention.error}
              onSelect={jobAttention.selectItem}
              onMarkRead={jobAttention.markRead}
              onMarkSeen={async (item) => {
                if (!currentJobId || !item.request) return;
                setPendingAttentionId(item.id);
                try {
                  await updateProposalCustomerRequestStatus({
                    requestId: item.request.requestId,
                    proposalId: item.destination.proposalId,
                    jobId: currentJobId,
                    status: "seen",
                  });
                } finally {
                  setPendingAttentionId(null);
                }
              }}
              onDismiss={async (item) => {
                if (!currentJobId || !item.request) return;
                setPendingAttentionId(item.id);
                try {
                  await updateProposalCustomerRequestStatus({
                    requestId: item.request.requestId,
                    proposalId: item.destination.proposalId,
                    jobId: currentJobId,
                    status: "dismissed",
                  });
                } finally {
                  setPendingAttentionId(null);
                }
              }}
              onReviewProposal={(item) => {
                if (!currentJobId) return;
                router.push(buildJobCardProposalAttentionHref(currentJobId, item));
              }}
              onConfirmAcceptance={async (item: JobAttentionSafeItem) => {
                if (!currentJobId || !item.acceptance) return;
                setPendingAttentionId(item.id);
                try {
                  await fetch("/api/jobs/confirm-acceptance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      jobId: currentJobId,
                      acceptanceId: item.acceptance.acceptanceId,
                    }),
                  });
                  await Promise.all([
                    jobAttention.reload(),
                    refreshHydratedJobRecord(currentJobId),
                  ]);
                  notifyJobAttentionChanged({ jobId: currentJobId });
                } finally {
                  setPendingAttentionId(null);
                }
              }}
              onAcknowledgeAcceptance={async (item: JobAttentionSafeItem) => {
                if (!currentJobId || !item.acceptance) return;
                setPendingAttentionId(item.id);
                try {
                  await fetch("/api/jobs/acknowledge-acceptance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      jobId: currentJobId,
                      acceptanceId: item.acceptance.acceptanceId,
                    }),
                  });
                  await jobAttention.reload();
                  notifyJobAttentionChanged({ jobId: currentJobId });
                } finally {
                  setPendingAttentionId(null);
                }
              }}
              onConnectPayments={() => router.push("/tools/settings/payments")}
              onReviewPayment={() => setJobCardTab("payments")}
              canonicalJobStage={canonicalJobStage}
              jobDisposition={hydratedJobRecord?.status ?? null}
            />
            <JobCardTabs activeTab={jobCardTab} onTabChange={setJobCardTab} />
            <div className="grid min-h-[min(520px,calc(100vh-14rem))] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
              <main className="min-h-0 overflow-y-auto p-5 sm:p-6">
                <JobCardSectionPanel
                  tabId="overview"
                  activeTab={jobCardTab}
                  title="Overview"
                >
                  <JobCardOverviewSummary
                    proposalLabel={display.proposalLabel}
                    measurementLabel={
                      prepare.selected
                        ? formatMeasurementQuantityLine(prepare.selected)
                        : "No measurement"
                    }
                    operationalStateLabel={
                      jobCardActionEligibility.canApproveJob
                        ? JOB_CARD_AWAITING_CONTRACTOR_APPROVAL
                        : null
                    }
                    paymentStatusLabel={
                      jobPayments.workspace?.overviewStatusLabel ?? null
                    }
                  />
                  <JobCardForwardLifecycleAction
                    action={overviewForward}
                    busy={pendingAttentionId != null}
                    onApproveJob={confirmJobAcceptance}
                    onSchedule={() => {
                      setScheduleError(null);
                      setJobCardTab("calendar");
                    }}
                  />
                  <JobCardScheduleSection
                    canSchedule={
                      overviewForward?.kind === "schedule"
                        ? false
                        : jobCardActionEligibility.canSchedule
                    }
                    stage={canonicalJobStage}
                    schedule={jobCardSchedule.active}
                    scheduleReady={jobCardSchedule.ready}
                    scheduleLoadStatus={
                      jobCardSchedule.loadStatus === "error"
                        ? "error"
                        : jobCardSchedule.ready
                          ? "ready"
                          : "loading"
                    }
                    scheduleRefreshError={jobCardSchedule.refreshError}
                    productionStartedAt={
                      hydratedJobRecord?.production_started_at ?? null
                    }
                    completedAt={hydratedJobRecord?.completed_at ?? null}
                    displayTimezone={companyTimezone}
                    startBusy={startWorkBusy}
                    startError={startWorkError}
                    completeBusy={completeJobBusy}
                    completeError={completeJobError}
                    onStartWork={
                      jobCardActionEligibility.canStartWork
                        ? startCurrentJobWork
                        : undefined
                    }
                    onCompleteJob={
                      jobCardActionEligibility.canCompleteJob
                        ? completeCurrentJobWork
                        : undefined
                    }
                    onSchedule={() => {
                      setScheduleError(null);
                      setJobCardTab("calendar");
                    }}
                    onChangeSchedule={
                      jobCardActionEligibility.canReschedule
                        ? () => {
                            setScheduleError(null);
                            setJobCardTab("calendar");
                          }
                        : undefined
                    }
                  />
                </JobCardSectionPanel>

                <JobCardSectionPanel
                  tabId="calendar"
                  activeTab={jobCardTab}
                  title="Calendar"
                >
                  <JobCardScheduleWorkspacePanel
                    stage={canonicalJobStage}
                    scheduleReady={jobCardSchedule.ready}
                    timezone={companyTimezoneForScheduling(
                      resolveCompanyTimezoneReadState({
                        loadStatus: companyTimezoneLoadStatus,
                        savedTimezone: companyTimezone,
                      })
                    )}
                    timezoneLoadStatus={companyTimezoneLoadStatus}
                    activeSchedule={jobCardSchedule.active}
                    cancelledRows={
                      currentJobId
                        ? jobScheduleRows.filter(
                            (row) =>
                              row.job_id === currentJobId &&
                              row.status === "cancelled"
                          )
                        : []
                    }
                    canSchedule={jobCardActionEligibility.canSchedule}
                    canReschedule={jobCardActionEligibility.canReschedule}
                    canUnschedule={jobCardActionEligibility.canUnschedule}
                    busy={scheduleBusy}
                    error={scheduleError}
                    depositNotReceived={
                      jobPayments.workspace?.depositNotReceived === true
                    }
                    timezoneSettingsHref={
                      currentJobId
                        ? `/tools/settings?timezoneReturnTo=${encodeURIComponent(`/tools/roofing?entry=job-card&job=${currentJobId}`)}#company-timezone`
                        : undefined
                    }
                    onSubmitSchedule={submitJobCardSchedule}
                    onConfirmUnschedule={unscheduleJobCard}
                  />
                </JobCardSectionPanel>

                <JobCardSectionPanel
                  tabId="proposals"
                  activeTab={jobCardTab}
                  title="Proposals"
                  subtitle={JOB_CARD_PROPOSALS_TAB_SUBTITLE}
                  headerAction={
                    <JobCardProposalsAddHeaderButton
                      onClick={prepare.openModal}
                      quiet={jobCardProposalRows.length > 0}
                    />
                  }
                >
                  <JobCardProposalsTab
                    rows={jobCardProposalRows}
                    jobId={currentJobId}
                    listStatus={listedJobDraftStatus}
                    listError={listedJobDraftError}
                    onAddProposal={prepare.openModal}
                    focusedRequestId={focusedRequestParam}
                    onProposalAction={(action, proposalId) => {
                      if (!action.enabled || !action.href) return;
                      router.push(action.href);
                      void proposalId;
                    }}
                  />
                </JobCardSectionPanel>

                <JobCardSectionPanel
                  tabId="payments"
                  activeTab={jobCardTab}
                  title="Payments"
                  subtitle="Contract, collected, and remaining"
                >
                  <JobCardPaymentsWorkspace
                    workspace={jobPayments.workspace}
                    onCollectPayment={
                      jobPayments.workspace?.canCollectPayment
                        ? jobPayments.collectPayment
                        : undefined
                    }
                    onCancelCurrentRequest={
                      jobPayments.workspace?.currentRequest?.status === "open"
                        ? jobPayments.cancelCurrentRequest
                        : undefined
                    }
                    onCopyPaymentLink={
                      jobPayments.workspace?.currentRequest
                        ? jobPayments.copyPaymentLink
                        : undefined
                    }
                    onIssueRefund={jobPayments.issueRefund}
                    collectBusy={jobPayments.collectBusy}
                    collectError={jobPayments.collectError}
                    cancelBusy={jobPayments.cancelBusy}
                    copyBusy={jobPayments.copyBusy}
                    refundBusy={jobPayments.refundBusy}
                    refundError={jobPayments.refundError}
                    copyError={jobPayments.copyError}
                  />
                </JobCardSectionPanel>

                <JobCardSectionPanel
                  tabId="measurements"
                  activeTab={jobCardTab}
                  title="Measurements"
                >
                  <JobCardMeasurementsWorkspace
                    records={prepare.records}
                    selectedId={prepare.selectedId}
                    loading={prepare.loadingMeasurements}
                    capturing={
                      prepare.captureOpen && prepare.captureOrigin === "tab"
                    }
                    captureInitial={prepare.captureInitial}
                    captureTitle={prepare.captureTitle}
                    saving={prepare.saving}
                    saveError={prepare.saveError}
                    selectBusy={prepare.selectBusy}
                    binding={measurementProposalBinding}
                    draftProposal={measurementProposalRefs.draft}
                    onAddMeasurement={() => prepare.openCapture("tab", "add")}
                    onEditMeasurement={() => prepare.openCapture("tab", "edit")}
                    onCancelCapture={prepare.closeCapture}
                    onSaveMeasurement={prepare.saveMeasurement}
                    onMakeCurrent={prepare.selectMeasurement}
                    onReviewProposal={(href) => router.push(href)}
                  />
                </JobCardSectionPanel>

                <JobCardSecondaryPanels
                  activeTab={jobCardTab}
                  jobId={currentJobId}
                  companyId={companyId}
                  listedDraftProposalId={listedJobDraftProposalId}
                />
              </main>
              {currentJobId ? (
                <JobCardActivityPanelWithCustomerRequests
                  key={`${currentJobId}-${scheduleActivityTick}`}
                  jobId={currentJobId}
                  proposalIds={jobCardProposalRows.map((row) => row.proposalId)}
                  jobCreatedAt={hydratedJobRecord?.created_at ?? null}
                  proposals={listedJobDraftSummaries}
                  sentFactsByProposalId={listedJobSentFacts}
                  secondaryEffectsEnabled={jobCardSecondaryEnabled}
                  ownedAcceptanceItems={jobAcceptanceActivityItems}
                  ownedSignatureItems={jobSignatureActivityItems}
                  skipPaymentEnrichment
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {prepare.modalOpen ? (
        <JobCardCreateProposalModal
          open={prepare.modalOpen}
          onClose={prepare.closeModal}
          measurements={prepare.eligibleChoices}
          selectedMeasurementId={prepare.selectedId}
          onSelectMeasurement={prepare.selectMeasurement}
          measurementReady={prepare.proposalHandoff?.proposalReady === true}
          measurementLabel={prepare.proposalHandoff?.selectedLabel ?? null}
          measurementRoofAreaSqft={
            prepare.proposalHandoff?.quantities.roof_area_sqft ?? null
          }
          measurementWastePercent={
            prepare.proposalHandoff?.quantities.waste_percent ?? null
          }
          templates={prepare.modalTemplates}
          selectedTemplateId={prepare.selectedTemplateId}
          onSelectTemplate={prepare.setSelectedTemplateId}
          templateReady={prepare.templateEligibility.usable}
          selectedTemplateUnusableReason={
            prepare.templateEligibility.graphMatchesSelection &&
            !prepare.templateEligibility.usable
              ? prepare.templateEligibility.reason
              : null
          }
          preferredTemplateId={prepare.preferredTemplateId}
          starterTemplateId={prepare.starterTemplateId}
          packageChoices={
            prepare.templateEligibility.graphMatchesSelection
              ? prepare.packageSetup.choices
              : []
          }
          packagePresentationMode={prepare.packageSetup.packagePresentationMode}
          selectedPackageOptionId={prepare.selectedPackageOptionId}
          startingPackageOptionId={prepare.packageSetup.selectedOptionId}
          onSelectPackage={prepare.setSelectedPackageOptionId}
          packageGraphReady={prepare.templateEligibility.graphMatchesSelection}
          createEnabled={prepare.createEnabled}
          creating={prepare.creating}
          createError={prepare.createError}
          onCreateProposal={prepare.createProposal}
          onAddMeasurement={() => prepare.openCapture("prepare", "add")}
          preparingStructure={prepare.preparingStructure}
          preparingStructureLabel={prepare.preparingStructureLabel}
          structureError={prepare.structureError}
          showFirstProposalPricingRules={prepare.showFirstProposalPricingRules}
          firstProposalPricingRulesDraft={prepare.firstProposalPricingRulesDraft}
          onFirstProposalPricingRulesChange={prepare.patchFirstProposalPricingRulesDraft}
          onSaveFirstProposalPricingRules={() =>
            void prepare.saveFirstProposalPricingRules()
          }
          firstProposalPricingRulesSaving={prepare.firstProposalPricingRulesSaving}
          firstProposalPricingRulesSaveError={
            prepare.firstProposalPricingRulesSaveError
          }
          firstProposalPricingRulesComplete={
            prepare.firstProposalPricingRulesComplete
          }
          showFirstProposalPricing={prepare.showFirstProposalPricing}
          firstProposalPricingLines={prepare.firstProposalPricingLines}
          firstProposalPricingDrafts={prepare.firstProposalPricingDrafts}
          onFirstProposalPricingDraftChange={prepare.setFirstProposalPricingDraft}
          onSaveFirstProposalPrices={() => void prepare.saveFirstProposalPrices()}
          firstProposalPricingSaving={prepare.firstProposalPricingSaving}
          firstProposalPricingSaveError={prepare.firstProposalPricingSaveError}
          firstProposalPricingComplete={prepare.firstProposalPricingComplete}
        />
      ) : null}
      {prepare.captureOpen && prepare.captureOrigin === "prepare" ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-5"
          data-jobcard-prepare-measurement-capture="true"
        >
          <div className="relative z-10 w-full max-w-xl rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl">
            <JobCardMeasurementCapture
              initial={prepare.captureInitial}
              saving={prepare.saving}
              error={prepare.saveError}
              onCancel={prepare.closeCapture}
              onSave={prepare.saveMeasurement}
              title={prepare.captureTitle}
              hint={
                prepare.captureKind === "add"
                  ? PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT
                  : null
              }
            />
          </div>
        </div>
      ) : null}
    </FieldDiveAppShell>
  );
}
