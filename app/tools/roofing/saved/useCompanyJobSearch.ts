"use client";

import { useEffect, useState } from "react";
import {
  JOB_SEARCH_DEBOUNCE_MS,
  jobSearchQueryIsActive,
  parseJobSearchApiPayload,
  type JobSearchResult,
} from "@/app/lib/jobSearch";

export type CompanyJobSearchStatus = "idle" | "loading" | "ready" | "error";

export function useCompanyJobSearch(query: string, enabled: boolean) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [status, setStatus] = useState<CompanyJobSearchStatus>("idle");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, JOB_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const active = enabled && jobSearchQueryIsActive(debouncedQuery);

  useEffect(() => {
    if (!active) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    void fetch(`/api/jobs/search?q=${encodeURIComponent(debouncedQuery.trim())}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!res.ok || !json?.ok) {
          setResults([]);
          setStatus("error");
          return;
        }
        setResults(parseJobSearchApiPayload(json));
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [active, debouncedQuery]);

  return {
    active,
    results,
    status,
    query: debouncedQuery,
  };
}
