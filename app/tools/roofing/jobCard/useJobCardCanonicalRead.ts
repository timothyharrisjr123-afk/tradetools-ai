"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  matchingServerJobRecord,
  resolveTrustedJobCardSeed,
  shouldSkipClientCanonicalJobHydrate,
} from "@/app/lib/jobCardServerSeed";
import { shouldApplyJobCardRefreshResult } from "@/app/lib/jobCardRefreshGuard";
import {
  getJobById,
  isUuidLike,
} from "@/app/lib/jobStore";
import { ensureBrowserAuthSession } from "@/app/lib/supabaseClient";
import type { JobRecord } from "@/app/lib/jobTypes";

export type JobHydrateStatus = "idle" | "loading" | "ready" | "unavailable";

export type UseJobCardCanonicalReadInput = {
  entryMode: string;
  companyId?: string;
  serverJobRecord?: JobRecord | null;
  loadSavedId: string | null;
  isBoardOriginParam: boolean;
  jobCardBoardOrigin: boolean;
  jobParam: string | null;
  searchParams: ReadonlyURLSearchParams;
  isJobCardBoardContext: boolean;
  isRestoringRef: React.MutableRefObject<boolean>;
  loadAppliedRef: React.MutableRefObject<boolean>;
  hydrateJobDisplayFromRecord: (
    record: JobRecord,
    opts: { fillEmptyOnly: boolean }
  ) => void;
  setCurrentJobId: (jobId: string) => void;
  restoreTick: number;
  onRestoreRetry: () => void;
};

