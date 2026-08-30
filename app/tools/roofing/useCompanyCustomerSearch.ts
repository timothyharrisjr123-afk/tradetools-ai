"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  customerSearchQueryIsActive,
  parseCustomerSearchApiPayload,
  type CustomerSearchCandidate,
  type CustomerSearchQuery,
} from "@/app/lib/customerMatch";

export type CompanyCustomerSearchStatus = "idle" | "loading" | "ready" | "error";

export function useCompanyCustomerSearch(input: CustomerSearchQuery, enabled: boolean) {
  const [debounced, setDebounced] = useState(input);
  const [results, setResults] = useState<CustomerSearchCandidate[]>([]);
  const [status, setStatus] = useState<CompanyCustomerSearchStatus>("idle");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(input), CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input.name, input.email, input.phone, input.q]);

  const active = enabled && customerSearchQueryIsActive(debounced);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced.name?.trim()) params.set("name", debounced.name.trim());
    if (debounced.email?.trim()) params.set("email", debounced.email.trim());
    if (debounced.phone?.trim()) params.set("phone", debounced.phone.trim());
    if (debounced.q?.trim()) params.set("q", debounced.q.trim());
    return params.toString();
  }, [debounced.name, debounced.email, debounced.phone, debounced.q]);

  useEffect(() => {
    if (!active) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    void fetch(`/api/customers/search?${queryString}`, {
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
        setResults(parseCustomerSearchApiPayload(json));
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [active, queryString]);

  return { active, results, status };
}
