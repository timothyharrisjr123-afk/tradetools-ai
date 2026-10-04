"use client";

import { useCallback, useEffect, useState } from "react";
import { propertyAddressIsMatchable } from "@/app/lib/propertyAddressNormalize";
import type { PropertySearchCandidate } from "@/app/tools/roofing/JobPacketPropertyCandidates";

const DEBOUNCE_MS = 280;

export function useCompanyPropertySearch(
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
  },
  enabled: boolean
) {
  const [debounced, setDebounced] = useState(address);
  const [results, setResults] = useState<PropertySearchCandidate[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(address), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [address.line1, address.line2, address.city, address.state, address.zip]);

  const matchable = propertyAddressIsMatchable(debounced);
  const active = enabled && matchable;

  useEffect(() => {
    if (!active) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    const params = new URLSearchParams({
      line1: debounced.line1,
      line2: debounced.line2,
      city: debounced.city,
      state: debounced.state,
      zip: debounced.zip,
    });
    void fetch(`/api/properties/search?${params.toString()}`, {
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
        const rows = Array.isArray(json.properties) ? json.properties : [];
        setResults(
          rows.map((row: PropertySearchCandidate) => ({
            id: String(row.id),
            line1: row.line1 ?? null,
            line2: row.line2 ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
            zip: row.zip ?? null,
            formatted: String(row.formatted ?? ""),
            jobCount: typeof row.jobCount === "number" ? row.jobCount : undefined,
          }))
        );
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [
    active,
    debounced.line1,
    debounced.line2,
    debounced.city,
    debounced.state,
    debounced.zip,
    attempt,
  ]);

  return { results, status, active, retry };
}