export function useJobCardCanonicalRead(input: UseJobCardCanonicalReadInput) {
  const initialSeed = resolveTrustedJobCardSeed({
    entryMode: input.entryMode,
    loadSavedId: input.loadSavedId,
    jobParam: input.jobParam,
    companyId: input.companyId,
    serverJobRecord: input.serverJobRecord,
  });

  const [hydratedJobRecord, setHydratedJobRecord] = useState<JobRecord | null>(
    initialSeed
  );
  const [jobHydrateStatus, setJobHydrateStatus] = useState<JobHydrateStatus>(
    initialSeed ? "ready" : "idle"
  );
  const jobHydratedRef = useRef<string | null>(initialSeed?.id ?? null);
  const jobHydrateInFlightRef = useRef<string | null>(null);
  const jobRefreshGenerationRef = useRef(0);
  const currentJobIdRef = useRef(input.jobParam);
  const currentCompanyIdRef = useRef(input.companyId);

  useEffect(() => {
    const jobId = input.searchParams.get("job");
    const nextJobId = String(input.jobParam ?? jobId ?? "").trim();
    if (currentJobIdRef.current && currentJobIdRef.current !== nextJobId) {
      jobRefreshGenerationRef.current += 1;
    }
    currentJobIdRef.current = nextJobId;
    currentCompanyIdRef.current = input.companyId;
    if (jobHydratedRef.current && jobHydratedRef.current !== jobId) {
      jobHydratedRef.current = null;
    }
    if (jobHydrateInFlightRef.current && jobHydrateInFlightRef.current !== jobId) {
      jobHydrateInFlightRef.current = null;
    }
  }, [input.searchParams, input.jobParam, input.companyId]);

  useEffect(() => {
    if (input.entryMode !== "job-card") return;

    const jobId = (input.jobParam ?? "").trim();
    if (!jobId || !isUuidLike(jobId)) return;

    const cid = (input.companyId ?? "").trim();
    if (!cid) return;

    const matchedSeed = resolveTrustedJobCardSeed({
      entryMode: input.entryMode,
      loadSavedId: input.loadSavedId,
      jobParam: jobId,
      companyId: cid,
      serverJobRecord: input.serverJobRecord,
    });

    if (matchedSeed) {
      if (jobHydratedRef.current !== jobId) {
        setHydratedJobRecord(matchedSeed);
        input.hydrateJobDisplayFromRecord(matchedSeed, { fillEmptyOnly: false });
        jobHydratedRef.current = jobId;
        input.setCurrentJobId(jobId);
      }
      setJobHydrateStatus("ready");
      return;
    }

    if (jobHydratedRef.current && jobHydratedRef.current !== jobId) {
      setHydratedJobRecord(null);
      jobHydratedRef.current = null;
      setJobHydrateStatus("loading");
    }
  }, [
    input.entryMode,
    input.jobParam,
    input.companyId,
    input.serverJobRecord,
    input.loadSavedId,
    input.hydrateJobDisplayFromRecord,
    input.setCurrentJobId,
  ]);

  useEffect(() => {
    if (input.entryMode !== "job-card") {
      setJobHydrateStatus("idle");
      return;
    }

    const jobId = input.searchParams.get("job");
    if (!jobId || !isUuidLike(jobId)) {
      setJobHydrateStatus("idle");
      return;
    }

    const cid = (input.companyId ?? "").trim();
    if (!cid) return;

    if (input.isRestoringRef.current) return;
    if (input.loadSavedId && !input.loadAppliedRef.current) return;

    const trustedSeed = matchingServerJobRecord(
      input.serverJobRecord,
      jobId,
      cid
    );
    const skipClientCanonicalHydrate = shouldSkipClientCanonicalJobHydrate({
      entryMode: input.entryMode,
      loadSavedId: input.loadSavedId,
      isBoardOriginParam: input.isBoardOriginParam,
      jobCardBoardOrigin: input.jobCardBoardOrigin,
      jobParam: jobId,
      companyId: cid,
      serverJobRecord: input.serverJobRecord,
    });

    if (skipClientCanonicalHydrate && trustedSeed) {
      if (jobHydratedRef.current !== jobId) {
        setHydratedJobRecord(trustedSeed);
        input.hydrateJobDisplayFromRecord(trustedSeed, { fillEmptyOnly: false });
        jobHydratedRef.current = jobId;
        input.setCurrentJobId(jobId);
      }
      setJobHydrateStatus("ready");
      return;
    }

    if (jobHydratedRef.current === jobId) {
      setJobHydrateStatus("ready");
      return;
    }
    if (jobHydrateInFlightRef.current === jobId) return;

    const fillEmptyOnly =
      input.isJobCardBoardContext &&
      (Boolean(input.loadSavedId) || Boolean(input.loadAppliedRef.current));

    jobHydrateInFlightRef.current = jobId;
    if (!trustedSeed) {
      setJobHydrateStatus("loading");
    }

    void (async () => {
      try {
        const sessionReady = await ensureBrowserAuthSession();
        if (jobHydrateInFlightRef.current !== jobId) return;
        if (!sessionReady) {
          const seedOnTimeout = matchingServerJobRecord(
            input.serverJobRecord,
            jobId,
            cid
          );
          if (seedOnTimeout) {
            if (jobHydratedRef.current !== jobId) {
              setHydratedJobRecord(seedOnTimeout);
              input.hydrateJobDisplayFromRecord(seedOnTimeout, {
                fillEmptyOnly: false,
              });
              jobHydratedRef.current = jobId;
              input.setCurrentJobId(jobId);
            }
            setJobHydrateStatus("ready");
            return;
          }
          console.warn(
            "[useJobCardCanonicalRead] browser session not ready",
            jobId
          );
          setJobHydrateStatus("loading");
          input.onRestoreRetry();
          return;
        }

        let job = await getJobById(jobId);
        for (let attempt = 0; !job && attempt < 3; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 250));
          if (jobHydrateInFlightRef.current !== jobId) return;
          job = await getJobById(jobId);
        }
        if (jobHydrateInFlightRef.current !== jobId) return;
        if (!job) {
          console.warn("[useJobCardCanonicalRead] job not found", jobId);
          setHydratedJobRecord(null);
          setJobHydrateStatus("unavailable");
          return;
        }
        if (String(job.company_id || "").trim() !== cid) {
          console.warn("[useJobCardCanonicalRead] company mismatch", {
            jobId,
            companyId: cid,
          });
          setHydratedJobRecord(null);
          setJobHydrateStatus("unavailable");
          return;
        }
        setHydratedJobRecord(job);
        input.hydrateJobDisplayFromRecord(job, { fillEmptyOnly });
        jobHydratedRef.current = jobId;
        input.setCurrentJobId(jobId);
        setJobHydrateStatus("ready");
      } catch (err) {
        console.warn("[useJobCardCanonicalRead] hydrate error:", err);
        const seedOnError = matchingServerJobRecord(
          input.serverJobRecord,
          jobId,
          cid
        );
        if (seedOnError) {
          setJobHydrateStatus("ready");
          return;
        }
        if (jobHydrateInFlightRef.current === jobId) {
          setJobHydrateStatus("loading");
        }
      } finally {
        if (jobHydrateInFlightRef.current === jobId) {
          jobHydrateInFlightRef.current = null;
        }
      }
    })();
  }, [
    input.entryMode,
    input.searchParams,
    input.companyId,
    input.serverJobRecord,
    input.loadSavedId,
    input.restoreTick,
    input.hydrateJobDisplayFromRecord,
    input.isJobCardBoardContext,
    input.isBoardOriginParam,
    input.jobCardBoardOrigin,
    input.isRestoringRef,
    input.loadAppliedRef,
    input.setCurrentJobId,
    input.onRestoreRetry,
  ]);

  const refreshHydratedJobRecord = useCallback(
    async (jobId: string) => {
      const requestedJobId = String(jobId ?? "").trim();
      const generation = ++jobRefreshGenerationRef.current;
      const refreshed = await getJobById(requestedJobId);
      if (
        !shouldApplyJobCardRefreshResult({
          requestedJobId,
          currentJobId: currentJobIdRef.current,
          currentCompanyId: currentCompanyIdRef.current,
          refreshGeneration: generation,
          currentGeneration: jobRefreshGenerationRef.current,
          record: refreshed,
        }) ||
        !refreshed
      ) {
        return null;
      }
      setHydratedJobRecord(refreshed);
      jobHydratedRef.current = requestedJobId;
      input.hydrateJobDisplayFromRecord(refreshed, { fillEmptyOnly: false });
      return refreshed;
    },
    [input.hydrateJobDisplayFromRecord]
  );

  return {
    hydratedJobRecord,
    setHydratedJobRecord,
    jobHydrateStatus,
    setJobHydrateStatus,
    jobHydratedRef,
    jobHydrateInFlightRef,
    refreshHydratedJobRecord,
  };
}
