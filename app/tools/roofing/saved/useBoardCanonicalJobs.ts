/**
 * Canonical Jobs Board data layer — DB jobs, schedules, timezone with coalesced refresh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [dbJobs, setDbJobs] = useState<JobSummary[]>([]);
  const [dbJobsLoaded, setDbJobsLoaded] = useState(false);
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
  companyIdRef.current = input.companyId;

  const runDbJobsLoad = useCallback(async (generation: number) => {
    const cid = String(companyIdRef.current ?? "").trim();
    if (!cid) {
      if (isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        setDbJobs([]);
        setDbJobsLoaded(true);
      }
      return;
    }
    try {
      const jobs = await getJobsByCompany(cid);
      if (!isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        return;
      }
      setDbJobs(jobs);
      setDbJobsLoaded(true);
    } catch (err) {
      console.error("[useBoardCanonicalJobs] getJobsByCompany failed", err);
      if (!isCoalescedRefreshCurrent(refreshStateRef.current, generation)) {
        return;
      }
      setDbJobs([]);
      setDbJobsLoaded(true);
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
    if (!cid) {
      setDbJobs([]);
      setDbJobsLoaded(true);
      return;
    }

    setDbJobsLoaded(false);
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
    setR3fTimezoneLoadStatus("loading");
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
    dbJobs,
    dbJobsLoaded,
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
