"use client";

import { useEffect, useState } from "react";

export type PlacesSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

export type PlacesResolvedAddress = {
  formatted: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const DEBOUNCE_MS = 280;

/**
 * Quiet Places assist. When unavailable, stays idle — manual address continues.
 */
export function usePlacesAddressAssist(streetQuery: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(streetQuery);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(streetQuery), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [streetQuery]);

  const active = enabled && debounced.trim().length >= 3;

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    void fetch(`/api/places/autocomplete?q=${encodeURIComponent(debounced.trim())}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!res.ok || !json?.ok) {
          setSuggestions([]);
          setStatus("error");
          return;
        }
        setAvailable(Boolean(json.available));
        setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [active, debounced]);

  async function resolvePlace(placeId: string): Promise<PlacesResolvedAddress | null> {
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.address) return null;
      return json.address as PlacesResolvedAddress;
    } catch {
      return null;
    }
  }

  return {
    available,
    suggestions: available === false ? [] : suggestions,
    status: available === false ? "idle" : status,
    resolvePlace,
  };
}
