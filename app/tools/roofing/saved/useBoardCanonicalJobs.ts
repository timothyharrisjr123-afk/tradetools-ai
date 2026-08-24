/**
 * Canonical Jobs Board data layer — DB jobs, schedules, timezone with coalesced refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyBoardCanonicalJobsFailure,
  applyBoardCanonicalJobsSuccess,
  createInitialBoardCanonicalJobsSnapshot,
  isBoardCanonicalJobsLoaded,
  type BoardCanonicalJobsReadStatus,
  type BoardCanonicalJobsSnapshot,
} from "@/app/lib/boardCanonicalReadState";
import {
  beginCoalescedRefresh,
  createInitialCoalescedRefreshState,
  finishCoalescedRefresh,
  invalidateCoalescedRefresh,
  isCoalescedRefreshCurrent,
  type CoalescedRefreshState,
} from "@/app/lib/coalescedRefresh";
import { getJobsByCompany } from "@/app/lib/jobStore";
import type { JobSummary } from "@/app/lib/jobTypes";
import {
  parseCompanyTimezoneGetResult,
} from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import type { CompanyTimezoneLoadStatus } from "@/app/lib/jobScheduleMapper";

export type UseBoardCanonicalJobsResult = {
  dbJobs: JobSummary[];
  dbJobsLoaded: boolean;
  dbJobsStatus: BoardCanonicalJobsReadStatus;
  dbJobsRefreshError: boolean;
  r3fSchedulesByJobId: Record<string, JobSchedule>;
  r3fTimezone: string | null;
  r3fTimezoneLoadStatus: CompanyTimezoneLoadStatus;
  refreshDbJobs: () => void;
  invalidateDbJobs: () => void;
  setR3fSchedulesByJobId: React.Dispatch<
    React.SetStateAction<Record<string, JobSchedule>>
  >;
  setR3fTimezone: React.Dispatch<React.SetStateAction<string | null>>;
  setR3fTimezoneLoadStatus: React.Dispatch<
    React.SetStateAction<CompanyTimezoneLoadStatus>
  >;
};

export function useBoardCanonicalJobs(input: {
  enabled: boolean;
  companyId: string | null | undefined;
}): UseBoardCanonicalJobsResult {
  const [snapshot, setSnapshot] = useState<BoardCanonicalJobsSnapshot<JobSummary>>(
    () => createInitialBoardCanonicalJobsSnapshot<JobSummary>()
  );
  const [snapshotCompanyId, setSnapshotCompanyId] = useState(input.companyId);
  if (snapshotCompanyId !== input.companyId) {
    setSnapshotCompanyId(input.companyId);
    setSnapshot(createInitialBoardCanonicalJobsSnapshot<JobSummary>());
  }
  const [r3fSchedulesByJobId, setR3fSchedulesByJobId] = useState<
    Record<string, JobSchedule>
  >({});
  const [r3fTimezone, setR3fTimezone] = useState<string | null>(null);
  const [r3fTimezoneLoadStatus, setR3fTimezoneLoadStatus] =
    useState<CompanyTimezoneLoadStatus>("loading");

  const refreshStateRef = useRef<CoalescedRefreshState>(
    createInitialCoalescedRefreshState()
  );
  const companyIdRef = useRef(input.companyId);

  useEffect(() => {
    companyIdRef.current = input.companyId;
  }, [input.companyId]);

  const runDbJobsLoad = useCallback(async (generation: number) => {
    const cid = String(companyIdRef.current ?? "").trim();
    if (!cid) {
      if (isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        setSnapshot((previous) => applyBoardCanonicalJobsSuccess(previous, []));
      }
      return;
    }
    try {
      const jobs = await getJobsByCompany(cid);
      if (!isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        return;
      }
      setSnapshot((previous) => applyBoardCanonicalJobsSuccess(previous, jobs));
    } catch (err) {
      console.error("[useBoardCanonicalJobs] getJobsByCompany failed", err);
      if (!isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        return;
      }
      setSnapshot((previous) => applyBoardCanonicalJobsFailure(previous));
    }
  }, []);

  const pumpRefresh = useCallback(async () => {
    while (true) {
      const begin = beginCoalescedRefresh(refreshStateRef.current);
      refreshStateRef.current = begin.state;
      if (!begin.shouldRun) return;

      await runDbJobsLoad(begin.generation);

      const finish = finishCoalescedRefresh(
        refreshStateRef.current,
        begin.generation
      );
      refreshStateRef.current = finish.state;
      if (!finish.runAgain) break;
    }
  }, [runDbJobsLoad]);

  const refreshDbJobs = useCallback(() => {
    void pumpRefresh();
  }, [pumpRefresh]);

  const invalidateDbJobs = useCallback(() => {
    refreshStateRef.current = invalidateCoalescedRefresh(refreshStateRef.current);
    refreshDbJobs();
  }, [refreshDbJobs]);

  useEffect(() => {
    if (!input.enabled) return;
    const cid = String(input.companyId ?? "").trim();
    /* eslint-disable react-hooks/set-state-in-effect -- empty company is a known ready snapshot */
    if (!cid) {
      setSnapshot((previous) => applyBoardCanonicalJobsSuccess(previous, []));
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    setSnapshot((previous) => ({
      ...previous,
      status: previous.everSucceeded ? previous.status : "loading",
      refreshError: false,
    }));
    void pumpRefresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshDbJobs();
    };
    const onRefreshSignal = () => {
      refreshDbJobs();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onRefreshSignal);
    window.addEventListener("pageshow", onRefreshSignal);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onRefreshSignal);
      window.removeEventListener("pageshow", onRefreshSignal);
    };
  }, [input.enabled, input.companyId, pumpRefresh, refreshDbJobs]);

  const dbJobsLoaded = isBoardCanonicalJobsLoaded(snapshot);

  useEffect(() => {
    if (!input.enabled || !input.companyId || !dbJobsLoaded) return;
    let cancelled = false;
    void fetch("/api/jobs/schedules?active=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((schedulesJson) => {
        if (cancelled) return;
        const rows = Array.isArray(schedulesJson?.schedules)
          ? schedulesJson.schedules
          : [];
        const next: Record<string, JobSchedule> = {};
        for (const row of rows) {
          if (row?.job_id) next[row.job_id] = row;
        }
        setR3fSchedulesByJobId(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [input.enabled, input.companyId, dbJobsLoaded]);

  useEffect(() => {
    if (!input.enabled || !input.companyId || !dbJobsLoaded) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- independent timezone hydrate */
    setR3fTimezoneLoadStatus("loading");
    /* eslint-enable react-hooks/set-state-in-effect */
    void fetch("/api/company/timezone", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        return parseCompanyTimezoneGetResult(res.ok, json);
      })
      .then((tzParsed) => {
        if (cancelled) return;
        if (tzParsed.status === "error") {
          setR3fTimezoneLoadStatus("error");
        } else {
          setR3fTimezoneLoadStatus("ready");
          setR3fTimezone(tzParsed.timezone);
        }
      })
      .catch(() => {
        if (!cancelled) setR3fTimezoneLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [input.enabled, input.companyId, dbJobsLoaded]);

  return {
    dbJobs: snapshot.jobs,
    dbJobsLoaded,
    dbJobsStatus: snapshot.status,
    dbJobsRefreshError: snapshot.refreshError,
    r3fSchedulesByJobId,
    r3fTimezone,
    r3fTimezoneLoadStatus,
    refreshDbJobs,
    invalidateDbJobs,
    setR3fSchedulesByJobId,
    setR3fTimezone,
    setR3fTimezoneLoadStatus,
  };
}
