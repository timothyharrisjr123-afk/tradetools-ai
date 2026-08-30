"use client";

import { useEffect, useRef, useState } from "react";

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

function newPlacesSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `places-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Quiet Places assist. When unavailable, stays idle — manual address continues.
 * One sessionToken covers autocomplete typing → Place Details selection (Places New billing).
 */
export function usePlacesAddressAssist(streetQuery: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(streetQuery);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const sessionTokenRef = useRef<string | null>(null);

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

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = newPlacesSessionToken();
    }

    const controller = new AbortController();
    setStatus("loading");

    const token = sessionTokenRef.current;
    const params = new URLSearchParams({ q: debounced.trim() });
    if (token) params.set("sessionToken", token);

    void fetch(`/api/places/autocomplete?${params.toString()}`, {
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
      const params = new URLSearchParams({ placeId });
      const token = sessionTokenRef.current;
      if (token) params.set("sessionToken", token);
      const res = await fetch(`/api/places/details?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      // End session after details (success or fail) so the next typing starts fresh.
      sessionTokenRef.current = null;
      if (!res.ok || !json?.ok || !json.address) return null;
      return json.address as PlacesResolvedAddress;
    } catch {
      sessionTokenRef.current = null;
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
