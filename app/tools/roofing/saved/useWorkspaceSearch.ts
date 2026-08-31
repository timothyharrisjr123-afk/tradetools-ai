"use client";

import { useEffect, useState } from "react";
import {
  WORKSPACE_SEARCH_DEBOUNCE_MS,
  parseWorkspaceSearchApiPayload,
  workspaceSearchQueryIsActive,
  type WorkspaceSearchResult,
} from "@/app/lib/workspaceSearch";

export type WorkspaceSearchStatus = "idle" | "loading" | "ready" | "error";

export function useWorkspaceSearch(query: string, enabled: boolean) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [status, setStatus] = useState<WorkspaceSearchStatus>("idle");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, WORKSPACE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const active = enabled && workspaceSearchQueryIsActive(debouncedQuery);

  useEffect(() => {
    if (!active) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    void fetch(`/api/search?q=${encodeURIComponent(debouncedQuery.trim())}`, {
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
        setResults(parseWorkspaceSearchApiPayload(json));
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
